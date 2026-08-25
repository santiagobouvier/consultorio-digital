import { CalendarPlus, CreditCard, Coffee, CalendarOff, CircleDashed } from "lucide-react";
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
  onAddPersonal?: () => void;
  onQuickBlock?: () => void;
  onOpenSlot?: () => void;
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
  onAddPersonal,
  onQuickBlock,
  onOpenSlot,
}: NewActionDialogProps) => {
  const pick = (fn: () => void) => {
    onOpenChange(false);
    fn();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md max-h-[88dvh] overflow-y-auto">
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

          {onAddPersonal && (
            <button
              type="button"
              onClick={() => pick(onAddPersonal)}
              className="sm:col-span-2 flex items-center gap-4 rounded-2xl border-2 border-border bg-card p-4 text-left transition-all hover:border-primary hover:bg-primary/5 active:scale-[0.98]"
            >
              <div className="w-12 h-12 shrink-0 rounded-2xl bg-slate-500/10 flex items-center justify-center">
                <Coffee className="h-6 w-6 text-slate-500" />
              </div>
              <div>
                <p className="font-semibold">Evento personal</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Gimnasio, trámite, almuerzo... bloquea el horario para que nadie reserve
                </p>
              </div>
            </button>
          )}

          {onQuickBlock && (
            <button
              type="button"
              onClick={() => pick(onQuickBlock)}
              className={`${onOpenSlot ? "" : "sm:col-span-2 "}flex items-center gap-4 rounded-2xl border-2 border-border bg-card p-4 text-left transition-all hover:border-amber-500/60 hover:bg-amber-500/5 active:scale-[0.98]`}
            >
              <div className="w-12 h-12 shrink-0 rounded-2xl bg-amber-500/10 flex items-center justify-center">
                <CalendarOff className="h-6 w-6 text-amber-500" />
              </div>
              <div>
                <p className="font-semibold">Imprevisto</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Bloqueá la mañana, la tarde, el día o varios días
                </p>
              </div>
            </button>
          )}

          {onOpenSlot && (
            <button
              type="button"
              onClick={() => pick(onOpenSlot)}
              className="flex items-center gap-4 rounded-2xl border-2 border-border bg-card p-4 text-left transition-all hover:border-emerald-500/60 hover:bg-emerald-500/5 active:scale-[0.98]"
            >
              <div className="w-12 h-12 shrink-0 rounded-2xl bg-emerald-500/10 flex items-center justify-center">
                <CircleDashed className="h-6 w-6 text-emerald-500" />
              </div>
              <div>
                <p className="font-semibold">Abrir cupo</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Un horario extra puntual para que reserven online
                </p>
              </div>
            </button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
