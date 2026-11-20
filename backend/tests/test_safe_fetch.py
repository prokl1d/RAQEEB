import httpx
import pytest

from app.net.safe_fetch import BlockedDestination, is_public_ip, resolve_public, safe_fetch
from app.pipeline.extract import parse_url


@pytest.mark.parametrize("ip,public", [
    ("8.8.8.8", True),
    ("127.0.0.1", False),
    ("10.0.0.5", False),
    ("172.16.3.4", False),
    ("192.168.1.1", False),
    ("169.254.169.254", False),  # cloud metadata
    ("100.64.0.1", False),  # carrier-grade NAT
    ("0.0.0.0", False),
    ("::1", False),
    ("fe80::1", False),
    ("fc00::1", False),
    ("::ffff:127.0.0.1", False),  # IPv4-mapped loopback
    ("224.0.0.1", False),
    ("2606:4700:4700::1111", True),
])
def test_is_public_ip(ip, public):
    assert is_public_ip(ip) is public


@pytest.mark.parametrize("url", [
    "http://127.0.0.1/admin",
    "http://[::1]/",
    "http://169.254.169.254/latest/meta-data/",
    "http://10.0.0.5:8080/",
])
async def test_private_ip_literals_blocked(url):
    res = await safe_fetch(parse_url(url))
    assert res.blocked and res.final_url is None


@pytest.mark.parametrize("url", ["http://2130706433/", "http://0x7f.1/", "http://0x7f000001/"])
async def test_disguised_ip_tricks_blocked(url):
    # All of these mean 127.0.0.1.
    res = await safe_fetch(parse_url(url))
    assert res.blocked


def fake_resolver(table):
    async def resolve(host, port):
        return table[host]
    return resolve


async def test_rebinding_style_mixed_answers_blocked():
    with pytest.raises(BlockedDestination):
        await resolve_public("evil.test", 80, fake_resolver({"evil.test": ["93.184.216.34", "127.0.0.1"]}))


async def test_redirect_to_private_address_blocked():
    def handler(request: httpx.Request):
        return httpx.Response(302, headers={"Location": "http://169.254.169.254/latest"})

    res = await safe_fetch(parse_url("https://example.com/start"),
                           resolver=fake_resolver({"example.com": ["93.184.216.34"]}),
                           transport=httpx.MockTransport(handler))
    assert res.blocked
    assert res.hops[0].status == 302


async def test_redirect_chain_followed_and_body_not_needed():
    seen = []

    def handler(request: httpx.Request):
        seen.append((request.url.host, request.headers["host"]))
        if request.headers["host"] == "a.example":
            return httpx.Response(301, headers={"Location": "https://b.example/final"})
        return httpx.Response(200, text="<script>alert(1)</script>")

    res = await safe_fetch(parse_url("https://a.example/x"),
                           resolver=fake_resolver({"a.example": ["93.184.216.34"], "b.example": ["93.184.216.35"]}),
                           transport=httpx.MockTransport(handler))
    assert res.final_url == "https://b.example/final"
    # connects to the validated IP, sends the real Host header
    assert seen == [("93.184.216.34", "a.example"), ("93.184.216.35", "b.example")]


async def test_too_many_redirects():
    def handler(request):
        return httpx.Response(302, headers={"Location": "https://loop.example/again"})

    res = await safe_fetch(parse_url("https://loop.example/"),
                           resolver=fake_resolver({"loop.example": ["93.184.216.34"]}),
                           transport=httpx.MockTransport(handler), max_redirects=3)
    assert res.too_many_redirects and len(res.hops) == 4
