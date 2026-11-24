"""Campaign linking from shared infrastructure."""

from app.pipeline.campaigns import Fingerprint, link, shared_ip


def fp(key, **kw):
    return Fingerprint(key=key, domain=key.split("//")[-1].split("/")[0], **kw)


def test_shared_nameserver_pair_links_a_campaign():
    ns = ["alberto.ns.cloudflare.com", "nelly.ns.cloudflare.com"]
    c = link([fp("https://enbd-verify.top", nameservers=ns), fp("https://ae-post-fee.xyz", nameservers=list(reversed(ns))),
              fp("https://unrelated.com", nameservers=["a.ns.other.net", "b.ns.other.net"])])
    assert len(c) == 1 and set(c[0].members) == {"https://enbd-verify.top", "https://ae-post-fee.xyz"}
    assert "same nameservers" in c[0].links[0] and c[0].id == "A"


def test_shared_cdn_ip_and_registrar_defaults_do_not_link():
    assert shared_ip("104.21.3.4") and not shared_ip("45.9.20.11")
    c = link([fp("https://a1.com", ips=["104.21.3.4"]), fp("https://b1.com", ips=["104.21.3.4"]),
              fp("https://c1.com", nameservers=["ns1.domaincontrol.com", "ns2.domaincontrol.com"]),
              fp("https://d1.com", nameservers=["ns1.domaincontrol.com", "ns2.domaincontrol.com"])])
    assert c == []


def test_private_ip_and_registration_burst_link():
    c = link([fp("https://x1.com", ips=["45.9.20.11"]), fp("https://x2.com", ips=["45.9.20.11"]),
              fp("https://y1.com", registrar="NameCheap, Inc.", registered="2026-11-20"),
              fp("https://y2.com", registrar="NameCheap, Inc.", registered="2026-11-21"),
              fp("https://y3.com", registrar="NameCheap, Inc.", registered="2026-10-01")])
    groups = sorted(sorted(g.members) for g in c)
    assert groups == [["https://x1.com", "https://x2.com"], ["https://y1.com", "https://y2.com"]]


def test_same_site_twice_is_not_a_campaign():
    assert link([fp("https://a.com/1", ips=["45.9.20.11"]), fp("https://a.com/2", ips=["45.9.20.11"])]) == []
