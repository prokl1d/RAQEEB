// RAQEEB Link Guard: check page.
// Asks the RAQEEB backend about one link, then:
//   Low Risk      -> lets you continue (automatically after a short countdown, if enabled)
//   Moderate/Unknown -> stops and explains; you can still continue
//   High Risk     -> stops; continuing needs a second confirmation
// All page text is set with textContent (never innerHTML), so nothing from the
// investigated site or the server can run as code here.

const DEFAULTS = { backend: "http://localhost:8000", site: "http://localhost:5173", autoContinue: true };
const $ = (id) => document.getElementById(id);

async function settings() {
  try {
    if (typeof chrome !== "undefined" && chrome.storage?.sync) {
      return { ...DEFAULTS, ...(await chrome.storage.sync.get(Object.keys(DEFAULTS))) };
    }
  } catch {
    /* fall through */
  }
  const p = new URLSearchParams(location.search);
  return { ...DEFAULTS, ...(p.get("backend") ? { backend: p.get("backend") } : {}) };
}

const target = new URLSearchParams(location.search).get("u") || "";

function safeTarget() {
  try {
    const u = new URL(target);
    return u.protocol === "http:" || u.protocol === "https:" ? u.href : null;
  } catch {
    return null;
  }
}

function go() {
  const url = safeTarget();
  if (url) location.replace(url);
}

function leave() {
  if (history.length > 1) history.back();
  else window.close();
}

const LEVEL = { "Low Risk": "low", "Moderate Risk": "moderate", "High Risk": "high", "Unknown Risk": "unknown" };

function show(result, cfg) {
  const level = LEVEL[result.score.band] || "unknown";
  $("checking").hidden = true;
  $("result").hidden = false;
  $("actions").hidden = false;
  $("bar").className = "bar";
  $("bar").style.background = `var(--${level === "moderate" ? "mod" : level === "unknown" ? "unk" : level})`;

  $("badge").className = "badge " + level;
  $("badge").textContent = result.score.band;
  $("score").textContent = level === "unknown" ? `Evidence coverage ${result.score.coverage}%` : `Risk score ${result.score.score}/100`;
  $("identity").textContent = `${result.identity.outcome} · ${result.identity.summary}`;

  const headline = {
    low: "No warning signs found",
    moderate: "Be careful with this link",
    high: "This link looks dangerous",
    unknown: "RAQEEB couldn't confirm this link",
  }[level];
  $("headline").textContent = headline;

  const rank = { confirmed: 0, contradictory: 1, suspicious: 2 };
  const important = result.evidence
    .filter((e) => e.status in rank)
    .sort((a, b) => rank[a.status] - rank[b.status] || (a.category === "identity" ? -1 : 0))
    .slice(0, 4);
  const list = $("findings");
  list.replaceChildren();
  for (const e of important) {
    const li = document.createElement("li");
    const b = document.createElement("b");
    b.textContent = e.finding;
    const s = document.createElement("span");
    s.textContent = e.why_it_matters;
    li.append(b, s);
    list.append(li);
  }
  if (!important.length) list.hidden = true;

  const notes = [...result.score.overrides, ...result.score.contradictions];
  if (result.check_mode === "fixture") notes.unshift("Demo mode: network and threat-intelligence results are recorded demo fixtures.");
  $("note").textContent = notes.join(" ");

  const report = new URL(cfg.site);
  report.searchParams.set("url", target);
  $("report").href = report.href;

  const primary = $("primary");
  const secondary = $("secondary");
  if (level === "low") {
    primary.textContent = "Continue to site";
    primary.onclick = go;
    secondary.textContent = "Go back";
    secondary.onclick = leave;
    if (cfg.autoContinue) countdown(primary, secondary);
  } else if (level === "high") {
    primary.textContent = "Close this tab";
    primary.classList.add("danger");
    primary.onclick = () => window.close();
    secondary.textContent = "Continue anyway";
    secondary.classList.add("quiet");
    secondary.onclick = () => {
      if (confirm("RAQEEB found serious warning signs. Open the link anyway?")) go();
    };
    primary.focus();
  } else {
    primary.textContent = "Go back";
    primary.onclick = leave;
    secondary.textContent = "Continue anyway";
    secondary.classList.add("quiet");
    secondary.onclick = go;
  }
}

function countdown(primary, secondary) {
  let n = 3;
  const tick = () => {
    if (n === 0) return go();
    $("note").textContent = `Opening in ${n}… RAQEEB found no warning signs, but no check can guarantee a site is safe.`;
    n -= 1;
    timer = setTimeout(tick, 1000);
  };
  let timer = setTimeout(tick, 0);
  secondary.textContent = "Stop";
  secondary.onclick = () => {
    clearTimeout(timer);
    $("note").textContent = "Stopped. You can continue or go back.";
    secondary.textContent = "Go back";
    secondary.onclick = leave;
  };
  primary.onclick = () => {
    clearTimeout(timer);
    go();
  };
}

function fail(message) {
  show(
    {
      score: { band: "Unknown Risk", score: 0, coverage: 0, overrides: [], contradictions: [] },
      identity: { outcome: "Unable to Verify", summary: message },
      evidence: [],
      check_mode: "live",
    },
    { ...DEFAULTS },
  );
}

(async () => {
  $("url").textContent = target;
  $("bar").className = "bar checking";
  if (!safeTarget()) return fail("This isn't a web link RAQEEB can check.");
  const cfg = await settings();
  try {
    const res = await fetch(cfg.backend.replace(/\/$/, "") + "/api/investigate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "url", url: target }),
    });
    if (!res.ok) {
      let detail = `RAQEEB returned an error (HTTP ${res.status}).`;
      try {
        const j = await res.json();
        if (typeof j.detail === "string") detail = j.detail;
      } catch {
        /* keep default */
      }
      return fail(detail);
    }
    show(await res.json(), cfg);
  } catch {
    fail("RAQEEB isn't reachable. Is the RAQEEB server running on this computer?");
  }
})();
