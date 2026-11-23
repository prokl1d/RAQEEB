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

## New features (2 minutes)

All three work offline in demo mode.

1. **Search Shield** (Protection → Search Shield): click the sample searches. The scan line passes over the results and each gets a badge with its reason: 3 of 4 Emirates NBD results imitate the bank. Then paste your own links in "Check your own links", e.g. `emiratesp0st.ae` (look-alike letters) and `http://192.168.1.1/login` (warning signs).
2. **Describe a call:** click "Bank + remote app" or the Arabic police story. The report shows who they claimed to be, what they asked for, the pressure tricks, and the official number to call back (with its source), plus AD Police Aman 800 2626.
3. **Listing check:** click "Impersonating listing" (High Risk: wrong website and wrong phone), then "Consistent listing" (Likely Safe), then "Incomplete listing" (Needs verification: RAQEEB never accuses without evidence).

4. **Screenshot or QR:** open the **Image** tab and drop a screenshot of a scam SMS (English or Arabic) or a QR code. Point out that it is read on the device; then start the investigation.
5. **Report to AD Police:** on any High Risk report, click **Report to AD Police**: a one-page evidence sheet with a reference number, ready to print, copy or send to Aman (800 2626 / SMS 2828).
6. **Spot the scam:** let a judge answer two quiz messages; the red flags light up, and "Check it with RAQEEB" runs the engine.

Extension bonus: with Link Guard v0.3.2 installed, search Google for "Emirates NBD login" and the real results get badges.

## Live mode (optional, needs internet)

Remove `OFFLINE_DEMO`. Live checks then run: DNS, the TLS certificate, redirects and RDAP domain age.

Add keys to `backend/.env` to turn on more checks:
- `SAFE_BROWSING_API_KEY` and `VIRUSTOTAL_API_KEY` for threat intelligence.
- `AI_PROVIDER=gemini` with `GEMINI_API_KEY` for AI explanations.

Without keys, those checks show as "not configured" and don't count toward the score.

Good live example: paste `https://www.dewa.gov.ae/en` in the **Link** tab.
