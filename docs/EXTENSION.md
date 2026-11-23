# RAQEEB Link Guard (Chrome extension)

Sulaiman's idea: you don't copy anything. When you click a link in **WhatsApp Web, Gmail, Outlook or Telegram Web**, RAQEEB checks it first:

- **Likely Safe / Low Risk**: "This looks like the real site" or "No warning signs found", and it opens by itself after 3 seconds. You can press **Stop**.
- **Inactive Link**: the domain doesn't exist; nothing to open.
- **Moderate / Unknown Risk**: it stops, explains why, and lets you go back or continue anyway.
- **High Risk**: it stops with the reasons. **Close this tab** is the main button. Continuing needs a second confirmation.
- **Open the full report** opens the full RAQEEB report for that link.

Only the clicked link is sent to *your* RAQEEB server, which by default runs on your own computer. Message text is never read.

## Install (about 2 minutes)

1. Start RAQEEB as usual (see [TEAM_SETUP.md](TEAM_SETUP.md)). The engine must run on `http://localhost:8000`.
2. In Chrome, open `chrome://extensions`.
3. Turn on **Developer mode** (top right).
4. Click **Load unpacked** and choose the `RAQEEB\extension` folder.
5. Pin it: click the puzzle icon, then the pin next to **RAQEEB Link Guard**. Click it to see "Connected to RAQEEB" and the on/off switches.

After a `git pull` that changed the extension, press the ↻ reload button on its card in `chrome://extensions`, then **reload the WhatsApp Web / Gmail tab** (F5). The extension only attaches to pages opened after it loaded.

Version 0.2 asks for two permissions:
- **"Read your browsing history"**: Chrome's wording for `webNavigation`. RAQEEB uses it only to notice when one of the four sites opens a new tab, so that tab can be checked first. Nothing is recorded or sent anywhere else.
- **Access to web.whatsapp.com, mail.google.com, Outlook and Telegram Web**: to tell that a new tab came from one of them.

## How it catches links

1. **Click guard** (`content.js`): listens on the page's outermost level in the capture phase, so it runs before the app's own click handling. It also works when you click an icon inside a link, or a link inside a shadow DOM. Gmail, Outlook SafeLinks and WhatsApp/Facebook redirect wrappers are unwrapped to the real destination.
2. **New-tab safety net** (`background.js`): if one of the four sites opens a new tab to an outside link by itself, that tab is sent to the RAQEEB check page before the site loads.
3. **Search Shield** (`search.js`, v0.3.2): on Google (`google.com`, `google.ae`) and Bing results pages, each result and ad gets a RAQEEB badge: Official site, In registry, Impersonation, Warning signs or Not in registry. Hover for the reason. Only each result's site address (`https://host`) goes to your RAQEEB server, through the background worker; the search words are never read. Turn it off with "Mark fake sites in Google and Bing results" in the popup.

## Live demo

1. Start the engine in demo mode (`OFFLINE_DEMO=true`, see [DEMO.md](DEMO.md)).
2. In WhatsApp Web, send yourself the three demo links in "Message yourself":
   - `https://emiratesnbd-secure.co/verify`: stopped, **High Risk**
   - `https://emiratespost-redelivery.com/pay`: stopped, **High Risk**
   - `https://www.dewa.gov.ae/en`: **Likely Safe**, opens by itself
3. Click each link.

**Backup if WhatsApp Web isn't available:** run `python -m http.server 5174` inside the `extension` folder and open http://localhost:5174/demo/chat-demo.html. It's a look-alike chat page using the same script. Opened this way (outside the installed extension), the check page also needs the engine to allow that address. Start the engine with:

```powershell
$env:CORS_ORIGINS='["http://localhost:5173","http://localhost:5174"]'
```

## Limits (say these honestly if judges ask)

- **Desktop Chrome only.** iPhone and Android don't let any app catch link taps inside WhatsApp or SMS. Planned next step: a "Share → RAQEEB" button, which needs RAQEEB hosted online.
- It only watches the four sites above, on purpose, for privacy. Watching every website would send all your browsing to the server.
- It's a hackathon prototype, loaded unpacked, and not published on the Chrome Web Store.
