// RAQEEB Link Guard: content script for messaging and email sites.
// Intercepts clicks on links that leave the current site and sends them to the
// RAQEEB check page instead. Only the link is used; message text is not read.

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

  // Gmail and Outlook wrap links in redirectors; recover the real destination.
  function unwrap(href) {
    try {
      const u = new URL(href);
      if (/(^|\.)google\.com$/.test(u.hostname) && u.pathname === "/url") {
        return u.searchParams.get("q") || u.searchParams.get("url") || href;
      }
      if (/safelinks\.protection\.outlook\.com$/.test(u.hostname)) {
        return u.searchParams.get("url") || href;
      }
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

  function handler(e) {
    if (!enabled) return;
    if (e.type === "auxclick" && e.button !== 1) return;
    const a = e.target instanceof Element ? e.target.closest("a[href]") : null;
    if (!a) return;
    const real = unwrap(a.href);
    if (!shouldCheck(real)) return;
    e.preventDefault();
    e.stopImmediatePropagation();
    open(real);
  }

  // Capture phase so we act before the page's own click handlers.
  document.addEventListener("click", handler, true);
  document.addEventListener("auxclick", handler, true);
})();
