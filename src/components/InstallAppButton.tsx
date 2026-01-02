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

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export const InstallAppButton = ({
  variant = "default",
  size = "default",
  className = "",
  showIcon = true
}: InstallAppButtonProps) => {
  const { isInstallable, isInstalled, installApp } = usePWAInstall();
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [showSuccessDialog, setShowSuccessDialog] = useState(false);
  const [showUnavailableDialog, setShowUnavailableDialog] = useState(false);
  const [isInstalling, setIsInstalling] = useState(false);

  const handleClickInstall = () => {
    setShowConfirmDialog(true);
  };

  const handleConfirmInstall = async () => {
    setShowConfirmDialog(false);

    const startedAt = Date.now();
    setIsInstalling(true);

    // Intento de instalación automática (solo funciona cuando el navegador expone el prompt)
    if (isInstallable) {
      const success = await installApp();

      // Asegurar que el loader se vea al menos un poquito
      const elapsed = Date.now() - startedAt;
      if (elapsed < 1200) await sleep(1200 - elapsed);

      setIsInstalling(false);

      if (success) {
        setShowSuccessDialog(true);
      }

      return;
    }

    // Si no hay prompt disponible, NO podemos forzar la instalación automática.
    // Mostramos una explicación corta y alternativa.
    const elapsed = Date.now() - startedAt;
    if (elapsed < 900) await sleep(900 - elapsed);
    setIsInstalling(false);
    setShowUnavailableDialog(true);
  };

  // Ya instalada
  if (isInstalled) {
    return (
      <Button
        variant="outline"
        size={size}
        className={`gap-2 ${className}`}
        disabled
      >
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
              La aplicación quedará como un ícono en tu celular para que puedas acceder rápidamente sin abrir el navegador.
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
              Estamos agregando la app a tu celular.
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
              En algunos Android el botón automático aparece unos segundos después.
              Si no te sale, abrí el menú <strong>⋮</strong> de Chrome y tocá <strong>"Instalar app"</strong>.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-center pt-4">
            <Button onClick={() => setShowUnavailableDialog(false)}>Entendido</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Dialog de éxito */}
      <Dialog open={showSuccessDialog} onOpenChange={setShowSuccessDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-green-600">
              <Check className="h-6 w-6" />
              ¡Aplicación instalada!
            </DialogTitle>
            <DialogDescription className="text-base pt-2">
              Por favor, verificá buscando el ícono de Tu Consultorio en tu celular.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-center pt-4">
            <Button onClick={() => setShowSuccessDialog(false)}>
              Entendido
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default InstallAppButton;
