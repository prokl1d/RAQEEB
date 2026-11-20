"""Shared investigation pipeline (reusable by a future browser extension).

Order (docs/PLAN.md section 5): validate -> extract -> URL structure -> technical checks and
threat intel -> identity verification (including redirect destinations) -> message rules ->
scoring -> AI explanation.
Everything runs in memory per request; nothing is stored.
"""

from __future__ import annotations

from pydantic import BaseModel

from app.ai.provider import AIResult, explain
from app.config import settings
from app.models import Evidence, InvestigationType
from app.pipeline.content import analyze_content
from app.pipeline.domains import analyze_url_structure
from app.pipeline.extract import ParsedUrl, extract_urls, validate_message, validate_url
from app.pipeline.technical import mode as check_mode, run_checks, to_evidence
from app.pipeline.scoring import ScoreResult, score_investigation
from app.pipeline.verify import IdentityOutcome, detect_claimed_orgs, verify_identity


class OrgRef(BaseModel):
    id: str
    name: str
    category: str
    official_domains: list[str]
    verified: bool


class UrlRef(BaseModel):
    url: str
    host: str
    registrable_domain: str
    final_url: str | None = None


class IdentitySummary(BaseModel):
    outcome: IdentityOutcome
    summary: str
    claimed: list[OrgRef]


class Disclosure(BaseModel):
    """Which outside services received what, for this investigation (shown to the user)."""
    service: str
    received: str


class InvestigationResult(BaseModel):
    type: InvestigationType
    check_mode: str  # live | fixture | disabled
    urls: list[UrlRef]
    identity: IdentitySummary
    evidence: list[Evidence]
    score: ScoreResult
    ai: AIResult
    disclosures: list[Disclosure]
    pending: list[str]


PENDING: list[str] = []


async def investigate(kind: InvestigationType, *, message: str | None = None, url: str | None = None) -> InvestigationResult:
    if kind == InvestigationType.url:
        parsed = [validate_url(url)]
        text = ""
    elif kind == InvestigationType.message:
        text = validate_message(message, settings.max_message_chars)
        parsed = extract_urls(text)
    else:
        raise NotImplementedError("Screenshot investigations arrive in Phase 6.")

    evidence: list[Evidence] = []
    for i, u in enumerate(parsed):
        evidence += analyze_url_structure(u, i)

    reports = await run_checks(parsed)
    for i, rep in enumerate(reports):
        evidence += to_evidence(rep, i)

    # Identity: the links as written, plus where they really lead.
    identity_urls: list[ParsedUrl] = list(parsed)
    for rep in reports:
        f = rep.final_url
        if f and f.registrable_domain and f.registrable_domain != rep.url.registrable_domain:
            identity_urls.append(f)
    claimed = detect_claimed_orgs(text) if text else []
    identity = verify_identity(claimed, identity_urls)
    evidence += identity.evidence

    if text:
        evidence += analyze_content(text)

    score = score_investigation(evidence, identity.outcome, has_urls=bool(parsed), has_text=bool(text),
                                claimed_any=bool(claimed))

    ai = await explain(text or (parsed[0].url if parsed else ""), evidence, identity.outcome.value, score.band.value)

    mode = check_mode()
    disclosures: list[Disclosure] = []
    if mode == "live" and parsed:
        disclosures.append(Disclosure(service="DNS, RDAP registries and the linked website",
                                      received="the domain names and links only"))
        if settings.safe_browsing_api_key:
            disclosures.append(Disclosure(service="Google Safe Browsing", received="the links"))
        if settings.virustotal_api_key:
            disclosures.append(Disclosure(service="VirusTotal (lookup only)", received="the links"))
    if ai.sent_to_external_ai:
        disclosures.append(Disclosure(service="Google Gemini (free tier; Google may review it)",
                                      received="the message text with personal details masked"))

    return InvestigationResult(
        type=kind,
        check_mode=mode,
        urls=[UrlRef(url=r.url.url, host=r.url.host, registrable_domain=r.url.registrable_domain,
                     final_url=r.final_url.url if r.final_url else None) for r in reports],
        identity=IdentitySummary(
            outcome=identity.outcome,
            summary=identity.summary,
            claimed=[OrgRef(id=o.id, name=o.name, category=o.category, official_domains=o.domains,
                            verified=o.is_verified) for o in claimed],
        ),
        evidence=evidence,
        score=score,
        ai=ai,
        disclosures=disclosures,
        pending=PENDING,
    )
