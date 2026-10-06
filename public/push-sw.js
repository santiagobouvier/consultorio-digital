// Manejo de notificaciones push. NO es un service worker aparte: el service
// worker de la app (sw.js, generado por Workbox) lo carga con importScripts.
// Un alcance ("/") admite UN solo service worker. Si la app registra dos
// archivos distintos en el mismo alcance, cada pestaña que carga reemplaza al
// otro y, como este archivo tomaba el control al instante (skipWaiting +
// clients.claim), las demás pestañas recibían "controllerchange" y se
// recargaban solas: con dos o más pestañas, recarga infinita.
//
// Por eso acá no hay skipWaiting en install ni clients.claim en activate: la
// activación de versiones nuevas la decide la persona con "Actualizar". Las
// pestañas con la versión anterior todavía llaman a register("/push-sw.js");
// con este contenido ese registro queda esperando y no le quita el control a
// nadie.
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
