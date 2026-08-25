import { useEffect, useState } from "react";
import { addDays, differenceInCalendarDays, format, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import { Sunrise, Sunset, CalendarOff, Loader2, Plane, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

interface QuickBlockDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  businessId: string;
  /** Día que se está mirando en la agenda: el bloqueo cae acá. */
  date: Date;
  onSaved: () => void;
}

type BlockOption = {
  key: string;
  label: string;
  detail: string;
  icon: typeof Sunrise;
  startTime: string;
  endTime: string;
};

const OPTIONS: BlockOption[] = [
  {
    key: "morning",
    label: "Bloquear la mañana",
    detail: "Hasta las 13:00 nadie puede reservar",
    icon: Sunrise,
    startTime: "07:00",
    endTime: "13:00",
  },
  {
    key: "afternoon",
    label: "Bloquear la tarde",
    detail: "Desde las 13:00 nadie puede reservar",
    icon: Sunset,
    startTime: "13:00",
    endTime: "21:00",
  },
  {
    key: "day",
    label: "Cerrar todo el día",
    detail: "El día completo queda sin reservas",
    icon: CalendarOff,
    startTime: "07:00",
    endTime: "21:00",
  },
];

/**
 * Percance resuelto en dos toques: bloquea la mañana, la tarde o el día
 * entero creando un evento personal. La semana tipo no se toca — cuando
 * pasa el imprevisto, la rutina sigue intacta.
 */
export const QuickBlockDialog = ({ open, onOpenChange, businessId, date, onSaved }: QuickBlockDialogProps) => {
  const [savingKey, setSavingKey] = useState<string | null>(null);
  // Licencia / vacaciones: cerrar un rango de días entero
  const [rangeOpen, setRangeOpen] = useState(false);
  const [rangeFrom, setRangeFrom] = useState(() => format(date, "yyyy-MM-dd"));
  const [rangeTo, setRangeTo] = useState(() => format(addDays(date, 6), "yyyy-MM-dd"));
  const [savingRange, setSavingRange] = useState(false);

  const dayLabel = format(date, "EEEE d 'de' MMMM", { locale: es });
  const dateStr = format(date, "yyyy-MM-dd");

  // Al abrir, el rango arranca en el día que se está mirando
  useEffect(() => {
    if (open) {
      setRangeFrom(format(date, "yyyy-MM-dd"));
      setRangeTo(format(addDays(date, 6), "yyyy-MM-dd"));
      setRangeOpen(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const applyVacation = async () => {
    const days = differenceInCalendarDays(parseISO(rangeTo), parseISO(rangeFrom)) + 1;
    if (days < 1) {
      toast({ title: "Rango inválido", description: "La fecha de fin debe ser igual o posterior a la de inicio.", variant: "destructive" });
      return;
    }
    if (days > 60) {
      toast({ title: "Máximo 60 días", description: "Para licencias más largas, hacelo en dos tandas.", variant: "destructive" });
      return;
    }
    setSavingRange(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Sesión no válida");
      // Un bloqueo por día: se ven en la agenda y se pueden borrar de a uno
      const rows = Array.from({ length: days }, (_, i) => {
        const d = format(addDays(parseISO(rangeFrom), i), "yyyy-MM-dd");
        return {
          business_id: businessId,
          professional_user_id: user.id,
          title: "Licencia",
          category: "personal",
          label_id: null,
          notes: null,
          start_at: new Date(`${d}T07:00:00`).toISOString(),
          end_at: new Date(`${d}T21:00:00`).toISOString(),
          recurrence: "none",
          recurrence_until: null,
        };
      });
      const { error } = await (supabase as any).from("personal_events").insert(rows);
      if (error) throw error;
      toast({
        title: "Días cerrados ✓",
        description: `${days} día${days !== 1 ? "s" : ""} sin reservas. Cada día aparece como "Licencia" en tu agenda.`,
      });
      onOpenChange(false);
      onSaved();
    } catch (e: any) {
      console.error(e);
      toast({ title: "Error", description: e?.message ?? "No se pudieron cerrar los días", variant: "destructive" });
    } finally {
      setSavingRange(false);
    }
  };

  const applyBlock = async (opt: BlockOption) => {
    setSavingKey(opt.key);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Sesión no válida");
      const { error } = await (supabase as any).from("personal_events").insert({
        business_id: businessId,
        professional_user_id: user.id,
        title: "Imprevisto",
        category: "personal",
        label_id: null,
        notes: null,
        start_at: new Date(`${dateStr}T${opt.startTime}:00`).toISOString(),
        end_at: new Date(`${dateStr}T${opt.endTime}:00`).toISOString(),
        recurrence: "none",
        recurrence_until: null,
      });
      if (error) throw error;
      toast({
        title: "Horario bloqueado ✓",
        description: `${opt.label} del ${dayLabel}. Para deshacerlo, tocá el bloque en la agenda.`,
      });
      onOpenChange(false);
      onSaved();
    } catch (e: any) {
      console.error(e);
      toast({ title: "Error", description: e?.message ?? "No se pudo bloquear el horario", variant: "destructive" });
    } finally {
      setSavingKey(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md max-h-[88dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>¿Se te complicó el {dayLabel}?</DialogTitle>
          <DialogDescription>
            Bloqueá en un toque — las citas ya agendadas no se tocan, solo se frena la reserva online.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2.5 pt-1">
          {OPTIONS.map((opt) => {
            const Icon = opt.icon;
            const saving = savingKey === opt.key;
            return (
              <button
                key={opt.key}
                type="button"
                disabled={savingKey !== null}
                onClick={() => applyBlock(opt)}
                className="w-full flex items-center gap-4 rounded-2xl border-2 border-border bg-card p-4 text-left transition-all hover:border-primary hover:bg-primary/5 active:scale-[0.98] disabled:opacity-60"
              >
                <div className="w-12 h-12 shrink-0 rounded-2xl bg-amber-500/10 flex items-center justify-center">
                  {saving ? (
                    <Loader2 className="h-6 w-6 text-amber-500 animate-spin" />
                  ) : (
                    <Icon className="h-6 w-6 text-amber-500" />
                  )}
                </div>
                <div className="min-w-0">
                  <p className="font-semibold text-[15px]">{opt.label}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{opt.detail}</p>
                </div>
              </button>
            );
          })}
        </div>

        {/* Licencia / vacaciones: cerrar varios días de una */}
        <div className="rounded-2xl border-2 border-border overflow-hidden">
          <button
            type="button"
            onClick={() => setRangeOpen((v) => !v)}
            className="w-full flex items-center gap-4 bg-card p-4 text-left transition-colors hover:bg-primary/5"
          >
            <div className="w-12 h-12 shrink-0 rounded-2xl bg-sky-500/10 flex items-center justify-center">
              <Plane className="h-6 w-6 text-sky-500" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-semibold text-[15px]">Me voy unos días</p>
              <p className="text-xs text-muted-foreground mt-0.5">Licencia o vacaciones: cerrá un rango de fechas</p>
            </div>
            <ChevronDown className={`h-4 w-4 text-muted-foreground shrink-0 transition-transform ${rangeOpen ? "rotate-180" : ""}`} />
          </button>
          {rangeOpen && (
            <div className="px-4 pb-4 space-y-3 bg-card">
              <div className="grid grid-cols-2 gap-2">
                <label className="space-y-1">
                  <span className="text-xs font-medium text-muted-foreground">Desde</span>
                  <input
                    type="date"
                    value={rangeFrom}
                    onChange={(e) => {
                      setRangeFrom(e.target.value);
                      if (e.target.value > rangeTo) setRangeTo(e.target.value);
                    }}
                    className="w-full h-11 rounded-xl border border-input bg-background px-3 text-sm tabular-nums"
                  />
                </label>
                <label className="space-y-1">
                  <span className="text-xs font-medium text-muted-foreground">Hasta</span>
                  <input
                    type="date"
                    value={rangeTo}
                    min={rangeFrom}
                    onChange={(e) => setRangeTo(e.target.value)}
                    className="w-full h-11 rounded-xl border border-input bg-background px-3 text-sm tabular-nums"
                  />
                </label>
              </div>
              <Button
                type="button"
                disabled={savingRange}
                onClick={applyVacation}
                className="w-full h-11 rounded-xl font-bold"
              >
                {savingRange ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <>Cerrar del {format(parseISO(rangeFrom), "d/M")} al {format(parseISO(rangeTo), "d/M")}</>
                )}
              </Button>
            </div>
          )}
        </div>

        <p className="text-xs text-muted-foreground text-center">
          Se marca como evento personal en tu agenda: tocalo para eliminarlo y liberar el horario.
        </p>
      </DialogContent>
    </Dialog>
  );
};
