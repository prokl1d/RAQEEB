"""Shared investigation pipeline (reusable by a future browser extension).

Phase 3 runs the offline, deterministic steps. Later phases add network checks,
threat intelligence, AI explanation and scoring at the marked points.
"""

from __future__ import annotations

from pydantic import BaseModel

from app.config import settings
from app.models import Evidence, InvestigationType
from app.pipeline.content import analyze_content
from app.pipeline.domains import analyze_url_structure
from app.pipeline.extract import extract_urls, validate_message, validate_url
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


class IdentitySummary(BaseModel):
    outcome: IdentityOutcome
    summary: str
    claimed: list[OrgRef]


class InvestigationResult(BaseModel):
    type: InvestigationType
    urls: list[UrlRef]
    identity: IdentitySummary
    evidence: list[Evidence]
    pending: list[str]  # pipeline steps not implemented yet (shown honestly in the UI)


PENDING = [
    "Network checks (DNS, TLS, domain age, redirects)",
    "Threat intelligence (Safe Browsing, VirusTotal)",
    "AI explanation",
    "Risk score",
]


def investigate(kind: InvestigationType, *, message: str | None = None, url: str | None = None) -> InvestigationResult:
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

    claimed = detect_claimed_orgs(text) if text else []
    identity = verify_identity(claimed, parsed)
    evidence += identity.evidence

    if text:
        evidence += analyze_content(text)

    return InvestigationResult(
        type=kind,
        urls=[UrlRef(url=u.url, host=u.host, registrable_domain=u.registrable_domain) for u in parsed],
        identity=IdentitySummary(
            outcome=identity.outcome,
            summary=identity.summary,
            claimed=[OrgRef(id=o.id, name=o.name, category=o.category, official_domains=o.domains,
                            verified=o.is_verified) for o in claimed],
        ),
        evidence=evidence,
        pending=PENDING,
    )
