"""Step 12: deterministic weighted risk scoring. See docs/PLAN.md section 10.

- Each category gives a risk value 0-100 plus whether it is applicable and covered
  (covered = real evidence exists; failed or missing checks never count).
- coverage = covered weight / applicable weight. Below the threshold -> Unknown Risk.
- score = weighted average over covered categories, then overrides:
    confirmed malicious threat intel   -> score >= 75
    Possible Impersonation             -> score >= 50
- A Verified Match lowers identity risk only; it never makes the result "safe" by itself.
The AI is not involved in any of this.
"""

from __future__ import annotations

from pydantic import BaseModel

from app.config import settings
from app.models import Category, Evidence, EvidenceStatus, RiskBand
from app.pipeline.verify import IdentityOutcome

S = EvidenceStatus

IDENTITY_RISK = {
    IdentityOutcome.possible_impersonation: 95,
    IdentityOutcome.no_relationship: 80,
    IdentityOutcome.verified_match: 0,
}
HIGH_IMPACT_CONTENT = {"otp", "card", "credentials", "fee"}


class CategoryScore(BaseModel):
    category: Category
    label: str
    weight: int
    applicable: bool
    covered: bool
    risk: int | None  # 0-100, None if not covered
    contribution: float  # points added to the final score
    reason: str


class ScoreResult(BaseModel):
    score: int
    band: RiskBand
    coverage: int  # 0-100
    low_confidence: bool
    categories: list[CategoryScore]
    overrides: list[str]
    contradictions: list[str]


LABELS = {
    Category.threat_intel: "Threat intelligence",
    Category.identity: "Organization identity",
    Category.url_domain: "Domain and URL",
    Category.content: "Message content",
    Category.context: "Context",
}


def _band(score: int) -> RiskBand:
    if score >= 50:
        return RiskBand.high
    if score >= 25:
        return RiskBand.moderate
    return RiskBand.low


