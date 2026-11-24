"""Key-free detection signals: global brand lookalikes, risky TLDs, free hosting, page facts, feeds."""

import pytest

from app.intel import feeds
from app.net.page import analyze_html
from app.pipeline.extract import parse_url
from app.pipeline.reputation import brand_in_path, global_lookalike, is_established, reputation_evidence


def ids(url, **kw):
    kw.setdefault("page", None)
    kw.setdefault("final", None)
    kw.setdefault("age_days", None)
    kw.setdefault("dns_exists", True)
    return {e.id.split(".", 1)[1]: e.status.value for e in reputation_evidence(parse_url(url), 0, **kw)}


@pytest.mark.parametrize("url,brand", [
    ("https://paypal-secure-login.com/x", "paypal"),
    ("https://paypa1.com", "paypal"),
    ("https://netfIix.com", "netflix"),
    ("https://linkedln.com", "linkedin"),
    ("https://netflix.xyz", "netflix"),
    ("https://coinbase-wallet.top/verify", "coinbase"),
    ("https://microsoft-account.pages.dev/login", "microsoft"),
    ("https://googledrive-docs.web.app", "google"),
])
def test_global_lookalikes_caught(url, brand):
    hit = global_lookalike(parse_url(url))
    assert hit and hit[0] == brand


@pytest.mark.parametrize("url", [
    "https://www.paypal.com/signin", "https://login.microsoftonline.com/", "https://amazon.ae",
    "https://applebees.com", "https://apple.stackexchange.com", "https://appleton.edu",
    "https://hotel-booking.com", "https://www.chase.com", "https://web.whatsapp.com",
])
def test_real_or_unrelated_sites_not_called_lookalikes(url):
    assert global_lookalike(parse_url(url)) is None


def test_established_list_bundled():
    assert is_established("google.com") and is_established("emiratesnbd.com")
    assert not is_established("pages.dev")  # free hosting platforms are excluded on purpose


def test_brand_in_path_on_unrelated_site():
    assert brand_in_path(parse_url("https://foo.com/paypal/signin")) == "paypal"
    assert brand_in_path(parse_url("https://foo.com/blog/paypal-review")) is None  # no login words


def test_free_host_and_ipfs():
    assert ids("https://cf-ipfs.com/ipfs/qm123")["free-host"] == "suspicious"
    plain = ids("https://myportfolio.github.io/")
    assert plain["free-host"] == "unverified" and "risky-tld" not in plain


def test_risky_tld_weak_alone_strong_with_lures():
    assert ids("https://myshop.store/")["risky-tld"] == "unverified"
    assert ids("https://account-verify.xyz/")["risky-tld"] == "suspicious"


def test_established_sites_skip_risky_tld():
    assert "risky-tld" not in ids("https://www.google.com/")


LOGIN_PAGE = """<html><head><title>Sign in to your Microsoft account</title></head><body>
<form action="https://collector.example.net/post.php"><input name=u><input type="password" name=p></form>
</body></html>"""


def test_page_brand_mismatch_and_offsite_form():
    page = analyze_html(LOGIN_PAGE, "https://secure-docs-share.com/", len(LOGIN_PAGE))
    assert page.has_password and page.external_form_hosts == ["collector.example.net"]
    got = ids("https://secure-docs-share.com/", page=page)
    assert got["page-brand"] == "suspicious" and got["form-offsite"] == "suspicious"


def test_page_brand_on_the_real_domain_is_fine():
    page = analyze_html(LOGIN_PAGE.replace("https://collector.example.net/post.php", "/login"),
                        "https://login.microsoftonline.com/", 100)
    assert "page-brand" not in ids("https://login.microsoftonline.com/", page=page)


def test_client_redirect_detected():
    body = '<meta http-equiv="refresh" content="0; url=https://evil-landing.top/x">'
    page = analyze_html(body, "https://innocent-start.com/", len(body))
    assert ids("https://innocent-start.com/", page=page)["client-redirect"] == "suspicious"


def test_dead_but_scam_shaped():
    assert ids("https://paypal-verify-account.com/", dns_exists=False)["dead-scam-shaped"] == "suspicious"
    assert "dead-scam-shaped" not in ids("https://myblog-site.com/", dns_exists=False)


def test_feed_lookup(tmp_path, monkeypatch):
    (tmp_path / "x.txt").write_text("https://bad.example.org/login\nhttps://evil.pages.dev/a\n", encoding="utf-8")
    monkeypatch.setattr(feeds, "FEED_DIR", tmp_path)
    feeds._reset()
    try:
        assert feeds.lookup("https://bad.example.org/login/", shared_host=False).state == "found"
        assert feeds.lookup("https://bad.example.org/other", shared_host=False).state == "found"  # host match
        # On a shared platform only the exact link counts, never the whole platform.
        assert feeds.lookup("https://evil.pages.dev/b", shared_host=True).state == "not_found"
        assert feeds.lookup("https://evil.pages.dev/a", shared_host=True).state == "found"
    finally:
        feeds._reset()


def test_feed_missing_is_not_clean(tmp_path, monkeypatch):
    monkeypatch.setattr(feeds, "FEED_DIR", tmp_path / "none")
    feeds._reset()
    try:
        assert feeds.lookup("https://x.com", shared_host=False).state == "missing"
    finally:
        feeds._reset()


def test_batch_endpoint_sorts_by_risk():
    from fastapi.testclient import TestClient

    from app.main import app

    c = TestClient(app)
    r = c.post("/api/investigate-batch", json={"urls": ["https://www.google.com/", "https://paypal-secure-login.xyz/verify",
                                                        "not a link at all ::"]})
    assert r.status_code == 200
    body = r.json()["items"]
    assert body[0]["url"].startswith("https://paypal-secure-login.xyz") and body[0]["verdict"] == "High Risk"
    assert any(i["error"] for i in body)
    assert r.json()["campaigns"] == []  # no network in tests, so no shared infrastructure to link
    assert c.post("/api/investigate-batch", json={"urls": ["https://a.com"] * 21}).status_code == 422


def test_machine_generated_names_on_free_hosts():
    from app.pipeline.reputation import machine_name

    assert machine_name("9o838-u7p-jrkd-4970f-26-10-2026-aa")
    assert machine_name("sp28ct11-dulvani-biz-vemzaro")
    assert not machine_name("my-cool-project") and not machine_name("username") and not machine_name("docs-v2")
    assert ids("https://9o838-u7p-jrkd-4970f-26-10-2026-aa.pages.dev/")["machine-name"] == "suspicious"


def test_brand_title_on_unrelated_site_without_a_static_form():
    from app.net.page import PageFacts

    assert ids("https://everythingturfpros.com/x", page=PageFacts(title="Log in to Docusign"))["page-title-brand"] == "suspicious"
    # Mentioning a brand is not imitating it.
    assert "page-title-brand" not in ids("https://somereviewblog.com/", page=PageFacts(title="Best PayPal alternatives in 2026"))
    # The brand's own site is fine.
    assert "page-title-brand" not in ids("https://www.docusign.com/", page=PageFacts(title="Log in to Docusign"))


@pytest.mark.parametrize("body", ["<script>" * 20000 + "x" * 100000, "<" * 250000, "<input " + "a" * 250000,
                                  ("<meta http-equiv=refresh " + "a" * 2000) * 120])
def test_hostile_pages_are_parsed_fast(body):
    # A scam page must never be able to freeze the server with crafted HTML.
    import time

    t = time.perf_counter()
    analyze_html(body[:262144], "https://x.com/", len(body))
    assert time.perf_counter() - t < 1.0
