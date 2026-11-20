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

const LEVEL = {
  "Likely Safe": "safe", "Low Risk": "low", "Inactive Link": "inactive",
  "Moderate Risk": "moderate", "High Risk": "high", "Unknown Risk": "unknown",
};
const COLOR = { safe: "var(--safe)", low: "var(--low)", inactive: "var(--inactive)", moderate: "var(--mod)", high: "var(--high)", unknown: "var(--unk)" };
const REDUCE = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

// Gauge: arc fills to the score while the number counts up (instant with reduced motion).
function gauge(score, level, noScore) {
  const arc = $("arc");
  const len = arc.getTotalLength();
  arc.style.stroke = COLOR[level];
  arc.style.strokeDasharray = String(len);
  arc.style.strokeDashoffset = String(len);
  const num = $("scoreNum");
  if (noScore) {
    num.textContent = "–";
    $("scoreLabel").textContent = "no score";
    return;
  }
  arc.getBoundingClientRect(); // commit the start state so the transition runs (no frame callback needed)
  arc.style.strokeDashoffset = String(len * (1 - Math.max(score, 2) / 100));
  num.textContent = String(score); // final value first, so it's always right even if frames are paused
  if (REDUCE) return;
  num.textContent = "0";
  const t0 = performance.now();
  const dur = 1100;
  const step = (t) => {
    const p = Math.min(1, (t - t0) / dur);
    num.textContent = String(Math.round(score * (1 - Math.pow(1 - p, 3))));
    if (p < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
  setTimeout(() => (num.textContent = String(score)), dur + 200); // guarantee the final number
}

function show(result, cfg) {
  const level = LEVEL[result.score.band] || "unknown";
  $("checking").hidden = true;
  $("result").hidden = false;
  $("actions").hidden = false;
  $("checking").setAttribute("aria-busy", "false");
  $("bar").className = "bar done";
  $("bar").style.background = COLOR[level];
  $("eyebrow").textContent = "RAQEEB checked this link";

  $("badge").className = "badge " + level;
  $("badge").textContent = result.score.band;
  gauge(result.score.score, level, level === "unknown" || level === "inactive");
  $("identity").textContent = `${result.identity.outcome} · ${result.identity.summary}`;

  const headline = {
    safe: "This looks like the real site",
    inactive: "This link doesn't lead anywhere",
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
  for (const [i, e] of important.entries()) {
    const li = document.createElement("li");
    li.style.animationDelay = `${0.25 + i * 0.08}s`;
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
  if (level === "low" || level === "safe") {
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

function tickSteps() {
  const items = [...$("steps").children];
  let i = 0;
  return setInterval(() => {
    i = Math.min(i + 1, items.length - 1);
    items[i].classList.add("on");
  }, 450);
}

(async () => {
  $("url").textContent = target;
  $("bar").className = "bar checking";
  const ticker = tickSteps();
  const minScan = new Promise((r) => setTimeout(r, REDUCE ? 0 : 1100)); // long enough to read the steps
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
    const data = await res.json();
    await minScan;
    show(data, cfg);
  } catch {
    fail("RAQEEB isn't reachable. Is the RAQEEB server running on this computer?");
  } finally {
    clearInterval(ticker);
  }
})();
