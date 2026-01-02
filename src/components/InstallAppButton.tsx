import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Download, Check, Smartphone, Loader2 } from "lucide-react";
import { usePWAInstall } from "@/hooks/use-pwa-install";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface InstallAppButtonProps {
  variant?: "default" | "outline" | "ghost";
  size?: "default" | "sm" | "lg";
  className?: string;
  showIcon?: boolean;
}

// Detecta en tiempo real si la app está en modo standalone (instalada)
const checkIsInstalledNow = (): boolean => {
  const displayModeStandalone = window.matchMedia("(display-mode: standalone)").matches;
  const displayModeFullscreen = window.matchMedia("(display-mode: fullscreen)").matches;
  const navigatorStandalone = (window.navigator as any).standalone === true;
  return displayModeStandalone || displayModeFullscreen || navigatorStandalone;
};

export const InstallAppButton = ({
  variant = "default",
  size = "default",
  className = "",
  showIcon = true,
}: InstallAppButtonProps) => {
  const { isInstallable, installApp, platform, showManualInstructions } = usePWAInstall();
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [showSuccessDialog, setShowSuccessDialog] = useState(false);
  const [showUnavailableDialog, setShowUnavailableDialog] = useState(false);
  const [showManualDialog, setShowManualDialog] = useState(false);
  const [showAlreadyInstalledDialog, setShowAlreadyInstalledDialog] = useState(false);
  const [isInstalling, setIsInstalling] = useState(false);

  const handleClickInstall = () => {
    // Si estás en un iframe (preview) o en un navegador embebido, Android NO muestra el instalador.
    // En ese caso abrimos la app en una pestaña normal para que el prompt pueda aparecer.
    try {
      const isInIframeNow = window.self !== window.top;
      const ua = navigator.userAgent;
      const isInAppBrowserNow = /Instagram|FBAN|FBAV|FB_IAB|Line\/|WhatsApp|wv\)|; wv|Twitter/i.test(ua);

      if (platform === "android" && (isInIframeNow || isInAppBrowserNow)) {
        window.open(window.location.href, "_blank", "noopener,noreferrer");
        return;
      }
    } catch {
      // Si no podemos detectar, igual seguimos con el flujo normal.
    }

    // Verificar EN TIEMPO REAL si ya está instalada
    if (checkIsInstalledNow()) {
      setShowAlreadyInstalledDialog(true);
      return;
    }

    // En iPhone/iPad no existe el prompt automático. Mostramos instrucciones.
    if (showManualInstructions) {
      setShowManualDialog(true);
      return;
    }

    setShowConfirmDialog(true);
  };

  const handleConfirmInstall = async () => {
    setShowConfirmDialog(false);
    setIsInstalling(true);

    // Si el navegador no expone el prompt, NO podemos forzar la instalación.
    // En Android esto suele pasar cuando:
    // - Estás dentro de un navegador embebido (Instagram/WhatsApp)
    // - Estás dentro de un iframe (como la vista previa)
    // - Chrome todavía no consideró el sitio "instalable" en ese contexto
    if (!isInstallable) {
      setIsInstalling(false);

      if (showManualInstructions) {
        setShowManualDialog(true);
      } else {
        setShowUnavailableDialog(true);
      }
      return;
    }

    // Dispara el prompt nativo del navegador.
    const accepted = await installApp();

    // Si el usuario canceló, cortamos.
    if (!accepted) {
      setIsInstalling(false);
      return;
    }

    // Luego de aceptar el prompt, mostramos SI O SÍ el popup informativo.
    setIsInstalling(false);
    setShowSuccessDialog(true);
  };

  const isInIframe = (() => {
    try {
      return window.self !== window.top;
    } catch {
      return true;
    }
  })();

  const userAgent = typeof navigator !== "undefined" ? navigator.userAgent : "";
  const isInAppBrowser = /Instagram|FBAN|FBAV|FB_IAB|Line\/|WhatsApp|wv\)|; wv|Twitter/i.test(userAgent);

  const openInNewTab = () => {
    // En la vista previa (iframe), abrir en nueva pestaña hace que Chrome pueda mostrar el instalador.
    window.open(window.location.href, "_blank", "noopener,noreferrer");
  };

  // SIEMPRE mostramos el botón "Instalar App" - la verificación es al hacer clic

  return (
    <>
      <Button
        variant={variant}
        size={size}
        className={`gap-2 ${className}`}
        onClick={handleClickInstall}
        disabled={isInstalling}
      >
        {showIcon && <Download className="h-4 w-4" />}
        {isInstalling ? "Instalando..." : "Instalar App"}
      </Button>

      {/* Dialog informativo antes de instalar */}
      <Dialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Smartphone className="h-6 w-6 text-primary" />
              Instalar Tu Consultorio
            </DialogTitle>
            <DialogDescription className="text-base pt-2">
              La aplicación quedará como un ícono en tu celular para que puedas acceder
              rápidamente sin abrir el navegador.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-center gap-3 pt-4">
            <Button variant="outline" onClick={() => setShowConfirmDialog(false)}>
              Cancelar
            </Button>
            <Button onClick={handleConfirmInstall}>
              <Download className="h-4 w-4 mr-2" />
              Instalar
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Dialog de progreso (instalando) */}
      <Dialog open={isInstalling}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Loader2 className="h-5 w-5 animate-spin text-primary" />
              Instalando...
            </DialogTitle>
            <DialogDescription className="text-base pt-2">
              Confirmaste la instalación. Tu celular está agregando el ícono.
            </DialogDescription>
          </DialogHeader>
        </DialogContent>
      </Dialog>

      {/* Dialog cuando el navegador no expone el instalador automático */}
      <Dialog open={showUnavailableDialog} onOpenChange={setShowUnavailableDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Smartphone className="h-6 w-6 text-primary" />
              Instalación
            </DialogTitle>
            <DialogDescription className="text-base pt-2">
              No se pudo abrir el instalador automático en este contexto.
              {platform === "android" ? (
                <>
                  {isInIframe || isInAppBrowser ? (
                    <>
                      <br />
                      Abrilo en <strong>Chrome (pestaña normal)</strong> y volvé a tocar “Instalar App”.
                    </>
                  ) : (
                    <>
                      {" "}
                      Probá actualizar la página y volver a intentar en unos segundos.
                    </>
                  )}
                </>
              ) : (
                <> Probá actualizar la página y volver a intentar en unos segundos.</>
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col sm:flex-row justify-center gap-3 pt-4">
            {(platform === "android") && (isInIframe || isInAppBrowser) && (
              <Button onClick={openInNewTab}>Abrir en nueva pestaña</Button>
            )}
            <Button variant={(platform === "android") && (isInIframe || isInAppBrowser) ? "outline" : "default"} onClick={() => setShowUnavailableDialog(false)}>
              Entendido
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Dialog de instalación manual (iOS) */}
      <Dialog open={showManualDialog} onOpenChange={setShowManualDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Smartphone className="h-6 w-6 text-primary" />
              Instalar en iPhone
            </DialogTitle>
            <DialogDescription className="text-base pt-2">
              En iPhone la instalación es manual:
              <br />
              1) Tocá Compartir (cuadrado con flecha ↑)
              <br />
              2) Elegí "Agregar a pantalla de inicio"
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-center pt-4">
            <Button onClick={() => setShowManualDialog(false)}>Entendido</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Dialog de resultado */}
      <Dialog open={showSuccessDialog} onOpenChange={setShowSuccessDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Check className="h-6 w-6 text-green-600" />
              Instalación en curso
            </DialogTitle>
            <DialogDescription className="text-base pt-2">
              Si aceptaste la instalación, el ícono aparece en tu pantalla de inicio en segundos.
              Si no lo ves, buscá "Tu Consultorio" en el buscador de apps del celular.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-center pt-4">
            <Button onClick={() => setShowSuccessDialog(false)}>Entendido</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Dialog cuando ya está instalada */}
      <Dialog open={showAlreadyInstalledDialog} onOpenChange={setShowAlreadyInstalledDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Check className="h-6 w-6 text-green-600" />
              Ya tenés la app instalada
            </DialogTitle>
            <DialogDescription className="text-base pt-2">
              La aplicación ya está instalada en tu dispositivo. Buscá el ícono de "Tu Consultorio" en tu pantalla de inicio.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-center pt-4">
            <Button onClick={() => setShowAlreadyInstalledDialog(false)}>Entendido</Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default InstallAppButton;

