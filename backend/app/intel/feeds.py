"""Known-phishing feeds, cached locally: threat intelligence with no API key and no account.

Sources (public, free):
  OpenPhish Community feed   https://openphish.com/feed.txt (refreshed every 12 hours upstream)
  Phishing.Database (MIT)    https://github.com/Phishing-Database/Phishing.Database

The lookup is local: the investigated link is never sent anywhere. Refresh the cache with
    python -m app.intel.feeds update
Cache files live in app/data/feeds/ (git-ignored). With no cache the check reports "missing",
never "clean".
"""

from __future__ import annotations

import sys
import threading
import time
from pathlib import Path
from urllib.parse import urlsplit

from app.intel.clients import IntelResult

FEED_DIR = Path(__file__).resolve().parent.parent / "data" / "feeds"
SOURCES = {
    "openphish.txt": "https://openphish.com/feed.txt",
    "phishing_database.txt": "https://raw.githubusercontent.com/Phishing-Database/Phishing.Database/master/phishing-links-ACTIVE.txt",
}
SERVICE = "Known-phishing feeds (OpenPhish, Phishing.Database; local copy)"


def _norm(url: str) -> str:
    u = url.strip().lower()
    for p in ("https://", "http://"):
        if u.startswith(p):
            u = u[len(p):]
    return u.rstrip("/")


_lock = threading.Lock()
_state: dict = {}


def _host_of(line: str) -> str:
    rest = line.split("://", 1)[1]
    host = rest.split("/", 1)[0].split("?", 1)[0].split("#", 1)[0]
    return host.rsplit("@", 1)[-1].split(":", 1)[0].lower()


def _load() -> tuple[frozenset[int], frozenset[str], float] | None:
    """Parse the cached feeds once (about a second for ~700k links). Thread-safe."""
    with _lock:
        if "data" in _state:
            return _state["data"]
        files = list(FEED_DIR.glob("*.txt")) if FEED_DIR.exists() else []
        if not files:
            _state["data"] = None
            return None
        urls: set[int] = set()
        hosts: set[str] = set()
        for f in files:
            with f.open(encoding="utf-8", errors="ignore") as fh:
                for line in fh:
                    if not line.startswith(("http://", "https://")):
                        continue
                    line = line.strip()
                    urls.add(hash(_norm(line)))  # hashes keep memory small; process-local is enough
                    h = _host_of(line)
                    if h:
                        hosts.add(h)
        _state["data"] = (frozenset(urls), frozenset(hosts), max(f.stat().st_mtime for f in files))
        return _state["data"]


def preload() -> None:
    """Start parsing in the background so the first investigation doesn't wait."""
    threading.Thread(target=_load, daemon=True, name="feed-preload").start()


def _reset() -> None:
    with _lock:
        _state.clear()


def lookup(url: str, *, shared_host: bool) -> IntelResult:
    """Exact link match, or host match when the host isn't a shared platform."""
    if "data" not in _state and _lock.locked():
        return IntelResult(SERVICE, "missing", "the local feed copy is still loading; try again in a moment")
    data = _load()
    if data is None:
        return IntelResult(SERVICE, "missing", "no local feed copy (run: python -m app.intel.feeds update)")
    urls, hosts, newest = data
    age_h = (time.time() - newest) / 3600
    when = f"feed copy {age_h:.0f} h old"
    n = _norm(url)
    host = (urlsplit(url).hostname or "").lower()
    if hash(n) in urls:
        return IntelResult(SERVICE, "found", f"this exact link is listed as phishing ({when})", {"match": "url"})
    if host and host in hosts and not shared_host:
        return IntelResult(SERVICE, "found", f"this website ({host}) is listed as phishing ({when})", {"match": "host"})
    return IntelResult(SERVICE, "not_found", f"not in the known-phishing lists ({when})", {})


def update() -> None:
    import httpx

    FEED_DIR.mkdir(parents=True, exist_ok=True)
    for name, src in SOURCES.items():
        r = httpx.get(src, timeout=60, follow_redirects=True)
        r.raise_for_status()
        (FEED_DIR / name).write_text(r.text, encoding="utf-8")
        print(f"{name}: {r.text.count(chr(10))} lines")
    _reset()


if __name__ == "__main__":
    if sys.argv[1:] == ["update"]:
        update()
    else:
        print(__doc__)
