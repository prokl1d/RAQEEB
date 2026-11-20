"""Step 7 (offline part): URL and domain structure analysis, plus lookalike helpers.

Network checks (DNS, TLS, RDAP age, redirects) come later through the SSRF-safe fetcher.
Everything here is deterministic and explainable.
"""

from __future__ import annotations

import unicodedata

from app.models import Category, Evidence, EvidenceStatus
from app.pipeline.extract import ParsedUrl

SHORTENERS = {
    "bit.ly", "tinyurl.com", "t.co", "goo.gl", "is.gd", "ow.ly", "buff.ly", "rb.gy",
    "cutt.ly", "rebrand.ly", "shorturl.at", "t.ly", "tiny.cc", "s.id", "lnkd.in",
}

# Words that phishing URLs use to look official. Supporting signal only.
LURE_WORDS = (
    "login", "log-in", "signin", "verify", "verification", "secure", "security", "update",
    "account", "confirm", "unlock", "suspend", "billing", "payment", "pay", "refund",
    "reward", "prize", "otp", "kyc", "wallet", "support", "helpdesk", "customs", "parcel",
    "delivery", "redelivery", "fine", "penalty",
)

# Characters that look like Latin letters (subset of Unicode confusables) and digit/letter swaps.
_CONFUSABLES = {
    "а": "a", "е": "e", "о": "o", "р": "p", "с": "c", "у": "y", "х": "x", "і": "i", "ј": "j",
    "ԁ": "d", "һ": "h", "ӏ": "l", "ѕ": "s", "ԛ": "q", "ԝ": "w", "ь": "b",
    "α": "a", "ο": "o", "ν": "v", "ρ": "p", "τ": "t", "ι": "i", "κ": "k",
    "0": "o", "1": "l", "3": "e", "5": "s", "7": "t", "|": "l", "i": "l",
}
_MULTI = [("rn", "m"), ("vv", "w"), ("cl", "d")]


def skeleton(text: str) -> str:
    """Map a label to a 'looks like' form so visually confusable strings compare equal."""
    s = unicodedata.normalize("NFKC", text).lower()
    s = "".join(_CONFUSABLES.get(ch, ch) for ch in s)
    for a, b in _MULTI:
        s = s.replace(a, b)
    return s.replace("-", "").replace("_", "")


def scripts_in(label: str) -> set[str]:
    out = set()
    for ch in label:
        if ch.isascii():
            if ch.isalpha():
                out.add("LATIN")
            continue
        name = unicodedata.name(ch, "")
        out.add(name.split(" ")[0] if name else "UNKNOWN")
    return out


def analyze_url_structure(u: ParsedUrl, idx: int) -> list[Evidence]:
    """Structural red flags for one URL. Each is a supporting indicator, never proof."""
    ev: list[Evidence] = []
    host = u.host
    shown = u.registrable_domain or host

    def add(key: str, finding: str, why: str, status: EvidenceStatus, raw: dict | None = None):
        ev.append(
            Evidence(
                id=f"url{idx}.{key}",
                category=Category.url_domain,
                finding=finding,
                why_it_matters=why,
                status=status,
                source="RAQEEB URL analysis (deterministic)",
                raw={"url": u.url, **(raw or {})},
            )
        )

    if u.is_ip:
        add("ip", f"The link uses a raw IP address ({host}) instead of a domain name.",
            "Legitimate organizations almost always use a named domain. IP links hide who runs the site.",
            EvidenceStatus.suspicious)
    if u.has_userinfo:
        add("userinfo", "The link contains an '@' before the address.",
            "Everything before '@' is ignored by the browser, so the visible start of the link can be fake.",
            EvidenceStatus.suspicious)
    if u.scheme == "http" and u.had_scheme:
        add("http", "The link uses unencrypted http://.",
            "Real login or payment pages use https. (https alone does not prove a site is safe.)",
            EvidenceStatus.suspicious)
    if u.port and u.port not in (80, 443):
        add("port", f"The link uses an unusual port ({u.port}).",
            "Official websites rarely use non-standard ports.", EvidenceStatus.suspicious)
    if u.registrable_domain in SHORTENERS:
        add("shortener", f"The link uses a URL shortener ({u.registrable_domain}).",
            "Shorteners hide the real destination. The destination must be checked separately.",
            EvidenceStatus.unverified)
    if "xn--" in u.host_ascii:
        mixed = scripts_in(u.domain_label or host)
        add("punycode", f"The domain uses international characters (shown as {u.host_ascii}).",
            "Look-alike characters from other alphabets can imitate a real brand name."
            + (f" Scripts mixed: {', '.join(sorted(mixed))}." if len(mixed) > 1 else ""),
            EvidenceStatus.suspicious if len(mixed) > 1 else EvidenceStatus.unverified,
            {"host_ascii": u.host_ascii, "scripts": sorted(mixed)})
    if u.subdomain and u.subdomain.count(".") >= 2:
        add("deep-subdomain", f"The address has many sub-levels ({u.subdomain}.{shown}).",
            "Long chains of subdomains are used to push the real domain out of view.",
            EvidenceStatus.suspicious)
    lures = sorted({w for w in LURE_WORDS if w in (u.host + u.path).lower()})
    if lures:
        add("lure-words", f"The link contains words often used in phishing: {', '.join(lures)}.",
            "These words try to make a page look official or urgent. On their own they prove nothing.",
            EvidenceStatus.unverified, {"words": lures})
    if (u.domain_label or "").count("-") >= 2:
        add("hyphens", f"The domain name has several hyphens ({u.registrable_domain}).",
            "Phishing domains often join a brand name with extra words using hyphens.",
            EvidenceStatus.unverified)
    if "unknown-suffix" in u.notes:
        add("suffix", f"'{host}' does not end in a known domain suffix.",
            "RAQEEB could not identify the registrable domain, so identity checks are limited.",
            EvidenceStatus.missing)
    return ev
