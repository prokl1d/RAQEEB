"""Threat-intelligence and registration-data clients.

Every client returns a result with an explicit `state`:
  "found"      - the service returned a finding (e.g. listed as phishing)
  "not_found"  - the service answered and has no finding (NOT proof of safety)
  "missing"    - not configured, failed, rate-limited or timed out (never counts as clean)
These call fixed, trusted API hosts only; investigated URLs are sent as data, never fetched here.
"""

from __future__ import annotations

import base64
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Literal

import httpx

from app.config import settings

State = Literal["found", "not_found", "missing"]


@dataclass
class IntelResult:
    service: str
    state: State
    detail: str = ""
    data: dict = field(default_factory=dict)
    fixture: bool = False  # True when replayed from a labelled demo fixture


def _client(transport: httpx.AsyncBaseTransport | None) -> httpx.AsyncClient:
    return httpx.AsyncClient(transport=transport, timeout=httpx.Timeout(settings.http_timeout_seconds))


# ---------- RDAP (domain registration date) ----------

async def rdap_lookup(domain: str, transport: httpx.AsyncBaseTransport | None = None) -> IntelResult:
    svc = "RDAP (domain registration data)"
    try:
        async with _client(transport) as c:
            # rdap.org redirects to the authoritative registry's RDAP server.
            c.follow_redirects = True
            r = await c.get(f"https://rdap.org/domain/{domain}",
                            headers={"Accept": "application/rdap+json"})
    except httpx.HTTPError as exc:
        return IntelResult(svc, "missing", f"lookup failed ({type(exc).__name__})")
    if r.status_code == 404:
        return IntelResult(svc, "missing", "no RDAP record available for this domain or its registry")
    if r.status_code != 200:
        return IntelResult(svc, "missing", f"RDAP returned HTTP {r.status_code}")
    try:
        body = r.json()
    except ValueError:
        return IntelResult(svc, "missing", "unreadable RDAP response")
    reg = next((e.get("eventDate") for e in body.get("events", []) if e.get("eventAction") == "registration"), None)
    if not reg:
        return IntelResult(svc, "missing", "the registry did not publish a registration date")
    try:
        when = datetime.fromisoformat(reg.replace("Z", "+00:00"))
    except ValueError:
        return IntelResult(svc, "missing", f"unrecognised registration date '{reg}'")
    age = (datetime.now(timezone.utc) - when).days
    return IntelResult(svc, "found", f"registered {when.date().isoformat()} ({age} days ago)",
                       {"registered": when.date().isoformat(), "age_days": age, "source_url": str(r.url)})


# ---------- Google Safe Browsing Lookup API v4 ----------

SB_URL = "https://safebrowsing.googleapis.com/v4/threatMatches:find"


async def safe_browsing(url: str, transport: httpx.AsyncBaseTransport | None = None) -> IntelResult:
    svc = "Google Safe Browsing"
    if not settings.safe_browsing_api_key:
        return IntelResult(svc, "missing", "not configured (no API key)")
    payload = {
        "client": {"clientId": "raqeeb-hackathon", "clientVersion": "0.1"},
        "threatInfo": {
            "threatTypes": ["MALWARE", "SOCIAL_ENGINEERING", "UNWANTED_SOFTWARE", "POTENTIALLY_HARMFUL_APPLICATION"],
            "platformTypes": ["ANY_PLATFORM"],
            "threatEntryTypes": ["URL"],
            "threatEntries": [{"url": url}],
        },
    }
    try:
        async with _client(transport) as c:
            r = await c.post(SB_URL, params={"key": settings.safe_browsing_api_key}, json=payload)
    except httpx.HTTPError as exc:
        return IntelResult(svc, "missing", f"lookup failed ({type(exc).__name__})")
    if r.status_code != 200:
        return IntelResult(svc, "missing", f"Safe Browsing returned HTTP {r.status_code}")
    matches = r.json().get("matches", [])
    if matches:
        types = sorted({m.get("threatType", "UNKNOWN") for m in matches})
        return IntelResult(svc, "found", f"listed by Google Safe Browsing as {', '.join(types)}", {"threat_types": types})
    return IntelResult(svc, "not_found", "not on Google Safe Browsing lists (this does not prove the link is safe)")


# ---------- VirusTotal API v3 (lookup only, never submit) ----------

def vt_url_id(url: str) -> str:
    return base64.urlsafe_b64encode(url.encode()).decode().rstrip("=")


async def virustotal(url: str, transport: httpx.AsyncBaseTransport | None = None) -> IntelResult:
    svc = "VirusTotal"
    if not settings.virustotal_api_key:
        return IntelResult(svc, "missing", "not configured (no API key)")
    try:
        async with _client(transport) as c:
            r = await c.get(f"https://www.virustotal.com/api/v3/urls/{vt_url_id(url)}",
                            headers={"x-apikey": settings.virustotal_api_key})
    except httpx.HTTPError as exc:
        return IntelResult(svc, "missing", f"lookup failed ({type(exc).__name__})")
    if r.status_code == 404:
        return IntelResult(svc, "not_found", "VirusTotal has no existing report for this link (RAQEEB does not submit links)")
    if r.status_code == 429:
        return IntelResult(svc, "missing", "VirusTotal rate limit reached (free tier: 4 lookups/minute)")
    if r.status_code != 200:
        return IntelResult(svc, "missing", f"VirusTotal returned HTTP {r.status_code}")
    attrs = r.json().get("data", {}).get("attributes", {})
    stats = attrs.get("last_analysis_stats", {})
    mal, sus = int(stats.get("malicious", 0)), int(stats.get("suspicious", 0))
    total = sum(int(v) for v in stats.values()) if stats else 0
    data = {"malicious": mal, "suspicious": sus, "engines": total,
            "last_analysis_date": attrs.get("last_analysis_date")}
    if mal or sus:
        return IntelResult(svc, "found", f"{mal} of {total} security vendors flagged this link as malicious"
                           + (f", {sus} as suspicious" if sus else ""), data)
    return IntelResult(svc, "not_found", f"0 of {total} vendors flagged this link in VirusTotal's last analysis", data)
