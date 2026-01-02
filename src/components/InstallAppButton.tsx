import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Download, Loader2 } from "lucide-react";
import { usePWAInstall } from "@/hooks/use-pwa-install";

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
  showIcon = true,
}: InstallAppButtonProps) => {
  const { isInstallable, installApp } = usePWAInstall();
  const [isInstalling, setIsInstalling] = useState(false);

  // “De cero”: si el navegador no expone el prompt nativo, no mostramos el botón.
  if (!isInstallable) return null;

  const handleInstall = async () => {
    setIsInstalling(true);
    try {
      await installApp();
    } finally {
      setIsInstalling(false);
    }
  };

  return (
    <Button
      variant={variant}
      size={size}
      className={`gap-2 ${className}`}
      onClick={handleInstall}
      disabled={isInstalling}
    >
      {showIcon && !isInstalling && <Download className="h-4 w-4" />}
      {isInstalling && <Loader2 className="h-4 w-4 animate-spin" />}
      {isInstalling ? "Instalando..." : "Instalar app"}
    </Button>
  );
};

export default InstallAppButton;


