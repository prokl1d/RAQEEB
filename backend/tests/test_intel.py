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
    v5_hit = {"threats": [{"url": "https://bad.example/", "threatTypes": ["SOCIAL_ENGINEERING"]}], "cacheDuration": "300s"}
    hit = await safe_browsing("https://bad.example", mock(200, v5_hit))
    assert hit.state == "found" and "SOCIAL_ENGINEERING" in hit.detail
    clean = await safe_browsing("https://ok.example", mock(200, {"cacheDuration": "300s"}))
    assert clean.state == "not_found" and "does not prove" in clean.detail
    assert (await safe_browsing("https://ok.example", mock(503))).state == "missing"
    denied = {"error": {"code": 403, "status": "PERMISSION_DENIED",
                        "details": [{"@type": "type.googleapis.com/google.rpc.ErrorInfo", "reason": "ACCESS_DENIED"}]}}
    r403 = await safe_browsing("https://ok.example", mock(403, denied))
    assert r403.state == "missing" and "HTTP 403, ACCESS_DENIED" in r403.detail


async def test_safe_browsing_uses_v5_and_keeps_key_out_of_url():
    settings.safe_browsing_api_key = "test-key"
    seen = {}

    def handler(request: httpx.Request):
        seen["method"], seen["url"], seen["key"] = request.method, str(request.url), request.headers.get("x-goog-api-key")
        return httpx.Response(200, json={"cacheDuration": "300s"})

    await safe_browsing("https://ok.example/a?b=1", httpx.MockTransport(handler))
    assert seen["method"] == "GET"
    assert seen["url"].startswith("https://safebrowsing.googleapis.com/v5/urls:search?urls=")
    assert "alt=json" in seen["url"]
    assert "test-key" not in seen["url"] and seen["key"] == "test-key"


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
