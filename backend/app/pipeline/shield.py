"""Search Shield: instant identity badges for many links at once (search results, ads, lists).

Fully offline and deterministic: it uses only the identity registry and the URL structure rules,
never the network, so it is fast enough to label a whole results page and can't leak anything.
Only domain names are needed; search words are never sent.

Verdicts
  official       registrable domain is an official domain whose source is verified
  listed         official domain in the registry, but not yet confirmed by an authoritative source
  impersonation  imitates a registry organization (wrong ending, look-alike letters, extra words,
                 brand only in a subdomain, typo)
  caution        not in the registry and the link has structural red flags (raw IP, '@' trick, ...)
  unknown        not in the registry and no red flags: RAQEEB can't say who runs it (never "safe")
  invalid        not a web address
"""

from __future__ import annotations

import json
from functools import lru_cache
from pathlib import Path
from typing import Literal

from pydantic import BaseModel

from app.models import EvidenceStatus
from app.pipeline.domains import analyze_url_structure
from app.pipeline.extract import InputError, ParsedUrl, validate_url
from app.pipeline.verify import MatchKind, compare
from app.registry import load_registry

Verdict = Literal["official", "listed", "impersonation", "caution", "unknown", "invalid"]

_IMPERSONATION = {MatchKind.wrong_suffix, MatchKind.homoglyph, MatchKind.brand_plus_words,
                  MatchKind.brand_in_subdomain, MatchKind.typo}
MAX_LINKS = 25


class LinkCheck(BaseModel):
    input: str
    domain: str | None = None  # registrable domain (or host for IPs)
    host: str | None = None
    verdict: Verdict
    org_id: str | None = None
    org_name: str | None = None
    official_domain: str | None = None
    match: str | None = None  # MatchKind value
    detail: str | None = None  # short technical detail (English)
    flags: list[str] = []  # structural red-flag ids, e.g. "ip", "userinfo", "punycode"
    source: str | None = None


def check_link(raw: str) -> LinkCheck:
    try:
        u: ParsedUrl = validate_url(raw)
    except InputError as exc:
        return LinkCheck(input=raw, verdict="invalid", detail=str(exc))
    domain = u.registrable_domain or u.host
    base = dict(input=raw, domain=domain, host=u.host)

    exact = [(o, m) for o in load_registry() if (m := compare(u, o)).kind == MatchKind.exact]
    if exact:
        org, m = sorted(exact, key=lambda om: not om[0].is_verified)[0]
        v = org.verification
        return LinkCheck(**base, verdict="official" if org.is_verified else "listed", org_id=org.id,
                         org_name=org.name, official_domain=m.official_domain, match=m.kind.value,
                         source=(f"{v.source_name} ({v.source_url})" if org.is_verified else "RAQEEB registry"))

    lookalikes = [m for o in load_registry() if (m := compare(u, o)).kind in _IMPERSONATION]
    if lookalikes:
        # Prefer the strongest kind of imitation.
        order = [MatchKind.homoglyph, MatchKind.wrong_suffix, MatchKind.brand_in_subdomain,
                 MatchKind.brand_plus_words, MatchKind.typo]
        m = sorted(lookalikes, key=lambda x: order.index(x.kind))[0]
        return LinkCheck(**base, verdict="impersonation", org_id=m.org.id, org_name=m.org.name,
                         official_domain=m.official_domain, match=m.kind.value, detail=m.detail,
                         source="RAQEEB registry comparison")

    flags = [e.id.split(".", 1)[1] for e in analyze_url_structure(u, 0) if e.status == EvidenceStatus.suspicious]
    return LinkCheck(**base, verdict="caution" if flags else "unknown", flags=flags,
                     source="RAQEEB URL analysis")


def check_links(links: list[str]) -> list[LinkCheck]:
    return [check_link(x) for x in links[:MAX_LINKS]]


# ---------- sample search results (clearly labelled demo data) ----------

FIXTURE = Path(__file__).resolve().parent.parent / "fixtures" / "search_demo.json"


class SearchResult(BaseModel):
    title: str
    url: str
    snippet: str
    sponsored: bool = False
    check: LinkCheck


class SearchQuery(BaseModel):
    id: str
    query: str
    query_ar: str
    results: list[SearchResult]


class SearchDemo(BaseModel):
    sample: bool = True
    note: str
    queries: list[SearchQuery]


@lru_cache
def search_demo() -> SearchDemo:
    data = json.loads(FIXTURE.read_text(encoding="utf-8"))
    queries = [
        SearchQuery(id=q["id"], query=q["query"], query_ar=q["query_ar"],
                    results=[SearchResult(**r, check=check_link(r["url"])) for r in q["results"]])
        for q in data["queries"]
    ]
    return SearchDemo(note=data["note"], queries=queries)
