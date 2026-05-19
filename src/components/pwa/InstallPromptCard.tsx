import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Smartphone, X } from "lucide-react";
import { usePWAInstall } from "@/hooks/use-pwa-install";
import { IOSInstallTutorial } from "./IOSInstallTutorial";
import { DesktopSafariTutorial } from "./DesktopSafariTutorial";
import { UnsupportedBrowserModal } from "./UnsupportedBrowserModal";
import { toast } from "sonner";

const DISMISS_KEY = "pwa_install_card_dismissed_pro";

/**
 * Card sutil dismissible (persistente) para sugerir instalar la app
 * desde el dashboard del profesional. Se oculta si ya está instalada
 * o si el usuario la dismiss-eó alguna vez.
 */
export const InstallPromptCard = () => {
  const { isInstalled, triggerInstall } = usePWAInstall();
  const [dismissed, setDismissed] = useState(
    () => typeof window !== "undefined" && localStorage.getItem(DISMISS_KEY) === "true",
  );
  const [showIOS, setShowIOS] = useState(false);
  const [showSafari, setShowSafari] = useState(false);
  const [showUnsupported, setShowUnsupported] = useState(false);
  const [busy, setBusy] = useState(false);

  if (isInstalled || dismissed) return null;

  const handleDismiss = () => {
    localStorage.setItem(DISMISS_KEY, "true");
    setDismissed(true);
  };

  const handleInstall = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const result = await triggerInstall();
      switch (result) {
        case "accepted":
          toast.success("¡App instalada!");
          window.setTimeout(() => window.location.reload(), 2000);
          break;
        case "ios":
          setShowIOS(true);
          break;
        case "desktop-safari":
          setShowSafari(true);
          break;
        case "unsupported":
          setShowUnsupported(true);
          break;
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Card className="border-primary/20 bg-primary/[0.04]">
        <CardContent className="p-3 flex items-center gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Smartphone className="h-4 w-4" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium leading-tight">
              Instalá Consultorio Digital en tu dispositivo
            </p>
            <p className="text-xs text-muted-foreground leading-tight mt-0.5">
              Acceso rápido desde tu escritorio o celular.
            </p>
          </div>
          <Button
            size="sm"
            onClick={handleInstall}
            disabled={busy}
            className="h-8 rounded-lg font-semibold shrink-0"
          >
            Instalar
          </Button>
          <button
            type="button"
            onClick={handleDismiss}
            className="p-1.5 rounded-full hover:bg-muted transition-colors shrink-0"
            aria-label="Cerrar"
          >
            <X className="h-3.5 w-3.5 text-muted-foreground" />
          </button>
        </CardContent>
      </Card>
      <IOSInstallTutorial open={showIOS} onClose={() => setShowIOS(false)} />
      <DesktopSafariTutorial open={showSafari} onClose={() => setShowSafari(false)} />
      <UnsupportedBrowserModal open={showUnsupported} onClose={() => setShowUnsupported(false)} />
    </>
  );
};

export default InstallPromptCard;