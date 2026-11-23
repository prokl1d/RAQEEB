const ids = ["enabled", "autoContinue", "searchBadges", "backend"];
const el = Object.fromEntries(ids.map((id) => [id, document.getElementById(id)]));
const status = document.getElementById("status");

// Show the extension's own version (from manifest.json) under the logo.
document.getElementById("extVersion").textContent = `Link Guard · v${chrome.runtime.getManifest().version}`;

async function ping(backend) {
  status.className = "status";
  status.textContent = "Checking connection…";
  try {
    const r = await fetch(backend.replace(/\/$/, "") + "/api/health");
    const j = await r.json();
    status.className = "status ok";
    status.textContent = `Connected to the RAQEEB engine (v${j.version})` + (j.offline_demo ? " · demo mode" : "");
  } catch {
    status.className = "status bad";
    status.textContent = "Can't reach the RAQEEB server. Start it, or check the address.";
  }
}

chrome.storage.sync.get(ids).then((s) => {
  el.enabled.checked = s.enabled !== false;
  el.autoContinue.checked = s.autoContinue !== false;
  el.searchBadges.checked = s.searchBadges !== false;
  el.backend.value = s.backend || "http://localhost:8000";
  ping(el.backend.value);
});

el.enabled.onchange = () => chrome.storage.sync.set({ enabled: el.enabled.checked });
el.autoContinue.onchange = () => chrome.storage.sync.set({ autoContinue: el.autoContinue.checked });
el.searchBadges.onchange = () => chrome.storage.sync.set({ searchBadges: el.searchBadges.checked });
el.backend.onchange = () => {
  const v = el.backend.value.trim();
  if (!/^https?:\/\//.test(v)) return;
  chrome.storage.sync.set({ backend: v });
  ping(v);
};
