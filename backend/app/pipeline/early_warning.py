"""Early Warning: find lookalike domains of a UAE organization BEFORE they are used in a scam.

Two key-free sources:
  1. Permutations: RAQEEB generates the lookalikes scammers typically register (typos, swapped
     look-alike letters, extra words like "-secure", other endings) and checks which ones
     actually exist in DNS right now.
  2. Certificate Transparency (crt.sh): every public HTTPS certificate is logged. A new
     certificate for "emiratesnbd-verify.com" often appears days before the SMS campaign.
Every candidate is then scored by the same identity and reputation rules as a normal check.
Only domain names are looked up; nothing about any user is involved.
"""

from __future__ import annotations

import asyncio
import json
import socket
from datetime import datetime, timezone
from functools import lru_cache
from pathlib import Path

import httpx
from pydantic import BaseModel

from app.config import settings
from app.net.tlsctx import shared_context
from app.pipeline.extract import InputError, parse_url
from app.pipeline.reputation import FREE_HOSTS, RISKY_TLDS, is_established
from app.pipeline.verify import MatchKind, compare
from app.registry import Organization, load_registry

FIXTURE = Path(__file__).resolve().parent.parent / "fixtures" / "early_warning_demo.json"

KEYBOARD = {
    "a": "qwsz", "b": "vghn", "c": "xdfv", "d": "serfcx", "e": "wsdr", "f": "drtgvc", "g": "ftyhbv",
    "h": "gyujnb", "i": "ujko", "j": "huikmn", "k": "jiolm", "l": "kop", "m": "njk", "n": "bhjm",
    "o": "iklp", "p": "ol", "q": "wa", "r": "edft", "s": "awedxz", "t": "rfgy", "u": "yhji",
    "v": "cfgb", "w": "qase", "x": "zsdc", "y": "tghu", "z": "asx",
}
GLYPHS = {"o": "0", "l": "1", "i": "1", "e": "3", "a": "4", "s": "5", "m": "rn", "w": "vv", "d": "cl"}
LURES = ("secure", "login", "verify", "update", "online", "pay", "ae", "uae", "support", "account",
         "portal", "help", "service", "rewards", "gift", "refund", "app", "web", "my")
MARKETPLACES = {"atom.com", "unstoppabledomains.com", "sedo.com", "dan.com", "afternic.com", "hugedomains.com",
                "godaddy.com", "bodis.com", "parkingcrew.net", "above.com", "squadhelp.com", "domainmarket.com",
                "spaceship.com", "namecheap.com", "porkbun.com", "brandbucket.com"}
PARKING = ("for sale", "buy this domain", "domain is parked", "parked free", "parked domain", "this domain may be",
           "domain name is available", "make an offer", "is available for purchase", "coming soon", "index of /")
SWAP_TLDS = ("com", "net", "org", "co", "info", "ae", "online", "site", "xyz", "top", "live", "shop", "app",
             "click", "icu", "vip", "cc", "me", "io", "pro")


def permutations(official: str, limit: int = 400) -> list[str]:
    """Plausible lookalikes of an official domain, most dangerous kinds first, de-duplicated."""
    label, _, suffix = official.partition(".")
    out: list[str] = []

    def add(lbl: str, sfx: str = suffix) -> None:
        if lbl and lbl != label and 2 < len(lbl) < 64 and not lbl.startswith("-") and not lbl.endswith("-"):
            d = f"{lbl}.{sfx}"
            if d not in out and d != official:
                out.append(d)

    for w in LURES:  # brand + word (the most common scam pattern)
        add(f"{label}-{w}")
        add(f"{w}-{label}")
        add(f"{label}{w}")
        add(f"{label}-{w}", "com")
    for t in SWAP_TLDS:  # same name, other ending
        if t != suffix:
            out.append(f"{label}.{t}") if f"{label}.{t}" not in out else None
    for i, ch in enumerate(label):  # look-alike characters
        if ch in GLYPHS:
            add(label[:i] + GLYPHS[ch] + label[i + 1:])
            add(label[:i] + GLYPHS[ch] + label[i + 1:], "com")
    for i in range(len(label)):  # omission, repetition
        add(label[:i] + label[i + 1:])
        add(label[:i] + label[i] + label[i:])
    for i in range(len(label) - 1):  # transposition
        add(label[:i] + label[i + 1] + label[i] + label[i + 2:])
    for i in range(1, len(label)):  # hyphenation
        add(label[:i] + "-" + label[i:])
    for i, ch in enumerate(label):  # keyboard typos
        for k in KEYBOARD.get(ch, ""):
            add(label[:i] + k + label[i + 1:])
    return out[:limit]


