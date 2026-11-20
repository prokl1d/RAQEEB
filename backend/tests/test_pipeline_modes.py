from app.config import settings
from app.models import EvidenceStatus, InvestigationType
from app.pipeline.investigate import investigate
from app.pipeline.verify import IdentityOutcome

BANK = ("URGENT: Emirates NBD has suspended your card. Verify within 24 hours at "
        "https://emiratesnbd-secure.co/verify")
DELIVERY = ("Emirates Post: your parcel is on hold. Pay the AED 4.50 redelivery fee at "
            "https://emiratespost-redelivery.com/pay")
LEGIT = "DEWA: your bill is ready. View it at https://www.dewa.gov.ae/en/consumer/billing"


async def test_disabled_mode_reports_missing_not_clean():
    r = await investigate(InvestigationType.message, message=BANK)
    assert r.check_mode == "disabled"
    missing = [e for e in r.evidence if e.status == EvidenceStatus.missing]
    assert any(e.category.value == "threat_intel" for e in missing)
    assert r.disclosures == []


async def test_fixture_bank_scenario():
    settings.offline_demo = True
    r = await investigate(InvestigationType.message, message=BANK)
    assert r.check_mode == "fixture"
    assert r.identity.outcome == IdentityOutcome.possible_impersonation
    confirmed = [e for e in r.evidence if e.status == EvidenceStatus.confirmed]
    assert confirmed and all("demo fixture" in e.source for e in confirmed)
    assert any(e.id.endswith("redirect-offsite") for e in r.evidence)
    assert any(e.id.endswith(".age") and e.status == EvidenceStatus.suspicious for e in r.evidence)


async def test_fixture_delivery_scenario_no_intel_hit_is_not_clean():
    settings.offline_demo = True
    r = await investigate(InvestigationType.message, message=DELIVERY)
    assert r.identity.outcome == IdentityOutcome.possible_impersonation
    sb = next(e for e in r.evidence if e.id.endswith(".sb"))
    assert sb.status == EvidenceStatus.unverified  # "not listed" is weak, never "verified safe"


async def test_fixture_legit_scenario():
    settings.offline_demo = True
    r = await investigate(InvestigationType.message, message=LEGIT)
    assert r.identity.outcome == IdentityOutcome.verified_match
    assert not [e for e in r.evidence if e.status == EvidenceStatus.confirmed]
    assert any(e.id.endswith(".age") and e.status == EvidenceStatus.missing for e in r.evidence)


async def test_unknown_domain_in_fixture_mode_is_missing():
    settings.offline_demo = True
    r = await investigate(InvestigationType.url, url="https://some-other-site.com")
    assert any(e.id.endswith("intel-missing") for e in r.evidence)
