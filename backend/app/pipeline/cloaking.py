"""Cloaking check: does the link show phones something different from desktops?

Scam kits often send desktop browsers and scanners to a harmless site (or a blank page) and show
the real phishing page only to phones, where the SMS is read. RAQEEB fetches the link twice,
as a desktop browser and as an Android phone, and compares where each lands and what each asks for.
Conservative on purpose: mobile versions of the same site (m.example.com) never count.
"""

from __future__ import annotations

from app.models import Category, Evidence, EvidenceStatus
from app.net.page import PageFacts
from app.net.safe_fetch import FetchResult
from app.pipeline.extract import InputError, ParsedUrl, parse_url
from app.pipeline.reputation import is_established


def _final(f: FetchResult | None) -> str:
    if not f or not f.final_url:
        return ""
    try:
        return parse_url(f.final_url).registrable_domain.lower()
    except InputError:
        return ""


def _asks(p: PageFacts | None) -> bool:
    return bool(p and (p.has_password or p.asks_card or p.asks_otp))


def cloaking_evidence(u: ParsedUrl, idx: int, desktop: FetchResult | None, mobile: FetchResult | None) -> list[Evidence]:
    d, m = _final(desktop), _final(mobile)
    if not d or not m:
        return []
    shown = u.registrable_domain or u.host
    raw = {"url": u.url, "desktop_lands_on": desktop.final_url, "phone_lands_on": mobile.final_url}

    def ev(finding: str) -> Evidence:
        return Evidence(id=f"url{idx}.cloaking", category=Category.context, finding=finding,
                        why_it_matters="Scam pages hide from scanners and desktop computers and show the real page only "
                                       "to phones, where the SMS is opened.",
                        status=EvidenceStatus.suspicious, source="RAQEEB cloaking check (desktop vs Android fetch)", raw=raw)

    if d != m and is_established(d) and not is_established(m):
        return [ev(f"{shown} sends desktop browsers to {d}, but phones to {m}.")]
    if d == m and _asks(mobile.page) and not _asks(desktop.page) and desktop.page is not None:
        return [ev(f"{shown} asks phones for a password, card or code, but not desktop browsers.")]
    return []


def best_page(desktop: FetchResult | None, mobile: FetchResult | None) -> PageFacts | None:
    """The page to analyse: the phone's version when only it shows a form or a title."""
    dp = desktop.page if desktop else None
    mp = mobile.page if mobile else None
    if mp and (not dp or (_asks(mp) and not _asks(dp)) or (mp.title and not dp.title)):
        return mp
    return dp
