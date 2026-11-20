"""Steps 7-8: technical checks and threat intelligence for each URL, turned into Evidence.

Modes:
  live      - real DNS / TLS / redirect / RDAP / Safe Browsing / VirusTotal calls
  fixture   - OFFLINE_DEMO=true: replay labelled demo fixtures (app/fixtures/demo.json)
  disabled  - NETWORK_CHECKS=false (tests): everything reported as missing
Missing data is always reported as missing, never as clean.
"""

from __future__ import annotations

import asyncio
import json
from dataclasses import dataclass, field
from functools import lru_cache
from pathlib import Path

from app.config import settings
from app.intel.clients import IntelResult, rdap_lookup, safe_browsing, virustotal
from app.models import Category, Evidence, EvidenceStatus
from app.net.dns_check import DnsInfo, dns_info
from app.net.safe_fetch import FetchResult, Hop, TlsInfo, safe_fetch, tls_info
from app.pipeline.extract import InputError, ParsedUrl, parse_url

FIXTURE_FILE = Path(__file__).resolve().parent.parent / "fixtures" / "demo.json"
FIXTURE_LABEL = "Recorded demo fixture (not a live result)"


@lru_cache
def _fixtures() -> dict:
    return json.loads(FIXTURE_FILE.read_text(encoding="utf-8"))["domains"]


@dataclass
class TechReport:
    url: ParsedUrl
    mode: str
    dns: DnsInfo | None = None
    tls: TlsInfo | None = None
    fetch: FetchResult | None = None
    intel: list[IntelResult] = field(default_factory=list)
    final_url: ParsedUrl | None = None


def mode() -> str:
    if settings.offline_demo:
        return "fixture"
    return "live" if settings.network_checks else "disabled"


async def _live(u: ParsedUrl) -> TechReport:
    rep = TechReport(u, "live")
    domain = u.registrable_domain or u.host_ascii
    tasks = [
        dns_info(domain) if u.registrable_domain else asyncio.sleep(0, result=None),
        tls_info(u) if u.scheme == "https" or not u.had_scheme else asyncio.sleep(0, result=None),
        safe_fetch(u),
        rdap_lookup(u.registrable_domain) if u.registrable_domain else asyncio.sleep(0, result=None),
        safe_browsing(u.url),
        virustotal(u.url),
    ]
    dns, tls, fetch, rdap, sb, vt = await asyncio.gather(*tasks, return_exceptions=True)

    def ok(x):
        return None if isinstance(x, BaseException) else x

    rep.dns, rep.tls, rep.fetch = ok(dns), ok(tls), ok(fetch)
    for svc, res in (("RDAP (domain registration data)", rdap), ("Google Safe Browsing", sb), ("VirusTotal", vt)):
        if isinstance(res, BaseException) or res is None:
            if res is None and svc.startswith("RDAP"):
                continue
            rep.intel.append(IntelResult(svc, "missing", "check failed unexpectedly"))
        else:
            rep.intel.append(res)
    if rep.fetch and rep.fetch.final_url:
        try:
            rep.final_url = parse_url(rep.fetch.final_url)
        except InputError:
            pass
    return rep


def _from_fixture(u: ParsedUrl) -> TechReport:
    rep = TechReport(u, "fixture")
    fx = _fixtures().get(u.registrable_domain)
    if not fx:
        return rep
    rep.dns = DnsInfo(**fx["dns"])
    rep.tls = TlsInfo(ok=fx["tls"]["ok"], issuer=fx["tls"].get("issuer"),
                      days_since_issued=fx["tls"].get("days_since_issued"))
    hops = [Hop(h["url"], "", None, h.get("status"), h.get("location")) for h in fx["redirects"]]
    rep.fetch = FetchResult(hops=hops, final_url=hops[-1].url)
    for key, svc in (("rdap", "RDAP (domain registration data)"), ("safe_browsing", "Google Safe Browsing"),
                     ("virustotal", "VirusTotal")):
        d = fx[key]
        rep.intel.append(IntelResult(svc, d["state"], d.get("detail", ""), d.get("data", {}), fixture=True))
    try:
        rep.final_url = parse_url(rep.fetch.final_url)
    except InputError:
        pass
    return rep


async def run_checks(urls: list[ParsedUrl]) -> list[TechReport]:
    m = mode()
    if m == "disabled":
        return [TechReport(u, "disabled") for u in urls]
    if m == "fixture":
        # Demo domains replay labelled fixtures; any other link is checked live when the network
        # is allowed, so testing with other links still gives real results.
        async def one(u: ParsedUrl) -> TechReport:
            if u.registrable_domain in _fixtures():
                return _from_fixture(u)
            if settings.network_checks:
                return await _live(u)
            return TechReport(u, "disabled")
        return list(await asyncio.gather(*(one(u) for u in urls)))
    return list(await asyncio.gather(*(_live(u) for u in urls)))


# ---------- evidence ----------

