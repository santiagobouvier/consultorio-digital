import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Chrome, Globe, Info } from "lucide-react";

interface UnsupportedBrowserModalProps {
  open: boolean;
  onClose: () => void;
}

export function UnsupportedBrowserModal({ open, onClose }: UnsupportedBrowserModalProps) {
  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary mb-2">
            <Info className="h-6 w-6" />
          </div>
          <DialogTitle className="text-center text-lg">
            Tu navegador no soporta instalar apps directamente
          </DialogTitle>
          <DialogDescription className="text-center">
            Para instalar esta app en un toque, te recomendamos abrirla en uno de estos navegadores:
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-3 gap-3 py-2">
          <div className="flex flex-col items-center gap-2 p-3 rounded-xl border border-border/60 bg-card">
            <Chrome className="h-7 w-7 text-primary" />
            <p className="text-xs font-medium">Chrome</p>
          </div>
          <div className="flex flex-col items-center gap-2 p-3 rounded-xl border border-border/60 bg-card">
            <Globe className="h-7 w-7 text-primary" />
            <p className="text-xs font-medium">Safari</p>
            <p className="text-[10px] text-muted-foreground -mt-1">(iPhone/Mac)</p>
          </div>
          <div className="flex flex-col items-center gap-2 p-3 rounded-xl border border-border/60 bg-card">
            <Globe className="h-7 w-7 text-primary" />
            <p className="text-xs font-medium">Edge</p>
          </div>
        </div>

        <p className="text-xs text-muted-foreground text-center">
          Si ya rechazaste el aviso antes, buscá <span className="font-semibold">"Instalar app"</span> en el menú del navegador.
        </p>

        <Button onClick={onClose} className="w-full mt-2">
          Entendido
        </Button>
      </DialogContent>
    </Dialog>
  );
}