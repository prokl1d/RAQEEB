import pytest

from app.pipeline.extract import InputError, extract_urls, parse_url, refang, validate_message, validate_url


def hosts(text):
    return [u.host for u in extract_urls(text)]


def test_scheme_and_bare_urls():
    text = "Pay now at https://emiratesnbd-secure.co/pay or visit www.dewa.gov.ae/en today."
    assert hosts(text) == ["emiratesnbd-secure.co", "www.dewa.gov.ae"]


def test_defanged_urls_are_refanged():
    assert refang("hxxps://evil[.]com/x") == "https://evil.com/x"
    assert hosts("go to hxxp://bad(.)example[.]com now") == ["bad.example.com"]


def test_emails_and_non_domains_are_not_links():
    text = "Write to customer.care@emiratespost.ae, e.g. by email. See file report.pdf"
    assert hosts(text) == []


def test_no_url_message():
    assert extract_urls("Your parcel is waiting. Call us back.") == []


def test_multiple_urls_deduplicated():
    text = "https://a-pay.com/x and again https://a-pay.com/x then bit.ly/abc"
    assert hosts(text) == ["a-pay.com", "bit.ly"]


def test_trailing_punctuation_stripped():
    assert extract_urls("Visit (https://rta.ae/fines).")[0].path == "/fines"


def test_registrable_domain_and_subdomain():
    u = parse_url("https://secure.login.emiratesnbd.com.verify-acc.xyz/a")
    assert u.registrable_domain == "verify-acc.xyz"
    assert u.subdomain == "secure.login.emiratesnbd.com"


def test_punycode_decoded():
    import idna

    lookalike = "еmiratesnbd.com"  # Cyrillic 'е' instead of Latin 'e'
    ascii_form = idna.encode(lookalike).decode()
    u = parse_url("https://" + ascii_form)
    assert u.host_ascii.startswith("xn--")
    assert u.host == lookalike


def test_ip_and_userinfo():
    u = parse_url("http://user@192.168.1.10:8080/login")
    assert u.is_ip and u.has_userinfo and u.port == 8080


@pytest.mark.parametrize("bad", ["", "   ", "javascript:alert(1)", "ftp://x.com", "http://", "http://[::1"])
def test_invalid_urls_rejected(bad):
    with pytest.raises(InputError):
        validate_url(bad)


def test_unknown_suffix_rejected_for_url_input():
    with pytest.raises(InputError):
        validate_url("http://intranet.localdomain")


def test_message_validation():
    with pytest.raises(InputError):
        validate_message("   ", 100)
    with pytest.raises(InputError):
        validate_message("x" * 101, 100)
    assert validate_message("hi\x00 there", 100) == "hi there"
