# RAQEEB (رقيب)

**Verify the claim, not just the link.**
RAQEEB is an evidence-based investigation platform for suspicious links, messages and screenshots, focused on UAE impersonation scams. Hackathon MVP.

- Requirements: [docs/MASTER_PLAN.md](docs/MASTER_PLAN.md)
- Approved plan: [docs/PLAN.md](docs/PLAN.md)

## Status

Working end to end. Paste a message or link on the dashboard and press **Start investigation** to get a full report:
- risk score (Low / Moderate / High / Unknown), evidence coverage and score breakdown
- organization identity verification against the UAE registry
- evidence grouped as confirmed / suspicious / verified / unverified / missing, each with its source
- the message with red flags highlighted, recommended actions, limitations and privacy disclosures

Under the hood:
- link extraction and SSRF-safe live checks (DNS, TLS, redirects, RDAP domain age)
- Google Safe Browsing and VirusTotal (lookup only), when keys are set
- deterministic weighted scoring
- AI explanation (built-in by default, Gemini optional) with personal data masked

**New: RAQEEB Link Guard**, a Chrome extension that checks links automatically when you click them in WhatsApp Web, Gmail, Outlook or Telegram. See [docs/EXTENSION.md](docs/EXTENSION.md).

Presenting? See [docs/DEMO.md](docs/DEMO.md). Still to do: screenshot investigations (OCR) and final polish.

## Run it locally (Windows)

You need Node 20+ and Python 3.12+.

**1. Backend** (first time only: create the environment and install):

```powershell
cd backend
py -3.13 -m venv .venv
.\.venv\Scripts\python.exe -m pip install -e ".[dev]"
```

Start it:

```powershell
cd backend
.\.venv\Scripts\python.exe -m uvicorn app.main:app --port 8000
```

**2. Frontend** in a second terminal (first time only: `npm install`):

```powershell
cd frontend
npm run dev
```

Open http://localhost:5173.

**API keys (optional).** Put keys **only in `backend/.env`**, which is git-ignored. Do **not** edit `.env.example`: it's a public template that gets uploaded to GitHub, so it must stay empty. To start, make a copy:

```powershell
Copy-Item .env.example backend\.env
```

Then fill in the keys in `backend\.env`. A test (`backend/tests/test_no_secrets.py`) fails if a key ever appears in a tracked file.

## Tests

```powershell
cd backend
.\.venv\Scripts\python.exe -m pytest
```

## Layout

```
backend/   FastAPI app, investigation pipeline (Python)
frontend/  React + TypeScript + Tailwind UI
docs/      plan, requirements, design research
```

RAQEEB is a student hackathon project and is not affiliated with any government entity.
