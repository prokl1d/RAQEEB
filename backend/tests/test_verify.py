import pytest

from app.models import EvidenceStatus
from app.pipeline.extract import parse_url
from app.pipeline.verify import (
    IdentityOutcome,
    MatchKind,
    compare,
    detect_claimed_orgs,
    verify_identity,
)
from app.registry import load_registry


def org(org_id):
    return next(o for o in load_registry() if o.id == org_id)


def test_registry_loads_and_verified_entries_have_sources():
    orgs = load_registry()
    assert len(orgs) >= 20
    for o in orgs:
        if o.verification.status == "verified":
            assert o.is_verified, f"{o.id} marked verified without source/date"


def test_detect_claimed_orgs():
    found = {o.id for o in detect_claimed_orgs("Dear customer, Emirates NBD has blocked your card.")}
    assert found == {"emirates-nbd"}
    # short acronyms are case-sensitive whole words
    assert "dib" not in {o.id for o in detect_claimed_orgs("did you get it?")}
    assert "dewa" in {o.id for o in detect_claimed_orgs("Your DEWA bill is overdue")}


@pytest.mark.parametrize(
    "url,org_id,kind",
    [
        ("https://emiratesnbd.com/login", "emirates-nbd", MatchKind.exact),
        ("https://online.emiratesnbd.com", "emirates-nbd", MatchKind.exact),
        ("https://emiratesnbd-secure.co/pay", "emirates-nbd", MatchKind.brand_plus_words),
        ("https://emiratesnbd.com.verify-acc.xyz", "emirates-nbd", MatchKind.brand_in_subdomain),
        ("https://emiratesnbb.com", "emirates-nbd", MatchKind.typo),
        ("https://dewa.com/bill", "dewa", MatchKind.wrong_suffix),
        ("https://dewa-gov.ae/bill", "dewa", MatchKind.brand_plus_words),
        ("https://emiratesp0st.ae/track", "emirates-post", MatchKind.homoglyph),
        ("https://еmiratespost.ae/track", "emirates-post", MatchKind.homoglyph),  # Cyrillic 'е'
        ("https://google.com", "emirates-nbd", MatchKind.none),
    ],
)
def test_domain_comparison(url, org_id, kind):
    assert compare(parse_url(url), org(org_id)).kind == kind


def test_scenario_bank_impersonation():
    claimed = detect_claimed_orgs("Emirates NBD: your account is suspended")
    r = verify_identity(claimed, [parse_url("https://emiratesnbd-secure.co/verify")])
    assert r.outcome == IdentityOutcome.possible_impersonation
    assert any(e.status == EvidenceStatus.suspicious for e in r.evidence)


def test_scenario_delivery_unrelated_domain():
    claimed = detect_claimed_orgs("Emirates Post: parcel held, pay AED 4.50")
    r = verify_identity(claimed, [parse_url("https://parcel-release-center.top/pay")])
    assert r.outcome == IdentityOutcome.no_relationship


def test_scenario_legitimate_verified():
    claimed = detect_claimed_orgs("DEWA: view your bill")
    r = verify_identity(claimed, [parse_url("https://www.dewa.gov.ae/en/consumer/billing")])
    assert r.outcome == IdentityOutcome.verified_match
    assert any(e.status == EvidenceStatus.verified for e in r.evidence)


def test_unverified_registry_entry_never_gives_verified_match():
    claimed = detect_claimed_orgs("Emirates NBD statement")
    r = verify_identity(claimed, [parse_url("https://emiratesnbd.com/statement")])
    assert r.outcome == IdentityOutcome.unable
    assert all(e.status != EvidenceStatus.verified for e in r.evidence)


def test_lookalike_found_without_claim():
    r = verify_identity([], [parse_url("https://emiratespost-redelivery.com")])
    assert r.outcome == IdentityOutcome.possible_impersonation


def test_unknown_org_and_no_link():
    assert verify_identity([], [parse_url("https://example.com")]).outcome == IdentityOutcome.unable
    r = verify_identity(detect_claimed_orgs("Emirates Post here"), [])
    assert r.outcome == IdentityOutcome.unable
    assert r.evidence[0].status == EvidenceStatus.missing
