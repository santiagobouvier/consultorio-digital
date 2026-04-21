// Custom service worker for push notification handling
// This file is loaded alongside the workbox-generated SW
// Bump SW_VERSION on each deploy to force browsers to fetch a fresh worker.
const SW_VERSION = "2026-04-21-1";

self.addEventListener("install", () => {
  // Take over as soon as the new SW is installed.
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  // Claim all open clients so the updated SW controls them immediately.
  event.waitUntil(self.clients.claim());
});

self.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING") {
    self.skipWaiting();
    return;
  }
  if (event.data?.type !== "CLEAR_APP_CACHES") return;

  event.waitUntil(
    caches.keys().then(async (cacheNames) => {
      await Promise.all(cacheNames.map((cacheName) => caches.delete(cacheName)));
      event.ports?.[0]?.postMessage({ ok: true });
    })
  );
});

self.addEventListener("push", (event) => {
  if (!event.data) return;

  let data;
  try {
    data = event.data.json();
  } catch {
    data = { title: "Consultorio Digital", body: event.data.text() };
  }

  const { title, body, icon, data: notifData } = data;

  event.waitUntil(
    self.registration.showNotification(title || "Consultorio Digital", {
      body: body || "",
      icon: icon || "/app-icon.svg",
      badge: "/app-icon.svg",
      data: notifData || {},
      vibrate: [200, 100, 200],
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const url = event.notification.data?.url || "/dashboard";

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      // Focus existing window if open
      for (const client of clients) {
        if (client.url.includes(self.location.origin) && "focus" in client) {
          client.navigate(url);
          return client.focus();
        }
      }
      // Open new window
      return self.clients.openWindow(url);
    })
  );
});
