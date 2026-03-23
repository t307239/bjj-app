// BJJ App Service Worker — PWA offline cache + Web Push
const CACHE_NAME = "bjj-app-20260324";
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

// ─── Web Push ────────────────────────────────────────────────────────────────

/**
 * push: Show a notification when the server sends a push message.
 * Payload format (JSON):
 *   { title: string, body: string, url?: string, icon?: string }
 */
self.addEventListener("push", (event) => {
  if (!event.data) return;

  let payload = { title: "BJJ App", body: "You have a new notification", url: "/", icon: "/icon-192.png" };
  try {
    payload = { ...payload, ...event.data.json() };
  } catch {
    payload.body = event.data.text();
  }

  event.waitUntil(
    self.registration.showNotification(payload.title, {
      body: payload.body,
      icon: payload.icon ?? "/icon-192.png",
      badge: "/icon-192.png",
      data: { url: payload.url ?? "/" },
    })
  );
});

/**
 * notificationclick: Open (or focus) the target URL when user taps a notification.
 */
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetUrl = event.notification.data?.url ?? "/";

  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((clientList) => {
        // If app is already open in a tab, focus it and navigate
        for (const client of clientList) {
          if ("navigate" in client && "focus" in client) {
            return client.focus().then(() => client.navigate(targetUrl));
          }
        }
        // Otherwise open a new window
        if (self.clients.openWindow) {
          return self.clients.openWindow(targetUrl);
        }
      })
  );
});
