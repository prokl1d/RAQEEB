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
from app.net.tlsctx import shared_context

State = Literal["found", "not_found", "missing"]


@dataclass
class IntelResult:
    service: str
    state: State
    detail: str = ""
    data: dict = field(default_factory=dict)
    fixture: bool = False  # True when replayed from a labelled demo fixture


def _client(transport: httpx.AsyncBaseTransport | None) -> httpx.AsyncClient:
    return httpx.AsyncClient(transport=transport, timeout=httpx.Timeout(settings.http_timeout_seconds),
                             verify=shared_context())


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
    data = {"registered": when.date().isoformat(), "age_days": age, "source_url": str(r.url)}
    data.update(_registrar_facts(body))
    return IntelResult(svc, "found", f"registered {when.date().isoformat()} ({age} days ago)", data)


def _vcard(entity: dict, field_name: str) -> str:
    for item in (entity.get("vcardArray") or [None, []])[1]:
        if isinstance(item, list) and len(item) >= 4 and item[0] == field_name and item[3]:
            return str(item[3]).removeprefix("tel:").removeprefix("mailto:")
    return ""


def _registrar_facts(body: dict) -> dict:
    """Registrar, its abuse contact and the nameservers: who a takedown request goes to."""
    out: dict = {}
    for ent in body.get("entities", []) or []:
        if "registrar" not in (ent.get("roles") or []):
            continue
        if name := _vcard(ent, "fn"):
            out["registrar"] = name
        for sub in ent.get("entities", []) or []:
            if "abuse" in (sub.get("roles") or []):
                if email := _vcard(sub, "email"):
                    out["abuse_email"] = email
                if tel := _vcard(sub, "tel"):
                    out["abuse_phone"] = tel
    ns = [str(n.get("ldhName", "")).lower() for n in body.get("nameservers", []) or [] if n.get("ldhName")]
    if ns:
        out["nameservers"] = ns[:4]
    return out


# ---------- Google Safe Browsing API v5: urls.search ----------
# v4 (threatMatches:find) is deprecated per https://developers.google.com/safe-browsing/v4.
# v5 reference: https://developers.google.com/safe-browsing/reference/rest/v5/urls/search
#   GET /v5/urls:search?urls=<url>[&urls=...]   (max 50 URLs, empty body)
#   200 {"threats": [{"url", "threatTypes": [...]}], "cacheDuration": "300s"}; no match -> threats empty
# The API key is sent in the X-Goog-Api-Key header, never in the URL, so it can't leak into logs.

SB_URL = "https://safebrowsing.googleapis.com/v5/urls:search"


def _google_error_reason(r: httpx.Response) -> str | None:
    """Google's machine-readable error reason (e.g. ACCESS_DENIED, SERVICE_DISABLED). Never includes the key."""
    try:
        err = r.json().get("error", {})
    except ValueError:
        return None
    for d in err.get("details", []):
        if d.get("reason"):
            return str(d["reason"])[:60]
    return str(err.get("status"))[:60] if err.get("status") else None


async def safe_browsing(url: str, transport: httpx.AsyncBaseTransport | None = None) -> IntelResult:
    svc = "Google Safe Browsing"
    if not settings.safe_browsing_api_key:
        return IntelResult(svc, "missing", "not configured (no API key)")
    try:
        async with _client(transport) as c:
            # alt=json: v5 answers in protobuf by default; ask for JSON.
            r = await c.get(SB_URL, params=[("urls", url), ("alt", "json")],
                            headers={"X-Goog-Api-Key": settings.safe_browsing_api_key})
    except httpx.HTTPError as exc:
        return IntelResult(svc, "missing", f"lookup failed ({type(exc).__name__})")
    if r.status_code in (400, 401, 403):
        reason = _google_error_reason(r)
        return IntelResult(svc, "missing", f"Google refused the request (HTTP {r.status_code}"
                           + (f", {reason}" if reason else "") + ")", {"http_status": r.status_code, "reason": reason})
    if r.status_code == 429:
        return IntelResult(svc, "missing", "Safe Browsing quota reached")
    if r.status_code != 200:
        return IntelResult(svc, "missing", f"Safe Browsing returned HTTP {r.status_code}")
    try:
        threats = r.json().get("threats", []) or []
    except ValueError:
        return IntelResult(svc, "missing", "unreadable Safe Browsing response")
    types = sorted({t for th in threats for t in th.get("threatTypes", [])})
    if threats:
        return IntelResult(svc, "found", f"listed by Google Safe Browsing as {', '.join(types) or 'a threat'}",
                           {"threat_types": types, "api": "v5 urls.search"})
    return IntelResult(svc, "not_found", "not on Google Safe Browsing lists (this does not prove the link is safe)",
                       {"api": "v5 urls.search"})


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
