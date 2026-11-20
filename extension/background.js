// RAQEEB Link Guard: background service worker.
// Opens the RAQEEB check page for a clicked link. The link itself is only sent to
// the RAQEEB backend you configured (default: your own computer, localhost:8000).

chrome.runtime.onMessage.addListener((msg, sender) => {
  if (msg?.type !== "raqeeb-check" || typeof msg.url !== "string") return;
  const page = chrome.runtime.getURL("check.html") + "?u=" + encodeURIComponent(msg.url);
  const opts = { url: page, active: true };
  if (sender.tab?.index !== undefined) opts.index = sender.tab.index + 1;
  if (sender.tab?.windowId !== undefined) opts.windowId = sender.tab.windowId;
  chrome.tabs.create(opts);
});

chrome.runtime.onInstalled.addListener(async () => {
  const cur = await chrome.storage.sync.get(["enabled", "backend", "autoContinue"]);
  await chrome.storage.sync.set({
    enabled: cur.enabled ?? true,
    backend: cur.backend ?? "http://localhost:8000",
    autoContinue: cur.autoContinue ?? true,
  });
});
