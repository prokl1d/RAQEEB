// RAQEEB Link Guard: content script for messaging and email sites.
// Intercepts clicks on links that leave the current site and opens the RAQEEB check page instead.
// Only the link is used; message text is not read.
// Backup: background.js also catches new tabs these sites open by themselves.
//
// Robustness rules (learned the hard way):
// - The check page is opened synchronously, inside the click, so pop-up blockers always allow it.
// - A click is never swallowed: if this copy of the script can't reach the extension any more
//   (the extension was reloaded or updated while the tab stayed open), it steps aside and lets
//   the link open normally, and a fresh copy injected by background.js takes over.

(() => {
  // Where check.html lives when this script is loaded by a plain test page (no extension).
  let SCRIPT_BASE = "";
  try {
    if (document.currentScript?.src) SCRIPT_BASE = new URL(".", document.currentScript.src).href;
  } catch {
    /* inline or injected: no base needed */
  }
  const hasChrome = typeof chrome !== "undefined" && Boolean(chrome.runtime?.id);

  /** Is this copy still connected to the installed extension? */
  function alive() {
    if (!hasChrome) return true; // test page without the extension
    try {
      return Boolean(chrome.runtime?.id);
    } catch {
      return false;
    }
  }

  // Only one live copy per page. A copy left over from an older extension version is replaced.
  const prev = window.__raqeebGuard;
  if (prev && typeof prev.alive === "function" && prev.alive()) return;
  if (prev && typeof prev.teardown === "function") prev.teardown();

  let enabled = true;
  if (hasChrome) {
    try {
      chrome.storage.sync.get("enabled").then((s) => (enabled = s.enabled !== false)).catch(() => {});
      chrome.storage.onChanged.addListener((c) => {
        if (c.enabled) enabled = c.enabled.newValue !== false;
      });
    } catch {
      /* extension context already gone */
    }
  }

  // Links inside these sites are the app's own navigation, not something to check.
  const SAME_APP = [
    /(^|\.)whatsapp\.com$/, /(^|\.)whatsapp\.net$/, /(^|\.)telegram\.org$/,
    /(^|\.)google\.com$/, /(^|\.)googleusercontent\.com$/, /(^|\.)gstatic\.com$/,
    /(^|\.)live\.com$/, /(^|\.)office\.com$/, /(^|\.)office365\.com$/, /(^|\.)microsoft\.com$/,
  ];

  // Messaging and mail apps wrap links in redirectors; recover the real destination.
  function unwrap(href) {
    try {
      const u = new URL(href);
      const h = u.hostname;
      if (/(^|\.)google\.com$/.test(h) && u.pathname === "/url") return u.searchParams.get("q") || u.searchParams.get("url") || href;
      if (/safelinks\.protection\.outlook\.com$/.test(h)) return u.searchParams.get("url") || href;
      if (h === "l.wl.co" || h === "l.facebook.com" || h === "lm.facebook.com") return u.searchParams.get("u") || href;
    } catch {
      /* ignore */
    }
    return href;
  }

  function shouldCheck(href) {
    let u;
    try {
      u = new URL(href, location.href);
    } catch {
      return false;
    }
    if (u.protocol !== "http:" && u.protocol !== "https:") return false;
    if (u.hostname === location.hostname) return false;
    return !SAME_APP.some((re) => re.test(u.hostname));
  }

  /** Opens the check page. Returns false if it couldn't, so the caller lets the click through. */
  function open(url) {
    let page;
    try {
      page = hasChrome ? chrome.runtime.getURL("check.html") : SCRIPT_BASE + "check.html";
    } catch {
      return false; // extension context gone
    }
    page += "?u=" + encodeURIComponent(url);
    // Synchronous: still inside the user's click, so the browser allows the new tab.
    const w = window.open(page, "_blank");
    if (w) {
      try {
        w.opener = null;
      } catch {
        /* cross-origin */
      }
      return true;
    }
    // Pop-up blocked (rare): ask the background worker to open it as a tab instead.
    if (hasChrome) {
      try {
        chrome.runtime.sendMessage({ type: "raqeeb-check", url }).catch(() => {});
        return true;
      } catch {
        return false;
      }
    }
    return false;
  }

  // Find the link that was clicked, even inside shadow DOM or when the click hit an icon/span.
  function linkFrom(e) {
    for (const el of e.composedPath ? e.composedPath() : [e.target]) {
      if (el instanceof Element && el.matches?.("a[href]")) return el;
    }
    return e.target instanceof Element ? e.target.closest("a[href]") : null;
  }

  function handler(e) {
    if (!alive()) return teardown(); // never swallow a click we can't handle
    if (!enabled) return;
    if (e.type === "auxclick" && e.button !== 1) return;
    if (e.type === "click" && e.button !== 0) return;
    const a = linkFrom(e);
    if (!a) return;
    const real = unwrap(a.href);
    if (!shouldCheck(real)) return;
    if (!open(real)) return; // couldn't open the check page: let the link open normally
    e.preventDefault();
    e.stopImmediatePropagation();
  }

  function teardown() {
    window.removeEventListener("click", handler, true);
    window.removeEventListener("auxclick", handler, true);
    if (window.__raqeebGuard?.handler === handler) window.__raqeebGuard = null;
  }

  // Capture phase on window: runs before the page's own handlers (even ones on document/window).
  window.addEventListener("click", handler, true);
  window.addEventListener("auxclick", handler, true);
  window.__raqeebGuard = { alive, teardown, handler };

  // Tell the background this tab is protected (shows "ON" on the toolbar icon).
  if (hasChrome && window.top === window) {
    try {
      chrome.runtime.sendMessage({ type: "raqeeb-ready" }).catch(() => {});
    } catch {
      /* ignore */
    }
  }
})();
