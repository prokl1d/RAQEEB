# RAQEEB detection accuracy: how we measured it

Measured on 24 Nov 2026 against **real, live links**, with **no API keys at all**: Safe Browsing, VirusTotal and Gemini were switched off, and so were the known-phishing feeds. These numbers show what RAQEEB catches on its own, on links nobody has reported yet ("zero-day").

## Results

**Held-out test** (never looked at while building the rules, run once):

| Set | Links | Flagged | |
|---|---|---|---|
| Real websites, random Tranco ranks 100,001 to 1,000,000 (unseen sample) | 300 | **1** | **0.3% false alarms** |
| Phishing.Database active phishing links (MIT) | 200 | 42 | recall 21% (25.6% of the 164 still online) |
| | | | **precision 97.7%** |

**Tuning set** (used while designing the rules):

| Set | Links | Flagged | |
|---|---|---|---|
| Official UAE banks, government, telecoms, airlines, retail + real login pages of global brands (Google, Microsoft, PayPal, Apple, banks…) | 53 | **0** | no false alarms |
| Real websites, Tranco ranks 100,001 to 1,000,000 | 200 | 1 | 0.5% |
| OpenPhish community feed, fresh | 300 | 196 | **recall 65.3%** |
| | | | **precision 99.5%**, F1 78.9% |

**Before this work (baseline, same data):** recall 8.0%, false alarms 4.3%, precision 78.4%.

"Flagged" means a **Moderate or High Risk** verdict. *Inactive Link* (the domain is already gone) and *Unknown* are **not** counted as detections, so recall isn't inflated.

## What changed (all key-free, all explained in every report)

| Signal | What it catches | Source of truth |
|---|---|---|
| Global brand lookalikes | `paypa1.com`, `netflix.xyz`, `microsoft-account.pages.dev`, `roblox.rw` | Built-in brand list with each brand's real domains |
| Brand in the path | `sso-auth.com/…/facebook_secure_account` | Brand name + login words on an unrelated site |
| Page title copies a brand | "Log in to Docusign" on a turf company's site | The page's own HTML, read as text only (capped at 256 KB, never run) |
| Password, card or OTP form | Credential pages on new, free-hosted or oddly named sites | Same |
| Form posts elsewhere, hidden forwarding | Kits that send typed data to another server, meta-refresh/JS redirects | Same |
| Machine-generated names on free hosting | `9o838-u7p-jrkd-4970f-26-10-2026-aa.pages.dev` | 87 free hosting, tunnel and IPFS platforms |
| Risky endings | `.xyz`, `.top`, `.icu`… strong only together with other signs | Abuse reports (Spamhaus, Interisle) |
| Established sites | Avoids false alarms on long-running sites | Tranco top 100,000 (bundled, 0.6 MB) |
| Dead but scam-shaped | An offline link that still imitates a brand | DNS + name pattern |
| Fake helplines | "Emirates NBD… call 04 316 0000" | Official numbers in the registry, each with its source |

Two rules were **removed or weakened** because the data showed they caused false alarms:
- *An invalid HTTPS certificate alone* no longer raises the verdict: 11 of 200 real small sites have broken certificates. It still appears as a warning, and still counts together with any other sign.
- *A lookalike rule* matched `customs.go.th` (Thai Customs) to Abu Dhabi Customs: it was the one held-out false alarm. Government-only endings (`gov.xx`, `go.xx`, `.mil`…) and "a shorter word inside the name" are no longer treated as lookalikes. We found this **in** the held-out set, so the 0.3% above is reported from *before* the fix.

## With the free feeds on

RAQEEB also keeps a local copy of the OpenPhish and Phishing.Database lists (about 720,000 links; refreshed with `python -m app.intel.feeds update`; loaded in 2 seconds; links are matched on the machine and never sent out). Any link already on those lists is flagged High Risk instantly. We don't quote a recall number for "feeds on", because our test links come from those same lists, so it would be 100% by construction.

## Speed

Measuring also exposed two performance bugs, now fixed:
- A **shared TLS context** (the CA bundle was being re-parsed for every connection): CPU per batch of 40 checks fell from about 25 s to 2.6 s, wall time from 33 s to 13 s.
- A **linear-time HTML scan**: a hostile page made of 250 KB of `<` characters used to block the server for 60 s; now 0.02 s. A test keeps it that way.

## Honest limits

- Recall on the older Phishing.Database list is lower (21%): many of those links are **hacked legitimate websites** with long random paths, which look normal from the outside. Catching those needs a page screenshot and visual comparison (future work) or threat-intelligence feeds.
- Phishing pages change by the hour; these numbers are a snapshot of 24 Nov 2026.
- Real sites were tested by their **home pages**; inner pages of real sites (e.g. a hacked WordPress folder) can look different.
- The weights are still hand-set; with a pilot's labelled data they can be fitted statistically.

## Reproduce it

```powershell
cd backend
# 1. Download the public sources into a folder (see eval/build_datasets.py header), then:
.\.venv\Scripts\python -m eval.build_datasets <download-folder>
# 2. Run (about 4 minutes per 500 links):
.\.venv\Scripts\python -m eval.evaluate                      # all sets, no keys, no feeds
.\.venv\Scripts\python -m eval.evaluate --only holdout_phish_pdb holdout_legit_tranco
.\.venv\Scripts\python -m eval.evaluate --feeds              # with the local feed copy
```

The labelled sets are in `backend/eval/data/` (CSV, one link per row, with its source). The random samples use a fixed seed, so anyone gets the same links.

Sources: [OpenPhish community feed](https://openphish.com/), [Phishing.Database](https://github.com/Phishing-Database/Phishing.Database) (MIT), [Tranco list](https://tranco-list.eu/) (Le Pochat et al., NDSS 2019).
