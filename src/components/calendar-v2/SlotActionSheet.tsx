import { useEffect, useState } from "react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { CalendarPlus, Ban, Loader2, Sparkles, Repeat } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import type { FreeSlot } from "@/hooks/use-free-slots";
import {
  DAY_KEYS,
  mergeBlocks,
  parseDayBlocksFromRow,
  toMinutes,
  type DayKey,
  type TimeBlock,
} from "@/hooks/use-availability-template";

// getDay(): 0=domingo..6=sábado → clave del día en la semana tipo
const WEEKDAY_KEY: DayKey[] = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];

// Logo de WhatsApp (el mismo verde oficial que en compartir huecos)
const WhatsAppIcon = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden>
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
  </svg>
);

interface SlotActionSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  businessId: string;
  /** Día que se está mirando en la agenda. */
  date: Date;
  slot: FreeSlot | null;
  /** Agendar una cita en el horario del cupo (prellenado). */
  onSchedule: (time: string) => void;
  /** Después de cerrar un cupo: refrescar agenda y cupos. */
  onChanged: () => void;
}

/**
 * Tocar un cupo libre en la grilla del día: agendar ahí, cerrarlo para que
 * nadie lo reserve, o salir a buscarle paciente por WhatsApp.
 */
export const SlotActionSheet = ({
  open,
  onOpenChange,
  businessId,
  date,
  slot,
  onSchedule,
  onChanged,
}: SlotActionSheetProps) => {
  const [closing, setClosing] = useState(false);
  const [closingWeekly, setClosingWeekly] = useState(false);
  const [sharing, setSharing] = useState(false);
  // Tocar "Cerrar" despliega las dos opciones: solo hoy / todas las semanas
  const [closeExpanded, setCloseExpanded] = useState(false);

  useEffect(() => {
    if (open) setCloseExpanded(false);
  }, [open]);

  if (!slot) return null;

  const dayLabel = format(date, "EEEE d 'de' MMMM", { locale: es });
  const dateStr = format(date, "yyyy-MM-dd");
  const weekdayName = format(date, "EEEE", { locale: es });

  /** Sacar este horario de la semana tipo: no se ofrece más ese día de semana. */
  const closeWeekly = async () => {
    setClosingWeekly(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Sesión no válida");
      const { data: row, error: loadErr } = await (supabase as any)
        .from("availability_templates")
        .select("*")
        .eq("business_id", businessId)
        .eq("professional_user_id", user.id)
        .maybeSingle();
      if (loadErr) throw loadErr;
      if (!row) {
        toast({ title: "Este cupo no viene de tu semana tipo", description: "Puede ser un horario suelto — cerralo solo por hoy." });
        return;
      }

      const key = WEEKDAY_KEY[date.getDay()];
      const allDays = parseDayBlocksFromRow(row);
      const s = toMinutes(slot.start);
      const e = toMinutes(slot.end);
      const keep = allDays[key].filter((b) => !(toMinutes(b.start) < e && toMinutes(b.end) > s));
      if (keep.length === allDays[key].length) {
        toast({ title: "Este cupo no está en tu semana tipo", description: "Puede ser un horario suelto — cerralo solo por hoy." });
        return;
      }

      // Actualizar el día tocado: day_blocks + columnas clásicas
      const dayBlocks: Record<string, [string, string][]> = {};
      for (const k of DAY_KEYS) {
        const blocks: TimeBlock[] = k === key ? keep : allDays[k];
        dayBlocks[k] = blocks.map((b) => [b.start, b.end]);
      }
      const merged = mergeBlocks(keep);
      const legacyPatch: any = {
        [`${key}_enabled`]: merged.length > 0,
        [`${key}_start_1`]: merged[0]?.start ?? null,
        [`${key}_end_1`]: merged[0]?.end ?? null,
        [`${key}_start_2`]: merged[1]?.start ?? null,
        [`${key}_end_2`]: merged[1]?.end ?? null,
      };
      let { error: upErr } = await (supabase as any)
        .from("availability_templates")
        .update({ ...legacyPatch, day_blocks: dayBlocks })
        .eq("id", row.id);
      if (upErr && (`${upErr.message} ${upErr.code}`.includes("day_blocks") || upErr.code === "42703" || upErr.code === "PGRST204")) {
        // Base sin la columna nueva: alcanza con las columnas clásicas
        ({ error: upErr } = await (supabase as any)
          .from("availability_templates")
          .update(legacyPatch)
          .eq("id", row.id));
      }
      if (upErr) throw upErr;

      toast({
        title: "Semana tipo actualizada ✓",
        description: `Los ${weekdayName} a las ${slot.start} ya no se ofrecen. Lo reabrís desde Mis horarios.`,
      });
      onOpenChange(false);
      onChanged();
    } catch (err: any) {
      console.error(err);
      toast({ title: "Error", description: err?.message ?? "No se pudo actualizar la semana tipo", variant: "destructive" });
    } finally {
      setClosingWeekly(false);
    }
  };

  const closeSlot = async () => {
    setClosing(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Sesión no válida");
      const { error } = await (supabase as any).from("personal_events").insert({
        business_id: businessId,
        professional_user_id: user.id,
        title: "Cupo cerrado",
        category: "personal",
        label_id: null,
        notes: null,
        start_at: new Date(`${dateStr}T${slot.start}:00`).toISOString(),
        end_at: new Date(`${dateStr}T${slot.end}:00`).toISOString(),
        recurrence: "none",
        recurrence_until: null,
      });
      if (error) throw error;
      toast({
        title: "Cupo cerrado ✓",
        description: `El ${dayLabel} a las ${slot.start} ya no se puede reservar. Tocá el bloque en la agenda para reabrirlo.`,
      });
      onOpenChange(false);
      onChanged();
    } catch (e: any) {
      console.error(e);
      toast({ title: "Error", description: e?.message ?? "No se pudo cerrar el cupo", variant: "destructive" });
    } finally {
      setClosing(false);
    }
  };

  const shareSlot = async () => {
    setSharing(true);
    try {
      const { data } = await supabase
        .from("businesses")
        .select("public_slug")
        .eq("id", businessId)
        .maybeSingle();
      const slug = data?.public_slug;
      const link = slug ? `\n\nReservá acá: ${window.location.origin}/consultorio/${slug}/reservar` : "";
      const msg = slot.freed
        ? `Hola 👋 ¡Se me liberó un horario! ${dayLabel} a las ${slot.start}. ¿Te sirve?${link}`
        : `Hola 👋 Tengo un horario libre el ${dayLabel} a las ${slot.start}. ¿Te sirve?${link}`;
      window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(msg)}`, "_blank");
      onOpenChange(false);
    } finally {
      setSharing(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="capitalize">
            {dayLabel} · {slot.start}
          </DialogTitle>
          <DialogDescription>
            {slot.freed ? (
              <span className="inline-flex items-center gap-1.5 text-amber-600 dark:text-amber-400 font-medium">
                <Sparkles className="h-3.5 w-3.5" />
                Se liberó por una cancelación — buscale paciente
              </span>
            ) : (
              "Este cupo se ofrece en tu reserva online"
            )}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2.5 pt-1">
          <button
            type="button"
            onClick={() => {
              onOpenChange(false);
              onSchedule(slot.start);
            }}
            className="w-full flex items-center gap-4 rounded-2xl border-2 border-border bg-card p-4 text-left transition-all hover:border-primary hover:bg-primary/5 active:scale-[0.98]"
          >
            <div className="w-12 h-12 shrink-0 rounded-2xl bg-primary/10 flex items-center justify-center">
              <CalendarPlus className="h-6 w-6 text-primary" />
            </div>
            <div className="min-w-0">
              <p className="font-semibold text-[15px]">Agendar cita acá</p>
              <p className="text-xs text-muted-foreground mt-0.5">Le ponés paciente a este horario</p>
            </div>
          </button>

          <button
            type="button"
            disabled={sharing}
            onClick={shareSlot}
            className="w-full flex items-center gap-4 rounded-2xl border-2 border-border bg-card p-4 text-left transition-all hover:border-[#25D366]/60 hover:bg-[#25D366]/5 active:scale-[0.98] disabled:opacity-60"
          >
            <div className="w-12 h-12 shrink-0 rounded-2xl bg-[#25D366]/10 flex items-center justify-center">
              {sharing ? (
                <Loader2 className="h-6 w-6 text-[#25D366] animate-spin" />
              ) : (
                <WhatsAppIcon className="h-6 w-6 text-[#25D366]" />
              )}
            </div>
            <div className="min-w-0">
              <p className="font-semibold text-[15px]">Ofrecerlo por WhatsApp</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Mensaje listo con el horario y tu link de reservas
              </p>
            </div>
          </button>

          {!closeExpanded ? (
            <button
              type="button"
              onClick={() => setCloseExpanded(true)}
              className="w-full flex items-center gap-4 rounded-2xl border-2 border-border bg-card p-4 text-left transition-all hover:border-amber-500/60 hover:bg-amber-500/5 active:scale-[0.98]"
            >
              <div className="w-12 h-12 shrink-0 rounded-2xl bg-amber-500/10 flex items-center justify-center">
                <Ban className="h-6 w-6 text-amber-500" />
              </div>
              <div className="min-w-0">
                <p className="font-semibold text-[15px]">Cerrar este cupo</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Solo por hoy, o todas las semanas
                </p>
              </div>
            </button>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <button
                type="button"
                disabled={closing || closingWeekly}
                onClick={closeSlot}
                className="flex items-center gap-3 rounded-2xl border-2 border-amber-500/40 bg-amber-500/5 p-4 text-left transition-all hover:bg-amber-500/10 active:scale-[0.98] disabled:opacity-60"
              >
                {closing ? (
                  <Loader2 className="h-5 w-5 text-amber-500 animate-spin shrink-0" />
                ) : (
                  <Ban className="h-5 w-5 text-amber-500 shrink-0" />
                )}
                <div className="min-w-0">
                  <p className="font-semibold text-sm capitalize">Solo este {weekdayName}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Tu rutina no cambia</p>
                </div>
              </button>
              <button
                type="button"
                disabled={closing || closingWeekly}
                onClick={closeWeekly}
                className="flex items-center gap-3 rounded-2xl border-2 border-amber-500/40 bg-amber-500/5 p-4 text-left transition-all hover:bg-amber-500/10 active:scale-[0.98] disabled:opacity-60"
              >
                {closingWeekly ? (
                  <Loader2 className="h-5 w-5 text-amber-500 animate-spin shrink-0" />
                ) : (
                  <Repeat className="h-5 w-5 text-amber-500 shrink-0" />
                )}
                <div className="min-w-0">
                  <p className="font-semibold text-sm capitalize">Todos los {weekdayName}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Sale de tu semana tipo</p>
                </div>
              </button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
