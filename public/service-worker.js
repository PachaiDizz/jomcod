// JomCOD service worker — network-first so deployed updates always load.
// Cache is only used as an offline fallback, so stale builds never get served.
// Bump CACHE_NAME whenever you make big changes to clear old caches.
const CACHE_NAME = "jomcod-cache-v7";
// NOTE: no "/index.html" here — it redirects (307) on Vercel/Next.js, and
// iOS Safari's cache.addAll rejects redirects, which would fail the whole
// install and leave the service worker inactive.
const CORE_ASSETS = [
  "/",
  "/manifest.json",
  "/icon-192.png",
  "/icon-512.png"
];

// Install: pre-cache the core shell so the app opens instantly even offline.
// addAll rejects if ANY asset fails, so add each one independently and never
// let a single hiccup fail the install.
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) =>
      Promise.allSettled(CORE_ASSETS.map((url) => cache.add(url)))
    )
  );
  self.skipWaiting();
});

// Activate: clean up old caches from previous versions.
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

// Fetch: network first, then cache. Only same-origin GET requests are handled.
self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  if (!request.url.startsWith(self.location.origin)) return;

  event.respondWith(
    fetch(request)
      .then((response) => {
        if (response.ok) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
        }
        return response;
      })
      .catch(() =>
        caches.match(request).then(
          (cached) =>
            cached ||
            caches.match("/index.html").then((home) => home || Response.error())
        )
      )
  );
});

// Push: show an OS notification even when the app is closed.
self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    // ignore malformed payloads
  }
  event.waitUntil(
    self.registration.showNotification(data.title || "JomCOD", {
      body: data.body || "",
      icon: "/icon-192.png",
      badge: "/icon-192.png",
      data: { url: data.url || "/" },
    })
  );
});

// Tap the notification → open the right page (or focus the open window).
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || "/";
  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((windows) => {
      for (const w of windows) {
        if (w.url === url || new URL(w.url).pathname === new URL(url).pathname) {
          return w.focus();
        }
      }
      return clients.openWindow(url);
    })
  );
});
