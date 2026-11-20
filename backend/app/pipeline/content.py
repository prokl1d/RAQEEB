"""Steps 5-6 (rule-based part): suspicious requests and pressure tactics in message text.

The AI layer (Phase 4) adds interpretation; these rules are deterministic and explainable.
Suspicious language alone never proves fraud.
"""

from __future__ import annotations

import re
from dataclasses import dataclass

from app.models import Category, Evidence, EvidenceStatus


@dataclass(frozen=True)
class Rule:
    key: str
    label: str
    why: str
    pattern: re.Pattern


def _r(p: str) -> re.Pattern:
    return re.compile(p, re.IGNORECASE)


RULES = [
    Rule("otp", "Asks for a one-time code (OTP / PIN)",
         "Banks and government services never ask you to share an OTP or PIN.",
         _r(r"\b(otp|one[-\s]?time\s+(pass(word|code)?|code)|verification\s+code|pin(\s+code)?)\b")),
    Rule("card", "Asks for card or bank details",
         "Requests for card numbers, CVV or expiry dates are a common way to steal money.",
         _r(r"\b(card\s+(number|details)|cvv|cvc|expiry\s+date|iban|account\s+number)\b")),
    Rule("credentials", "Asks for a password or login",
         "Real organizations don't ask for your password by message.",
         _r(r"\b(password|passcode|log\s?in\s+details|username\s+and\s+password|credentials)\b")),
    Rule("fee", "Asks for a small payment or fee",
         "A small 'release', 'customs' or 'redelivery' fee is a classic delivery-scam pattern.",
         _r(r"\b(pay|payment|fee|charge|customs\s+duty|redeliver(y)?\s+fee)\b[^.\n]{0,40}?"
            r"\b(aed|dhs?|dirhams?|usd|\$)\s?\d+(?:\.\d+)?|\b(aed|dhs?)\s?\d+(\.\d+)?\b[^.\n]{0,40}\b(fee|pay|charge)")),
    Rule("urgency", "Uses urgency or a deadline",
         "Pressure to act fast stops people from checking whether a message is real.",
         _r(r"\b(urgent(ly)?|immediately|within\s+\d+\s*(hours?|hrs?|minutes?|mins?)|today\s+only|"
            r"final\s+(notice|warning|reminder)|last\s+chance|act\s+now|expires?\s+(today|soon))\b")),
    Rule("threat", "Threatens a penalty or account block",
         "Threats of blocked accounts, fines or legal action are used to scare people into acting.",
         _r(r"\b(suspend(ed)?|block(ed)?|deactivat(ed|e)|frozen|legal\s+action|penalt(y|ies)|"
            r"fine(d)?|arrest|will\s+be\s+(closed|cancel+ed))\b")),
    Rule("reward", "Promises a prize, refund or reward",
         "Unexpected prizes or refunds are bait to collect payment or personal details.",
         _r(r"\b(congratulations|you\s+(have\s+)?won|winner|prize|reward|cash\s*back|refund\s+of)\b")),
    Rule("click", "Pushes you to click a link to fix something",
         "Scam messages steer you to a link where details are collected.",
         _r(r"\b(click|tap|visit|open)\b[^.\n]{0,30}\b(link|here|below|to\s+(verify|update|confirm|pay|release))\b")),
    Rule("update-details", "Asks you to update or confirm personal details",
         "Requests to 'update' Emirates ID, KYC or account details are used to steal identities.",
         _r(r"\b(update|confirm|verify|re-?activate)\b[^.\n]{0,30}\b(details|information|account|"
            r"emirates\s+id|kyc|identity)\b")),
]


def analyze_content(text: str) -> list[Evidence]:
    ev: list[Evidence] = []
    for rule in RULES:
        m = rule.pattern.search(text)
        if not m:
            continue
        snippet = m.group(0)[:80]
        ev.append(Evidence(
            id=f"content.{rule.key}",
            category=Category.content,
            finding=f"{rule.label}: “{snippet}”",
            why_it_matters=rule.why,
            status=EvidenceStatus.suspicious,
            source="RAQEEB message rules (deterministic)",
            raw={"rule": rule.key, "match": snippet, "start": m.start(), "end": m.end()},
        ))
    return ev
