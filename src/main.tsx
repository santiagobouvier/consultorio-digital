import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { registerSW } from "virtual:pwa-register";
import { detectReloadLoopAndRecover } from "@/lib/session-recovery";

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

const bootstrap = async () => {
  if (!isPreviewHost && !isInIframe) {
    const recoveredFromLoop = await detectReloadLoopAndRecover();
    if (recoveredFromLoop) return;
  }

  if (isPreviewHost || isInIframe) {
    navigator.serviceWorker?.getRegistrations().then((registrations) => {
      registrations.forEach((registration) => registration.unregister());
    });
  } else {
    // No usamos immediate:true ni callbacks que recarguen automáticamente.
    // El nuevo SW se activará cuando el usuario cierre y vuelva a abrir la
    // app — así evitamos recargas en medio del scroll o de una sesión activa.
    registerSW();

    // Register push notification service worker
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/push-sw.js").catch((err) => {
        console.warn("Push SW registration failed:", err);
      });
    }
  }

  createRoot(document.getElementById("root")!).render(<App />);
};

void bootstrap();
