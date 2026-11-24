"""SSRF-safe network access for investigated (untrusted) URLs. See docs/PLAN.md section 15.

Rules:
- only http/https, only to public (globally routable) IP addresses
- DNS is resolved once per hop; the connection goes to that validated IP (no DNS rebinding),
  with the original hostname used for TLS SNI and certificate checks
- redirects are followed manually (max N), every hop re-validated
- short timeouts; the body is never executed or rendered. Only the final HTML page is read as
  text, capped at PAGE_CAP bytes, for static phishing checks (app/net/page.py)
"""

from __future__ import annotations

import asyncio
import ipaddress
import re
import socket
import ssl
from collections.abc import Awaitable, Callable
from dataclasses import dataclass, field
from datetime import datetime, timezone
from urllib.parse import urljoin

import httpx

from app.config import settings
from app.net.page import PageFacts, analyze_html
from app.net.tlsctx import shared_context
from app.pipeline.extract import InputError, ParsedUrl, parse_url

Resolver = Callable[[str, int], Awaitable[list[str]]]
# An Android phone, for the cloaking check: many scam kits only show the real page to phones.
MOBILE_UA = ("Mozilla/5.0 (Linux; Android 14; SM-S918B) AppleWebKit/537.36 (KHTML, like Gecko) "
             "Chrome/131.0 Mobile Safari/537.36")
PAGE_CAP = 256 * 1024
# A normal browser identity: phishing kits often show a blank page to anything that looks like a bot.
BROWSER_UA = ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) "
              "Chrome/131.0 Safari/537.36")


class BlockedDestination(Exception):
    """The destination is not a public internet address."""


_NUMERIC_HOST = re.compile(r"^(0x[0-9a-f]+|\d+)(\.(0x[0-9a-f]+|\d+)){0,3}$", re.I)


def legacy_numeric_ip(host: str) -> str | None:
    """Decode disguised IPv4 forms ('2130706433', '0x7f.1', '017700000001') to dotted form."""
    if not _NUMERIC_HOST.match(host):
        return None
    try:
        return socket.inet_ntoa(socket.inet_aton(host))
    except OSError:
        return None


def is_public_ip(ip: str) -> bool:
    addr = ipaddress.ip_address(ip)
    if isinstance(addr, ipaddress.IPv6Address) and addr.ipv4_mapped:
        addr = addr.ipv4_mapped
    return addr.is_global and not addr.is_multicast


async def system_resolve(host: str, port: int) -> list[str]:
    loop = asyncio.get_running_loop()
    infos = await asyncio.wait_for(
        loop.getaddrinfo(host, port, type=socket.SOCK_STREAM), timeout=settings.http_timeout_seconds
    )
    return sorted({info[4][0] for info in infos})


async def resolve_public(host: str, port: int, resolver: Resolver = system_resolve) -> str:
    """Resolve and return one public IP. Raises BlockedDestination if ANY address is not public."""
    try:
        ips = await resolver(host.strip("[]"), port)
    except (socket.gaierror, asyncio.TimeoutError, OSError) as exc:
        raise LookupError(f"could not resolve {host}: {exc}") from None
    if not ips:
        raise LookupError(f"no addresses for {host}")
    bad = [ip for ip in ips if not is_public_ip(ip)]
    if bad:
        raise BlockedDestination(f"{host} resolves to a non-public address ({', '.join(bad)})")
    return ips[0]


@dataclass
class Hop:
    url: str
    host: str
    ip: str | None
    status: int | None
    location: str | None = None


@dataclass
class FetchResult:
    hops: list[Hop] = field(default_factory=list)
    final_url: str | None = None
    error: str | None = None
    blocked: bool = False
    too_many_redirects: bool = False
    page: PageFacts | None = None


def _ip_url(u: ParsedUrl, ip: str) -> str:
    host = f"[{ip}]" if ":" in ip else ip
    port = f":{u.port}" if u.port else ""
    q = f"?{u.query}" if u.query else ""
    return f"{u.scheme}://{host}{port}{u.path}{q}"


