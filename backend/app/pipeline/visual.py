"""Visual brand match: does this page LOOK like a real brand's sign-in page?

Phishing kits copy a brand's login page pixel for pixel, then host it on another domain. RAQEEB
keeps a small fingerprint of each real login page (app/data/brand_refs.json): a 64-bit
difference hash of the page layout and its main colours. Only these numbers are stored, not
the pages. A screenshot of the investigated page is fingerprinted the same way; if it is close
to a brand's page while the domain is not that brand's, that is strong evidence of imitation.

Build or refresh the references (needs the optional "visual" extra and a browser):
    python -m app.pipeline.visual build
"""

from __future__ import annotations

import asyncio
import json
import re
import sys
from functools import lru_cache
from pathlib import Path

REFS = Path(__file__).resolve().parent.parent / "data" / "brand_refs.json"
# Official sign-in pages to learn from: brand key -> (display name, official domains, page URLs).
SOURCES: dict[str, tuple[str, list[str], list[str]]] = {
    "microsoft": ("Microsoft", ["microsoftonline.com", "live.com", "microsoft.com", "office.com"],
                  ["https://login.microsoftonline.com/", "https://login.live.com/"]),
    "google": ("Google", ["google.com"], ["https://accounts.google.com/signin"]),
    "paypal": ("PayPal", ["paypal.com"], ["https://www.paypal.com/signin"]),
    "apple": ("Apple", ["apple.com", "icloud.com"], ["https://appleid.apple.com/sign-in"]),
    "netflix": ("Netflix", ["netflix.com"], ["https://www.netflix.com/login"]),
    "facebook": ("Facebook", ["facebook.com"], ["https://www.facebook.com/login/"]),
    "instagram": ("Instagram", ["instagram.com"], ["https://www.instagram.com/accounts/login/"]),
    "linkedin": ("LinkedIn", ["linkedin.com"], ["https://www.linkedin.com/login"]),
    "dropbox": ("Dropbox", ["dropbox.com"], ["https://www.dropbox.com/login"]),
    "docusign": ("DocuSign", ["docusign.com", "docusign.net"], ["https://account.docusign.com/"]),
    "coinbase": ("Coinbase", ["coinbase.com"], ["https://www.coinbase.com/signin"]),
    "github": ("GitHub", ["github.com"], ["https://github.com/login"]),
    "emirates-nbd": ("Emirates NBD", ["emiratesnbd.com"], ["https://online.emiratesnbd.com/"]),
    "uae-pass": ("UAE PASS", ["uaepass.ae"], ["https://id.uaepass.ae/"]),
    "emirates-post": ("Emirates Post", ["emiratespost.ae"], ["https://www.emiratespost.ae/"]),
    "dewa": ("DEWA", ["dewa.gov.ae"], ["https://www.dewa.gov.ae/en"]),
}
# Bot-protection and error pages look alike everywhere; they must never become a brand reference.
BOT_WALL = re.compile(r"just a moment|access denied|attention required|captcha|are you a robot|forbidden|error", re.I)
N = 16  # 16 x 16 = 256-bit difference hash
MAX_HASH_DISTANCE = 40  # of 256 bits; calibrated in docs/EVALUATION.md
MAX_COLOUR_DISTANCE = 45.0  # mean RGB distance of the two main colours
MIN_DETAIL = 24  # pages with fewer "edges" than this (blank, loading, spinner) are never compared


