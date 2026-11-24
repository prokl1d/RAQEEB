// RAQEEB service worker: makes the site installable and keeps the app shell available offline.
// Investigations always go to the network: results are never cached.
const CACHE = "raqeeb-shell-v1";
const SHELL = ["/", "/favicon.svg", "/icon-192.png", "/icon-512.png", "/manifest.webmanifest"];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== "GET" || url.origin !== self.location.origin || url.pathname.startsWith("/api/")) return;
  // Network first, so the newest version is used; the cache is only a fallback when offline.
  e.respondWith(
    fetch(e.request)
      .then((res) => {
        if (res.ok && (e.request.mode === "navigate" || SHELL.includes(url.pathname) || url.pathname.startsWith("/assets/"))) {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(e.request.mode === "navigate" ? "/" : e.request, copy));
        }
        return res;
      })
      .catch(() => caches.match(e.request.mode === "navigate" ? "/" : e.request).then((r) => r || Response.error())),
  );
});