def to_evidence(rep: TechReport, idx: int) -> list[Evidence]:
    u = rep.url
    ev: list[Evidence] = []
    fixture = rep.mode == "fixture"
    label = u.registrable_domain or u.host

    def add(cat: Category, key: str, finding: str, why: str, status: EvidenceStatus, source: str, raw=None):
        ev.append(Evidence(id=f"url{idx}.{key}", category=cat, finding=finding, why_it_matters=why,
                           status=status, source=f"{source} · {FIXTURE_LABEL}" if fixture else source,
                           raw={"url": u.url, "fixture": fixture, **(raw or {})}))

    if rep.mode == "disabled":
        reason = "network checks are turned off" if rep.mode == "disabled" else "offline demo mode has no recorded data for this domain"
        add(Category.threat_intel, "intel-missing", f"Threat-intelligence checks were not run for {label} ({reason}).",
            "Without these checks RAQEEB cannot say whether the link is already known to be malicious.",
            EvidenceStatus.missing, "RAQEEB")
        add(Category.url_domain, "tech-missing", f"Technical checks (DNS, certificate, domain age, redirects) were not run for {label}.",
            "Missing checks are never counted as a clean result.", EvidenceStatus.missing, "RAQEEB")
        return ev

    # DNS
    if rep.dns is not None:
        if rep.dns.exists is False:
            add(Category.url_domain, "dns", f"{label} does not exist in DNS.",
                "The link cannot load right now. Scam domains are often taken down or not yet active.",
                EvidenceStatus.unverified, "DNS lookup", {"dns": rep.dns.records, "dns_exists": False})
        elif rep.dns.exists:
            add(Category.url_domain, "dns", f"{label} is an active domain (DNS records found).",
                "The site exists. This says nothing about who runs it.",
                EvidenceStatus.unverified, "DNS lookup", {"dns": rep.dns.records, "dns_exists": True})
        elif rep.dns.exists is None:
            add(Category.url_domain, "dns", f"DNS lookup for {label} failed.", "RAQEEB could not confirm the domain is active.",
                EvidenceStatus.missing, "DNS lookup")

    # Domain age (RDAP)
    for r in rep.intel:
        if not r.service.startswith("RDAP"):
            continue
        if r.state == "found":
            age = r.data.get("age_days", 0)
            if age < 30:
                add(Category.url_domain, "age", f"{label} was {r.detail}.",
                    "Very new domains are common in scams, which are set up quickly and abandoned. A new domain is not proof of fraud on its own.",
                    EvidenceStatus.suspicious, "RDAP registration data", r.data)
            else:
                add(Category.url_domain, "age", f"{label} was {r.detail}.",
                    "An older domain is a mild positive sign, but older domains can still be misused.",
                    EvidenceStatus.unverified, "RDAP registration data", r.data)
        else:
            add(Category.url_domain, "age", f"Domain age for {label} is unavailable: {r.detail}.",
                "Unknown age is not evidence either way.", EvidenceStatus.missing, "RDAP registration data")

    # TLS
    if rep.tls is not None:
        t = rep.tls
        if t.ok:
            recent = t.days_since_issued is not None and t.days_since_issued < 7
            add(Category.url_domain, "tls",
                f"{label} has a valid HTTPS certificate"
                + (f" from {t.issuer}" if t.issuer else "")
                + (f", issued {t.days_since_issued} day(s) ago" if t.days_since_issued is not None else "") + ".",
                "HTTPS only means the connection is encrypted. Scam sites get free certificates too."
                + (" A certificate issued in the last few days fits a newly set-up site." if recent else ""),
                EvidenceStatus.unverified, "TLS certificate check", {"issuer": t.issuer, "days_since_issued": t.days_since_issued})
        elif t.error and "certificate not valid" in t.error:
            add(Category.url_domain, "tls", f"{label}'s HTTPS certificate is not valid ({t.error}).",
                "A real organization's site has a valid certificate. Browsers will show a warning here.",
                EvidenceStatus.suspicious, "TLS certificate check", {"error": t.error})
        else:
            add(Category.url_domain, "tls", f"The HTTPS certificate for {label} could not be checked.",
                "RAQEEB could not connect securely; this is not evidence either way.", EvidenceStatus.missing,
                "TLS certificate check", {"error": t.error})

    # Redirects
    f = rep.fetch
    if f is not None:
        chain = [h.url for h in f.hops]
        if f.blocked:
            add(Category.url_domain, "ssrf", f"The link points to a private or internal network address ({f.error}).",
                "Public websites don't live on private networks. RAQEEB refused to connect.",
                EvidenceStatus.suspicious, "RAQEEB safe fetcher", {"chain": chain})
        elif f.too_many_redirects:
            add(Category.url_domain, "redirects", f"The link redirects more than {settings.max_redirects} times.",
                "Long redirect chains are used to hide the final destination.", EvidenceStatus.suspicious,
                "RAQEEB safe fetcher", {"chain": chain})
        elif f.error and not f.final_url:
            add(Category.url_domain, "redirects", f"RAQEEB could not load {label} ({f.error}).",
                "The destination could not be checked. This is not evidence either way.", EvidenceStatus.missing,
                "RAQEEB safe fetcher", {"chain": chain})
        elif rep.final_url and rep.final_url.registrable_domain and rep.final_url.registrable_domain != u.registrable_domain:
            add(Category.context, "redirect-offsite",
                f"{label} redirects to a different domain: {rep.final_url.registrable_domain}.",
                "What you see in the message is not where the link really goes.",
                EvidenceStatus.suspicious, "RAQEEB safe fetcher", {"chain": chain})

    # Threat intelligence
    for r in rep.intel:
        if r.service.startswith("RDAP"):
            continue
        key = "sb" if "Safe Browsing" in r.service else "vt"
        if r.state == "found":
            strong = key == "sb" or int(r.data.get("malicious", 0)) >= 3
            add(Category.threat_intel, key, f"{r.service}: {r.detail}.",
                "Independent security services have already flagged this link.",
                EvidenceStatus.confirmed if strong else EvidenceStatus.suspicious, r.service, r.data)
        elif r.state == "not_found":
            add(Category.threat_intel, key, f"{r.service}: {r.detail}.",
                "No known record is a weak signal only. New scam links often aren't listed yet.",
                EvidenceStatus.unverified, r.service, r.data)
        else:
            add(Category.threat_intel, key, f"{r.service} check unavailable: {r.detail}.",
                "This check did not run, so it cannot count as clean.", EvidenceStatus.missing, r.service)
    return ev
