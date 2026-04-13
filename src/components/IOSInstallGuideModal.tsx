import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Share, PlusSquare, Smartphone, Bell } from "lucide-react";

interface IOSInstallGuideModalProps {
  open: boolean;
  onClose: () => void;
}

const steps = [
  {
    icon: Share,
    text: "Tocá el botón compartir en Safari (el cuadrado con la flecha)",
    description: "Está en la barra inferior del navegador",
  },
  {
    icon: PlusSquare,
    text: "Seleccioná 'Agregar a pantalla de inicio'",
    description: "Buscalo en el menú que aparece",
  },
  {
    icon: Smartphone,
    text: "Abrí la app desde tu pantalla de inicio",
    description: "Va a abrir como una app independiente",
  },
  {
    icon: Bell,
    text: "Volvé a activar las notificaciones",
    description: "Desde adentro de la app podés habilitarlas",
  },
];

export function IOSInstallGuideModal({ open, onClose }: IOSInstallGuideModalProps) {
  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="text-center text-lg">
            Para recibir notificaciones en iPhone, primero instalá la app
          </DialogTitle>
          <DialogDescription className="text-center text-muted-foreground">
            Seguí estos pasos desde Safari
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {steps.map((step, i) => (
            <div key={i} className="flex items-start gap-4">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <step.icon className="h-5 w-5" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium leading-tight">
                  <span className="mr-1.5 text-primary font-bold">
                    {i + 1}.
                  </span>
                  {step.text}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {step.description}
                </p>
              </div>
            </div>
          ))}
        </div>

        <Button onClick={onClose} className="w-full mt-2">
          Entendido
        </Button>
      </DialogContent>
    </Dialog>
  );
}
