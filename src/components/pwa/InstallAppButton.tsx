import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { usePWAInstall } from "@/hooks/use-pwa-install";
import { IOSInstallTutorial } from "./IOSInstallTutorial";
import { DesktopSafariTutorial } from "./DesktopSafariTutorial";
import { UnsupportedBrowserModal } from "./UnsupportedBrowserModal";

type Variant = "icon-only" | "icon-text";

interface InstallAppButtonProps {
  variant?: Variant;
  label?: string;
  className?: string;
  /** Personaliza el copy de los tutoriales con el nombre del consultorio. */
  clinicName?: string;
  /** Si true, recarga la app tras una instalación aceptada (default true). */
  reloadOnAccept?: boolean;
}

/**
 * Botón único de instalación PWA. Funciona en todas las plataformas:
 * - Android/Desktop Chrome con prompt nativo
 * - iOS Safari: abre tutorial visual
 * - Desktop Safari: abre tutorial Dock
 * - Firefox / sin soporte: abre modal explicativo
 * Se oculta automáticamente si la app ya está instalada.
 */
export const InstallAppButton = ({
  variant = "icon-text",
  label = "Instalar app",
  className,
  clinicName,
  reloadOnAccept = true,
}: InstallAppButtonProps) => {
  const { isInstalled, triggerInstall, isAndroid } = usePWAInstall();
  const [showIOS, setShowIOS] = useState(false);
  const [showSafari, setShowSafari] = useState(false);
  const [showUnsupported, setShowUnsupported] = useState(false);
  const [busy, setBusy] = useState(false);

  if (isInstalled) return null;

  const handleClick = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const result = await triggerInstall();
      switch (result) {
        case "accepted":
          toast.success("¡App instalada!", {
            description: /Mobi|Android|iPhone/i.test(navigator.userAgent)
              ? "Buscá el ícono en tu pantalla principal."
              : "Buscá la app en tu computadora.",
            duration: 4000,
          });
          if (reloadOnAccept) {
            window.setTimeout(() => window.location.reload(), 2000);
          }
          break;
        case "dismissed":
          // silencio — es esperable que rechacen
          break;
        case "ios":
          setShowIOS(true);
          break;
        case "desktop-safari":
          setShowSafari(true);
          break;
        case "unsupported":
          // En Android con Chrome el prompt nativo puede tardar unos segundos
          // en habilitarse (o estar desactivado en esta visita): el camino del
          // menú del navegador siempre funciona — mejor eso que decirle que su
          // navegador no sirve.
          if (isAndroid) {
            toast.info("Instalala desde el menú de Chrome", {
              description: "Tocá los tres puntos (⋮) arriba a la derecha y elegí “Agregar a la pantalla principal”.",
              duration: 6000,
            });
          } else {
            setShowUnsupported(true);
          }
          break;
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Button
        type="button"
        variant="ghost"
        size={variant === "icon-only" ? "icon" : "sm"}
        onClick={handleClick}
        disabled={busy}
        className={cn(
          variant === "icon-only" ? "h-9 w-9 rounded-full" : "gap-2 rounded-full",
          className,
        )}
        aria-label={label}
        title={label}
      >
        <Download className="h-4 w-4" />
        {variant === "icon-text" && <span className="text-sm font-medium">{label}</span>}
      </Button>
      <IOSInstallTutorial open={showIOS} onClose={() => setShowIOS(false)} clinicName={clinicName} />
      <DesktopSafariTutorial open={showSafari} onClose={() => setShowSafari(false)} clinicName={clinicName} />
      <UnsupportedBrowserModal open={showUnsupported} onClose={() => setShowUnsupported(false)} />
    </>
  );
};

export default InstallAppButton;