def score_investigation(
    evidence: list[Evidence],
    outcome: IdentityOutcome,
    *,
    has_urls: bool,
    has_text: bool,
    claimed_any: bool,
) -> ScoreResult:
    w = settings.weights
    weights = {Category.threat_intel: w.threat_intel, Category.identity: w.identity,
               Category.url_domain: w.url_domain, Category.content: w.content, Category.context: w.context}
    by_cat: dict[Category, list[Evidence]] = {c: [] for c in Category}
    for e in evidence:
        by_cat[e.category].append(e)

    results: dict[Category, tuple[bool, bool, int | None, str]] = {}

    # Threat intelligence
    ti = [e for e in by_cat[Category.threat_intel] if e.status != S.missing]
    if not has_urls:
        results[Category.threat_intel] = (False, False, None, "No link to check.")
    elif not ti:
        results[Category.threat_intel] = (True, False, None, "Threat-intelligence checks did not run or failed.")
    elif any(e.status == S.confirmed for e in ti):
        results[Category.threat_intel] = (True, True, 100, "A security service has flagged this link as malicious.")
    elif any(e.status == S.suspicious for e in ti):
        results[Category.threat_intel] = (True, True, 70, "A few security vendors flagged this link.")
    else:
        results[Category.threat_intel] = (True, True, 15,
                                          "Not listed by the services checked. That is a weak signal: new scam links are often not listed yet.")

    # Identity
    if outcome in IDENTITY_RISK:
        reason = {IdentityOutcome.possible_impersonation: "The link imitates a known organization's domain.",
                  IdentityOutcome.no_relationship: "The link is not an official domain of the organization named.",
                  IdentityOutcome.verified_match: "The link is an official domain of the organization (verified source)."}[outcome]
        results[Category.identity] = (True, True, IDENTITY_RISK[outcome], reason)
    else:
        results[Category.identity] = (True, False, None, "Identity could not be verified.")

    # Domain and URL
    if not has_urls:
        results[Category.url_domain] = (False, False, None, "No link to check.")
    else:
        ud = [e for e in by_cat[Category.url_domain] if e.status != S.missing]
        sus = sum(1 for e in ud if e.status == S.suspicious)
        weak = sum(1 for e in ud if e.status == S.unverified and not e.id.endswith((".tls", ".age")))
        risk = min(100, sus * 30 + weak * 8)
        reason = (f"{sus} suspicious and {weak} weak indicator(s) in the link." if sus or weak
                  else "No structural or technical warning signs in the link.")
        results[Category.url_domain] = (True, True, risk, reason)

    # Message content
    if not has_text:
        results[Category.content] = (False, False, None, "No message text.")
    else:
        rules = {e.raw.get("rule") for e in by_cat[Category.content] if e.status == S.suspicious}
        n, high = len(rules), len(rules & HIGH_IMPACT_CONTENT)
        risk = 0 if n == 0 else min(100, 25 + 15 * (n - 1) + 15 * high)
        reason = (f"{n} red flag(s) in the wording" + (f", {high} asking for codes, card details, passwords or money" if high else "") + "."
                  if n else "No red-flag wording found. Wording alone never proves a message is safe.")
        results[Category.content] = (True, True, risk, reason)

    # Context: how the pieces fit together
    ctx_sus = [e for e in by_cat[Category.context] if e.status in (S.suspicious, S.confirmed)]
    content_rules = {e.raw.get("rule") for e in by_cat[Category.content] if e.status == S.suspicious}
    if not (has_urls or has_text):
        results[Category.context] = (False, False, None, "Nothing to compare.")
    else:
        risk, reasons = 0, []
        if ctx_sus:
            risk = max(risk, 80)
            reasons.append("the link redirects somewhere other than it appears")
        if claimed_any and outcome in (IdentityOutcome.possible_impersonation, IdentityOutcome.no_relationship) \
                and content_rules & HIGH_IMPACT_CONTENT:
            risk = max(risk, 90)
            reasons.append("it names an organization, links elsewhere and asks for money or sensitive details")
        elif claimed_any and not has_urls and content_rules & HIGH_IMPACT_CONTENT:
            risk = max(risk, 70)
            reasons.append("it names an organization and asks for money or sensitive details")
        results[Category.context] = (True, True, risk,
                                     ("Context: " + "; ".join(reasons) + ".") if reasons else "Nothing unusual in how the pieces fit together.")

    applicable_w = sum(weights[c] for c, r in results.items() if r[0])
    covered_w = sum(weights[c] for c, r in results.items() if r[0] and r[1])
    coverage = round(100 * covered_w / applicable_w) if applicable_w else 0
    raw = (sum(weights[c] * r[2] for c, r in results.items() if r[0] and r[1]) / covered_w) if covered_w else 0.0

    overrides: list[str] = []
    score = raw
    if results[Category.threat_intel][2] == 100 and score < 75:
        score = 75
        overrides.append("Raised to at least 75 because a security service confirmed the link as malicious.")
    if outcome == IdentityOutcome.possible_impersonation and score < 50:
        score = 50
        overrides.append("Raised to at least 50 because the link imitates a known organization.")
    score_i = round(score)

    contradictions = []
    if outcome == IdentityOutcome.verified_match:
        if results[Category.threat_intel][2] == 100:
            contradictions.append("The domain is official, but a security service flags this exact link. The site may be compromised.")
        if ctx_sus:
            contradictions.append("The link starts on an official domain but redirects somewhere else.")

    categories = []
    for c in Category:
        app_, cov, risk, reason = results[c]
        contrib = round(weights[c] * risk / covered_w, 1) if (app_ and cov and covered_w) else 0.0
        categories.append(CategoryScore(category=c, label=LABELS[c], weight=weights[c], applicable=app_,
                                        covered=cov, risk=risk, contribution=contrib, reason=reason))

    low_conf = coverage < settings.min_coverage_for_verdict
    band = RiskBand.unknown if low_conf else _band(score_i)
    ti_applicable, ti_covered = results[Category.threat_intel][0], results[Category.threat_intel][1]
    if band == RiskBand.low and ti_applicable and not ti_covered:
        # Never call a link low risk when threat-intel checks failed or didn't run.
        band, low_conf = RiskBand.unknown, True
        overrides.append("Shown as Unknown Risk: threat-intelligence checks did not run, so RAQEEB will not call this link low risk.")
    return ScoreResult(score=score_i, band=band, coverage=coverage, low_confidence=low_conf,
                       categories=categories, overrides=overrides, contradictions=contradictions)
