import { useCallback, useEffect, useState } from "react";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

const isPreviewHost = (hostname: string) =>
  hostname.includes("lovableproject.com") || hostname.includes("id-preview--");

const isStandalone = () => {
  const iosNavigator = window.navigator as Navigator & { standalone?: boolean };

  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    iosNavigator.standalone === true
  );
};

let deferredPrompt: BeforeInstallPromptEvent | null = null;

export const usePWAInstall = () => {
  const [canInstall, setCanInstall] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isPreview, setIsPreview] = useState(false);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(display-mode: standalone)");

    const handleDisplayModeChange = () => {
      setIsInstalled(isStandalone());
    };

    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      deferredPrompt = e as BeforeInstallPromptEvent;
      setCanInstall(true);
    };

    const handleAppInstalled = () => {
      deferredPrompt = null;
      setCanInstall(false);
      setIsInstalled(true);
    };

    setIsPreview(isPreviewHost(window.location.hostname));
    setIsInstalled(isStandalone());

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    window.addEventListener("appinstalled", handleAppInstalled);

    if (typeof mediaQuery.addEventListener === "function") {
      mediaQuery.addEventListener("change", handleDisplayModeChange);
    }

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
      window.removeEventListener("appinstalled", handleAppInstalled);

      if (typeof mediaQuery.removeEventListener === "function") {
        mediaQuery.removeEventListener("change", handleDisplayModeChange);
      }
    };
  }, []);

  const install = useCallback(async () => {
    if (!deferredPrompt) return false;

    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;

    if (outcome === "accepted") {
      deferredPrompt = null;
      setCanInstall(false);
      setIsInstalled(true);
      return true;
    }

    return false;
  }, []);

  return { canInstall, install, isInstalled, isPreview };
};
