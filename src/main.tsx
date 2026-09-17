import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { registerSW } from "virtual:pwa-register";
import {
  clearServiceWorkerCaches,
  detectReloadLoopAndRecover,
  isChunkLoadFailure,
  recoverFromChunkLoadFailure,
  stripRecoveryMarkerWhenStable,
} from "@/lib/session-recovery";

window.addEventListener("vite:preloadError", (event) => {
  event.preventDefault();
  void recoverFromChunkLoadFailure({ unregisterServiceWorkers: true });
});

window.addEventListener("unhandledrejection", (event) => {
  if (!isChunkLoadFailure(event.reason)) return;
  event.preventDefault();
  void recoverFromChunkLoadFailure({ unregisterServiceWorkers: true });
});

window.addEventListener("error", (event) => {
  if (!isChunkLoadFailure(event.error ?? event.message)) return;
  event.preventDefault();
  void recoverFromChunkLoadFailure({ unregisterServiceWorkers: true });
});

const isInIframe = (() => {
  try {
    return window.self !== window.top;
  } catch {
    return true;
  }
})();

const isPreviewHost =
  window.location.hostname.includes("id-preview--") ||
  window.location.hostname.includes("lovableproject.com");

const SPLASH_MIN_DURATION_MS = 300;
const splashStartedAt = performance.now();

const hideAppSplash = () => {
  const el = document.getElementById("app-splash");
  if (!el) return;
  const elapsed = performance.now() - splashStartedAt;
  const remaining = Math.max(0, SPLASH_MIN_DURATION_MS - elapsed);
  window.setTimeout(() => {
    el.classList.add("fade-out");
    window.setTimeout(() => el.remove(), 450);
  }, remaining);
};

const bootstrap = async () => {
  if (!isPreviewHost && !isInIframe) {
    const recoveredFromLoop = await detectReloadLoopAndRecover();
    if (recoveredFromLoop) return;
  }

  if (isPreviewHost || isInIframe) {
    await clearServiceWorkerCaches({ unregister: true });
  } else {
    // Sin recargas automáticas en medio de la sesión, pero SIN quedarse
    // viejo para siempre: cuando hay versión nueva se avisa con un toast
    // ("Actualizar" recarga una sola vez, iniciado por el usuario) y cada
    // una hora se chequea si salió algo nuevo.
    const updateSW = registerSW({
      onNeedRefresh() {
        window.dispatchEvent(new CustomEvent("pwa:need-refresh"));
      },
      onRegistered(reg) {
        if (reg) {
          window.setInterval(() => {
            void reg.update().catch(() => {});
          }, 60 * 60 * 1000);
        }
      },
    });
    window.addEventListener("pwa:do-update", () => {
      void updateSW(true);
    });

    // Register push notification service worker
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/push-sw.js").catch((err) => {
        console.warn("Push SW registration failed:", err);
      });
    }
  }

  createRoot(document.getElementById("root")!).render(<App />);
  // Si esta carga vino de una recuperación automática y la app quedó
  // estable, se limpia el contador de la URL.
  stripRecoveryMarkerWhenStable();
  // El splash lo apaga la app cuando la primera pantalla real montó
  // (AppSplashKiller). Esto queda como red de seguridad por si algo falla:
  // nunca más de 10 segundos de splash.
  window.setTimeout(hideAppSplash, 10_000);
};

void bootstrap();
