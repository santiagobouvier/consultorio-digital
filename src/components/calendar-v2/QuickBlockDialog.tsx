import { useState } from "react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { Sunrise, Sunset, CalendarOff, Loader2 } from "lucide-react";
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

  const dayLabel = format(date, "EEEE d 'de' MMMM", { locale: es });
  const dateStr = format(date, "yyyy-MM-dd");

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
      <DialogContent className="sm:max-w-md">
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
        <p className="text-xs text-muted-foreground text-center">
          Se marca como evento personal en tu agenda: tocalo para eliminarlo y liberar el horario.
        </p>
      </DialogContent>
    </Dialog>
  );
};
