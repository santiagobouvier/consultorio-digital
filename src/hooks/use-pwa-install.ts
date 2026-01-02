import { useState, useEffect } from "react";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

type Platform = "ios" | "android" | "desktop" | "unknown";

const detectPlatform = (): Platform => {
  const userAgent = navigator.userAgent.toLowerCase();

  if (/iphone|ipad|ipod/.test(userAgent)) {
    return "ios";
  }
  if (/android/.test(userAgent)) {
    return "android";
  }
  if (/windows|macintosh|linux/.test(userAgent) && !/mobile/.test(userAgent)) {
    return "desktop";
  }
  return "unknown";
};

const isInStandaloneMode = (): boolean => {
  // Múltiples formas de detectar standalone / instalada
  const displayModeStandalone = window.matchMedia("(display-mode: standalone)").matches;
  const displayModeFullscreen = window.matchMedia("(display-mode: fullscreen)").matches;
  const navigatorStandalone = (window.navigator as any).standalone === true; // iOS Safari

  return displayModeStandalone || displayModeFullscreen || navigatorStandalone;
};

// Persistir si el usuario instaló la app (solo como hint). NO debe bloquear listeners
// porque el usuario puede desinstalar la app y el navegador vuelve a requerir beforeinstallprompt.
const INSTALLED_KEY = "pwa_installed";

// --- Listener global (clave): si beforeinstallprompt se dispara ANTES de que se monte el botón,
// lo capturamos igual y no se pierde.
let deferredPromptGlobal: BeforeInstallPromptEvent | null = null;
let installableGlobal = false;
const subscribers = new Set<() => void>();

const notify = () => {
  subscribers.forEach((fn) => {
    try {
      fn();
    } catch {
      // ignore
    }
  });
};

const ensureGlobalPWAListeners = () => {
  if (typeof window === "undefined") return;
  const w = window as any;
  if (w.__pwa_listeners_attached) return;
  w.__pwa_listeners_attached = true;

  window.addEventListener("beforeinstallprompt", (e: Event) => {
    e.preventDefault();
    deferredPromptGlobal = e as BeforeInstallPromptEvent;
    installableGlobal = true;
    notify();
  });

  window.addEventListener("appinstalled", () => {
    deferredPromptGlobal = null;
    installableGlobal = false;
    try {
      localStorage.setItem(INSTALLED_KEY, "true");
    } catch {
      // ignore
    }
    notify();
  });
};

export const usePWAInstall = () => {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstallable, setIsInstallable] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);
  const [platform, setPlatform] = useState<Platform>("unknown");

  useEffect(() => {
    ensureGlobalPWAListeners();

    setPlatform(detectPlatform());

    // Estado real: standalone (instalada)
    const standaloneNow = isInStandaloneMode();
    setIsInstalled(standaloneNow);

    // Si alguna vez marcamos "instalada" pero ya no está en standalone,
    // limpiamos el flag para no quedar bloqueados.
    const storedInstalled = localStorage.getItem(INSTALLED_KEY) === "true";
    if (storedInstalled && !standaloneNow) {
      localStorage.removeItem(INSTALLED_KEY);
    }

    const syncFromGlobal = () => {
      setDeferredPrompt(deferredPromptGlobal);
      setIsInstallable(installableGlobal);
    };

    // Sincroniza inmediatamente (por si el evento ya pasó)
    syncFromGlobal();

    subscribers.add(syncFromGlobal);

    // Escuchar cambios en display-mode por si el usuario instala desde el menú del navegador
    const mediaQuery = window.matchMedia("(display-mode: standalone)");
    const handleDisplayModeChange = (e: MediaQueryListEvent) => {
      if (e.matches) {
        setIsInstalled(true);
        localStorage.setItem(INSTALLED_KEY, "true");
      } else {
        // si sale de standalone (ej: desinstalación / abrir en navegador)
        setIsInstalled(false);
      }
    };
    mediaQuery.addEventListener("change", handleDisplayModeChange);

    return () => {
      subscribers.delete(syncFromGlobal);
      mediaQuery.removeEventListener("change", handleDisplayModeChange);
    };
  }, []);

  const installApp = async (): Promise<boolean> => {
    const prompt = deferredPromptGlobal ?? deferredPrompt;
    if (!prompt) return false;

    try {
      await prompt.prompt();
      const { outcome } = await prompt.userChoice;

      if (outcome === "accepted") {
        deferredPromptGlobal = null;
        installableGlobal = false;
        setDeferredPrompt(null);
        setIsInstallable(false);
        setIsInstalled(true);
        localStorage.setItem(INSTALLED_KEY, "true");
        return true;
      }
      return false;
    } catch (error) {
      console.error("Error installing PWA:", error);
      return false;
    }
  };

  return {
    isInstallable,
    isInstalled,
    installApp,
    platform,
    // Para iOS siempre mostramos instrucciones manuales
    showManualInstructions: platform === "ios" && !isInstalled,
  };
};

