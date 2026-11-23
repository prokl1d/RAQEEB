"""Steps 4 and 9: identify claimed organizations and verify identity against the registry.

Outcomes (docs/PLAN.md section 9):
  Verified Match | Possible Impersonation | No Verified Relationship Found | Unable to Verify
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field
from enum import Enum

from rapidfuzz.distance import Levenshtein
from rapidfuzz import fuzz

from app.models import Category, Evidence, EvidenceStatus
from app.pipeline.arabic import normalize as normalize_ar
from app.pipeline.domains import skeleton
from app.pipeline.extract import ParsedUrl
from app.registry import Organization, load_registry


class IdentityOutcome(str, Enum):
    verified_match = "Verified Match"
    possible_impersonation = "Possible Impersonation"
    no_relationship = "No Verified Relationship Found"
    unable = "Unable to Verify"


class MatchKind(str, Enum):
    exact = "exact"  # registrable domain is an official domain (incl. genuine subdomains)
    wrong_suffix = "wrong-suffix"  # same name, different ending (dewa.com vs dewa.gov.ae)
    homoglyph = "homoglyph"  # looks identical once confusable characters are mapped
    brand_plus_words = "brand-plus-words"  # official name with extra words (emiratesnbd-secure)
    brand_in_subdomain = "brand-in-subdomain"  # emiratesnbd.com.evil.xyz
    typo = "typo"  # one or two characters different
    none = "none"


@dataclass
class DomainMatch:
    org: Organization
    kind: MatchKind
    official_domain: str
    detail: str = ""


# ---------- claimed organization detection (rule-based; AI adds to this later) ----------

def detect_claimed_orgs(text: str) -> list[Organization]:
    """Organizations named in the text, in English or Arabic (Arabic letter variants normalised)."""
    found: list[Organization] = []
    text = normalize_ar(text)
    for org in load_registry():
        for alias in map(normalize_ar, org.aliases):
            # Short all-caps aliases (FAB, DIB, RTA) must match case-sensitively as whole words.
            if len(alias) <= 4 and alias.isupper():
                pat = rf"(?<![\w&]){re.escape(alias)}(?![\w&])"
                flags = 0
            else:
                pat = rf"(?<![\w&]){re.escape(alias)}(?![\w&])"
                flags = re.IGNORECASE
            if re.search(pat, text, flags):
                found.append(org)
                break
    return found


# ---------- domain comparison ----------

def _official_parts(domain: str) -> tuple[str, str]:
    label, _, suffix = domain.partition(".")
    return label, suffix


def compare(u: ParsedUrl, org: Organization) -> DomainMatch:
    reg = u.registrable_domain.lower()
    host = u.host_ascii.lower()
    label = (u.domain_label or "").lower()
    for official in org.domains:
        off = official.lower()
        if reg == off or host == off or host.endswith("." + off):
            return DomainMatch(org, MatchKind.exact, official)

    best = DomainMatch(org, MatchKind.none, org.domains[0])
    for official in org.domains:
        off_label, off_suffix = _official_parts(official.lower())
        if not label or len(off_label) < 3:
            continue
        if label == off_label:
            return DomainMatch(org, MatchKind.wrong_suffix, official,
                               f"same name, different ending (.{u.suffix} instead of .{off_suffix})")
        if skeleton(label) == skeleton(off_label):
            return DomainMatch(org, MatchKind.homoglyph, official, "look-alike characters")
        tokens = re.split(r"[-_.]", label)
        if off_label in tokens or (len(off_label) >= 5 and off_label in label):
            best = DomainMatch(org, MatchKind.brand_plus_words, official,
                               f"official name '{off_label}' combined with other words")
            continue
        if len(off_label) >= 5 and off_label in (u.subdomain or "").lower().replace(".", " ").split():
            best = DomainMatch(org, MatchKind.brand_in_subdomain, official,
                               f"'{off_label}' appears only in the subdomain; the real domain is {reg}")
            continue
        if len(off_label) >= 5 and off_label in (u.subdomain or "").lower():
            best = DomainMatch(org, MatchKind.brand_in_subdomain, official,
                               f"'{off_label}' appears only in the subdomain; the real domain is {reg}")
            continue
        dist = Levenshtein.distance(skeleton(label), skeleton(off_label))
        if len(off_label) >= 5 and (dist <= 2 or fuzz.ratio(label, off_label) >= 88):
            if best.kind == MatchKind.none:
                best = DomainMatch(org, MatchKind.typo, official,
                                   f"{dist} character(s) different from '{off_label}'")
    return best


def find_lookalikes(u: ParsedUrl, exclude: set[str]) -> list[DomainMatch]:
    """Registry organizations this URL imitates, even if the message never names them."""
    out = []
    for org in load_registry():
        if org.id in exclude:
            continue
        m = compare(u, org)
        if m.kind not in (MatchKind.none, MatchKind.exact):
            out.append(m)
    return out


# ---------- verification ----------

@dataclass
class IdentityResult:
    outcome: IdentityOutcome
    claimed: list[Organization]
    matches: list[DomainMatch] = field(default_factory=list)
    evidence: list[Evidence] = field(default_factory=list)
    summary: str = ""


_IMPERSONATION = {MatchKind.wrong_suffix, MatchKind.homoglyph, MatchKind.brand_plus_words,
                  MatchKind.brand_in_subdomain, MatchKind.typo}


def _source_of(org: Organization) -> str:
    v = org.verification
    if org.is_verified:
        return f"RAQEEB registry, verified via {v.source_name} ({v.source_url}, checked {v.checked})"
    return "RAQEEB registry (domain not yet confirmed by an authoritative source)"


def verify_identity(claimed: list[Organization], urls: list[ParsedUrl]) -> IdentityResult:
    ev: list[Evidence] = []
    matches: list[DomainMatch] = []
    claimed_ids = {o.id for o in claimed}

    def add(key: str, finding: str, why: str, status: EvidenceStatus, source: str, raw: dict):
        ev.append(Evidence(id=f"identity.{key}", category=Category.identity, finding=finding,
                           why_it_matters=why, status=status, source=source, raw=raw))

    # 1. Lookalikes of any registry org (claimed or not)
    for i, u in enumerate(urls):
        for m in [compare(u, o) for o in claimed] + find_lookalikes(u, claimed_ids):
            if m.kind in _IMPERSONATION:
                matches.append(m)
                add(f"url{i}.{m.org.id}.{m.kind.value}",
                    f"{u.registrable_domain or u.host} resembles {m.org.name}'s domain "
                    f"{m.official_domain} ({m.detail}).",
                    "Scammers register addresses that look like a real organization's to borrow its trust.",
                    EvidenceStatus.suspicious, _source_of(m.org),
                    {"url": u.url, "official_domain": m.official_domain, "match": m.kind.value})
            elif m.kind == MatchKind.exact:
                matches.append(m)
        if not claimed:
            # URL-only: is this an official domain of any registry organization?
            matches += [m for o in load_registry() if (m := compare(u, o)).kind == MatchKind.exact]

    # 2. Decide outcome
    impersonations = [m for m in matches if m.kind in _IMPERSONATION]
    exacts = [m for m in matches if m.kind == MatchKind.exact]

    if impersonations:
        names = sorted({m.org.name for m in impersonations})
        return IdentityResult(IdentityOutcome.possible_impersonation, claimed, matches, ev,
                              f"The link imitates {', '.join(names)}.")

    if claimed and urls:
        verified = [m for m in exacts if m.org.id in claimed_ids and m.org.is_verified]
        unconfirmed = [m for m in exacts if m.org.id in claimed_ids and not m.org.is_verified]
        unrelated = [u for u in urls if not any(compare(u, o).kind == MatchKind.exact for o in claimed)]
        for m in verified:
            add(f"{m.org.id}.verified", f"The link uses {m.official_domain}, an official domain of {m.org.name}.",
                "The domain matches the organization the message claims to be from.",
                EvidenceStatus.verified, _source_of(m.org), {"official_domain": m.official_domain})
        for m in unconfirmed:
            add(f"{m.org.id}.unconfirmed",
                f"The link uses {m.official_domain}, which RAQEEB lists for {m.org.name}, "
                "but that domain has not yet been confirmed by an authoritative source.",
                "Without an authoritative source, RAQEEB will not claim the identity is verified.",
                EvidenceStatus.unverified, _source_of(m.org), {"official_domain": m.official_domain})
        for i, u in enumerate(unrelated):
            add(f"unrelated{i}",
                f"The message claims to be from {', '.join(o.name for o in claimed)}, but "
                f"{u.registrable_domain or u.host} is not one of its official domains.",
                "A message from a real organization normally links to that organization's own website.",
                EvidenceStatus.suspicious, "RAQEEB registry comparison",
                {"url": u.url, "official_domains": [d for o in claimed for d in o.domains]})
        if unrelated:
            return IdentityResult(IdentityOutcome.no_relationship, claimed, matches, ev,
                                  "The link does not belong to the organization the message claims to be from.")
        if verified and not unconfirmed:
            return IdentityResult(IdentityOutcome.verified_match, claimed, matches, ev,
                                  f"The link belongs to {', '.join(m.org.name for m in verified)}.")
        return IdentityResult(IdentityOutcome.unable, claimed, matches, ev,
                              "The link matches a registry domain that is not yet confirmed by an authoritative source.")

    if not claimed and urls and exacts:
        # URL-only investigation of an official domain
        verified = [m for m in exacts if m.org.is_verified]
        for m in exacts:
            add(f"{m.org.id}.domain",
                f"{m.official_domain} is listed in the RAQEEB registry for {m.org.name}"
                + ("." if m.org.is_verified else " (not yet confirmed by an authoritative source)."),
                "The domain belongs to a known organization. Its pages can still be misused, so other checks still count.",
                EvidenceStatus.verified if m.org.is_verified else EvidenceStatus.unverified,
                _source_of(m.org), {"official_domain": m.official_domain})
        if verified:
            return IdentityResult(IdentityOutcome.verified_match, claimed, matches, ev,
                                  f"The link belongs to {', '.join(m.org.name for m in verified)}.")
        return IdentityResult(IdentityOutcome.unable, claimed, matches, ev,
                              "The domain is in the registry but not yet confirmed by an authoritative source.")

    if claimed and not urls:
        add("no-link", f"The message claims to be from {', '.join(o.name for o in claimed)} but contains no link.",
            "Without a link or domain, RAQEEB cannot compare the claim with official domains.",
            EvidenceStatus.missing, "RAQEEB registry comparison", {})
        return IdentityResult(IdentityOutcome.unable, claimed, matches, ev,
                              "No link to compare with the claimed organization.")

    add("no-claim", "RAQEEB could not identify which organization this claims to be from.",
        "Identity can only be verified against organizations in the registry.",
        EvidenceStatus.missing, "RAQEEB registry comparison", {})
    return IdentityResult(IdentityOutcome.unable, claimed, matches, ev,
                          "No known organization identified.")
