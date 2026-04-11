import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";
import { usePWAInstall } from "@/hooks/use-pwa-install";

const PUBLISHED_APP_URL = "https://agenda-psicologia.lovable.app";

export const InstallAppButton = () => {
  const { canInstall, install, isInstalled, isPreview } = usePWAInstall();

  if (isInstalled || (!canInstall && !isPreview)) return null;

  const handleClick = async () => {
    if (canInstall) {
      await install();
      return;
    }

    if (isPreview) {
      window.open(PUBLISHED_APP_URL, "_blank", "noopener,noreferrer");
    }
  };

  return (
    <Button
      onClick={handleClick}
      size="lg"
      className="w-full sm:w-auto h-12 sm:h-14 px-8 sm:px-12 text-sm sm:text-base font-semibold rounded-xl gap-2"
    >
      <Download className="h-4 w-4" />
      Instalar la app
    </Button>
  );
};

export default InstallAppButton;
