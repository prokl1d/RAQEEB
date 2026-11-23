"""Search Shield, call/situation checks (English + Arabic) and the business listing check."""

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.pipeline.arabic import normalize
from app.pipeline.content import analyze_content
from app.pipeline.listing import ListingInput, check_listing, demo_listings, phone_matches
from app.pipeline.shield import check_link, search_demo
from app.pipeline.verify import detect_claimed_orgs
from app.registry import load_registry

client = TestClient(app)


def rules(text):
    return {e.raw["rule"] for e in analyze_content(text)}


# ---------- Arabic + call rules ----------

def test_arabic_normalisation_keeps_length():
    s = "أإآ ى ة ٣٤٥"
    assert len(normalize(s)) == len(s)
    assert normalize(s) == "ااا ي ه 345"


@pytest.mark.parametrize("text,expected", [
    ("اتصل بي شخص وطلب رمز التحقق وقال لا تخبر احد وإلا سيتم إيقاف حسابك", {"otp", "secrecy", "threat"}),
    ("قالوا عليك قضية غسيل أموال ولازم تحوّل المبلغ لحساب آمن وأرسل صورة الهوية", {"authority", "transfer", "personal-id"}),
    ("ادفع 25 درهم رسوم التوصيل فورا", {"fee", "urgency"}),
    ("He asked me to install AnyDesk and transfer my money to a safe account. Don't tell anyone.",
     {"remote-app", "transfer", "secrecy"}),
    ("Pay with Google Play cards and stay on the line", {"gift-card", "secrecy"}),
    ("He told me not to hang up and not to tell anyone", {"secrecy"}),
])
def test_call_and_arabic_rules(text, expected):
    assert expected <= rules(text)


def test_harmless_texts_raise_nothing():
    assert rules("مرحبا، موعدنا غدا الساعة الخامسة في المقهى") == set()
    assert rules("Your DEWA bill for November is ready in the DEWA app.") == set()


def test_match_positions_point_at_original_text():
    text = "يرجى إرسال رمز التحقق الآن"
    e = next(e for e in analyze_content(text) if e.raw["rule"] == "otp")
    assert text[e.raw["start"]:e.raw["end"]] == e.raw["match"] == "رمز التحقق"


def test_arabic_organization_names_detected():
    assert {o.id for o in detect_claimed_orgs("اتصل بي موظف من بنك الإمارات دبي الوطني")} == {"emirates-nbd"}
    assert "ad-police" in {o.id for o in detect_claimed_orgs("رسالة من شرطة ابوظبي")}


def test_call_investigation_api_english():
    body = client.post("/api/investigate", json={"type": "call", "message": (
        "Someone called saying he is from Emirates NBD. He said my card is blocked and asked me to "
        "install AnyDesk and read him the OTP. He said don't tell anyone.")}).json()
    assert body["type"] == "call"
    assert body["score"]["band"] == "High Risk"
    call = body["call"]
    assert call["claimed"] == ["Emirates NBD"]
    assert {"remote-app", "otp"} <= set(call["asked_for"])
    assert {"secrecy", "threat"} <= set(call["pressure"])
    assert call["contacts"][0]["phones"] == ["600 54 0000"]
    finding = next(e["finding"] for e in body["evidence"] if e["id"] == "identity.no-link")
    assert "caller claimed" in finding


def test_call_investigation_api_arabic():
    body = client.post("/api/investigate", json={"type": "call", "message": (
        "اتصل بي شخص يقول إنه من شرطة أبوظبي وقال إن علي قضية غسيل أموال ويجب أن أحوّل المبلغ إلى حساب آمن")}).json()
    assert body["score"]["band"] == "High Risk"
    assert body["call"]["claimed"] == ["Abu Dhabi Police"]
    assert "transfer" in body["call"]["asked_for"]
    assert "authority" in body["call"]["pressure"]


def test_harmless_call_is_low_risk():
    body = client.post("/api/investigate", json={"type": "call", "message": (
        "A delivery driver called to ask which gate of the building to use.")}).json()
    assert body["score"]["band"] in ("Low Risk", "Unknown Risk")
    assert body["call"]["asked_for"] == []


