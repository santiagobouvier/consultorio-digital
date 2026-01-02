import { useEffect, useState } from "react";

// Hook mínimo y "limpio":
// - Captura beforeinstallprompt (Android/Chrome) y expone un método install()
// - Sin popups, sin localStorage, sin flujos alternativos

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

let deferredPromptGlobal: BeforeInstallPromptEvent | null = null;
let listenersAttached = false;
const subscribers = new Set<(e: BeforeInstallPromptEvent | null) => void>();

const attachOnce = () => {
  if (typeof window === "undefined") return;
  if (listenersAttached) return;
  listenersAttached = true;

  window.addEventListener("beforeinstallprompt", (e: Event) => {
    e.preventDefault();
    deferredPromptGlobal = e as BeforeInstallPromptEvent;
    subscribers.forEach((fn) => fn(deferredPromptGlobal));
  });

  window.addEventListener("appinstalled", () => {
    deferredPromptGlobal = null;
    subscribers.forEach((fn) => fn(deferredPromptGlobal));
  });
};

export const usePWAInstall = () => {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    attachOnce();

    // sync inmediato por si el evento ya ocurrió
    setDeferredPrompt(deferredPromptGlobal);

    const sub = (e: BeforeInstallPromptEvent | null) => setDeferredPrompt(e);
    subscribers.add(sub);
    return () => {
      subscribers.delete(sub);
    };
  }, []);

  const installApp = async (): Promise<boolean> => {
    const prompt = deferredPromptGlobal ?? deferredPrompt;
    if (!prompt) return false;

    await prompt.prompt();
    const { outcome } = await prompt.userChoice;

    if (outcome === "accepted") {
      deferredPromptGlobal = null;
      setDeferredPrompt(null);
      return true;
    }

    return false;
  };

  return {
    // El botón debe mostrarse solo cuando exista el evento
    isInstallable: Boolean(deferredPromptGlobal ?? deferredPrompt),
    installApp,
  };
};
