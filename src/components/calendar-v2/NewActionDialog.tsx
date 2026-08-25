import { CalendarPlus, CreditCard, Coffee, CalendarOff, CircleDashed, CalendarDays } from "lucide-react";
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
  /** Si está: todo lo que se cree queda FIJO para ese día (ej: "jueves 27 de agosto"). */
  fixedDateLabel?: string | null;
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
  fixedDateLabel = null,
}: NewActionDialogProps) => {
  const pick = (fn: () => void) => {
    onOpenChange(false);
    fn();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl">¿Qué querés crear?</DialogTitle>
          <DialogDescription>
            {fixedDateLabel ? "Elegí una opción para este día" : "Elegí una opción"}
          </DialogDescription>
        </DialogHeader>

        {/* Día fijo: lo que crees queda agendado acá */}
        {fixedDateLabel && (
          <div className="flex items-center gap-2.5 rounded-xl bg-primary/10 border border-primary/25 px-3.5 py-2.5">
            <CalendarDays className="h-4 w-4 text-primary shrink-0" />
            <span className="text-sm font-semibold capitalize text-foreground">{fixedDateLabel}</span>
            <span className="ml-auto text-[10px] font-bold uppercase tracking-wide text-primary shrink-0">
              Día fijado
            </span>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
          <button
            type="button"
            onClick={() => pick(onAddAppointment)}
            className="flex flex-col items-center gap-3 rounded-2xl border-2 border-border bg-card p-6 sm:p-7 text-center transition-all hover:border-primary hover:bg-primary/5 active:scale-[0.98]"
          >
            <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center">
              <CalendarPlus className="h-8 w-8 text-primary" />
            </div>
            <div>
              <p className="font-bold text-[16px]">Cita con paciente</p>
              <p className="text-xs text-muted-foreground mt-1">
                {fixedDateLabel ? "Sesión para este día" : "Agendá una sesión en tu agenda"}
              </p>
            </div>
          </button>

          <button
            type="button"
            onClick={() => pick(onAddPayment)}
            className="flex flex-col items-center gap-3 rounded-2xl border-2 border-border bg-card p-6 sm:p-7 text-center transition-all hover:border-primary hover:bg-primary/5 active:scale-[0.98]"
          >
            <div className="w-16 h-16 rounded-2xl bg-emerald-500/10 flex items-center justify-center">
              <CreditCard className="h-8 w-8 text-emerald-500" />
            </div>
            <div>
              <p className="font-bold text-[16px]">Registrar pago</p>
              <p className="text-xs text-muted-foreground mt-1">
                {fixedDateLabel ? "Cobro con fecha de este día" : "Un cobro o vencimiento para un paciente"}
              </p>
            </div>
          </button>

          {onAddPersonal && (
            <button
              type="button"
              onClick={() => pick(onAddPersonal)}
              className="sm:col-span-2 flex items-center gap-4 rounded-2xl border-2 border-border bg-card p-5 text-left transition-all hover:border-primary hover:bg-primary/5 active:scale-[0.98]"
            >
              <div className="w-14 h-14 shrink-0 rounded-2xl bg-slate-500/10 flex items-center justify-center">
                <Coffee className="h-7 w-7 text-slate-500" />
              </div>
              <div>
                <p className="font-bold text-[16px]">Evento personal</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Gimnasio, trámite, almuerzo... bloquea el horario para que nadie reserve
                </p>
              </div>
            </button>
          )}

          {onQuickBlock && (
            <button
              type="button"
              onClick={() => pick(onQuickBlock)}
              className={`${onOpenSlot ? "" : "sm:col-span-2 "}flex items-center gap-4 rounded-2xl border-2 border-border bg-card p-5 text-left transition-all hover:border-amber-500/60 hover:bg-amber-500/5 active:scale-[0.98]`}
            >
              <div className="w-14 h-14 shrink-0 rounded-2xl bg-amber-500/10 flex items-center justify-center">
                <CalendarOff className="h-7 w-7 text-amber-500" />
              </div>
              <div>
                <p className="font-bold text-[16px]">Imprevisto</p>
                <p className="text-xs text-muted-foreground mt-1">
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