def test_message_without_call_has_no_call_summary():
    body = client.post("/api/investigate", json={"type": "message", "message": "Hello there"}).json()
    assert body["call"] is None


# ---------- Search Shield ----------

@pytest.mark.parametrize("url,verdict,match", [
    ("https://www.dewa.gov.ae/en", "official", "exact"),
    ("https://www.emiratesnbd.com/en", "listed", "exact"),
    ("https://dewa.com/pay", "impersonation", "wrong-suffix"),
    ("https://emiratesnbd-online-login.com", "impersonation", "brand-plus-words"),
    ("https://emiratesnbd.help-desk-ae.com", "impersonation", "brand-in-subdomain"),
    ("https://emiratesnbb.com", "impersonation", "typo"),
    ("https://emiratesp0st.ae", "impersonation", "homoglyph"),
    ("https://abudhabipolice.gov.ae/en", "listed", "exact"),
])
def test_check_link_verdicts(url, verdict, match):
    c = check_link(url)
    assert (c.verdict, c.match) == (verdict, match)


def test_check_link_unknown_caution_invalid():
    assert check_link("trackmyparcel-uae.com").verdict == "unknown"
    caution = check_link("http://192.168.1.1/login")
    assert caution.verdict == "caution" and "ip" in caution.flags
    assert check_link("not a link").verdict == "invalid"


def test_search_demo_expected_badges():
    got = {r.url: r.check.verdict for q in search_demo().queries for r in q.results}
    assert got["https://www.dewa.gov.ae/en/consumer/billing"] == "official"
    assert got["https://www.emiratespost.ae/track"] == "official"
    assert got["https://dewa-quickpay.com/bill"] == "impersonation"
    assert got["https://emiratespost.ae.customs-pay.top/payment"] == "impersonation"
    assert got["https://trackmyparcel-uae.com"] == "unknown"
    # every sponsored sample result is a scam, and is caught
    for q in search_demo().queries:
        for r in q.results:
            if r.sponsored:
                assert r.check.verdict == "impersonation"


def test_check_links_api_limits():
    res = client.post("/api/check-links", json={"links": ["dewa.gov.ae", "dewa.com"]})
    assert res.status_code == 200
    assert [x["verdict"] for x in res.json()] == ["official", "impersonation"]
    assert client.post("/api/check-links", json={"links": []}).status_code == 422
    assert client.post("/api/check-links", json={"links": ["a.com"] * 26}).status_code == 422
    assert client.get("/api/search-demo").json()["sample"] is True


# ---------- business listings ----------

def test_phone_matching_formats():
    assert phone_matches("+971 600 54 0000", ["600 54 0000"])
    assert phone_matches("00971 4 601 9999", ["04 601 9999"])
    assert phone_matches("٦٠٠ ٥٤ ٠٠٠٠", ["600 54 0000"])  # Arabic-Indic digits
    assert not phone_matches("04 000 0148", ["600 54 0000"])


def test_demo_listings_three_scenarios():
    got = {d.id: check_listing(d.listing) for d in demo_listings()}
    assert got["real"].band == "likely_safe"
    assert got["fake"].band == "high" and got["fake"].score >= 50
    assert {c.key: c.status for c in got["fake"].checks}["phone"] == "bad"
    assert got["incomplete"].band == "needs_verification"


def test_listing_never_accuses_without_evidence():
    r = check_listing(ListingInput(name="Joe's Cafe", phone="04 123 4567", website="joecafe.ae"))
    assert r.band == "needs_verification"
    assert check_listing(ListingInput(name="Emirates NBD Branch")).band == "needs_verification"


def test_listing_api():
    res = client.post("/api/check-listing", json={"name": "DEWA Customer Care", "phone": "04 601 9999",
                                                   "website": "https://www.dewa.gov.ae"})
    assert res.status_code == 200 and res.json()["band"] == "likely_safe"
    assert client.post("/api/check-listing", json={"name": ""}).status_code == 422
    assert len(client.get("/api/listing-demo").json()) == 3


def test_registry_phones_have_sources():
    for o in load_registry():
        if o.phones:
            assert o.phone_source and o.phone_source.startswith("https://") and o.phone_checked