class Candidate(BaseModel):
    domain: str
    sources: list[str]  # "permutation" | "certificate"
    resolves: bool | None = None
    ips: list[str] = []
    cert_first_seen: str | None = None  # ISO date of the earliest logged certificate
    cert_days_ago: int | None = None
    match: str  # how it imitates the organization
    risk: str  # "high" | "watch" | "low" | "parked" | "defensive"
    redirects_to: str | None = None  # where the domain's website forwards to, if anywhere
    reasons: list[str]


class EarlyWarningResult(BaseModel):
    org_id: str
    org_name: str
    official_domains: list[str]
    checked_permutations: int
    certificate_search: str  # "ok" | "unavailable: ..." | "fixture"
    candidates: list[Candidate]
    fixture: bool = False
    generated_utc: str


async def _resolve(domain: str) -> list[str] | None:
    loop = asyncio.get_running_loop()
    try:
        infos = await asyncio.wait_for(loop.getaddrinfo(domain, 443, type=socket.SOCK_STREAM), timeout=3)
    except (socket.gaierror, asyncio.TimeoutError, OSError, UnicodeError):
        return None
    return sorted({i[4][0] for i in infos})[:4]


async def crtsh(label: str) -> tuple[str, dict[str, str]]:
    """Domains with a logged certificate whose name contains `label`. -> (status, {domain: first_seen})"""
    try:
        async with httpx.AsyncClient(timeout=httpx.Timeout(25.0), follow_redirects=True, verify=shared_context()) as c:
            r = await c.get("https://crt.sh/", params={"q": f"%{label}%", "output": "json", "exclude": "expired"},
                            headers={"User-Agent": "RAQEEB early-warning (hackathon MVP)"})
    except httpx.HTTPError as exc:
        return f"unavailable: {type(exc).__name__}", {}
    if r.status_code != 200:
        return f"unavailable: crt.sh returned HTTP {r.status_code}", {}
    try:
        rows = r.json()
    except ValueError:
        return "unavailable: unreadable crt.sh response", {}
    seen: dict[str, str] = {}
    for row in rows[:5000]:
        names = str(row.get("name_value", "")).lower().split("\n")
        when = str(row.get("not_before", ""))[:10]
        for n in names:
            n = n.strip().lstrip("*.")
            try:
                reg = parse_url(n).registrable_domain
            except InputError:
                continue
            if reg and label in reg and (reg not in seen or when < seen[reg]):
                seen[reg] = when
    return "ok", seen


def _assess(domain: str, org: Organization, resolves: bool | None, cert_days: int | None) -> Candidate | None:
    try:
        u = parse_url(domain)
    except InputError:
        return None
    m = compare(u, org)
    if m.kind in (MatchKind.exact,):
        return None
    if m.kind == MatchKind.none:
        if org.domains[0].split(".")[0] not in (u.domain_label or ""):
            return None
        how = "contains the organization's name"
    else:
        how = m.detail or m.kind.value
    reasons = [f"Imitates {org.name}: {how}."]
    # How strongly the name itself imitates the organization.
    score = {MatchKind.homoglyph: 3, MatchKind.brand_plus_words: 3, MatchKind.brand_in_subdomain: 3,
             MatchKind.typo: 2, MatchKind.wrong_suffix: 2}.get(m.kind, 1)
    if resolves:
        score += 1
        reasons.append("The domain is registered and live in DNS right now.")
    if cert_days is not None:
        recent = 0 <= cert_days <= 30
        reasons.append(f"An HTTPS certificate was issued {cert_days} day(s) ago." if cert_days >= 0 else
                       "An HTTPS certificate is logged for it.")
        score += 2 if recent else 1
    if u.suffix in RISKY_TLDS:
        score += 1
        reasons.append(f"It uses .{u.suffix}, an ending heavily used for phishing.")
    if is_established(u.registrable_domain):
        score -= 3
        reasons.append("It is a long-established site, so it is probably unrelated (shown for completeness).")
    if u.registrable_domain in FREE_HOSTS:
        return None
    risk = "high" if score >= 5 else "watch" if score >= 3 else "low"
    return Candidate(domain=u.registrable_domain or domain, sources=[], resolves=resolves, match=how, risk=risk,
                     reasons=reasons, cert_days_ago=cert_days)


