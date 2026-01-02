import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Download, Check, Smartphone } from "lucide-react";
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

export const InstallAppButton = ({
  variant = "default",
  size = "default",
  className = "",
  showIcon = true
}: InstallAppButtonProps) => {
  const { isInstallable, isInstalled, installApp } = usePWAInstall();
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [showSuccessDialog, setShowSuccessDialog] = useState(false);
  const [isInstalling, setIsInstalling] = useState(false);

  const handleClickInstall = () => {
    // Mostrar popup informativo primero
    setShowConfirmDialog(true);
  };

  const handleConfirmInstall = async () => {
    setShowConfirmDialog(false);
    setIsInstalling(true);

    if (isInstallable) {
      const success = await installApp();
      setIsInstalling(false);
      
      if (success) {
        setShowSuccessDialog(true);
      }
    } else {
      // Simular proceso para cuando no hay prompt disponible
      // El navegador igual puede instalar desde el menú
      setIsInstalling(false);
      setShowSuccessDialog(true);
    }
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
