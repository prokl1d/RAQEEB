# RAQEEB (رقيب)

**Verify the claim, not just the link.**
RAQEEB is an evidence-based investigation platform for suspicious links, messages and screenshots, focused on UAE impersonation scams. Hackathon MVP.

- Requirements: [docs/MASTER_PLAN.md](docs/MASTER_PLAN.md)
- Approved plan: [docs/PLAN.md](docs/PLAN.md)

## Status

Phase 3 (investigation engine core). `POST /api/investigate` handles links and messages: link extraction (including defanged links), URL structure checks, the UAE organization registry, identity verification (Verified Match / Possible Impersonation / No Verified Relationship Found / Unable to Verify) and message red-flag rules. Network checks, threat intelligence, AI and scoring come next. The website does not call the engine yet.

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

**API keys (optional for now).** Copy `.env.example` to `backend/.env` and add your keys there. `backend/.env` is git-ignored, so never paste keys anywhere else.

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
