# RAQEEB (رقيب): Verify the claim, not just the link

RAQEEB is an AI-assisted **digital trust investigation** tool for the UAE. Paste a suspicious message or link, or just click a link in WhatsApp Web with the RAQEEB Chrome extension. RAQEEB checks **who the message claims to be from**, gathers evidence about the link, and explains its verdict in plain English or Arabic.

Built for the **AD Police x 42AD Hackathon 2026** · English and Arabic website (full right-to-left layout) · Student project, not affiliated with any government entity.

- Technical documentation: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)
- Presenter script: [docs/DEMO.md](docs/DEMO.md) · Chrome extension: [docs/EXTENSION.md](docs/EXTENSION.md) · Team setup: [docs/TEAM_SETUP.md](docs/TEAM_SETUP.md)

---

## 1. The problem

People in the UAE get a steady stream of SMS, WhatsApp and email messages pretending to be:
- their bank;
- Emirates Post or a courier ("pay AED 4.50 to release your parcel");
- a utility, or the police.

The scam isn't the link alone. It's the **false claim**: "this message is from Emirates NBD" next to a link that has nothing to do with Emirates NBD.

Existing tools mostly answer "is this URL on a blocklist?" That fails for new scam domains, which aren't listed yet. Chatbots answer "this looks suspicious" without evidence, and sometimes invent it.

## 2. Our solution

RAQEEB runs an **investigation**, not a guess:

1. **Extract** the links (including disguised ones like `hxxps://site[.]com`) and the organization the message claims to be.
2. **Verify identity** against a curated registry of UAE organizations (banks, government, couriers, telecoms, payments). Each entry's official domain is backed by an authoritative source. Lookalikes are caught:
   - extra words (`emiratesnbd-secure.co`);
   - swapped characters (`emiratesp0st.ae`, a Cyrillic "е");
   - the wrong ending (`dewa.com` vs `dewa.gov.ae`);
   - the brand only in the subdomain;
   - typos.
3. **Check the site safely:** DNS, TLS certificate, domain age (RDAP), and the full redirect chain. Every hop is validated, so RAQEEB can't be tricked into reaching private networks.
4. **Check threat intelligence:** Google Safe Browsing v5 and VirusTotal (lookup only, never submitting links).
5. **Read the message** for red flags: OTP, card or password requests, small fees, urgency, threats.
6. **Score with fixed rules.** The AI never sets the score. The verdict is one of:

   | Verdict | Meaning |
   |---|---|
   | **Likely Safe** | Verified official domain, or strong positive evidence (old domain, valid certificate, clean threat intel), and no warning signs |
   | **Low Risk** | No warning signs, but the owner of the site isn't verified |
   | **Inactive Link** | The domain doesn't exist right now: nothing would load |
   | **Moderate Risk** / **High Risk** | Warning signs found, with every reason listed |
   | **Unknown Risk** | Only when RAQEEB couldn't check the site itself at all: no evidence means no verdict |

7. **Explain** every finding with its source: confirmed, suspicious, verified, unverified or missing. An AI layer writes the plain-English summary and is only allowed to cite evidence RAQEEB actually collected.

**Automatic protection:** the **RAQEEB Link Guard** Chrome extension checks links the moment you click them in WhatsApp Web, Gmail, Outlook or Telegram Web:
- Likely Safe and Low Risk links open after a 3-second countdown.
- Risky ones are stopped with the reasons.

## 3. Technical choices and why

| Choice | Why | Trade-off |
|---|---|---|
| **Python FastAPI backend** | The deterministic logic (domain parsing, lookalike detection, scoring) is easiest to write and test in Python; typed API models with Pydantic | Two languages in the repo (Python + TypeScript) |
| **React + TypeScript + Tailwind frontend** | Fast to build, typed API contract, design tokens in one CSS file | No server-side rendering (not needed for a tool) |
| **Deterministic scoring; AI only explains** | Judges and users can see *why*. The same input always gives the same verdict, and the AI can't hallucinate a "safe" result | Less flexible than an AI verdict; weights are hand-tuned (30/25/20/15/10) |
| **Curated registry instead of web search for identity** | Search results and AI answers aren't proof of who owns a domain. Each registry entry has a source URL and check date | Covers ~26 organizations; only 3 are verified so far. Unverified entries can still catch lookalikes but never produce "Verified Match" |
| **"Missing" is never "clean"** | A failed API call must not make something look safe | More "not checked" notes when keys or the network fail |
| **Google Safe Browsing v5** (`urls:search`) | v4 is deprecated; v5 is the supported version. The key goes in a header, never the URL | Sends the link itself (not a hash) to Google; disclosed to users |
| **VirusTotal lookup only** | Submitting a link would share it with VirusTotal's community | New links have no report yet: shown as a weak signal |
| **Gemini free tier, behind a replaceable interface, with a built-in fallback explainer** | Free for a hackathon; any provider can be swapped in | Free tier may be reviewed by Google, so personal data is **masked** first (names, phones, emails, cards, Emirates ID, OTPs). It was slow or busy in testing, so the fallback is used often |
| **Local OCR planned (Tesseract), not cloud vision** | Screenshots would never leave the server | Not built yet (see below) |
| **Chrome extension, not a mobile app** | Desktop Chrome is the only platform that allows catching link clicks inside WhatsApp Web or Gmail | iPhone and Android don't allow any app to do this inside WhatsApp or SMS |
| **Demo mode with labelled fixtures** | The live demo must work on bad venue Wi-Fi | Fixture results are clearly labelled "Recorded demo fixture", never shown as live |

