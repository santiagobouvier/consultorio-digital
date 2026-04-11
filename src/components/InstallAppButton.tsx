import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";
import { usePWAInstall } from "@/hooks/use-pwa-install";
import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export const InstallAppButton = () => {
  const { canInstall, install } = usePWAInstall();
  const [showInstructions, setShowInstructions] = useState(false);

  const handleClick = async () => {
    if (canInstall) {
      await install();
    } else {
      setShowInstructions(true);
    }
  };

  return (
    <>
      <Button 
        onClick={handleClick} 
        size="lg"
        className="w-full sm:w-auto h-12 sm:h-14 px-8 sm:px-12 text-sm sm:text-base font-semibold rounded-xl gap-2"
      >
        <Download className="h-4 w-4" />
        Instalá la app en tu dispositivo
      </Button>

      <Dialog open={showInstructions} onOpenChange={setShowInstructions}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-lg">Instalá Tu Consultorio Digital</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 text-sm text-muted-foreground">
            <div className="space-y-2">
              <p className="font-semibold text-foreground flex items-center gap-2">
                🖥️ En PC (Chrome / Edge)
              </p>
              <ol className="list-decimal list-inside space-y-1 pl-2">
                <li>Abrí esta página en <strong>Google Chrome</strong> o <strong>Microsoft Edge</strong></li>
                <li>Buscá el ícono de instalar <span className="inline-block px-1.5 py-0.5 bg-muted rounded text-xs">⊕</span> en la barra de direcciones (arriba a la derecha)</li>
                <li>Hacé clic en <strong>"Instalar"</strong></li>
              </ol>
            </div>

            <div className="space-y-2">
              <p className="font-semibold text-foreground flex items-center gap-2">
                📱 En Android (Chrome)
              </p>
              <ol className="list-decimal list-inside space-y-1 pl-2">
                <li>Abrí esta página en <strong>Chrome</strong></li>
                <li>Tocá el menú <strong>⋮</strong> (tres puntos arriba a la derecha)</li>
                <li>Seleccioná <strong>"Instalar aplicación"</strong> o <strong>"Agregar a pantalla de inicio"</strong></li>
              </ol>
            </div>

            <div className="space-y-2">
              <p className="font-semibold text-foreground flex items-center gap-2">
                🍎 En iPhone / iPad (Safari)
              </p>
              <ol className="list-decimal list-inside space-y-1 pl-2">
                <li>Abrí esta página en <strong>Safari</strong></li>
                <li>Tocá el botón <strong>Compartir</strong> <span className="inline-block px-1.5 py-0.5 bg-muted rounded text-xs">↑</span></li>
                <li>Seleccioná <strong>"Agregar a pantalla de inicio"</strong></li>
              </ol>
            </div>

            <p className="text-xs text-muted-foreground/70 pt-2 border-t">
              La app funciona como una aplicación nativa en tu computadora, tablet o celular.
            </p>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default InstallAppButton;
