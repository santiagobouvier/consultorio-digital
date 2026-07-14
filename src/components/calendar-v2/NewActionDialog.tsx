import { CalendarPlus, CreditCard } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface NewActionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAddAppointment: () => void;
  onAddPayment: () => void;
}

/**
 * Selector de acción "+ Nuevo": dos tarjetas grandes con ícono,
 * cómodas para el dedo (reemplaza el menú desplegable chiquito).
 */
export const NewActionDialog = ({
  open,
  onOpenChange,
  onAddAppointment,
  onAddPayment,
}: NewActionDialogProps) => {
  const pick = (fn: () => void) => {
    onOpenChange(false);
    fn();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>¿Qué querés crear?</DialogTitle>
          <DialogDescription>Elegí una opción</DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
          <button
            type="button"
            onClick={() => pick(onAddAppointment)}
            className="flex flex-col items-center gap-3 rounded-2xl border-2 border-border bg-card p-6 text-center transition-all hover:border-primary hover:bg-primary/5 active:scale-[0.98]"
          >
            <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center">
              <CalendarPlus className="h-7 w-7 text-primary" />
            </div>
            <div>
              <p className="font-semibold">Cita con paciente</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Agendá una sesión en tu agenda
              </p>
            </div>
          </button>

          <button
            type="button"
            onClick={() => pick(onAddPayment)}
            className="flex flex-col items-center gap-3 rounded-2xl border-2 border-border bg-card p-6 text-center transition-all hover:border-primary hover:bg-primary/5 active:scale-[0.98]"
          >
            <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 flex items-center justify-center">
              <CreditCard className="h-7 w-7 text-emerald-500" />
            </div>
            <div>
              <p className="font-semibold">Registrar pago</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Un cobro o vencimiento para un paciente
              </p>
            </div>
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
