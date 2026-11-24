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
from app.models import Category, Evidence, EvidenceStatus, InvestigationType
from app.pipeline.content import HIGH_IMPACT_RULES, PRESSURE_RULES, analyze_content
from app.pipeline.domains import analyze_url_structure
from app.pipeline.helpline import helpline_evidence
from app.pipeline.extract import ParsedUrl, extract_urls, validate_message, validate_url
from app.pipeline.cloaking import best_page, cloaking_evidence
from app.pipeline.page_capture import PageScreenshot, capture_and_match, worth_capturing
from app.pipeline.reputation import reputation_evidence
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


class OfficialContact(BaseModel):
    org_id: str
    org_name: str
    phones: list[str]
    domains: list[str]
    source: str | None  # where the phone numbers were taken from


class CallInsight(BaseModel):
    """Structured summary for a described call or situation (the website translates it)."""
    claimed: list[str]  # organization names the caller claimed to be
    asked_for: list[str]  # rule keys: otp, card, remote-app, transfer, ...
    pressure: list[str]  # rule keys: urgency, threat, secrecy, authority
    contacts: list[OfficialContact]  # how to reach the claimed organizations officially


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
    call: CallInsight | None = None
    screenshot: PageScreenshot | None = None


PENDING: list[str] = []


async def investigate(kind: InvestigationType, *, message: str | None = None, url: str | None = None) -> InvestigationResult:
    if kind == InvestigationType.url:
        parsed = [validate_url(url)]
        text = ""
    elif kind in (InvestigationType.message, InvestigationType.call):
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
        age = next((int(r.data["age_days"]) for r in rep.intel
                    if r.service.startswith("RDAP") and r.state == "found" and "age_days" in r.data), None)
        evidence += cloaking_evidence(rep.url, i, rep.fetch, rep.mobile)
        evidence += reputation_evidence(rep.url, i, page=best_page(rep.fetch, rep.mobile),
                                        final=rep.final_url, age_days=age,
                                        dns_exists=rep.dns.exists if rep.dns else None)
        if rep.final_url and rep.final_url.registrable_domain != rep.url.registrable_domain:
            # Where the link really lands gets the same offline checks (no page facts twice).
            evidence += [e for e in reputation_evidence(rep.final_url, i, page=None, final=None, age_days=None,
                                                        dns_exists=None)
                         if not e.id.endswith((".established", ".young"))
                         and e.id not in {x.id for x in evidence}]

    # A sandboxed screenshot (and visual brand match) of the first link that is worth it.
    screenshot = None
    for i, rep in enumerate(reports):
        final = rep.final_url or (rep.url if rep.fetch and rep.fetch.final_url else None)
        if rep.mode == "live" and rep.fetch and not rep.fetch.blocked and worth_capturing(final):
            screenshot, shot_ev = await capture_and_match(final, i)
            evidence += shot_ev
            break

    # Identity: the links as written, plus where they really lead.
    identity_urls: list[ParsedUrl] = list(parsed)
    for rep in reports:
        f = rep.final_url
        if f and f.registrable_domain and f.registrable_domain != rep.url.registrable_domain:
            identity_urls.append(f)
    claimed = detect_claimed_orgs(text) if text else []
    identity = verify_identity(claimed, identity_urls)
    if kind == InvestigationType.call and claimed and not parsed:
        # A phone call has no link to compare. Say so in call terms.
        for e in identity.evidence:
            if e.id == "identity.no-link":
                e.finding = (f"The caller claimed to be from {', '.join(o.name for o in claimed)}. "
                             "A phone call can't be verified from what the caller says.")
                e.why_it_matters = ("Caller ID can be faked. Hang up and call the organization back on its "
                                    "official number.")
    evidence += identity.evidence
    brand_ev = [e for e in evidence if e.category == Category.identity and e.status == EvidenceStatus.suspicious
                and e.id.split(".")[1].startswith(("brand", "page-brand", "visual"))]
    if brand_ev and identity.outcome != IdentityOutcome.verified_match:
        identity.outcome = IdentityOutcome.possible_impersonation
        identity.summary = "The link imitates a well-known brand: " + brand_ev[0].finding

    if text:
        evidence += analyze_content(text)
        evidence += helpline_evidence(text, claimed)

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

    call = None
    if kind == InvestigationType.call:
        rules = [e.raw.get("rule") for e in evidence if e.category.value == "content"]
        call = CallInsight(
            claimed=[o.name for o in claimed],
            asked_for=[r for r in rules if r in HIGH_IMPACT_RULES],
            pressure=[r for r in rules if r in PRESSURE_RULES],
            contacts=[OfficialContact(org_id=o.id, org_name=o.name, phones=o.phones, domains=o.domains,
                                      source=o.phone_source) for o in claimed],
        )

    return InvestigationResult(
        type=kind,
        call=call,
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
        screenshot=screenshot,
    )
