// BJJ App Service Worker — PWA offline cache
const CACHE_NAME = "bjj-app-20260317";
const PRECACHE = ["/", "/login", "/manifest.json", "/icon-192.png", "/favicon.ico"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  // Only handle GET requests
  if (event.request.method !== "GET") return;
  // Skip Supabase API calls — always go to network
  if (event.request.url.includes("supabase.co")) return;

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        // Cache successful responses for static assets
        if (
          response.ok &&
          (event.request.url.endsWith(".png") ||
            event.request.url.endsWith(".ico") ||
            event.request.url.endsWith(".json") ||
            event.request.url.includes("/_next/static/"))
        ) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        }
        return response;
      })
      .catch(() =>
        // Offline fallback: serve from cache, or return cached LP
        caches.match(event.request).then((cached) => cached || caches.match("/"))
      )
  );
});
