# RAQEEB live demo guide

## Before you present

1. Start the backend in **demo mode**, which works with no internet:

   ```powershell
   cd backend
   $env:OFFLINE_DEMO = "true"; .\.venv\Scripts\python.exe -m uvicorn app.main:app --port 8000
   ```

   Or set `OFFLINE_DEMO=true` in `backend/.env`.
2. Start the frontend: `cd frontend` then `npm run dev`. Open http://localhost:5173.
3. A gold **Demo mode** banner appears on every report. Network and threat-intelligence results are recorded fixtures (`backend/app/fixtures/demo.json`), never presented as live.

## The three scenarios

Use the **Try an example** buttons under the message box.

| # | Example | Expected result | What to point out |
|---|---|---|---|
| 1 | **Bank impersonation** (Emirates NBD) | High Risk (~83) · Possible Impersonation | `emiratesnbd-secure.co` is not `emiratesnbd.com`; domain 3 days old; redirects to another domain; Safe Browsing + VirusTotal hits (fixture); OTP + urgency + threat highlighted |
| 2 | **Delivery fee** (Emirates Post) | High Risk (~51) · Possible Impersonation | No threat-intel listing yet, but identity + "pay AED 4.50" + lookalike domain still make it high. "Not listed" is never "safe" |
| 3 | **Legitimate-looking** (DEWA) | **Likely Safe** (~5) · Verified Match | `dewa.gov.ae` verified via the dubai.ae directory; "Likely" safe, never "100% safe", and the report lists its limitations |

**Bonus:** paste a made-up link like `https://totally-made-up-shop-xyz8812.com` to show **Inactive Link**, or a real site like `https://www.wikipedia.org` to show **Low Risk**. In demo mode, links other than the three scenarios are checked live.

## Live mode (optional, needs internet)

Remove `OFFLINE_DEMO`. Live checks then run: DNS, the TLS certificate, redirects and RDAP domain age.

Add keys to `backend/.env` to turn on more checks:
- `SAFE_BROWSING_API_KEY` and `VIRUSTOTAL_API_KEY` for threat intelligence.
- `AI_PROVIDER=gemini` with `GEMINI_API_KEY` for AI explanations.

Without keys, those checks show as "not configured" and don't count toward the score.

Good live example: paste `https://www.dewa.gov.ae/en` in the **Link** tab.
