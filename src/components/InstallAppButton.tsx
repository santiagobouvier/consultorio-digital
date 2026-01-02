import { useEffect, useRef, useState } from "react";
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

type InstallResult = "installed" | "pending";

const waitUntil = async (condition: () => boolean, timeoutMs: number) => {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    if (condition()) return true;
    await new Promise((r) => setTimeout(r, 150));
  }
  return condition();
};

export const InstallAppButton = ({
  variant = "default",
  size = "default",
  className = "",
  showIcon = true,
}: InstallAppButtonProps) => {
  const { isInstallable, isInstalled, installApp } = usePWAInstall();
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [showSuccessDialog, setShowSuccessDialog] = useState(false);
  const [showUnavailableDialog, setShowUnavailableDialog] = useState(false);
  const [isInstalling, setIsInstalling] = useState(false);
  const [installResult, setInstallResult] = useState<InstallResult>("pending");

  // Mantener la última lectura de isInstalled dentro de async flows
  const isInstalledRef = useRef(isInstalled);
  useEffect(() => {
    isInstalledRef.current = isInstalled;
  }, [isInstalled]);

  const handleClickInstall = () => {
    setShowConfirmDialog(true);
  };

  const handleConfirmInstall = async () => {
    setShowConfirmDialog(false);
    setIsInstalling(true);

    // Si el navegador no expone el prompt, NO podemos forzar la instalación.
    if (!isInstallable) {
      setIsInstalling(false);
      setShowUnavailableDialog(true);
      return;
    }

    // Dispara el prompt nativo del navegador.
    const accepted = await installApp();

    // Si el usuario canceló, cortamos sin mostrar éxito.
    if (!accepted) {
      setIsInstalling(false);
      return;
    }

    // Importante: aceptar el prompt NO garantiza que el ícono aparezca instantáneo.
    // Eso lo termina el sistema del celular. Para mejorar UX:
    // - esperamos unos segundos por el evento real (appinstalled / standalone)
    // - si no llega, mostramos “instalación iniciada” (sin mentir).
    const installedQuickly = await waitUntil(() => isInstalledRef.current, 5000);
    setInstallResult(installedQuickly ? "installed" : "pending");

    setIsInstalling(false);
    setShowSuccessDialog(true);
  };

  // Ya instalada
  if (isInstalled) {
    return (
      <Button variant="outline" size={size} className={`gap-2 ${className}`} disabled>
        <Check className="h-4 w-4" />
        App instalada
      </Button>
    );
  }

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
              Tu navegador no permitió completar la instalación automáticamente.
              Probá actualizar la página y volver a intentar en unos segundos.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-center pt-4">
            <Button onClick={() => setShowUnavailableDialog(false)}>Entendido</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Dialog de resultado */}
      <Dialog open={showSuccessDialog} onOpenChange={setShowSuccessDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle
              className={`flex items-center gap-2 ${
                installResult === "installed" ? "text-green-600" : ""
              }`}
            >
              <Check className="h-6 w-6" />
              {installResult === "installed"
                ? "¡Aplicación instalada!"
                : "Instalación iniciada"}
            </DialogTitle>
            <DialogDescription className="text-base pt-2">
              {installResult === "installed" ? (
                <>Instalación correcta. Ya deberías ver el ícono en tu celular.</>
              ) : (
                <>
                  Instalación correcta. Tu celular puede tardar unos segundos en mostrar el
                  ícono.
                  <br />
                  Si no lo ves, buscá “Tu Consultorio” en la lista de aplicaciones del
                  celular.
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-center pt-4">
            <Button onClick={() => setShowSuccessDialog(false)}>Entendido</Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default InstallAppButton;

