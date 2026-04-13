import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { registerSW } from "virtual:pwa-register";

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

if (isPreviewHost || isInIframe) {
  navigator.serviceWorker?.getRegistrations().then((registrations) => {
    registrations.forEach((registration) => registration.unregister());
  });
} else {
  registerSW({
    immediate: true,
  });

  // Register push notification service worker
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("/push-sw.js").catch((err) => {
      console.warn("Push SW registration failed:", err);
    });
  }
}

createRoot(document.getElementById("root")!).render(<App />);
