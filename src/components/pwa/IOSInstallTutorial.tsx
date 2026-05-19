import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { CheckCircle2 } from "lucide-react";
import { IOSShareStep } from "./illustrations/IOSShareStep";
import { IOSAddToHomeStep } from "./illustrations/IOSAddToHomeStep";
import { IOSConfirmStep } from "./illustrations/IOSConfirmStep";

interface IOSInstallTutorialProps {
  open: boolean;
  onClose: () => void;
  /** Nombre del consultorio para personalizar el copy. */
  clinicName?: string;
}

export function IOSInstallTutorial({ open, onClose, clinicName }: IOSInstallTutorialProps) {
  const steps = [
    {
      title: "Tocá el botón Compartir",
      description: "Es el cuadrado con la flecha hacia arriba, en la barra inferior de Safari.",
      illustration: <IOSShareStep />,
    },
    {
      title: "Buscá 'Agregar a inicio'",
      description: "Desplazate hacia abajo en el menú hasta encontrar la opción.",
      illustration: <IOSAddToHomeStep />,
    },
    {
      title: "Tocá 'Agregar'",
      description: "Confirmá en la esquina superior derecha. ¡Listo!",
      illustration: <IOSConfirmStep />,
    },
  ];

  const heading = clinicName ? `${clinicName}` : "tu consultorio";

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent
        className="max-w-2xl p-0 gap-0 max-h-[100dvh] sm:max-h-[90vh] overflow-hidden flex flex-col w-screen sm:w-auto h-[100dvh] sm:h-auto rounded-none sm:rounded-2xl"
      >
        <DialogHeader className="px-5 pt-5 pb-3 border-b border-border/60 shrink-0">
          <DialogTitle className="text-lg sm:text-xl font-bold">
            Instalar como aplicación
          </DialogTitle>
          <DialogDescription className="text-sm">
            En 3 pasos vas a tener {heading} en tu pantalla de inicio.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-6">
          {steps.map((step, i) => (
            <div
              key={i}
              className="grid grid-cols-[auto_1fr] sm:grid-cols-[140px_1fr] gap-4 items-center"
            >
              <div className="w-[110px] sm:w-[140px] flex-shrink-0">{step.illustration}</div>
              <div className="space-y-1.5">
                <div className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-bold">
                  {i + 1}
                </div>
                <h3 className="text-base sm:text-lg font-semibold leading-tight">
                  {step.title}
                </h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {step.description}
                </p>
              </div>
            </div>
          ))}

          <div className="rounded-xl border border-primary/30 bg-primary/5 p-4 flex items-start gap-3">
            <CheckCircle2 className="h-5 w-5 text-primary shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold">¡Listo!</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Vas a ver el ícono en tu pantalla principal, listo para abrir como una app.
              </p>
            </div>
          </div>
        </div>

        <div className="px-5 py-3 border-t border-border/60 shrink-0">
          <Button onClick={onClose} className="w-full h-11 text-sm font-semibold">
            Entendido
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}