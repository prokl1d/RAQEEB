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
    assert r.band == RiskBand.unknown or r.band == RiskBand.low
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
    assert r.coverage < 40 and r.band == RiskBand.unknown and r.low_confidence


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
    assert legit.score.band == RiskBand.low
    assert legit.score.score > 0  # never "zero risk": no 100% safe claim
    assert legit.identity.outcome == IdentityOutcome.verified_match


async def test_unknown_site_without_network_is_unknown_risk():
    r = await investigate(InvestigationType.url, url="https://example.com")
    assert r.score.band == RiskBand.unknown
