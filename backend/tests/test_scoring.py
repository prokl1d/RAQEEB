from app.config import settings
from app.models import Category, Evidence, EvidenceStatus, InvestigationType, RiskBand
from app.pipeline.investigate import investigate
from app.pipeline.scoring import score_investigation
from app.pipeline.verify import IdentityOutcome
from tests.test_pipeline_modes import BANK, DELIVERY, LEGIT

S = EvidenceStatus


def e(cat, status, eid="x", rule=None):
    return Evidence(id=eid, category=cat, finding="f", why_it_matters="w", status=status, source="s",
                    raw={"rule": rule} if rule else {})


def test_bands_and_weights():
    r = score_investigation([e(Category.url_domain, S.unverified, "url0.tls")], IdentityOutcome.verified_match,
                            has_urls=True, has_text=False, claimed_any=False)
    assert r.band in (RiskBand.likely_safe, RiskBand.low)
    assert sum(c.weight for c in r.categories) == 100


def test_confirmed_intel_override_to_75():
    ev = [e(Category.threat_intel, S.confirmed, "url0.sb")]
    r = score_investigation(ev, IdentityOutcome.verified_match, has_urls=True, has_text=False, claimed_any=False)
    assert r.score >= 75 and r.band == RiskBand.high
    assert r.overrides and r.contradictions  # official domain but flagged


def test_impersonation_override_to_50():
    r = score_investigation([e(Category.threat_intel, S.unverified, "url0.sb")], IdentityOutcome.possible_impersonation,
                            has_urls=True, has_text=False, claimed_any=False)
    assert r.score >= 50 and r.band == RiskBand.high


def test_missing_checks_never_lower_risk_and_low_coverage_is_unknown():
    ev = [e(Category.threat_intel, S.missing, "url0.sb"), e(Category.url_domain, S.missing, "url0.age")]
    r = score_investigation(ev, IdentityOutcome.unable, has_urls=True, has_text=False, claimed_any=False)
    tic = next(c for c in r.categories if c.category == Category.threat_intel)
    assert not tic.covered and tic.risk is None
    assert r.band == RiskBand.unknown and r.low_confidence  # no traces of the site itself


def test_suspicious_language_alone_is_not_high():
    ev = [e(Category.content, S.suspicious, "content.urgency", "urgency")]
    r = score_investigation(ev, IdentityOutcome.unable, has_urls=False, has_text=True, claimed_any=False)
    assert r.band in (RiskBand.low, RiskBand.moderate, RiskBand.unknown)


def test_message_without_link_asking_for_otp():
    ev = [e(Category.content, S.suspicious, "content.otp", "otp"),
          e(Category.content, S.suspicious, "content.urgency", "urgency")]
    r = score_investigation(ev, IdentityOutcome.unable, has_urls=False, has_text=True, claimed_any=True)
    assert r.coverage >= 40
    assert r.band == RiskBand.high


async def test_demo_scenarios_end_to_end():
    settings.offline_demo = True
    bank = await investigate(InvestigationType.message, message=BANK)
    assert bank.score.band == RiskBand.high and bank.score.score >= 75

    delivery = await investigate(InvestigationType.message, message=DELIVERY)
    assert delivery.score.band == RiskBand.high

    legit = await investigate(InvestigationType.message, message=LEGIT)
    assert legit.score.band == RiskBand.likely_safe
    assert legit.score.score > 0  # never "zero risk": no 100% safe claim
    assert legit.identity.outcome == IdentityOutcome.verified_match


def test_verified_official_domain_is_likely_safe_even_if_intel_fails():
    # Official domain, but Safe Browsing rejected the key and VirusTotal isn't configured.
    ev = [e(Category.threat_intel, S.missing, "url0.sb"), e(Category.threat_intel, S.missing, "url0.vt"),
          e(Category.identity, S.verified, "identity.dewa.domain")]
    r = score_investigation(ev, IdentityOutcome.verified_match, has_urls=True, has_text=False, claimed_any=False)
    assert r.band == RiskBand.likely_safe
    assert any("Threat-intelligence checks were unavailable" in o for o in r.overrides)