def fingerprint(img) -> dict:
    """256-bit difference hash of the top of the page (logo + login form) + main colours + detail."""
    from PIL import Image, ImageChops

    w, h = img.size
    top = img.convert("RGB").crop((0, 0, w, int(h * 0.75)))
    # Trim the plain background around the content (minimalist login pages are mostly empty
    # space), so the login card fills the hash wherever the clone places it.
    bg = top.getpixel((2, top.size[1] - 3))
    diff = ImageChops.difference(top, Image.new("RGB", top.size, bg)).convert("L").point(lambda v: 255 if v > 18 else 0)
    box = diff.getbbox()
    if box and (box[2] - box[0]) * (box[3] - box[1]) > 0.02 * top.size[0] * top.size[1]:
        pad = 12
        top = top.crop((max(0, box[0] - pad), max(0, box[1] - pad), min(top.size[0], box[2] + pad), min(top.size[1], box[3] + pad)))
    g = top.convert("L").resize((N + 1, N))
    px = list(g.getdata())
    bits, detail = 0, 0
    for row in range(N):
        for col in range(N):
            a, b = px[row * (N + 1) + col], px[row * (N + 1) + col + 1]
            bits = (bits << 1) | (a > b)
            detail += abs(a - b) > 8  # a real edge, not noise
    q = top.resize((64, 48)).quantize(colors=4)
    pal = q.getpalette()[:12]
    counts = sorted(q.getcolors(), reverse=True)
    colours = [pal[i * 3:i * 3 + 3] for _, i in counts[:4]]
    return {"dhash": f"{bits:064x}", "colours": colours, "detail": detail}


def _hamming(a: str, b: str) -> int:
    return bin(int(a, 16) ^ int(b, 16)).count("1")


def _colour_distance(a: list, b: list) -> float:
    if not a or not b:
        return 999.0
    total = 0.0
    for c in a[:2]:  # the two most common colours must each have a close partner
        total += min(sum((x - y) ** 2 for x, y in zip(c, d)) ** 0.5 for d in b)
    return total / min(2, len(a))


@lru_cache
def references() -> dict:
    return json.loads(REFS.read_text(encoding="utf-8")) if REFS.exists() else {}


def match(fp: dict, domain: str) -> dict | None:
    """The brand whose real login page this page looks like, if the domain isn't that brand's."""
    best = None
    if fp.get("detail", 0) < MIN_DETAIL:
        return None  # nearly blank page: nothing to compare
    for key, ref in references().items():
        if any(domain == d or domain.endswith("." + d) for d in ref["domains"]):
            continue
        for r in ref["prints"]:
            if r.get("detail", 0) < MIN_DETAIL:
                continue
            hd = _hamming(fp["dhash"], r["dhash"])
            cd = _colour_distance(fp["colours"], r["colours"])
            if hd <= MAX_HASH_DISTANCE and cd <= MAX_COLOUR_DISTANCE:
                score = round(100 * (1 - hd / (N * N)))
                if not best or score > best["similarity"]:
                    best = {"brand": key, "name": ref["name"], "similarity": score, "hash_distance": hd,
                            "official": ref["domains"], "reference_page": r["url"]}
    return best


async def build() -> None:
    from app.net.screenshot import capture, shutdown

    out: dict = {}
    for key, (name, domains, urls) in SOURCES.items():
        prints = []
        for u in urls:
            shot = await capture(u)
            if shot and shot.image is not None and BOT_WALL.search(shot.title):
                print(f"  {key}: {u} -> bot-protection page, skipped")
            elif shot and shot.image is not None and fingerprint(shot.image)["detail"] < MIN_DETAIL:
                print(f"  {key}: {u} -> nearly blank page, skipped")
            elif shot and shot.image is not None:
                prints.append({"url": u, **fingerprint(shot.image)})
                print(f"  {key}: {u} -> {ascii(shot.title[:50])}")
            else:
                print(f"  {key}: {u} -> no screenshot")
        if prints:
            out[key] = {"name": name, "domains": domains, "prints": prints}
    await shutdown()
    REFS.parent.mkdir(parents=True, exist_ok=True)
    REFS.write_text(json.dumps(out, indent=1), encoding="utf-8")
    print(f"{len(out)} brands written to app/data/brand_refs.json")


if __name__ == "__main__":
    if sys.argv[1:] == ["build"]:
        asyncio.run(build())
    else:
        print(__doc__)
