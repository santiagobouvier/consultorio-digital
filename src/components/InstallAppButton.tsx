import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";
import { usePWAInstall } from "@/hooks/use-pwa-install";

export const InstallAppButton = () => {
  const { canInstall, install } = usePWAInstall();

  if (!canInstall) return null;

  return (
    <Button 
      onClick={install} 
      size="lg"
      className="w-full sm:w-auto h-12 sm:h-14 px-8 sm:px-12 text-sm sm:text-base font-semibold rounded-xl gap-2"
    >
      <Download className="h-4 w-4" />
      Instalá la app en tu dispositivo
    </Button>
  );
};

export default InstallAppButton;
