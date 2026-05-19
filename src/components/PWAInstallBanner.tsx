import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Smartphone, X } from "lucide-react";
import { usePWAInstall } from "@/hooks/use-pwa-install";
import { IOSInstallTutorial } from "@/components/pwa/IOSInstallTutorial";

const DEFAULT_DISMISSED_KEY = "pwa_install_banner_dismissed";
const IOS_AUTO_SHOWN_KEY = "pwa_install_ios_auto_shown";

const PUBLISHED_APP_URL = "https://agenda-psicologia.lovable.app";

interface PWAInstallBannerProps {
  /** localStorage key used to remember dismissal (allows separate state per surface). */
  storageKey?: string;
  /** If provided, banner only shows for the first 7 days from this date. */
  firstSeenDate?: string | Date | null;
  /** Days after firstSeenDate the banner stays visible. Default 7. */
  visibleDays?: number;
  /** When true, automatically opens the iOS modal once per device. */
  autoOpenIOS?: boolean;
  /** Visual variant: 'sticky' (top of layout) or 'inline'. */
  variant?: "sticky" | "inline";
}

export const PWAInstallBanner = ({
  storageKey = DEFAULT_DISMISSED_KEY,
  firstSeenDate = null,
  visibleDays = 7,
  autoOpenIOS = true,
  variant = "inline",
}: PWAInstallBannerProps = {}) => {
  const { canInstall, install, isInstalled, isPreview, isIOS } = usePWAInstall();
  const [dismissed, setDismissed] = useState(() => {
    return localStorage.getItem(storageKey) === "true";
  });
  const [iosModalOpen, setIosModalOpen] = useState(false);

  // Auto-open the iOS guide modal once per device (mobile only).
  useEffect(() => {
    if (!autoOpenIOS || !isIOS || isInstalled || dismissed) return;
    const alreadyShown = localStorage.getItem(IOS_AUTO_SHOWN_KEY) === "true";
    if (alreadyShown) return;
    const t = window.setTimeout(() => {
      setIosModalOpen(true);
      localStorage.setItem(IOS_AUTO_SHOWN_KEY, "true");
    }, 1500);
    return () => window.clearTimeout(t);
  }, [autoOpenIOS, isIOS, isInstalled, dismissed]);

  // 7-day window (only when firstSeenDate is provided).
  const withinWindow = (() => {
    if (!firstSeenDate) return true;
    const start = new Date(firstSeenDate).getTime();
    if (Number.isNaN(start)) return true;
    const elapsedDays = (Date.now() - start) / (1000 * 60 * 60 * 24);
    return elapsedDays <= visibleDays;
  })();

  // Don't render if installed, dismissed, out of window, or no install method available.
  if (
    isInstalled ||
    dismissed ||
    !withinWindow ||
    (!canInstall && !isPreview && !isIOS)
  ) {
    return null;
  }

  const handleInstall = async () => {
    if (isIOS) {
      setIosModalOpen(true);
      return;
    }
    if (canInstall) {
      await install();
      return;
    }
    if (isPreview) {
      window.open(PUBLISHED_APP_URL, "_blank", "noopener,noreferrer");
    }
  };

  const handleDismiss = () => {
    setDismissed(true);
    localStorage.setItem(storageKey, "true");
  };

  const containerClasses =
    variant === "sticky"
      ? "sticky top-0 z-40 w-full bg-primary text-primary-foreground shadow-md"
      : "relative w-full rounded-xl border border-primary/30 bg-primary/10 mb-4";

  const innerPadding = variant === "sticky" ? "px-4 py-2.5" : "p-4";
  const titleClass =
    variant === "sticky"
      ? "text-sm font-semibold text-primary-foreground"
      : "text-sm font-semibold text-foreground";
  const subtitleClass =
    variant === "sticky"
      ? "text-xs text-primary-foreground/80"
      : "text-xs text-muted-foreground";
  const iconWrapperClass =
    variant === "sticky"
      ? "h-8 w-8 rounded-lg bg-primary-foreground/15 flex items-center justify-center shrink-0"
      : "h-9 w-9 rounded-lg bg-primary/15 flex items-center justify-center shrink-0";
  const iconClass =
    variant === "sticky"
      ? "h-4 w-4 text-primary-foreground"
      : "h-5 w-5 text-primary";
  const buttonClass =
    variant === "sticky"
      ? "h-8 px-3 rounded-lg shrink-0 bg-primary-foreground text-primary hover:bg-primary-foreground/90 font-semibold"
      : "h-9 rounded-lg shrink-0 font-semibold";
  const dismissClass =
    variant === "sticky"
      ? "p-1.5 rounded-full hover:bg-primary-foreground/10 transition-colors shrink-0"
      : "p-1.5 rounded-full hover:bg-muted transition-colors shrink-0";
  const dismissIconClass =
    variant === "sticky"
      ? "h-4 w-4 text-primary-foreground/80"
      : "h-4 w-4 text-muted-foreground";

  return (
    <>
      <div className={containerClasses}>
        <div className={`flex items-center gap-3 ${innerPadding}`}>
          <div className={iconWrapperClass}>
            <Smartphone className={iconClass} />
          </div>
          <div className="flex-1 min-w-0">
            <p className={titleClass}>📱 Instalá la app en tu celular</p>
            <p className={subtitleClass}>
              {isIOS
                ? "Tocá Instalar para ver los pasos en iPhone"
                : "Accedé más rápido desde tu pantalla de inicio"}
            </p>
          </div>
          <Button
            size="sm"
            onClick={handleInstall}
            className={buttonClass}
            variant={variant === "sticky" ? "secondary" : "default"}
          >
            Instalar
          </Button>
          <button
            onClick={handleDismiss}
            className={dismissClass}
            aria-label="Cerrar"
          >
            <X className={dismissIconClass} />
          </button>
        </div>
      </div>
      <IOSInstallTutorial
        open={iosModalOpen}
        onClose={() => setIosModalOpen(false)}
      />
    </>
  );
};

export default PWAInstallBanner;