Security highlights:
- SSRF protection: public IPs only, the connection is pinned to the checked IP, every redirect hop is re-validated, and disguised numeric IPs are decoded.
- The investigated page is never rendered or executed.
- Investigated text is treated as data, so prompt injection inside a message can't change the verdict.
- No API keys reach the frontend.
- A test fails if a key ever lands in a tracked file.

Privacy:
- No accounts, no database, no history, no analytics.
- Everything runs in memory per request.
- Each report lists exactly which outside services received what.

## 4. What we left out, and what we'd do next

- **Screenshot investigations (OCR):** designed (local Tesseract, then the same pipeline) but not built in time.
- **More verified registry entries:** only DEWA, Emirates Post and u.ae have authoritative sources so far. Next would be verifying the banks against the Central Bank register.
- **Phones:** a "Share → RAQEEB" button (an Android share target plus an iPhone Shortcut). This needs RAQEEB hosted online.
- **Arabic interface and Arabic message analysis.**
- **Hosting and HTTPS deployment**, plus a Chrome Web Store release of the extension.
- **Tuning the weights on real labelled scam data.** Today they're expert-set, not statistically validated. The score is a risk assessment, not a probability.
- **Done differently:** we'd start the registry verification and API access (Safe Browsing, Gemini) on day one; both took longer than expected.

## 5. Build and run (Windows)

Needs **Python 3.12+**, **Node.js 20+** and **Git**. Step-by-step for teammates: [docs/TEAM_SETUP.md](docs/TEAM_SETUP.md).

First time only:

```powershell
Copy-Item .env.example backend\.env
cd backend
py -m venv .venv
.\.venv\Scripts\python.exe -m pip install -e ".[dev]"
cd ..\frontend
npm install
```

Start the engine (window 1) and the website (window 2):

```powershell
cd backend
.\.venv\Scripts\python.exe -m uvicorn app.main:app --port 8000
```

```powershell
cd frontend
npm run dev
```

Open http://localhost:5173. Use the **Try an example** buttons, or paste your own message or link.

**Modes and keys** (all in `backend\.env`, which is git-ignored; never edit `.env.example`):
- `OFFLINE_DEMO=true`: the three demo scenarios replay labelled fixtures; any other link is checked live.
- `SAFE_BROWSING_API_KEY`, `VIRUSTOTAL_API_KEY`: threat intelligence. Optional: without them, those checks show as "not checked".
- `AI_PROVIDER=gemini` + `GEMINI_API_KEY`: AI explanations. Optional: the built-in explainer is used otherwise.

**Chrome extension:** open `chrome://extensions`, turn on **Developer mode**, then **Load unpacked** and pick the `extension` folder. Details in [docs/EXTENSION.md](docs/EXTENSION.md).

**Tests** (102 backend tests):

```powershell
cd backend
.\.venv\Scripts\python.exe -m pytest
```

## 6. Repository layout

```
backend/    FastAPI app: pipeline/ (extract, domains, verify, technical, content, scoring),
            net/ (SSRF-safe fetch, DNS), intel/ (RDAP, Safe Browsing, VirusTotal), ai/ (providers, masking),
            registry/organizations.yaml, fixtures/demo.json, tests/
frontend/   React + TypeScript + Tailwind website (dashboard + report)
extension/  RAQEEB Link Guard (Chrome, Manifest V3)
docs/       ARCHITECTURE, DEMO, EXTENSION, TEAM_SETUP, PLAN, MASTER_PLAN, design-research
```

## 7. Credits and third-party licenses

- **GSAP** and **@gsap/react**: GreenSock Standard "no charge" license (https://gsap.com/standard-license). Used for the hero text split, scroll-pinned sections and the smooth-scroll ticker.
- **Lenis** (MIT): smooth scrolling, by darkroom.engineering.
- **React Bits** by David Haz (MIT + Commons Clause): LightRays, Particles, DecryptedText, ScrollReveal, ScrollVelocity, SpotlightCard and Magnet, copied into `frontend/src/components/bits/` with attribution (see the README there).
- **Three.js** (MIT): the animated 3D UAE flag in the "Made for the UAE" section (the flag is drawn in code; no image assets).
- **Motion** (MIT): UI transitions. **Tailwind CSS**, **React**, **FastAPI** and the Python libraries listed in `backend/pyproject.toml`, all open-source.
- Fonts: Inter, Roboto, JetBrains Mono, Noto Kufi Arabic (Arabic headings) and IBM Plex Sans Arabic (Arabic body text), all SIL Open Font License, via Google Fonts.

Language: English or Arabic (globe button in the header, remembered per browser). In Arabic the whole layout flips right-to-left; links, domains and code stay left-to-right so they read correctly. Verdicts, summaries, labels and advice are translated; the engine's detailed evidence lines are still in English and are marked as such.

Light and dark themes (toggle in the header, remembered per browser, follows the system setting by default). All animation respects the operating system's "reduce motion" setting: smooth scrolling, pinning and text effects switch off.
