"""Mask personal data before any text is sent to an external AI provider."""

from __future__ import annotations

import re

_PATTERNS = [
    # Emirates ID: 784-YYYY-NNNNNNN-N
    ("EMIRATES_ID", re.compile(r"\b784[-\s]?\d{4}[-\s]?\d{7}[-\s]?\d\b")),
    ("IBAN", re.compile(r"\b[A-Z]{2}\d{2}(?:\s?[A-Z0-9]{4}){3,7}(?:\s?[A-Z0-9]{1,4})?\b")),
    ("CARD", re.compile(r"\b(?:\d[ -]?){13,19}\b")),
    ("EMAIL", re.compile(r"[\w.+-]+@[\w-]+(?:\.[\w-]+)+")),
    # UAE and international phone numbers
    ("PHONE", re.compile(r"(?<!\w)(?:\+|00)?971[\s-]?\d{1,2}[\s-]?\d{3}[\s-]?\d{4}\b|(?<!\w)0\d{1,2}[\s-]?\d{3}[\s-]?\d{4}\b|(?<!\w)\+\d{7,15}\b")),
]
_OTP = re.compile(r"(?i)\b(otp|code|pin)(\s*(?:is|:)?\s*)\d{4,8}\b")

# "Dear Ahmed," / "Hi Fatima" -> "Dear [NAME],"
_GREETING_NAME = re.compile(r"(?i)\b(dear|hi|hello|mr\.?|mrs\.?|ms\.?)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)")


def mask_pii(text: str) -> tuple[str, dict[str, int]]:
    counts: dict[str, int] = {}
    for label, pat in _PATTERNS:
        text, n = pat.subn(f"[{label}]", text)
        if n:
            counts[label] = n
    text, n = _OTP.subn(lambda m: f"{m.group(1)}{m.group(2)}[OTP]", text)
    if n:
        counts["OTP"] = n

    def _name(m: re.Match) -> str:
        counts["NAME"] = counts.get("NAME", 0) + 1
        return f"{m.group(1)} [NAME]"

    text = _GREETING_NAME.sub(_name, text)
    return text, counts
