import httpx

from app.config import settings
from app.intel.clients import rdap_lookup, safe_browsing, virustotal, vt_url_id


def mock(status, json=None):
    return httpx.MockTransport(lambda req: httpx.Response(status, json=json))


async def test_unconfigured_services_are_missing_not_clean():
    assert (await safe_browsing("https://x.com")).state == "missing"
    assert (await virustotal("https://x.com")).state == "missing"


async def test_safe_browsing_match_and_no_match():
    settings.safe_browsing_api_key = "test-key"
    hit = await safe_browsing("https://bad.example", mock(200, {"matches": [{"threatType": "SOCIAL_ENGINEERING"}]}))
    assert hit.state == "found" and "SOCIAL_ENGINEERING" in hit.detail
    clean = await safe_browsing("https://ok.example", mock(200, {}))
    assert clean.state == "not_found" and "does not prove" in clean.detail
    down = await safe_browsing("https://ok.example", mock(503))
    assert down.state == "missing"


async def test_virustotal_states():
    settings.virustotal_api_key = "test-key"
    stats = {"data": {"attributes": {"last_analysis_stats": {"malicious": 5, "suspicious": 1, "harmless": 60, "undetected": 20}}}}
    found = await virustotal("https://bad.example", mock(200, stats))
    assert found.state == "found" and found.data["malicious"] == 5 and found.data["engines"] == 86
    assert (await virustotal("https://new.example", mock(404))).state == "not_found"
    assert (await virustotal("https://x.example", mock(429))).state == "missing"


def test_vt_url_id_has_no_padding():
    assert "=" not in vt_url_id("https://a.b/")


async def test_rdap_age_and_missing():
    body = {"events": [{"eventAction": "registration", "eventDate": "2020-01-15T00:00:00Z"}]}
    r = await rdap_lookup("example.com", mock(200, body))
    assert r.state == "found" and r.data["registered"] == "2020-01-15" and r.data["age_days"] > 365
    assert (await rdap_lookup("example.ae", mock(404))).state == "missing"
    assert (await rdap_lookup("example.ae", mock(200, {"events": []}))).state == "missing"
