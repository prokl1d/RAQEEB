"""Calibrates the visual brand match threshold on real pages.

  same   : each official login page captured again -> distance to its own reference (should be SMALL)
  legit  : random real websites (Tranco 100k-1M tuning set) -> distance to the nearest brand (should be LARGE)
  phish  : OpenPhish tuning links -> distance to the nearest brand (lower = more clones caught)

Usage: python -m eval.visual_calibrate [n_legit] [n_phish]
"""

from __future__ import annotations

import asyncio
import csv
import json
import sys
from pathlib import Path

from app.net.screenshot import capture, shutdown
from app.pipeline.visual import MIN_DETAIL, N, _colour_distance, _hamming, fingerprint, references

DATA = Path(__file__).with_name("data")


def nearest(fp: dict, skip: str | None = None) -> tuple[int, float, str]:
    best = (999, 999.0, "")
    for key, ref in references().items():
        if key == skip:
            continue
        for r in ref["prints"]:
            if r.get("detail", 0) < MIN_DETAIL:
                continue
            hd = _hamming(fp["dhash"], r["dhash"])
            if hd < best[0]:
                best = (hd, _colour_distance(fp["colours"], r["colours"]), key)
    return best


async def shots(urls: list[str]) -> list[tuple[str, dict | None]]:
    async def one(u):
        s = await capture(u)
        return u, (fingerprint(s.image) if s and s.image is not None else None)
    return list(await asyncio.gather(*(one(u) for u in urls)))


async def main(n_legit: int, n_phish: int) -> None:
    out = {"same": [], "legit": [], "phish": []}
    for key, ref in references().items():
        for r in ref["prints"]:
            for u, fp in await shots([r["url"]]):
                if fp:
                    own = min(_hamming(fp["dhash"], x["dhash"]) for x in ref["prints"])
                    out["same"].append((key, own, fp["detail"]))
    rows = lambda f: [r["url"] for r in csv.DictReader((DATA / f).open(encoding="utf-8"))]  # noqa: E731
    for name, urls in (("legit", rows("legit_tranco.csv")[:n_legit]), ("phish", rows("phish_openphish.csv")[:n_phish])):
        for u, fp in await shots(urls):
            if fp and fp["detail"] >= MIN_DETAIL:
                hd, cd, key = nearest(fp)
                out[name].append((u, hd, round(cd, 1), key))
    await shutdown()
    print(f"bits: {N * N}")
    print("same page again  :", sorted(x[1] for x in out["same"]))
    print("real sites, min  :", sorted(x[1] for x in out["legit"])[:10], f"(n={len(out['legit'])})")
    print("phishing, closest:", sorted((x[1], x[3], round(x[2])) for x in out["phish"])[:15], f"(n={len(out['phish'])})")
    Path(__file__).with_name("results").mkdir(exist_ok=True)
    (Path(__file__).with_name("results") / "visual_calibration.json").write_text(json.dumps(out, indent=1), encoding="utf-8")


if __name__ == "__main__":
    a = sys.argv[1:]
    asyncio.run(main(int(a[0]) if a else 80, int(a[1]) if len(a) > 1 else 120))
