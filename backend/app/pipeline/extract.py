"""Steps 1-3: validate input, extract text-level facts, extract and normalise URLs.

Pure functions, no network. Investigated text is untrusted data.
"""

from __future__ import annotations

import ipaddress
import re
from dataclasses import dataclass, field
from urllib.parse import urlsplit

import idna
import tldextract

# Offline public-suffix list (bundled snapshot); never fetch at runtime.
_tld = tldextract.TLDExtract(suffix_list_urls=(), cache_dir=None)


class InputError(ValueError):
    """Raised for input that cannot be investigated (shown to the user as-is)."""


# ---------- refanging ("hxxp://evil[.]com" -> "http://evil.com") ----------

_REFANG = [
    (re.compile(r"h(xx|\*\*|tt)p(s?)\s*(\[:\]|:)//", re.I), r"http\2://"),
    (re.compile(r"\[\s*\.\s*\]|\(\s*\.\s*\)|\{\s*\.\s*\}"), "."),
    (re.compile(r"\[\s*dot\s*\]|\(\s*dot\s*\)", re.I), "."),
    (re.compile(r"\[:\]"), ":"),
]


def refang(text: str) -> str:
    for pattern, repl in _REFANG:
        text = pattern.sub(repl, text)
    return text


# ---------- URL candidates ----------

# Explicit scheme URLs, or bare host[/path] that looks like a domain.
_URL_RE = re.compile(
    r"""(?ix)
    (?<![@\w.-])                                   # not part of an email / longer token
    (
      (?:https?://)[^\s<>"'`]+                      # scheme URL
      |
      (?:www\.)?(?:[\w-]+\.)+[a-z¡-￿-]{2,}  # bare domain (unicode TLDs allowed)
      (?::\d{2,5})?(?:/[^\s<>"'`]*)?
    )
    """
)
_TRAILING = ".,;:!?)]}>'\"»”’"
_EMAIL_RE = re.compile(r"[\w.+-]+@[\w-]+(?:\.[\w-]+)+")


@dataclass
class ParsedUrl:
    raw: str
    url: str  # normalised, with scheme
    scheme: str
    host: str  # lower-case, unicode form
    host_ascii: str  # punycode / ASCII form
    port: int | None
    path: str
    query: str
    has_userinfo: bool
    is_ip: bool
    registrable_domain: str  # e.g. "emiratesnbd.com"; "" for IPs / unknown suffix
    subdomain: str
    domain_label: str  # registrable label without suffix, e.g. "emiratesnbd"
    suffix: str
    had_scheme: bool
    notes: list[str] = field(default_factory=list)


def parse_url(raw: str) -> ParsedUrl:
    """Normalise one URL. Raises InputError if it cannot be a web URL."""
    candidate = raw.strip().strip(_TRAILING)
    if not candidate:
        raise InputError("The link is empty.")
    had_scheme = bool(re.match(r"(?i)^[a-z][a-z0-9+.-]*://", candidate))
    if not had_scheme:
        candidate = "http://" + candidate
    try:
        parts = urlsplit(candidate)
        port = parts.port
    except ValueError as exc:
        raise InputError(f"This doesn't look like a valid link ({exc}).") from None
    scheme = parts.scheme.lower()
    if scheme not in ("http", "https"):
        raise InputError("Only http and https links can be investigated.")
    host = (parts.hostname or "").rstrip(".")
    if not host:
        raise InputError("The link has no website address.")

    notes: list[str] = []
    is_ip = _is_ip(host)
    if is_ip:
        host_ascii = host_unicode = host
    else:
        try:
            host_unicode = idna.decode(host) if "xn--" in host.lower() else host
        except idna.IDNAError:
            host_unicode = host
            notes.append("invalid-punycode")
        try:
            host_ascii = idna.encode(host_unicode, uts46=True).decode("ascii")
        except idna.IDNAError:
            host_ascii = host.encode("ascii", "replace").decode()
            notes.append("unencodable-host")
        host_unicode = host_unicode.lower()
        host_ascii = host_ascii.lower()

    ext = _tld(host_ascii) if not is_ip else None
    registrable = ""
    label = sub = suffix = ""
    if ext and ext.suffix and ext.domain:
        suffix = ext.suffix
        label_ascii = ext.domain
        sub = ext.subdomain
        registrable = f"{label_ascii}.{suffix}"
        label = _to_unicode(label_ascii)
    elif not is_ip:
        notes.append("unknown-suffix")

    return ParsedUrl(
        raw=raw,
        url=parts._replace(scheme=scheme).geturl(),
        scheme=scheme,
        host=host_unicode,
        host_ascii=host_ascii,
        port=port,
        path=parts.path or "/",
        query=parts.query,
        has_userinfo="@" in parts.netloc,
        is_ip=is_ip,
        registrable_domain=registrable,
        subdomain=sub,
        domain_label=label,
        suffix=suffix,
        had_scheme=had_scheme,
        notes=notes,
    )


def extract_urls(text: str, limit: int = 10) -> list[ParsedUrl]:
    """Find links in free text (including defanged ones). De-duplicated, in order."""
    text = _EMAIL_RE.sub(" ", refang(text))  # emails are not links
    found: list[ParsedUrl] = []
    seen: set[str] = set()
    for m in _URL_RE.finditer(text):
        token = m.group(1).rstrip(_TRAILING)
        try:
            parsed = parse_url(token)
        except InputError:
            continue
        # Bare tokens must end in a real public suffix (avoids "e.g", "file.txt" noise).
        if not parsed.had_scheme and not parsed.registrable_domain:
            continue
        if not parsed.had_scheme and parsed.suffix.lower() in _FILE_LIKE_SUFFIXES:
            continue
        key = parsed.host_ascii + parsed.path + "?" + parsed.query
        if key in seen:
            continue
        seen.add(key)
        found.append(parsed)
        if len(found) >= limit:
            break
    return found


# Real TLDs that are far more often file extensions in chat text.
_FILE_LIKE_SUFFIXES = {"zip", "mov", "py", "sh", "md", "pdf", "txt", "jpg", "png", "exe"}


def _is_ip(host: str) -> bool:
    try:
        ipaddress.ip_address(host.strip("[]"))
        return True
    except ValueError:
        return False


def _to_unicode(label: str) -> str:
    try:
        return idna.decode(label) if label.startswith("xn--") else label
    except idna.IDNAError:
        return label


# ---------- input validation ----------

def validate_message(text: str | None, max_chars: int) -> str:
    if text is None or not text.strip():
        raise InputError("Please paste the message you want to investigate.")
    if len(text) > max_chars:
        raise InputError(f"The message is too long (max {max_chars:,} characters).")
    # Drop control characters except newlines/tabs.
    return re.sub(r"[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]", "", text)


def validate_url(raw: str | None, max_chars: int = 2048) -> ParsedUrl:
    if raw is None or not raw.strip():
        raise InputError("Please paste the link you want to investigate.")
    if len(raw) > max_chars:
        raise InputError(f"The link is too long (max {max_chars:,} characters).")
    parsed = parse_url(refang(raw.strip()))
    if not parsed.is_ip and not parsed.registrable_domain:
        raise InputError("This doesn't look like a website address RAQEEB can check.")
    return parsed
