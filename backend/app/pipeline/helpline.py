"""Fake helpline check: a message that claims to be an organization but gives a phone number
that isn't one of that organization's official numbers (each official number has a source)."""

from __future__ import annotations

import re

from app.models import Category, Evidence, EvidenceStatus
from app.pipeline.arabic import normalize as normalize_ar
from app.pipeline.listing import _digits, phone_matches
from app.registry import Organization

# Phone-like runs: optional +/00 country code, then 7-13 digits with spaces, dots or dashes.
_PHONE = re.compile(r"(?<![\w/.])(?:\+|00)?\d[\d\s\-().]{5,18}\d(?![\w/])")


def phones_in(text: str) -> list[str]:
    out: list[str] = []
    for m in _PHONE.finditer(normalize_ar(text)):
        raw = m.group(0).strip()
        d = re.sub(r"\D", "", raw)
        if 7 <= len(d) <= 13 and not re.fullmatch(r"(19|20)\d{2}", d[:4]) or d.startswith(("600", "800")):
            if 3 <= len(d) <= 13 and raw not in out:
                out.append(raw)
    return out


def helpline_evidence(text: str, claimed: list[Organization]) -> list[Evidence]:
    ev: list[Evidence] = []
    nums = phones_in(text)
    if not nums:
        return ev
    for org in claimed:
        if not org.phones:
            continue
        for n in nums:
            if phone_matches(n, org.phones):
                ev.append(Evidence(
                    id=f"context.helpline-ok.{org.id}", category=Category.identity,
                    finding=f"{n} is an official number of {org.name}.",
                    why_it_matters="The number matches the organization's own published contact details.",
                    status=EvidenceStatus.unverified, source=org.phone_source or "RAQEEB registry",
                    raw={"phone": n, "official": org.phones}))
            elif len(_digits(n)) >= 6:
                ev.append(Evidence(
                    id=f"context.helpline.{org.id}", category=Category.context,
                    finding=f"The message claims to be from {org.name} but gives {n}, which is not one of its "
                            f"official numbers ({' / '.join(org.phones)}).",
                    why_it_matters="Fake helplines are a common trick: the scammer answers and asks for your card, "
                                   "OTP or a transfer. Only call numbers from the organization's own website or card.",
                    status=EvidenceStatus.suspicious, source=org.phone_source or "RAQEEB registry",
                    raw={"phone": n, "official": org.phones}))
    return ev
