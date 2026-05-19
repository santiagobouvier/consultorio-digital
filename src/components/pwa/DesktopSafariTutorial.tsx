import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { CheckCircle2 } from "lucide-react";
import { SafariMenuStep } from "./illustrations/SafariMenuStep";

interface DesktopSafariTutorialProps {
  open: boolean;
  onClose: () => void;
  clinicName?: string;
}

export function DesktopSafariTutorial({ open, onClose, clinicName }: DesktopSafariTutorialProps) {
  const heading = clinicName ? `${clinicName}` : "el consultorio";

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md p-0 gap-0 overflow-hidden">
        <DialogHeader className="px-5 pt-5 pb-3 border-b border-border/60">
          <DialogTitle className="text-lg font-bold">Instalar en Mac con Safari</DialogTitle>
          <DialogDescription className="text-sm">
            Agregá {heading} al Dock en 2 pasos.
          </DialogDescription>
        </DialogHeader>

        <div className="px-5 py-5 space-y-5">
          <SafariMenuStep />

          <ol className="space-y-3">
            <li className="flex items-start gap-3">
              <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-bold">
                1
              </div>
              <div>
                <p className="text-sm font-semibold">Click en <span className="text-primary">Archivo</span></p>
                <p className="text-xs text-muted-foreground">En la barra superior de Safari.</p>
              </div>
            </li>
            <li className="flex items-start gap-3">
              <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-bold">
                2
              </div>
              <div>
                <p className="text-sm font-semibold">Elegí <span className="text-primary">Añadir al Dock</span></p>
                <p className="text-xs text-muted-foreground">Confirmá el nombre y listo.</p>
              </div>
            </li>
          </ol>

          <div className="rounded-xl border border-primary/30 bg-primary/5 p-3 flex items-start gap-2">
            <CheckCircle2 className="h-4 w-4 text-primary shrink-0 mt-0.5" />
            <p className="text-xs text-muted-foreground">
              La app va a aparecer en tu Dock, lista para abrir con un click.
            </p>
          </div>
        </div>

        <div className="px-5 py-3 border-t border-border/60">
          <Button onClick={onClose} className="w-full h-11 text-sm font-semibold">
            Entendido
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}