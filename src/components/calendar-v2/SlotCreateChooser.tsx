import { format } from "date-fns";
import { es } from "date-fns/locale";
import { CalendarPlus, Coffee, Clock } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface SlotCreateChooserProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Día que se está mirando. */
  date: Date;
  /** Hora tocada en la grilla ("15:00"). */
  time: string | null;
  onCreateAppointment: () => void;
  onCreatePersonal: () => void;
}

/**
 * Tocar una hora libre de la grilla del día: elegís qué va ahí — una cita
 * con paciente o un evento personal — con día y hora ya fijados. La base
 * Google Calendar: cualquier cosa se crea tocando su hora.
 */
export const SlotCreateChooser = ({
  open,
  onOpenChange,
  date,
  time,
  onCreateAppointment,
  onCreatePersonal,
}: SlotCreateChooserProps) => {
  if (!time) return null;

  const pick = (fn: () => void) => {
    onOpenChange(false);
    fn();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md max-h-[88dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="capitalize">
            {format(date, "EEEE d 'de' MMMM", { locale: es })}
          </DialogTitle>
          <DialogDescription>¿Qué va en este horario?</DialogDescription>
        </DialogHeader>

        {/* Hora fijada */}
        <div className="flex items-center gap-2.5 rounded-xl bg-primary/10 border border-primary/25 px-3.5 py-2.5">
          <Clock className="h-4 w-4 text-primary shrink-0" />
          <span className="text-sm font-semibold tabular-nums">{time} hs</span>
          <span className="ml-auto text-[10px] font-bold uppercase tracking-wide text-primary shrink-0">
            Hora fijada
          </span>
        </div>

        <div className="space-y-2.5 pt-1">
          <button
            type="button"
            onClick={() => pick(onCreateAppointment)}
            className="w-full flex items-center gap-4 rounded-2xl border-2 border-border bg-card p-5 text-left transition-all hover:border-primary hover:bg-primary/5 active:scale-[0.98]"
          >
            <div className="w-14 h-14 shrink-0 rounded-2xl bg-primary/10 flex items-center justify-center">
              <CalendarPlus className="h-7 w-7 text-primary" />
            </div>
            <div className="min-w-0">
              <p className="font-bold text-[16px]">Cita con paciente</p>
              <p className="text-xs text-muted-foreground mt-1">Sesión a las {time}</p>
            </div>
          </button>

          <button
            type="button"
            onClick={() => pick(onCreatePersonal)}
            className="w-full flex items-center gap-4 rounded-2xl border-2 border-border bg-card p-5 text-left transition-all hover:border-primary hover:bg-primary/5 active:scale-[0.98]"
          >
            <div className="w-14 h-14 shrink-0 rounded-2xl bg-slate-500/10 flex items-center justify-center">
              <Coffee className="h-7 w-7 text-slate-500" />
            </div>
            <div className="min-w-0">
              <p className="font-bold text-[16px]">Evento personal</p>
              <p className="text-xs text-muted-foreground mt-1">
                Gimnasio, trámite, almuerzo... bloquea el horario
              </p>
            </div>
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
