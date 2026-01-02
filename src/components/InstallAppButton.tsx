import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";
import { usePWAInstall } from "@/hooks/use-pwa-install";

export const InstallAppButton = () => {
  const { canInstall, install } = usePWAInstall();

  return (
    <Button 
      onClick={install} 
      disabled={!canInstall}
      className="gap-2"
    >
      <Download className="h-4 w-4" />
      Descargá la app
    </Button>
  );
};

export default InstallAppButton;
