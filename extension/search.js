// RAQEEB Link Guard: Search Shield for Google and Bing results pages.
// Adds a RAQEEB badge to each result (official site, impersonation, warning signs, not in registry).
// Privacy: only the result sites' addresses (scheme + host) are sent to your RAQEEB server, through
// the extension's background worker. Your search words are never read or sent.

(() => {
  if (window.__raqeebShield) return;
  window.__raqeebShield = true;

  const ATTR = "data-raqeeb";
  const MAX = 25;
  let on = true;

  chrome.storage.sync.get(["enabled", "searchBadges"]).then((s) => {
    on = s.enabled !== false && s.searchBadges !== false;
    if (on) schedule();
  });
  chrome.storage.onChanged.addListener((c) => {
    if (c.enabled || c.searchBadges) {
      chrome.storage.sync.get(["enabled", "searchBadges"]).then((s) => {
        on = s.enabled !== false && s.searchBadges !== false;
        if (!on) document.querySelectorAll(".raqeeb-badge").forEach((b) => b.remove());
        else schedule();
      });
    }
  });

  const STYLE = {
    official: ["#0f2e24", "#6ee7b7", "Official site"],
    listed: ["#2a2417", "#ecd6a3", "In registry · not yet confirmed"],
    impersonation: ["#3a1414", "#ff8a80", "Impersonation"],
    caution: ["#3a2414", "#fdba74", "Warning signs"],
    unknown: ["#26272d", "#bdb8ae", "Not in registry"],
  };
  const MATCH = {
    "wrong-suffix": "same name, wrong ending",
    homoglyph: "look-alike letters",
    "brand-plus-words": "brand name plus extra words",
    "brand-in-subdomain": "brand name hidden in a subdomain",
    typo: "a misspelling of the real name",
  };

  function why(c) {
    if (c.verdict === "official") return `Official domain of ${c.org_name}, confirmed by an authoritative source.`;
    if (c.verdict === "listed") return `${c.org_name}'s domain in RAQEEB's registry (not yet confirmed by an authoritative source).`;
    if (c.verdict === "impersonation") return `Imitates ${c.org_name} (real site: ${c.official_domain}): ${MATCH[c.match] || c.match}.`;
    if (c.verdict === "caution") return `Warning signs in the address: ${c.flags.join(", ")}.`;
    return "Not one of the organizations RAQEEB knows. That doesn't make it safe.";
  }

  /** Result links on the page, with the destination they really lead to. */
  function results() {
    const out = [];
    const isBing = /(^|\.)bing\.com$/.test(location.hostname);
    const anchors = isBing
      ? document.querySelectorAll("#b_results li.b_algo h2 a, #b_results li.b_ad h2 a")
      : document.querySelectorAll("#search a:has(h3), #rso a:has(h3), #tads a:has([role='heading']), #tads a:has(h3), #bottomads a:has([role='heading'])");
    for (const a of anchors) {
      if (a.hasAttribute(ATTR)) continue;
      let dest = a.href;
      try {
        const u = new URL(dest);
        if (/googleadservices\.com$|doubleclick\.net$/.test(u.hostname) || u.pathname === "/aclk") {
          const pcu = a.getAttribute("data-pcu") || a.getAttribute("data-rw") || "";
          dest = pcu.split(",").find((x) => /^https?:\/\//.test(x)) || "";
        } else if (u.pathname === "/url" && u.searchParams.get("q")) {
          dest = u.searchParams.get("q");
        }
        if (!dest) continue;
        const d = new URL(dest);
        if (d.protocol !== "http:" && d.protocol !== "https:") continue;
        if (/(^|\.)google\.[a-z.]+$|(^|\.)bing\.com$/.test(d.hostname)) continue;
        out.push({ a, site: d.protocol + "//" + d.host });
      } catch {
        /* skip */
      }
      if (out.length >= MAX) break;
    }
    return out;
  }

  function badge(c) {
    const [bg, fg, label] = STYLE[c.verdict] || STYLE.unknown;
    const b = document.createElement("span");
    b.className = "raqeeb-badge";
    b.title = "RAQEEB: " + why(c);
    b.setAttribute("role", "note");
    b.setAttribute("aria-label", "RAQEEB: " + label + ". " + why(c));
    b.style.cssText = [
      "display:inline-flex", "align-items:center", "gap:6px", "margin:6px 0 2px", "padding:3px 10px 3px 4px",
      "border-radius:999px", `background:${bg}`, `color:${fg}`, `box-shadow:0 0 0 1px ${fg}40`,
      "font:600 12px/1.4 system-ui,-apple-system,Segoe UI,Roboto,sans-serif", "letter-spacing:0", "vertical-align:middle",
      "max-width:100%", "white-space:nowrap", "overflow:hidden", "text-overflow:ellipsis",
    ].join(";");
    const mark = document.createElement("span");
    mark.textContent = "R";
    mark.style.cssText = "display:inline-flex;align-items:center;justify-content:center;width:18px;height:18px;border-radius:999px;background:#d9b76e;color:#1a1408;font:800 11px/1 system-ui,sans-serif";
    const text = document.createElement("span");
    text.textContent = c.verdict === "impersonation" ? `${label}: ${c.org_name}` : label;
    b.append(mark, text);
    return b;
  }

  async function run() {
    if (!on) return;
    const items = results();
    if (!items.length) return;
    items.forEach(({ a }) => a.setAttribute(ATTR, "pending"));
    const sites = [...new Set(items.map((i) => i.site))].slice(0, MAX);
    let checks;
    try {
      checks = await chrome.runtime.sendMessage({ type: "raqeeb-domains", links: sites });
    } catch {
      checks = null;
    }
    if (!Array.isArray(checks)) {
      items.forEach(({ a }) => a.removeAttribute(ATTR)); // server not reachable: try again later
      return;
    }
    const bySite = new Map(sites.map((s, i) => [s, checks[i]]));
    for (const { a, site } of items) {
      const c = bySite.get(site);
      a.setAttribute(ATTR, "done");
      if (!c || c.verdict === "invalid") continue;
      const holder = document.createElement("div");
      holder.style.cssText = "display:block;line-height:0";
      holder.append(badge(c));
      a.insertAdjacentElement("afterend", holder);
    }
  }

  let timer = 0;
  function schedule() {
    clearTimeout(timer);
    timer = setTimeout(run, 350);
  }
  new MutationObserver(schedule).observe(document.documentElement, { childList: true, subtree: true });
  if (document.readyState !== "loading") schedule();
  else document.addEventListener("DOMContentLoaded", schedule);
})();
