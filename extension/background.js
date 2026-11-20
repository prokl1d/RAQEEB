// RAQEEB Link Guard: background service worker.
// 1) Opens the RAQEEB check page for a link the content script intercepted.
// 2) Safety net: if WhatsApp Web, Gmail, Outlook or Telegram Web opens a new tab to an outside
//    link by itself (window.open, its own click handling), that tab is sent to the check page
//    first. Links are only sent to the RAQEEB server you configured (default: this computer).

const WATCHED = [
  /^https:\/\/web\.whatsapp\.com\//,
  /^https:\/\/web\.telegram\.org\//,
  /^https:\/\/mail\.google\.com\//,
  /^https:\/\/outlook\.live\.com\//,
  /^https:\/\/outlook\.office\.com\//,
  /^https:\/\/outlook\.office365\.com\//,
];
const SAME_APP = [
  /(^|\.)whatsapp\.com$/, /(^|\.)whatsapp\.net$/, /(^|\.)telegram\.org$/,
  /(^|\.)google\.com$/, /(^|\.)googleusercontent\.com$/, /(^|\.)gstatic\.com$/,
  /(^|\.)live\.com$/, /(^|\.)office\.com$/, /(^|\.)office365\.com$/, /(^|\.)microsoft\.com$/,
];

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

function needsCheck(url) {
  try {
    const u = new URL(url);
    if (u.protocol !== "http:" && u.protocol !== "https:") return false;
    return !SAME_APP.some((re) => re.test(u.hostname));
  } catch {
    return false;
  }
}

const checkPage = (url) => chrome.runtime.getURL("check.html") + "?u=" + encodeURIComponent(url);

async function isEnabled() {
  const s = await chrome.storage.sync.get("enabled");
  return s.enabled !== false;
}

// 1) From the content script
chrome.runtime.onMessage.addListener((msg, sender) => {
  if (msg?.type !== "raqeeb-check" || typeof msg.url !== "string") return;
  const opts = { url: checkPage(msg.url), active: true };
  if (sender.tab?.index !== undefined) opts.index = sender.tab.index + 1;
  if (sender.tab?.windowId !== undefined) opts.windowId = sender.tab.windowId;
  chrome.tabs.create(opts);
});

// 2) Safety net for tabs the watched sites open themselves.
// New tabs that start as about:blank and navigate a moment later are remembered briefly.
const pending = new Map(); // tabId -> expiry time

async function fromWatchedSite(sourceTabId) {
  try {
    const src = await chrome.tabs.get(sourceTabId);
    return Boolean(src.url && WATCHED.some((re) => re.test(src.url)));
  } catch {
    return false;
  }
}

async function redirect(tabId, rawUrl) {
  const url = unwrap(rawUrl);
  if (!needsCheck(url)) return false;
  await chrome.tabs.update(tabId, { url: checkPage(url) });
  return true;
}

chrome.webNavigation.onCreatedNavigationTarget.addListener(async (d) => {
  if (!(await isEnabled()) || !(await fromWatchedSite(d.sourceTabId))) return;
  if (d.url && d.url !== "about:blank" && (await redirect(d.tabId, d.url))) return;
  pending.set(d.tabId, Date.now() + 5000);
});

chrome.webNavigation.onBeforeNavigate.addListener(async (d) => {
  if (d.frameId !== 0) return;
  const until = pending.get(d.tabId);
  if (!until) return;
  pending.delete(d.tabId);
  if (Date.now() > until || d.url.startsWith(chrome.runtime.getURL(""))) return;
  await redirect(d.tabId, d.url);
});

chrome.tabs.onRemoved.addListener((tabId) => pending.delete(tabId));

chrome.runtime.onInstalled.addListener(async () => {
  const cur = await chrome.storage.sync.get(["enabled", "backend", "autoContinue"]);
  await chrome.storage.sync.set({
    enabled: cur.enabled ?? true,
    backend: cur.backend ?? "http://localhost:8000",
    autoContinue: cur.autoContinue ?? true,
  });
});
