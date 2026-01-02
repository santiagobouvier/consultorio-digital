import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Download, Check, Share } from "lucide-react";
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
  const { isInstallable, isInstalled, installApp, platform, showManualInstructions } = usePWAInstall();
  const [showSuccessDialog, setShowSuccessDialog] = useState(false);
  const [showIOSInstructions, setShowIOSInstructions] = useState(false);
  const [isInstalling, setIsInstalling] = useState(false);

  const handleInstall = async () => {
    // iOS necesita instrucciones manuales
    if (showManualInstructions) {
      setShowIOSInstructions(true);
      return;
    }

    // Android/Chrome con prompt disponible
    if (isInstallable) {
      setIsInstalling(true);
      const success = await installApp();
      setIsInstalling(false);
      
      if (success) {
        setShowSuccessDialog(true);
      }
      return;
    }

    // Android sin prompt todavía (puede tardar en cargar)
    if (platform === "android") {
      setShowSuccessDialog(false);
      // Mostrar instrucciones para Android
      setShowIOSInstructions(true);
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
        onClick={handleInstall}
        disabled={isInstalling}
      >
        {showIcon && <Download className="h-4 w-4" />}
        {isInstalling ? "Instalando..." : "Instalar App"}
      </Button>

      {/* Dialog de éxito */}
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

      {/* Dialog de instrucciones manuales (iOS y Android sin prompt) */}
      <Dialog open={showIOSInstructions} onOpenChange={setShowIOSInstructions}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Download className="h-6 w-6 text-primary" />
              Instalar Tu Consultorio
            </DialogTitle>
          </DialogHeader>
          
          {platform === "ios" ? (
            <div className="space-y-4 pt-2">
              <p className="text-muted-foreground">
                Para instalar la app en tu iPhone:
              </p>
              <ol className="space-y-3 text-sm">
                <li className="flex items-start gap-3">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-medium">1</span>
                  <span>Tocá el botón <Share className="inline h-4 w-4 mx-1" /> de compartir en Safari (abajo)</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-medium">2</span>
                  <span>Buscá y tocá <strong>"Agregar a Inicio"</strong></span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-medium">3</span>
                  <span>Confirmá tocando <strong>"Agregar"</strong></span>
                </li>
              </ol>
              <p className="text-xs text-muted-foreground pt-2">
                ¡Listo! El ícono aparecerá en tu pantalla de inicio.
              </p>
            </div>
          ) : (
            <div className="space-y-4 pt-2">
              <p className="text-muted-foreground">
                Para instalar la app en tu Android:
              </p>
              <ol className="space-y-3 text-sm">
                <li className="flex items-start gap-3">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-medium">1</span>
                  <span>Tocá el menú <strong>⋮</strong> de Chrome (arriba a la derecha)</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-medium">2</span>
                  <span>Seleccioná <strong>"Instalar app"</strong> o <strong>"Agregar a inicio"</strong></span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-medium">3</span>
                  <span>Confirmá la instalación</span>
                </li>
              </ol>
              <p className="text-xs text-muted-foreground pt-2">
                ¡Listo! El ícono aparecerá en tu pantalla de inicio.
              </p>
            </div>
          )}

          <div className="flex justify-center pt-4">
            <Button onClick={() => setShowIOSInstructions(false)}>
              Entendido
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default InstallAppButton;
