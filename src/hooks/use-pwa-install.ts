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

// Persistir si el usuario instaló la app (para casos donde el navegador no reporta bien)
const INSTALLED_KEY = "pwa_installed";

export const usePWAInstall = () => {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstallable, setIsInstallable] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);
  const [platform, setPlatform] = useState<Platform>("unknown");

  useEffect(() => {
    setPlatform(detectPlatform());
    
    // Check if already installed (standalone o localStorage)
    if (isInStandaloneMode() || localStorage.getItem(INSTALLED_KEY) === "true") {
      setIsInstalled(true);
      return;
    }

    const handleBeforeInstall = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setIsInstallable(true);
    };

    const handleAppInstalled = () => {
      setIsInstalled(true);
      setIsInstallable(false);
      setDeferredPrompt(null);
      // Guardar en localStorage para detectar en el futuro
      localStorage.setItem(INSTALLED_KEY, "true");
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstall);
    window.addEventListener("appinstalled", handleAppInstalled);

    // Escuchar cambios en display-mode por si el usuario instala desde el menú del navegador
    const mediaQuery = window.matchMedia("(display-mode: standalone)");
    const handleDisplayModeChange = (e: MediaQueryListEvent) => {
      if (e.matches) {
        setIsInstalled(true);
        localStorage.setItem(INSTALLED_KEY, "true");
      }
    };
    mediaQuery.addEventListener("change", handleDisplayModeChange);

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstall);
      window.removeEventListener("appinstalled", handleAppInstalled);
      mediaQuery.removeEventListener("change", handleDisplayModeChange);
    };
  }, []);

  const installApp = async (): Promise<boolean> => {
    if (!deferredPrompt) return false;

    try {
      await deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      
      if (outcome === "accepted") {
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
    showManualInstructions: platform === "ios" && !isInstalled
  };
};
