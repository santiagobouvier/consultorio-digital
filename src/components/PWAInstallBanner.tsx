import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Download, X } from "lucide-react";
import { usePWAInstall } from "@/hooks/use-pwa-install";

const BANNER_DISMISSED_KEY = "pwa_install_banner_dismissed";

const PUBLISHED_APP_URL = "https://agenda-psicologia.lovable.app";

export const PWAInstallBanner = () => {
  const { canInstall, install, isInstalled, isPreview } = usePWAInstall();
  const [dismissed, setDismissed] = useState(() => {
    return localStorage.getItem(BANNER_DISMISSED_KEY) === "true";
  });

  if (dismissed || isInstalled || (!canInstall && !isPreview)) return null;

  const handleInstall = async () => {
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
    localStorage.setItem(BANNER_DISMISSED_KEY, "true");
  };

  return (
    <div className="relative bg-primary/10 border border-primary/20 rounded-xl p-4 flex items-center gap-3">
      <Download className="h-5 w-5 text-primary shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-foreground">Instalá la app en tu dispositivo</p>
        <p className="text-xs text-muted-foreground">Accedé más rápido desde tu pantalla de inicio</p>
      </div>
      <Button size="sm" onClick={handleInstall} className="rounded-xl shrink-0">
        Instalar
      </Button>
      <button
        onClick={handleDismiss}
        className="absolute top-2 right-2 p-1 rounded-full hover:bg-muted transition-colors"
      >
        <X className="h-3.5 w-3.5 text-muted-foreground" />
      </button>
    </div>
  );
};

export default PWAInstallBanner;
