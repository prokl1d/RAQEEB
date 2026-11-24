"""Builds RAQEEB's labelled evaluation sets from public sources (fixed random seed, reproducible).

Sources (download them first, see backend/eval/README.md):
  phishing  Phishing.Database "phishing-links-ACTIVE.txt" (MIT)  -> holdout_phish_pdb.csv (held out)
            OpenPhish community feed (current)                     -> phish_openphish.csv (tuning)
  legit     Tranco top-1M, ranks 100,001-1,000,000 (NOT in RAQEEB's "established" list, so no shortcut)
                                                                    -> legit_tranco.csv (tuning)
                                                                    -> holdout_legit_tranco.csv (held out)
            Hand-picked real UAE banks/government/brands and real login pages of global brands
                                                                    -> legit_known.csv

Usage: python -m eval.build_datasets <folder-with-downloads>
"""

from __future__ import annotations

import csv
import random
import re
import sys
from pathlib import Path
from urllib.parse import urlsplit

OUT = Path(__file__).with_name("data")
SEED = 42
HEX64 = re.compile(r"\b[0-9a-f]{64}\b")

LEGIT_KNOWN = [
    # UAE banks, government, couriers, telecoms, payments (official sites)
    "https://www.emiratesnbd.com/en", "https://www.bankfab.com/en-ae/personal", "https://www.adcb.com/en/personal/",
    "https://www.dib.ae/", "https://www.mashreq.com/en/uae/neo/", "https://www.adib.ae/en", "https://www.rakbank.ae/",
    "https://www.dewa.gov.ae/en", "https://u.ae/en", "https://www.emiratespost.ae/", "https://www.tamm.abudhabi/en",
    "https://uaepass.ae/", "https://www.moi.gov.ae/en", "https://www.adpolice.gov.ae/en", "https://www.dubaipolice.gov.ae/",
    "https://www.rta.ae/", "https://www.salik.ae/", "https://tax.gov.ae/en", "https://www.mohre.gov.ae/",
    "https://www.centralbank.ae/en/", "https://tdra.gov.ae/", "https://www.etisalat.ae/", "https://www.du.ae/",
    "https://www.aramex.com/", "https://www.dhl.com/ae-en/home.html", "https://tabby.ai/", "https://tamara.co/",
    "https://icp.gov.ae/", "https://www.addc.ae/", "https://www.sewa.gov.ae/", "https://www.emirates.com/ae/english/",
    "https://www.etihad.com/en-ae/", "https://www.noon.com/uae-en/", "https://www.amazon.ae/", "https://www.careem.com/",
    # Real login pages: they contain "login", "signin", "account"... and must never be flagged
    "https://accounts.google.com/signin", "https://login.microsoftonline.com/", "https://login.live.com/",
    "https://www.paypal.com/signin", "https://appleid.apple.com/sign-in", "https://www.facebook.com/login/",
    "https://www.instagram.com/accounts/login/", "https://www.netflix.com/login", "https://www.amazon.com/ap/signin",
    "https://www.linkedin.com/login", "https://github.com/login", "https://www.dropbox.com/login",
    "https://secure.chase.com/web/auth/", "https://www.coinbase.com/signin", "https://www.binance.com/en/login",
    "https://web.whatsapp.com/", "https://outlook.live.com/owa/", "https://www.bankofamerica.com/online-banking/sign-in/",
]


def _http_only(lines):
    for line in lines:
        u = line.strip()
        if u.startswith(("http://", "https://")) and len(u) < 2000:
            yield u


def _host(u: str) -> str:
    try:
        return (urlsplit(u).hostname or "").lower()
    except ValueError:
        return ""


def write(name: str, rows: list[tuple[str, str, str]]) -> None:
    OUT.mkdir(exist_ok=True)
    with (OUT / name).open("w", newline="", encoding="utf-8") as f:
        w = csv.writer(f)
        w.writerow(["url", "label", "source"])
        w.writerows(rows)
    print(f"{name}: {len(rows)} rows")


def main(src: Path) -> None:
    rnd = random.Random(SEED)
    openphish = list(dict.fromkeys(_http_only((src / "openphish.txt").read_text(encoding="utf-8", errors="ignore").splitlines())))
    op_hosts = {_host(u) for u in openphish}
    write("phish_openphish.csv", [(u, "phish", "openphish") for u in openphish])

    pdb = [u for u in _http_only((src / "pdb_phishing-links-ACTIVE.txt").open(encoding="utf-8", errors="ignore"))
           if _host(u) and _host(u) not in op_hosts]
    # Links holding a 64-hex token are dropped after sampling: the repository's secret scanner
    # (tests/test_no_secrets.py) can't tell them from an API key. Sampling itself is unchanged.
    sample = [u for u in rnd.sample(pdb, 200) if not HEX64.search(u)]
    write("holdout_phish_pdb.csv", [(u, "phish", "phishing.database") for u in sample])

    ranked = []
    with (src / "top-1m.csv").open(encoding="utf-8") as f:
        for rank, dom in csv.reader(f):
            if 100_000 < int(rank) <= 1_000_000:
                ranked.append(dom)
    first = rnd.sample(ranked, 200)
    write("legit_tranco.csv", [(f"https://{d}/", "legit", "tranco-100k-1m") for d in first])
    # Held-out legitimate set: a second sample, never used while tuning the rules.
    rest = sorted(set(ranked) - set(first))
    write("holdout_legit_tranco.csv", [(f"https://{d}/", "legit", "tranco-100k-1m-holdout")
                                       for d in random.Random(SEED + 1).sample(rest, 300)])
    write("legit_known.csv", [(u, "legit", "known-official") for u in LEGIT_KNOWN])


if __name__ == "__main__":
    main(Path(sys.argv[1]))
