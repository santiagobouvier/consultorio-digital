import { useCallback, useEffect, useState } from "react";
import { triggerPWAInstalledCelebration } from "@/components/PWAInstalledCelebrationModal";

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

const detectIOS = () => {
  const ua = window.navigator.userAgent;
  const iosNavigator = window.navigator as Navigator & { standalone?: boolean };
  // iPad on iOS 13+ reports as Mac, detect via touch points
  const iPadOS =
    ua.includes("Macintosh") && (window.navigator.maxTouchPoints || 0) > 1;
  return /iPhone|iPad|iPod/.test(ua) || iPadOS || iosNavigator.standalone !== undefined;
};

const detectAndroid = () => /Android/.test(window.navigator.userAgent);

const detectDesktopSafari = () => {
  const ua = window.navigator.userAgent;
  const isSafari = /Safari/.test(ua) && !/Chrome|Chromium|Edg|OPR|Firefox/.test(ua);
  const isMac = /Macintosh/.test(ua) && (window.navigator.maxTouchPoints || 0) <= 1;
  return isSafari && isMac;
};

const detectFirefox = () =>
  /Firefox/i.test(window.navigator.userAgent) || /FxiOS/i.test(window.navigator.userAgent);

let deferredPrompt: BeforeInstallPromptEvent | null = null;

export type TriggerInstallResult =
  | "accepted"
  | "dismissed"
  | "ios"
  | "desktop-safari"
  | "unsupported";

export const usePWAInstall = () => {
  const [canInstall, setCanInstall] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isPreview, setIsPreview] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [isAndroid, setIsAndroid] = useState(false);
  const [isDesktopSafari, setIsDesktopSafari] = useState(false);
  const [isFirefox, setIsFirefox] = useState(false);

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
    setIsIOS(detectIOS());
    setIsAndroid(detectAndroid());
    setIsDesktopSafari(detectDesktopSafari());
    setIsFirefox(detectFirefox());

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
      // Fallback: some browsers (notably Android Chrome in certain configs)
      // don't reliably fire `appinstalled`. Trigger the celebration modal
      // after a short delay so the user always sees confirmation.
      // Use force=true so reinstalls (where the localStorage flag persists)
      // also show the modal — the user explicitly asked to install.
      window.setTimeout(() => {
        triggerPWAInstalledCelebration(true);
      }, 3000);
      return true;
    }

    return false;
  }, []);

  // Derived flags
  const isDesktop = !isIOS && !isAndroid;
  // No native prompt available AND not iOS/desktop-Safari that have manual flows.
  const isUnsupported = !canInstall && !isIOS && !isDesktopSafari && (isFirefox || (isDesktop && !isDesktopSafari));

  /**
   * Unified install trigger. Returns a discriminator so the caller can
   * decide which modal to show. Never opens UI by itself.
   */
  const triggerInstall = useCallback(async (): Promise<TriggerInstallResult> => {
    if (canInstall) {
      const accepted = await install();
      return accepted ? "accepted" : "dismissed";
    }
    if (isIOS) return "ios";
    if (isDesktopSafari) return "desktop-safari";
    return "unsupported";
  }, [canInstall, install, isIOS, isDesktopSafari]);

  return {
    canInstall,
    install,
    isInstalled,
    isPreview,
    isIOS,
    isAndroid,
    isDesktop,
    isDesktopSafari,
    isFirefox,
    isUnsupported,
    triggerInstall,
  };
};
