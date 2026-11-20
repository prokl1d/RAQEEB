"""DNS lookups for a registrable domain (only the domain name leaves the server)."""

from __future__ import annotations

from dataclasses import dataclass, field

import dns.asyncresolver
import dns.exception
import dns.resolver

from app.config import settings


@dataclass
class DnsInfo:
    exists: bool | None  # None = lookup failed (unknown)
    records: dict[str, list[str]] = field(default_factory=dict)
    error: str | None = None


async def dns_info(domain: str) -> DnsInfo:
    resolver = dns.asyncresolver.Resolver()
    resolver.lifetime = settings.http_timeout_seconds
    records: dict[str, list[str]] = {}
    nxdomain = False
    errors = 0
    for rtype in ("A", "AAAA", "MX", "NS"):
        try:
            ans = await resolver.resolve(domain, rtype)
            records[rtype] = sorted(r.to_text() for r in ans)[:6]
        except dns.resolver.NXDOMAIN:
            nxdomain = True
            break
        except (dns.resolver.NoAnswer, dns.resolver.NoNameservers):
            records[rtype] = []
        except dns.exception.DNSException:
            errors += 1
    if nxdomain:
        return DnsInfo(exists=False, records={})
    if errors == 4:
        return DnsInfo(exists=None, error="DNS lookup failed")
    return DnsInfo(exists=True, records=records)