async def safe_fetch(
    start: ParsedUrl,
    *,
    resolver: Resolver = system_resolve,
    transport: httpx.AsyncBaseTransport | None = None,
    max_redirects: int | None = None,
    user_agent: str | None = None,
) -> FetchResult:
    """Follow the redirect chain of `start` safely. Only the final HTML page is read, as capped text."""
    limit = settings.max_redirects if max_redirects is None else max_redirects
    result = FetchResult()
    current = start
    timeout = httpx.Timeout(settings.http_timeout_seconds)
    async with httpx.AsyncClient(
        transport=transport, timeout=timeout, follow_redirects=False, verify=shared_context()
    ) as client:
        for _ in range(limit + 1):
            port = current.port or (443 if current.scheme == "https" else 80)
            try:
                ip = current.host_ascii if current.is_ip else legacy_numeric_ip(current.host_ascii)
                if ip:
                    if not is_public_ip(ip.strip("[]")):
                        raise BlockedDestination(f"{ip} is not a public address")
                else:
                    ip = await resolve_public(current.host_ascii, port, resolver)
            except BlockedDestination as exc:
                result.hops.append(Hop(current.url, current.host, None, None))
                result.error, result.blocked = str(exc), True
                return result
            except LookupError as exc:
                result.hops.append(Hop(current.url, current.host, None, None))
                result.error = str(exc)
                return result

            headers = {"Host": current.host_ascii + (f":{current.port}" if current.port else ""),
                       "User-Agent": user_agent or BROWSER_UA,
                       "Accept": "text/html,*/*;q=0.5"}
            ext = {"sni_hostname": current.host_ascii} if current.scheme == "https" and not current.is_ip else {}
            try:
                req = client.build_request("GET", _ip_url(current, ip), headers=headers, extensions=ext)
                resp = await client.send(req, stream=True)
                body = b""
                ctype = resp.headers.get("content-type", "")
                if resp.status_code == 200 and "html" in ctype.lower():
                    try:
                        async for chunk in resp.aiter_bytes():
                            body += chunk
                            if len(body) >= PAGE_CAP:
                                break
                    except httpx.HTTPError:
                        pass  # a partial page is fine; it is optional evidence
                await resp.aclose()
            except httpx.HTTPError as exc:
                result.hops.append(Hop(current.url, current.host, ip, None))
                result.error = f"{type(exc).__name__}: {exc}"[:200]
                return result

            location = resp.headers.get("location")
            result.hops.append(Hop(current.url, current.host, ip, resp.status_code, location))
            if resp.status_code in (301, 302, 303, 307, 308) and location:
                try:
                    current = parse_url(urljoin(current.url, location))
                except InputError as exc:
                    result.error = f"redirect to an invalid address: {exc}"
                    return result
                continue
            result.final_url = current.url
            if body:
                try:
                    result.page = analyze_html(body[:PAGE_CAP].decode("utf-8", "replace"), current.url, len(body))
                except Exception:  # noqa: BLE001 - page facts are optional
                    result.page = None
            return result
    result.too_many_redirects = True
    result.error = f"more than {limit} redirects"
    return result


# ---------- TLS certificate ----------

@dataclass
class TlsInfo:
    ok: bool
    error: str | None = None
    issuer: str | None = None
    not_before: datetime | None = None
    not_after: datetime | None = None
    days_since_issued: int | None = None


def _cert_time(value: str) -> datetime:
    return datetime.fromtimestamp(ssl.cert_time_to_seconds(value), tz=timezone.utc)


def _tls_blocking(ip: str, host: str, port: int) -> TlsInfo:
    ctx = shared_context()  # Mozilla CA bundle, parsed once (app/net/tlsctx.py)
    try:
        with socket.create_connection((ip, port), timeout=settings.http_timeout_seconds) as sock:
            with ctx.wrap_socket(sock, server_hostname=host) as tls:
                cert = tls.getpeercert()
    except ssl.SSLCertVerificationError as exc:
        return TlsInfo(ok=False, error=f"certificate not valid for this site: {exc.verify_message}")
    except (OSError, ssl.SSLError) as exc:
        return TlsInfo(ok=False, error=f"{type(exc).__name__}: {exc}"[:200])
    issuer = dict(x[0] for x in cert.get("issuer", ()))
    nb, na = _cert_time(cert["notBefore"]), _cert_time(cert["notAfter"])
    return TlsInfo(
        ok=True,
        issuer=issuer.get("organizationName") or issuer.get("commonName"),
        not_before=nb,
        not_after=na,
        days_since_issued=(datetime.now(timezone.utc) - nb).days,
    )


async def tls_info(u: ParsedUrl, resolver: Resolver = system_resolve) -> TlsInfo:
    port = u.port or 443
    try:
        ip = await resolve_public(u.host_ascii, port, resolver)
    except (BlockedDestination, LookupError) as exc:
        return TlsInfo(ok=False, error=str(exc))
    return await asyncio.to_thread(_tls_blocking, ip, u.host_ascii, port)