@lru_cache
def _fixture() -> dict:
    return json.loads(FIXTURE.read_text(encoding="utf-8"))


def find_org(org_id: str) -> Organization | None:
    return next((o for o in load_registry() if o.id == org_id), None)


async def early_warning(org: Organization) -> EarlyWarningResult:
    now = datetime.now(timezone.utc)
    if settings.offline_demo and org.id in _fixture():
        fx = _fixture()[org.id]
        return EarlyWarningResult(org_id=org.id, org_name=org.name, official_domains=org.domains,
                                  checked_permutations=fx["checked_permutations"], certificate_search="fixture",
                                  candidates=[Candidate(**c) for c in fx["candidates"]], fixture=True,
                                  generated_utc=fx.get("recorded_utc", now.isoformat(timespec="seconds")))
    official = org.domains[0]
    label = official.split(".")[0]
    perms = permutations(official)
    sem = asyncio.Semaphore(60)

    async def res(d: str):
        async with sem:
            return d, await _resolve(d)

    if settings.network_checks:
        (status, certs), resolved = await asyncio.gather(crtsh(label), asyncio.gather(*(res(d) for d in perms)))
    else:
        status, certs, resolved = "unavailable: network checks are off", {}, [(d, None) for d in perms]
    live = {d: ips for d, ips in resolved if ips}

    # Certificate domains that weren't in the permutation list still need a DNS answer.
    extra = [d for d in certs if d not in live and d not in perms and d not in org.domains][:150]
    if settings.network_checks and extra:
        for d, ips in await asyncio.gather(*(res(d) for d in extra)):
            if ips:
                live[d] = ips

    cands: dict[str, Candidate] = {}
    for d in set(live) | set(certs):
        first = certs.get(d)
        days = None
        if first:
            try:
                days = (now.date() - datetime.fromisoformat(first).date()).days
            except ValueError:
                days = -1
        c = _assess(d, org, d in live, days)
        if not c:
            continue
        c.ips = live.get(d, [])
        c.cert_first_seen = first
        c.sources = (["permutation"] if d in perms else []) + (["certificate"] if d in certs else [])
        cands[c.domain] = c
    # Banks often register lookalikes themselves to protect customers. A lookalike that forwards
    # to an official domain is marked "defensive", not a threat.
    live_cands = [c for c in cands.values() if c.resolves][:40]
    if settings.network_checks and live_cands:
        from app.net.safe_fetch import safe_fetch

        async def where(c: Candidate):
            async with sem:
                try:
                    f = await asyncio.wait_for(safe_fetch(parse_url("http://" + c.domain)), timeout=12)
                except Exception:  # noqa: BLE001 - optional enrichment
                    return
            p = f.page
            if p and any(x in (p.title + " " + p.text_sample[:400]).lower() for x in PARKING):
                c.risk = "parked"
                c.reasons.append("Its page looks parked or for sale. Parked lookalikes are often switched on later, so keep watching.")
            if f.final_url:
                try:
                    fin = parse_url(f.final_url).registrable_domain
                except InputError:
                    return
                if fin and fin != c.domain:
                    c.redirects_to = fin
                    if fin in org.domains:
                        c.risk = "defensive"
                        c.reasons.append(f"It forwards to the official site {fin}, so it is most likely "
                                         f"registered by {org.name} itself to protect customers.")
                    elif fin in MARKETPLACES:
                        c.risk = "parked"
                        c.reasons.append(f"It forwards to {fin}, a domain marketplace: it is parked or for sale.")
                    elif fin not in FREE_HOSTS and not is_established(fin):
                        c.reasons.append(f"Its website forwards to {fin}.")

        await asyncio.gather(*(where(c) for c in live_cands))
    order = {"high": 0, "watch": 1, "low": 2, "parked": 3, "defensive": 4}
    ranked = sorted(cands.values(), key=lambda c: (order[c.risk], c.cert_days_ago if c.cert_days_ago is not None else 9999))
    return EarlyWarningResult(org_id=org.id, org_name=org.name, official_domains=org.domains,
                              checked_permutations=len(perms), certificate_search=status,
                              candidates=ranked[:60], generated_utc=now.isoformat(timespec="seconds"))

