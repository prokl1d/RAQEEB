"""Static facts about a fetched HTML page, for zero-day phishing detection.

Safety: the page is treated as untrusted TEXT. It is capped (see safe_fetch), decoded, and
scanned with regular expressions only. Nothing is rendered, executed, or followed from here.
"""

from __future__ import annotations

import html
import re
from dataclasses import dataclass, field
from urllib.parse import urljoin, urlsplit

# Every pattern is bounded ({0,N}) so a hostile page can't trigger slow (quadratic) matching.
_PASSWORD = re.compile(r"<input[^>]{0,600}?type\s*=\s*[\"']?password", re.I)
_FORM_ACTION = re.compile(r"<form[^>]{0,600}?action\s*=\s*[\"']([^\"']{1,500})[\"']", re.I)
_META_REFRESH = re.compile(r"<meta[^>]{0,400}?http-equiv\s*=\s*[\"']?refresh[^>]{0,400}?content\s*=\s*[\"'][^\"']{0,40}?url\s*=\s*([^\"'>\s]{1,500})", re.I)
_JS_REDIRECT = re.compile(r"(?:window|document|top|self)\.location(?:\.href)?\s*=\s*[\"'](https?://[^\"']{1,500})[\"']", re.I)
_CARD = re.compile(r"(?:card\s*number|cardnumber|cc-number|\bcvv\b|\bcvc\b|expiry|رقم\s*البطاقة)", re.I)
_OTP = re.compile(r"(?:one[-\s]?time\s*(?:password|code)|\botp\b|verification\s*code|رمز\s*التحقق)", re.I)


def _title(body: str, low: str) -> str:
    i = low.find("<title")
    if i < 0:
        return ""
    j = low.find(">", i)
    k = low.find("</title", j) if j >= 0 else -1
    return body[j + 1:k] if j >= 0 and k > j else ""


def _visible_text(body: str, low: str, limit: int = 3000) -> str:
    """Text outside tags, scripts and styles. Single linear pass (no backtracking regex)."""
    out: list[str] = []
    size, i, n = 0, 0, len(body)
    while i < n and size < limit * 2:
        j = body.find("<", i)
        if j < 0:
            out.append(body[i:])
            break
        if j > i:
            out.append(body[i:j])
            size += j - i
        for tag in ("script", "style"):
            if low.startswith("<" + tag, j):
                k = low.find("</" + tag, j)
                i = n if k < 0 else k + len(tag) + 2
                break
        else:
            k = body.find(">", j)
            i = n if k < 0 else k + 1
            continue
        k2 = body.find(">", i) if i < n else -1
        i = n if k2 < 0 else k2 + 1
    return re.sub(r"\s+", " ", html.unescape(" ".join(out)))[:limit]


@dataclass
class PageFacts:
    title: str = ""
    has_password: bool = False
    asks_card: bool = False
    asks_otp: bool = False
    external_form_hosts: list[str] = field(default_factory=list)
    client_redirect: str | None = None  # meta refresh / JS redirect target
    text_sample: str = ""  # first visible words, for brand detection
    bytes_read: int = 0


def analyze_html(body: str, base_url: str, nbytes: int) -> PageFacts:
    p = PageFacts(bytes_read=nbytes)
    low = body.lower()
    p.title = re.sub(r"\s+", " ", html.unescape(_title(body, low))).strip()[:200]
    p.has_password = bool(_PASSWORD.search(body))
    visible = _visible_text(body, low)
    p.text_sample = visible
    p.asks_card = bool(_CARD.search(visible))
    p.asks_otp = bool(_OTP.search(visible))
    base_host = (urlsplit(base_url).hostname or "").lower()
    for action in _FORM_ACTION.findall(body)[:10]:
        try:
            h = (urlsplit(urljoin(base_url, html.unescape(action))).hostname or "").lower()
        except ValueError:
            continue
        if h and h != base_host and h not in p.external_form_hosts:
            p.external_form_hosts.append(h)
    for rx in (_META_REFRESH, _JS_REDIRECT):
        m = rx.search(body)
        if m:
            try:
                p.client_redirect = urljoin(base_url, html.unescape(m.group(1)).strip())
            except ValueError:
                pass
            break
    return p
