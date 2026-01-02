import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

// PWA: registra el service worker. Sin esto, Android suele NO habilitar el instalador automático.
import { registerSW } from "virtual:pwa-register";

registerSW({
  immediate: true,
});

createRoot(document.getElementById("root")!).render(<App />);
