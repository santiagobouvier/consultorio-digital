import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";
import { usePWAInstall } from "@/hooks/use-pwa-install";

export const InstallAppButton = () => {
  const { canInstall, install } = usePWAInstall();

  if (!canInstall) return null;

  return (
    <Button onClick={install} className="gap-2">
      <Download className="h-4 w-4" />
      Instalar app
    </Button>
  );
};

export default InstallAppButton;