def dns(exists):
    return Evidence(id="url0.dns", category=Category.url_domain, finding="f", why_it_matters="w",
                    status=S.unverified, source="DNS", raw={"dns_exists": exists})


def test_failed_intel_with_real_site_traces_is_low_not_unknown():
    tls = e(Category.url_domain, S.unverified, "url0.tls")
    ev = [dns(True), tls, e(Category.threat_intel, S.missing, "url0.sb")]
    r = score_investigation(ev, IdentityOutcome.unable, has_urls=True, has_text=False, claimed_any=False)
    assert r.band == RiskBand.low
    assert any("Threat-intelligence checks were unavailable" in o for o in r.overrides)


def test_old_domain_valid_tls_and_clean_intel_is_likely_safe():
    age = Evidence(id="url0.age", category=Category.url_domain, finding="f", why_it_matters="w",
                   status=S.unverified, source="RDAP", raw={"age_days": 3000})
    ev = [dns(True), e(Category.url_domain, S.unverified, "url0.tls"), age,
          e(Category.threat_intel, S.unverified, "url0.sb")]
    r = score_investigation(ev, IdentityOutcome.unable, has_urls=True, has_text=False, claimed_any=False)
    assert r.band == RiskBand.likely_safe


def test_nonexistent_domain_is_inactive_link():
    ev = [dns(False), e(Category.threat_intel, S.unverified, "url0.sb")]
    r = score_investigation(ev, IdentityOutcome.unable, has_urls=True, has_text=False, claimed_any=False)
    assert r.band == RiskBand.inactive


def test_nonexistent_lookalike_domain_is_still_high():
    ev = [dns(False), e(Category.identity, S.suspicious, "identity.x")]
    r = score_investigation(ev, IdentityOutcome.possible_impersonation, has_urls=True, has_text=False, claimed_any=True)
    assert r.band == RiskBand.high


def test_no_traces_at_all_is_unknown():
    ev = [e(Category.threat_intel, S.missing, "url0.intel-missing"), e(Category.url_domain, S.missing, "url0.tech-missing")]
    r = score_investigation(ev, IdentityOutcome.unable, has_urls=True, has_text=False, claimed_any=False)
    assert r.band == RiskBand.unknown


def test_failed_threat_intel_does_not_hide_high_risk():
    ev = [e(Category.threat_intel, S.missing, "url0.sb")]
    r = score_investigation(ev, IdentityOutcome.possible_impersonation, has_urls=True, has_text=False, claimed_any=False)
    assert r.band == RiskBand.high


async def test_safe_browsing_403_on_official_domain_end_to_end():
    import httpx
    import app.intel.clients as clients

    settings.network_checks = True
    settings.safe_browsing_api_key = "test-key"
    from app.pipeline import technical
    from app.intel.clients import IntelResult

    async def fake_live(u):
        rep = technical.TechReport(u, "live")
        rep.intel = [await clients.safe_browsing(u.url, httpx.MockTransport(lambda r: httpx.Response(403))),
                     IntelResult("VirusTotal", "missing", "not configured (no API key)")]
        return rep

    original = technical._live
    technical._live = fake_live
    try:
        r = await investigate(InvestigationType.url, url="https://www.dewa.gov.ae/en")
    finally:
        technical._live = original
    assert r.identity.outcome == IdentityOutcome.verified_match
    sb = next(x for x in r.evidence if x.id.endswith(".sb"))
    assert sb.status == S.missing  # the 403 itself is never treated as clean
    assert r.score.band == RiskBand.likely_safe  # verdict rests on the verified official domain
    assert any("unavailable" in o for o in r.score.overrides)


async def test_unknown_site_without_network_is_unknown_risk():
    r = await investigate(InvestigationType.url, url="https://example.com")
    assert r.score.band == RiskBand.unknown


def test_invalid_certificate_is_at_least_moderate():
    ev = [dns(True), e(Category.url_domain, S.suspicious, "url0.tls"), e(Category.threat_intel, S.unverified, "url0.sb")]
    r = score_investigation(ev, IdentityOutcome.unable, has_urls=True, has_text=False, claimed_any=False)
    assert r.band == RiskBand.moderate and r.score >= 30
