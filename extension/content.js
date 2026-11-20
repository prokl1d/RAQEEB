// RAQEEB Link Guard: content script for messaging and email sites.
// Intercepts clicks on links that leave the current site and sends them to the
// RAQEEB check page instead. Only the link is used; message text is not read.
// Backup: background.js also catches new tabs these sites open by themselves.

(() => {
  if (window.__raqeebGuard) return;
  window.__raqeebGuard = true;

  // Where check.html lives when this script is loaded by a plain test page (no extension).
  const SCRIPT_BASE = document.currentScript ? new URL(".", document.currentScript.src).href : "";

  let enabled = true;
  const hasChrome = typeof chrome !== "undefined" && chrome.runtime?.id;
  if (hasChrome) {
    chrome.storage.sync.get("enabled").then((s) => (enabled = s.enabled !== false));
    chrome.storage.onChanged.addListener((c) => {
      if (c.enabled) enabled = c.enabled.newValue !== false;
    });
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

  function open(url) {
    if (hasChrome) {
      chrome.runtime.sendMessage({ type: "raqeeb-check", url });
    } else {
      // Test harness without the extension: open the page relative to this script.
      window.open(SCRIPT_BASE + "check.html?u=" + encodeURIComponent(url), "_blank");
    }
  }

  // Find the link that was clicked, even inside shadow DOM or when the click hit an icon/span.
  function linkFrom(e) {
    for (const el of e.composedPath ? e.composedPath() : [e.target]) {
      if (el instanceof Element && el.matches?.("a[href]")) return el;
    }
    return e.target instanceof Element ? e.target.closest("a[href]") : null;
  }

  function handler(e) {
    if (!enabled) return;
    if (e.type === "auxclick" && e.button !== 1) return;
    if (e.type === "click" && e.button !== 0) return;
    const a = linkFrom(e);
    if (!a) return;
    const real = unwrap(a.href);
    if (!shouldCheck(real)) return;
    e.preventDefault();
    e.stopImmediatePropagation();
    open(real);
  }

  // Capture phase on window: runs before the page's own handlers (even ones on document/window).
  window.addEventListener("click", handler, true);
  window.addEventListener("auxclick", handler, true);
})();
