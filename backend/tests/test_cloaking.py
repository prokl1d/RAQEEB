"""Cloaking: phones and desktops shown different things."""

from app.net.page import PageFacts
from app.net.safe_fetch import FetchResult
from app.pipeline.cloaking import best_page, cloaking_evidence
from app.pipeline.extract import parse_url

U = parse_url("https://parcel-redelivery-ae.com/x")


def f(url, page=None):
    return FetchResult(final_url=url, page=page)


def test_desktop_sent_to_big_site_phone_kept_on_scam():
    ev = cloaking_evidence(U, 0, f("https://www.google.com/"), f("https://parcel-redelivery-ae.com/pay"))
    assert len(ev) == 1 and ev[0].id == "url0.cloaking" and ev[0].status.value == "suspicious"


def test_form_only_for_phones():
    ev = cloaking_evidence(U, 0, f("https://parcel-redelivery-ae.com/", PageFacts(title="Welcome")),
                           f("https://parcel-redelivery-ae.com/", PageFacts(title="Pay fee", asks_card=True)))
    assert ev and "phones" in ev[0].finding
    assert best_page(f("https://a.com/", PageFacts(title="x")), f("https://a.com/", PageFacts(title="y", has_password=True))).has_password


def test_mobile_subdomain_and_same_page_are_not_cloaking():
    assert cloaking_evidence(U, 0, f("https://www.example.com/"), f("https://m.example.com/")) == []
    assert cloaking_evidence(U, 0, f("https://parcel-redelivery-ae.com/"), f("https://parcel-redelivery-ae.com/")) == []
    # Phones sent to an app store (a big site) is normal behaviour, not cloaking.
    assert cloaking_evidence(U, 0, f("https://parcel-redelivery-ae.com/"), f("https://play.google.com/store")) == []
    assert cloaking_evidence(U, 0, None, f("https://x.com/")) == []
