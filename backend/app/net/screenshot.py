"""Sandboxed screenshots of investigated pages (optional: `pip install -e ".[visual]"`).

Rendering a scam page runs its scripts, so it is fenced in:
  - a fresh private browser context per page (no cookies, storage or cache shared);
  - EVERY request the page makes (scripts, images, frames, redirects) passes the same check as
    RAQEEB's safe fetcher: http/https to public IP addresses only, so a page can't reach
    localhost or a private network; other schemes are refused;
  - downloads, service workers, permission prompts and pop-up dialogs are blocked;
  - a hard time limit, a small viewport, and at most 2 pages at a time.
Residual risk, stated honestly: the browser resolves DNS itself after RAQEEB's check, so a fast
DNS change ("rebinding") could slip through. In production the screenshot worker belongs in an
isolated container with no route to internal networks.
Uses the installed Microsoft Edge (or Chrome); if neither the library nor a browser is
available, screenshots are reported as "not taken", never faked.
"""

from __future__ import annotations

import asyncio
import base64
import hashlib
import io
from dataclasses import dataclass
from datetime import datetime, timezone
from urllib.parse import urlsplit

from app.net.safe_fetch import BlockedDestination, is_public_ip, legacy_numeric_ip, resolve_public

VIEWPORT = {"width": 1280, "height": 800}
TIME_LIMIT = 15.0


@dataclass
class Shot:
    jpeg_b64: str
    sha256: str  # of the JPEG bytes, for the evidence chain
    final_url: str
    title: str
    taken_utc: str
    image: object | None = None  # PIL image, for visual matching (not serialised)


_state: dict = {}


async def _browser():
    loop = asyncio.get_running_loop()
    if _state.get("loop") is not loop:
        # A browser belongs to the event loop that started it (tests and scripts create new loops).
        _state.clear()
        _state["loop"], _state["lock"], _state["sem"] = loop, asyncio.Lock(), asyncio.Semaphore(2)
    async with _state["lock"]:
        b = _state.get("browser")
        if b is not None and b.is_connected():
            return b
        from playwright.async_api import async_playwright  # optional dependency

        pw = _state.get("pw") or await async_playwright().start()
        _state["pw"] = pw
        last = None
        for channel in ("msedge", "chrome", None):
            try:
                b = await pw.chromium.launch(channel=channel, headless=True,
                                             args=["--disable-extensions", "--disable-background-networking",
                                                   "--no-first-run", "--disable-sync", "--mute-audio"])
                _state["browser"] = b
                return b
            except Exception as exc:  # noqa: BLE001 - try the next browser
                last = exc
        raise RuntimeError(f"no browser available ({type(last).__name__})")


async def _allowed(url: str, cache: dict[str, bool]) -> bool:
    parts = urlsplit(url)
    if parts.scheme in ("data", "blob", "about"):
        return True
    if parts.scheme not in ("http", "https") or not parts.hostname:
        return False
    host = parts.hostname.lower()
    if host in cache:
        return cache[host]
    ok = True
    try:
        ip = legacy_numeric_ip(host)
        if ip:
            ok = is_public_ip(ip.strip("[]"))
        elif host.replace(".", "").isdigit() or ":" in host:
            ok = is_public_ip(host.strip("[]"))
        else:
            await resolve_public(host, parts.port or (443 if parts.scheme == "https" else 80))
    except (BlockedDestination, LookupError, ValueError):
        ok = False
    cache[host] = ok
    return ok


async def capture(url: str) -> Shot | None:
    """Screenshot of the page `url` leads to, or None if it couldn't be taken safely."""
    try:
        from PIL import Image  # optional dependency
    except ImportError:
        return None
    try:
        await _browser()
    except Exception:  # noqa: BLE001 - feature unavailable on this machine
        return None
    async with _state["sem"]:
        try:
            ctx = await _state["browser"].new_context(viewport=VIEWPORT, accept_downloads=False,
                                                      service_workers="block", permissions=[], locale="en-US",
                                                      timezone_id="Asia/Dubai")
        except Exception:  # noqa: BLE001 - browser gone: report "not taken"
            _state.pop("browser", None)
            return None
        cache: dict[str, bool] = {}

        async def guard(route):
            if await _allowed(route.request.url, cache):
                await route.continue_()
            else:
                await route.abort("blockedbyclient")

        try:
            await ctx.route("**/*", guard)
            page = await ctx.new_page()
            page.on("dialog", lambda d: asyncio.ensure_future(d.dismiss()))
            page.set_default_timeout(TIME_LIMIT * 1000)

            async def run():
                await page.goto(url, wait_until="domcontentloaded")
                await page.wait_for_timeout(1500)  # let scripted login forms draw
                return await page.screenshot(type="jpeg", quality=55), page.url, await page.title()

            raw, final, title = await asyncio.wait_for(run(), timeout=TIME_LIMIT + 3)
        except Exception:  # noqa: BLE001 - blocked, timed out or crashed: no screenshot
            return None
        finally:
            await ctx.close()
    img = Image.open(io.BytesIO(raw))
    img.load()
    return Shot(jpeg_b64=base64.b64encode(raw).decode(), sha256=hashlib.sha256(raw).hexdigest(), final_url=final,
                title=(title or "")[:200], taken_utc=datetime.now(timezone.utc).isoformat(timespec="seconds"), image=img)


async def shutdown() -> None:
    b, pw = _state.pop("browser", None), _state.pop("pw", None)
    _state.clear()
    if b:
        await b.close()
    if pw:
        await pw.stop()
