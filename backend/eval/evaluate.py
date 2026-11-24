"""RAQEEB detection-accuracy harness.

Runs every labelled URL in backend/eval/data/*.csv through the real investigation pipeline
(live DNS, TLS, redirects, RDAP) and reports precision, recall and false-positive rate.

  python -m eval.evaluate                       # all datasets, key-free ("zero-day") mode
  python -m eval.evaluate --feeds               # also use the local known-phishing feed cache
  python -m eval.evaluate --only legit_known    # one dataset
  python -m eval.evaluate --reuse               # re-score cached results (no network)

"Flagged" means the verdict is Moderate or High Risk. Inactive (domain gone) and Unknown are
reported separately and are NOT counted as detections, so recall is never inflated.
Paid / rate-limited services (Safe Browsing, VirusTotal, Gemini) are switched off here: the
numbers show what RAQEEB detects on its own, with no API keys.
"""

from __future__ import annotations

import argparse
import asyncio
import csv
import json
import sys
import time
from collections import Counter
from pathlib import Path

HERE = Path(__file__).resolve().parent
DATA = HERE / "data"
RESULTS = HERE / "results"
FLAGGED = {"High Risk", "Moderate Risk"}


def _configure(feeds: bool, visual: bool = False) -> None:
    from app.config import settings
    from app.intel import clients
    from app.pipeline import technical

    settings.ai_provider = "mock"
    settings.offline_demo = False
    settings.network_checks = True
    settings.http_timeout_seconds = 6.0

    async def off(*_a, **_k):
        return clients.IntelResult("disabled", "missing", "disabled in evaluation")

    async def sb_off(*_a, **_k):
        return clients.IntelResult("Google Safe Browsing", "missing", "disabled in evaluation (no key)")

    async def vt_off(*_a, **_k):
        return clients.IntelResult("VirusTotal", "missing", "disabled in evaluation (no key)")

    technical.safe_browsing = sb_off
    technical.virustotal = vt_off
    settings.phish_feeds = feeds
    settings.screenshots = visual
    if feeds:
        from app.intel import feeds as feed_mod
        feed_mod._load()


def load(only: list[str] | None) -> dict[str, list[dict]]:
    sets = {}
    for f in sorted(DATA.glob("*.csv")):
        if only and f.stem not in only:
            continue
        with f.open(encoding="utf-8") as fh:
            sets[f.stem] = list(csv.DictReader(fh))
    return sets


async def run_one(url: str, sem: asyncio.Semaphore) -> dict:
    from app.pipeline.investigate import InvestigationType, investigate

    async with sem:
        t0 = time.perf_counter()
        try:
            r = await asyncio.wait_for(investigate(InvestigationType.url, url=url), timeout=40)
        except Exception as exc:  # noqa: BLE001 - one bad URL must not stop the run
            return {"url": url, "band": "Error", "score": None, "error": f"{type(exc).__name__}: {exc}"[:200]}
        sus = [e.id.split(".", 1)[-1] for e in r.evidence if e.status.value in ("suspicious", "confirmed")]
        return {"url": url, "band": r.score.band.value, "score": r.score.score, "identity": r.identity.outcome.value,
                "signals": sus, "secs": round(time.perf_counter() - t0, 1)}


def metrics(results: dict[str, list[dict]], labels: dict[str, str]) -> str:
    out = []
    tp = fn = fp = tn = 0
    out.append(f"{'dataset':<22}{'n':>5}{'flagged':>9}{'rate':>8}   bands")
    for name, rows in results.items():
        bands = Counter(r["band"] for r in rows)
        flagged = sum(bands[b] for b in FLAGGED)
        rate = flagged / len(rows) if rows else 0
        out.append(f"{name:<22}{len(rows):>5}{flagged:>9}{rate:>8.1%}   " + ", ".join(f"{b}: {c}" for b, c in bands.most_common()))
        if labels[name] == "phish":
            tp += flagged
            fn += len(rows) - flagged
        else:
            fp += flagged
            tn += len(rows) - flagged
    prec = tp / (tp + fp) if tp + fp else 0
    rec = tp / (tp + fn) if tp + fn else 0
    f1 = 2 * prec * rec / (prec + rec) if prec + rec else 0
    fpr = fp / (fp + tn) if fp + tn else 0
    out.append("")
    out.append(f"precision {prec:.1%}   recall {rec:.1%}   F1 {f1:.1%}   false-positive rate {fpr:.1%}"
               f"   (TP {tp}, FN {fn}, FP {fp}, TN {tn})")
    return "\n".join(out)


async def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--feeds", action="store_true", help="use the local known-phishing feed cache")
    ap.add_argument("--visual", action="store_true", help="also take sandboxed screenshots for visual brand match")
    ap.add_argument("--only", nargs="*")
    ap.add_argument("--reuse", action="store_true", help="re-print metrics from cached results")
    ap.add_argument("--concurrency", type=int, default=24)
    ap.add_argument("--tag", default="")
    a = ap.parse_args()

    sets = load(a.only)
    labels = {n: rows[0]["label"] for n, rows in sets.items() if rows}
    tag = a.tag or ("feeds" if a.feeds else "visual" if a.visual else "zeroday")
    RESULTS.mkdir(exist_ok=True)
    results: dict[str, list[dict]] = {}
    if a.reuse:
        for n in sets:
            p = RESULTS / f"{n}.{tag}.jsonl"
            results[n] = [json.loads(line) for line in p.read_text(encoding="utf-8").splitlines()] if p.exists() else []
    else:
        _configure(a.feeds, a.visual)
        sem = asyncio.Semaphore(a.concurrency)
        for n, rows in sets.items():
            t0 = time.perf_counter()
            res = await asyncio.gather(*(run_one(r["url"], sem) for r in rows))
            results[n] = list(res)
            (RESULTS / f"{n}.{tag}.jsonl").write_text("\n".join(json.dumps(r) for r in res) + "\n", encoding="utf-8")
            print(f"  {n}: {len(rows)} URLs in {time.perf_counter() - t0:.0f}s", file=sys.stderr)
    report = metrics(results, labels)
    print(f"\nRAQEEB evaluation ({tag})\n" + report)
    (RESULTS / f"summary.{tag}.txt").write_text(report + "\n", encoding="utf-8")


if __name__ == "__main__":
    asyncio.run(main())
