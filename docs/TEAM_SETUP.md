# Run RAQEEB on your own computer (Windows)

About 10 minutes the first time. No API keys needed.

## 1. Install once

- **Git**: https://git-scm.com/download/win
- **Python 3.12 or newer**: https://www.python.org/downloads/. Tick "Add python.exe to PATH" during install.
- **Node.js 20 or newer (LTS)**: https://nodejs.org

## 2. Download the project

Accept the GitHub invite email for `prokl1d/RAQEEB` first. Then open **PowerShell** and run:

```powershell
cd $HOME\Desktop
git clone https://github.com/prokl1d/RAQEEB.git
cd RAQEEB
```

If Git asks you to sign in, a GitHub window opens. Sign in there yourself.

## 3. Set up (first time only)

```powershell
Copy-Item .env.example backend\.env
cd backend
py -m venv .venv
.\.venv\Scripts\python.exe -m pip install -e ".[dev]"
cd ..\frontend
npm install
cd ..
```

Open `backend\.env` in Notepad and set `OFFLINE_DEMO=true`. That's demo mode: it works without internet or keys.

**Never put real keys in `.env.example`, and never paste them in chat.** If you have keys, they go only in `backend\.env`.

## 4. Start it (every time)

Open **two** PowerShell windows inside the `RAQEEB` folder.

Window 1, the engine:

```powershell
cd backend
.\.venv\Scripts\python.exe -m uvicorn app.main:app --port 8000
```

Window 2, the website:

```powershell
cd frontend
npm run dev
```

Open **http://localhost:5173**. Use the **Try an example** buttons, or paste your own message or link.

Stop both with `Ctrl+C`.

## 5. Get the latest changes

```powershell
git pull
```

If `git pull` brought new packages, run the step 3 install commands again.

## Run the tests

```powershell
cd backend
.\.venv\Scripts\python.exe -m pytest
```

See [DEMO.md](DEMO.md) for the presentation script.
