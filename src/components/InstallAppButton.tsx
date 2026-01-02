import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Download, Check, Smartphone } from "lucide-react";
import { usePWAInstall } from "@/hooks/use-pwa-install";
import { toast } from "sonner";
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
  const [showSuccessDialog, setShowSuccessDialog] = useState(false);
  const [isInstalling, setIsInstalling] = useState(false);

  const handleInstall = async () => {
    setIsInstalling(true);
    const success = await installApp();
    setIsInstalling(false);
    
    if (success) {
      setShowSuccessDialog(true);
    }
  };

  // If already installed, show a different state
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

  // If not installable (desktop browser or already installed), show instructions for mobile
  if (!isInstallable) {
    return (
      <Button
        variant={variant}
        size={size}
        className={`gap-2 ${className}`}
        onClick={() => {
          toast.info(
            "Para instalar la app, abrí esta página desde tu celular y tocá 'Instalar'",
            { duration: 5000 }
          );
        }}
      >
        {showIcon && <Smartphone className="h-4 w-4" />}
        Instalar App
      </Button>
    );
  }

  return (
    <>
      <Button
        variant={variant}
        size={size}
        className={`gap-2 ${className}`}
        onClick={handleInstall}
        disabled={isInstalling}
      >
        {showIcon && <Download className="h-4 w-4" />}
        {isInstalling ? "Instalando..." : "Instalar App"}
      </Button>

      <Dialog open={showSuccessDialog} onOpenChange={setShowSuccessDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-green-600">
              <Check className="h-6 w-6" />
              ¡App instalada!
            </DialogTitle>
            <DialogDescription className="text-base pt-2">
              Tu Consultorio Digital ya está en tu celular. 
              Buscá el ícono en tu pantalla de inicio para acceder rápidamente.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-center pt-4">
            <Button onClick={() => setShowSuccessDialog(false)}>
              ¡Entendido!
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default InstallAppButton;
