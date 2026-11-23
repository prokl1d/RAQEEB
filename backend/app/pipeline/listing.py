"""Business listing check (maps / directories): does a listing really belong to the organization
its name claims?

The user (or a labelled demo listing) provides the listing's name, phone, website and address.
RAQEEB compares them with the registry. No maps API is called; nothing is fetched or stored.

Scoring (deterministic, explainable):
  Identity   45  name vs. website: imitation 95 · unrelated website 80 · official 0 · listed 10
  Phone      35  differs from the official number(s) 85 · matches 0
                 not covered when no official number is on file or none was given
  Website    20  structural red flags x 30 (raw IP, '@' trick, http, ...)
  Coverage < 40% -> "needs_verification" (never an accusation).
  Overrides: website imitates the organization -> score >= 50.
"""

from __future__ import annotations

import json
import re
from functools import lru_cache
from pathlib import Path
from typing import Literal

from pydantic import BaseModel, Field

from app.pipeline.arabic import normalize as normalize_ar
from app.pipeline.shield import LinkCheck, check_link
from app.pipeline.verify import detect_claimed_orgs
from app.registry import Organization, load_registry

Status = Literal["ok", "warn", "bad", "missing"]
Band = Literal["likely_safe", "low", "moderate", "high", "needs_verification"]

WEIGHTS = {"identity": 45, "phone": 35, "website": 20}


class ListingInput(BaseModel):
    name: str = Field(min_length=2, max_length=200)
    phone: str | None = Field(default=None, max_length=40)
    website: str | None = Field(default=None, max_length=500)
    address: str | None = Field(default=None, max_length=300)


class ListingCheckItem(BaseModel):
    key: Literal["name", "website", "phone", "address"]
    status: Status
    params: dict = {}  # values the website uses to word the finding in English or Arabic
    source: str | None = None


class ListingResult(BaseModel):
    score: int
    band: Band
    coverage: int
    claimed: str | None  # organization name the listing claims to be
    claimed_id: str | None
    official_phones: list[str]
    official_domains: list[str]
    phone_source: str | None
    checks: list[ListingCheckItem]
    website: LinkCheck | None
    overrides: list[str]


def _digits(phone: str) -> str:
    d = re.sub(r"[^0-9]", "", normalize_ar(phone))  # Arabic-Indic digits count too
    for prefix in ("00971", "971"):
        if d.startswith(prefix):
            d = d[len(prefix):]
            break
    return d.lstrip("0")


def phone_matches(given: str, official: list[str]) -> bool:
    g = _digits(given)
    return bool(g) and any(g == _digits(o) for o in official)


def _band(score: int) -> Band:
    return "high" if score >= 50 else "moderate" if score >= 25 else "low"


def check_listing(inp: ListingInput) -> ListingResult:
    claimed_orgs: list[Organization] = detect_claimed_orgs(inp.name)
    org = claimed_orgs[0] if claimed_orgs else None
    checks: list[ListingCheckItem] = []
    risks: dict[str, int] = {}
    overrides: list[str] = []

    # 1. Name
    if org:
        checks.append(ListingCheckItem(key="name", status="warn" if not org.is_verified else "ok",
                                       params={"org": org.name, "verified": org.is_verified}))
    else:
        checks.append(ListingCheckItem(key="name", status="missing", params={"name": inp.name}))

    # 2. Website
    site: LinkCheck | None = None
    if inp.website and inp.website.strip():
        site = check_link(inp.website.strip())
        if site.verdict == "invalid":
            checks.append(ListingCheckItem(key="website", status="missing", params={"input": inp.website}))
        elif org and site.verdict in ("official", "listed") and site.org_id == org.id:
            risks["identity"] = 0 if site.verdict == "official" else 10
            checks.append(ListingCheckItem(key="website", status="ok", params={
                "domain": site.domain, "org": org.name, "verified": site.verdict == "official"},
                source=site.source))
        elif site.verdict == "impersonation":
            risks["identity"] = 95
            overrides.append("website-imitation")
            checks.append(ListingCheckItem(key="website", status="bad", params={
                "domain": site.domain, "org": site.org_name, "official": site.official_domain,
                "match": site.match}, source=site.source))
        elif org:
            risks["identity"] = 80
            checks.append(ListingCheckItem(key="website", status="bad", params={
                "domain": site.domain, "org": org.name, "official": ", ".join(org.domains),
                "match": "unrelated"}, source="RAQEEB registry comparison"))
        else:
            checks.append(ListingCheckItem(key="website", status="missing", params={"domain": site.domain}))
        if site.verdict != "invalid":
            risks["website"] = min(100, 30 * len(site.flags))
    else:
        checks.append(ListingCheckItem(key="website", status="missing", params={}))

    # 3. Phone
    if inp.phone and inp.phone.strip():
        if org and org.phones:
            if phone_matches(inp.phone, org.phones):
                risks["phone"] = 0
                checks.append(ListingCheckItem(key="phone", status="ok", params={
                    "given": inp.phone.strip(), "official": org.phones, "org": org.name}, source=org.phone_source))
            else:
                risks["phone"] = 85
                checks.append(ListingCheckItem(key="phone", status="bad", params={
                    "given": inp.phone.strip(), "official": org.phones, "org": org.name}, source=org.phone_source))
        else:
            checks.append(ListingCheckItem(key="phone", status="missing", params={
                "given": inp.phone.strip(), "org": org.name if org else None}))
    else:
        checks.append(ListingCheckItem(key="phone", status="missing", params={}))

    # 4. Address: RAQEEB has no official branch list, so it never claims to have checked it.
    checks.append(ListingCheckItem(key="address", status="missing", params={"given": (inp.address or "").strip()}))

    total = sum(WEIGHTS.values())
    covered = sum(WEIGHTS[k] for k in risks)
    coverage = round(100 * covered / total)
    score = round(sum(WEIGHTS[k] * r for k, r in risks.items()) / covered) if covered else 0
    if "website-imitation" in overrides and score < 50:
        score = 50
    if coverage < 40 or not org:
        band: Band = "needs_verification"
    else:
        band = _band(score)
        bad = any(c.status == "bad" for c in checks)
        if band == "low" and not bad and org.is_verified and risks.get("identity") == 0 \
                and risks.get("phone") == 0:
            band = "likely_safe"

    return ListingResult(
        score=score, band=band, coverage=coverage,
        claimed=org.name if org else None, claimed_id=org.id if org else None,
        official_phones=org.phones if org else [], official_domains=org.domains if org else [],
        phone_source=org.phone_source if org else None,
        checks=checks, website=site, overrides=overrides,
    )


# ---------- labelled demo listings ----------

FIXTURE = Path(__file__).resolve().parent.parent / "fixtures" / "listing_demo.json"


class DemoListing(BaseModel):
    id: str
    label: str
    label_ar: str
    listing: ListingInput


@lru_cache
def demo_listings() -> list[DemoListing]:
    data = json.loads(FIXTURE.read_text(encoding="utf-8"))
    return [DemoListing(**d) for d in data["listings"]]


def org_by_id(org_id: str) -> Organization | None:
    return next((o for o in load_registry() if o.id == org_id), None)
