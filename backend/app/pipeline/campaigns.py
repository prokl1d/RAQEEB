"""Campaign linking: which reported links are probably run by the same people?

Links are joined when they share a strong infrastructure fingerprint:
  - the same nameserver pair (Cloudflare and others give each account its own pair),
  - the same IP address, unless it belongs to a big shared CDN or free host (millions of
    unrelated sites share those),
  - the same registrar with registration dates at most 2 days apart.
Each campaign lists exactly which fingerprint links its members, so analysts can check it.
"""

from __future__ import annotations

import ipaddress
from dataclasses import dataclass, field
from datetime import date

# Shared front-end ranges (Cloudflare, GitHub Pages, Vercel, Netlify, Fastly, Google front ends).
_SHARED_NETS = [ipaddress.ip_network(n) for n in (
    "173.245.48.0/20", "103.21.244.0/22", "103.22.200.0/22", "103.31.4.0/22", "141.101.64.0/18",
    "108.162.192.0/18", "190.93.240.0/20", "188.114.96.0/20", "197.234.240.0/22", "198.41.128.0/17",
    "162.158.0.0/15", "104.16.0.0/13", "104.24.0.0/14", "172.64.0.0/13", "131.0.72.0/22",
    "185.199.108.0/22", "76.76.21.0/24", "75.2.60.0/24", "99.83.231.0/24", "151.101.0.0/16",
    "199.232.0.0/16", "142.250.0.0/15", "216.239.32.0/19", "2606:4700::/32", "2a06:98c0::/29",
)]


def shared_ip(ip: str) -> bool:
    try:
        a = ipaddress.ip_address(ip)
    except ValueError:
        return True
    return any(a in n for n in _SHARED_NETS)


@dataclass
class Fingerprint:
    key: str  # the item this belongs to (e.g. the link)
    domain: str
    ips: list[str] = field(default_factory=list)
    nameservers: list[str] = field(default_factory=list)
    registrar: str | None = None
    registered: str | None = None  # ISO date


@dataclass
class Campaign:
    id: str  # "A", "B", ...
    members: list[str]
    links: list[str]  # human-readable reasons, e.g. "same nameservers alberto/nelly.ns.cloudflare.com"


def _days(a: str | None, b: str | None) -> int | None:
    try:
        return abs((date.fromisoformat(a) - date.fromisoformat(b)).days) if a and b else None
    except ValueError:
        return None


def link(prints: list[Fingerprint]) -> list[Campaign]:
    """Groups of 2+ items with a shared fingerprint. Items in no group are not returned."""
    parent = list(range(len(prints)))
    why: dict[tuple[int, int], str] = {}

    def find(i: int) -> int:
        while parent[i] != i:
            parent[i] = parent[parent[i]]
            i = parent[i]
        return i

    def join(i: int, j: int, reason: str) -> None:
        ri, rj = find(i), find(j)
        if ri != rj:
            parent[ri] = rj
        why.setdefault((min(i, j), max(i, j)), reason)

    for i in range(len(prints)):
        for j in range(i + 1, len(prints)):
            a, b = prints[i], prints[j]
            if a.domain and a.domain == b.domain:
                continue  # the same site twice is not a campaign
            ns_a, ns_b = sorted(a.nameservers), sorted(b.nameservers)
            if ns_a and ns_a == ns_b and not all(any(g in n for g in _GENERIC_NS) for n in ns_a):
                join(i, j, "same nameservers " + " + ".join(ns_a))
                continue
            common = {ip for ip in a.ips if not shared_ip(ip)} & set(b.ips)
            if common:
                join(i, j, f"same server IP {sorted(common)[0]}")
                continue
            d = _days(a.registered, b.registered)
            if a.registrar and a.registrar == b.registrar and d is not None and d <= 2:
                join(i, j, f"same registrar ({a.registrar}), registered {d} day(s) apart")

    groups: dict[int, list[int]] = {}
    for i in range(len(prints)):
        groups.setdefault(find(i), []).append(i)
    out: list[Campaign] = []
    for members in sorted((g for g in groups.values() if len(g) > 1), key=len, reverse=True):
        reasons = sorted({r for (i, j), r in why.items() if i in members and j in members})
        out.append(Campaign(id=chr(ord("A") + len(out)) if len(out) < 26 else str(len(out) + 1),
                            members=[prints[i].key for i in members], links=reasons))
    return out


# Nameservers shared by huge numbers of unrelated customers (registrar defaults, parking).
_GENERIC_NS = ("domaincontrol.com", "registrar-servers.com", "dns-parking.com", "parkingcrew.net", "bodis.com",
               "sedoparking.com", "above.com", "afternic.com", "googledomains.com", "awsdns-", "azure-dns.com",
               "nsone.net", "wixdns.net", "squarespacedns.com", "name-services.com")


def fingerprint_from_result(key: str, result) -> Fingerprint:
    """Build a fingerprint from an InvestigationResult's evidence for its first link."""
    raw = {e.id: e.raw for e in result.evidence}
    dns = (raw.get("url0.dns") or {}).get("dns") or {}
    age = raw.get("url0.age") or {}
    dom = result.urls[0].registrable_domain if result.urls else ""
    ips = list(dns.get("A", [])) + list(dns.get("AAAA", [])) if isinstance(dns, dict) else []
    return Fingerprint(key=key, domain=dom, ips=ips, nameservers=list(age.get("nameservers") or []),
                       registrar=age.get("registrar"), registered=age.get("registered"))
