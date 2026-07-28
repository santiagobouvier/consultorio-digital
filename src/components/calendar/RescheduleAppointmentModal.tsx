import { useState, useEffect, useMemo, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "@/hooks/use-toast";
import { notifyPatient } from "@/lib/push-notifications";
import { useDashboardBranding } from "@/contexts/DashboardBrandingContext";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { Loader2, Clock, ArrowRight, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";

// Reprogramar una cita existente: elegir nuevo día/horario (horarios libres
// del motor, con opción manual) y mover la cita. Los recordatorios y el
// cobro la siguen solos (triggers de la base); acá además le avisamos al
// paciente por email + push. El WhatsApp de reprogramación lo encola la base.

interface Start {
  day: string;        // YYYY-MM-DD
  start_time: string; // HH:MM:SS
}

const DAY_SHORT = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
const MONTH_SHORT = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
const DAY_NAMES = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];
const MONTH_NAMES = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];

const parseDay = (dateStr: string) => {
  const [y, m, d] = dateStr.split("-").map(Number);
  return { date: new Date(y, m - 1, d), d, m };
};

const formatDayLong = (dateStr: string) => {
  const [y, m, d] = dateStr.split("-").map(Number);
  const dd = new Date(y, m - 1, d);
  return `${DAY_NAMES[dd.getDay()]} ${d} de ${MONTH_NAMES[m - 1]}`;
};

interface RescheduleAppointment {
  id: string;
  start_at: string;
  end_at: string;
  patient_id: string | null;
  patients: { full_name: string; email?: string | null } | null;
}

interface RescheduleAppointmentModalProps {
  appointment: RescheduleAppointment | null;
  open: boolean;
  onClose: () => void;
  businessId: string | null;
  onSuccess?: () => void;
}

export const RescheduleAppointmentModal = ({
  appointment,
  open,
  onClose,
  businessId,
  onSuccess,
}: RescheduleAppointmentModalProps) => {
  const { displayName: clinicDisplayName } = useDashboardBranding();
  const [mode, setMode] = useState<"slots" | "manual">("slots");
  const [starts, setStarts] = useState<Start[]>([]);
  const [startsLoading, setStartsLoading] = useState(false);
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [manualDate, setManualDate] = useState("");
  const [manualTime, setManualTime] = useState("");
  // Selección final (de cualquiera de los dos modos)
  const [picked, setPicked] = useState<{ day: string; time: string } | null>(null);
  const [saving, setSaving] = useState(false);

  const durationMinutes = useMemo(() => {
    if (!appointment) return 60;
    const ms = new Date(appointment.end_at).getTime() - new Date(appointment.start_at).getTime();
    return Math.max(15, Math.round(ms / 60000));
  }, [appointment]);

  const loadStarts = useCallback(async () => {
    if (!businessId) return;
    setStartsLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const today = new Date();
      const { data, error } = await (supabase as any).rpc("get_available_starts", {
        p_business_id: businessId,
        p_professional_user_id: user?.id ?? null,
        p_duration_minutes: durationMinutes,
        p_from: today.toISOString().slice(0, 10),
        p_to: new Date(today.getTime() + 180 * 86400000).toISOString().slice(0, 10),
      });
      if (error) throw error;
      setStarts((data ?? []) as Start[]);
    } catch (e) {
      console.error("Error cargando horarios libres:", e);
      setStarts([]);
    } finally {
      setStartsLoading(false);
    }
  }, [businessId, durationMinutes]);

  useEffect(() => {
    if (!open) return;
    setMode("slots");
    setSelectedDay(null);
    setManualDate("");
    setManualTime("");
    setPicked(null);
    void loadStarts();
  }, [open, loadStarts]);

  const startsByDate = useMemo(() => {
    const map = new Map<string, Start[]>();
    for (const s of starts) {
      const list = map.get(s.day) ?? [];
      list.push(s);
      map.set(s.day, list);
    }
    return Array.from(map.entries())
      .map(([day, items]) => ({
        day,
        items: [...items].sort((a, b) => a.start_time.localeCompare(b.start_time)),
      }))
      .sort((a, b) => a.day.localeCompare(b.day));
  }, [starts]);

  const timesForSelectedDay = useMemo(
    () => startsByDate.find((g) => g.day === selectedDay)?.items ?? [],
    [startsByDate, selectedDay]
  );

  if (!appointment) return null;

  const oldDate = new Date(appointment.start_at);
  const newStartAt = picked
    ? new Date(`${picked.day}T${picked.time.length === 5 ? `${picked.time}:00` : picked.time}-03:00`)
    : null;

  const confirmReschedule = async () => {
    if (!newStartAt) return;
    if (newStartAt.getTime() <= Date.now()) {
      toast({ title: "Fecha inválida", description: "Elegí un horario futuro.", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const newEndAt = new Date(newStartAt.getTime() + durationMinutes * 60000);
      const { error } = await supabase
        .from("appointments")
        .update({ start_at: newStartAt.toISOString(), end_at: newEndAt.toISOString() })
        .eq("id", appointment.id);
      if (error) throw error;

      const clinic = clinicDisplayName || "tu consultorio";
      const firstName = (appointment.patients?.full_name || "").split(" ")[0] || "Hola";
      const oldStr = `${format(oldDate, "EEEE d 'de' MMMM", { locale: es })} a las ${format(oldDate, "HH:mm")}`;
      const newStr = `${format(newStartAt, "EEEE d 'de' MMMM", { locale: es })} a las ${format(newStartAt, "HH:mm")}`;

      // Email al paciente (el WhatsApp lo encola la base de datos sola)
      if (appointment.patients?.email && businessId) {
        try {
          await supabase.functions.invoke("send-resend-email", {
            body: {
              to: appointment.patients.email,
              template: "raw",
              businessId,
              data: {
                subject: `Tu sesión fue reprogramada — ${clinic}`,
                message:
                  `Hola ${firstName},\n\n` +
                  `Tu sesión con ${clinic} fue reprogramada:\n\n` +
                  `Antes: ${oldStr}\n` +
                  `Ahora: ${newStr}\n\n` +
                  `Si el nuevo horario no te sirve, contactate con el consultorio o entrá a tu portal.\n\n${clinic}`,
              },
            },
          });
        } catch (err) {
          console.warn("Reschedule email failed:", err);
        }
      }

      if (appointment.patient_id) {
        notifyPatient({
          patientId: appointment.patient_id,
          title: "Tu sesión fue reprogramada",
          body: `Nueva fecha: ${format(newStartAt, "d 'de' MMMM 'a las' HH:mm", { locale: es })}.`,
          url: "/portal",
        });
      }

      toast({
        title: "Cita reprogramada ✓",
        description: `Quedó para el ${newStr}. Le avisamos al paciente y los recordatorios se rearmaron solos.`,
      });
      onSuccess?.();
      onClose();
    } catch (err) {
      console.error(err);
      toast({ title: "Error", description: "No se pudo reprogramar la cita", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className={cn("sm:max-w-md max-h-[90vh] overflow-y-auto", mode === "slots" && "lg:max-w-3xl")}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <RefreshCw className="h-5 w-5 text-primary" />
            Reprogramar cita
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* De → A */}
          <div className="flex items-center gap-3 p-3 rounded-xl bg-accent/50 text-sm">
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground">Ahora está</p>
              <p className="font-semibold capitalize">
                {format(oldDate, "EEE d MMM · HH:mm", { locale: es })}
              </p>
            </div>
            <ArrowRight className="h-4 w-4 text-muted-foreground shrink-0" />
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground">Pasa a</p>
              <p className={cn("font-semibold capitalize", !newStartAt && "text-muted-foreground")}>
                {newStartAt ? format(newStartAt, "EEE d MMM · HH:mm", { locale: es }) : "Elegí abajo…"}
              </p>
            </div>
          </div>

          {mode === "slots" ? (
            <>
              {startsLoading ? (
                <div className="py-10 flex items-center justify-center text-muted-foreground">
                  <Loader2 className="h-5 w-5 animate-spin mr-2" /> Buscando horarios libres...
                </div>
              ) : startsByDate.length === 0 ? (
                <div className="py-8 text-center space-y-2">
                  <Clock className="h-8 w-8 mx-auto text-muted-foreground" />
                  <p className="text-sm font-medium">No hay horarios libres en los próximos 6 meses</p>
                  <p className="text-xs text-muted-foreground">Podés elegir el horario a mano.</p>
                </div>
              ) : (
                <>
                  <div className="flex gap-2 overflow-x-auto pb-2 -mx-1 px-1 snap-x lg:flex-wrap lg:overflow-visible lg:pb-0 lg:snap-none">
                    {startsByDate.map(({ day }) => {
                      const { date: d, d: dayNum, m } = parseDay(day);
                      const isSelected = selectedDay === day;
                      return (
                        <button
                          key={day}
                          type="button"
                          onClick={() => { setSelectedDay(day); setPicked(null); }}
                          className={cn(
                            "flex flex-col items-center justify-center rounded-xl border-2 px-3 py-2 min-w-[60px] snap-start transition-all hover:border-primary/50",
                            isSelected
                              ? "border-primary bg-primary text-primary-foreground hover:border-primary"
                              : "border-border bg-card"
                          )}
                        >
                          <span className={cn("text-[10px] uppercase tracking-wide", !isSelected && "text-muted-foreground")}>
                            {DAY_SHORT[d.getDay()]}
                          </span>
                          <span className="text-base font-bold leading-tight">{dayNum}</span>
                          <span className={cn("text-[10px]", !isSelected && "text-muted-foreground")}>
                            {MONTH_SHORT[m - 1]}
                          </span>
                        </button>
                      );
                    })}
                  </div>

                  {selectedDay && (
                    <div className="space-y-2">
                      <p className="text-sm font-semibold">{formatDayLong(selectedDay)}</p>
                      <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-6 gap-2">
                        {timesForSelectedDay.map((s) => {
                          const isPicked = picked?.day === s.day && picked?.time === s.start_time.slice(0, 5);
                          return (
                            <button
                              key={`${s.day}-${s.start_time}`}
                              type="button"
                              onClick={() => setPicked({ day: s.day, time: s.start_time.slice(0, 5) })}
                              className={cn(
                                "px-2 py-2.5 rounded-xl border-2 text-sm font-semibold tabular-nums transition-all",
                                isPicked
                                  ? "border-primary bg-primary text-primary-foreground"
                                  : "border-primary/30 bg-primary/5 text-primary hover:bg-primary hover:text-primary-foreground"
                              )}
                            >
                              {s.start_time.slice(0, 5)}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </>
              )}

              <button
                type="button"
                onClick={() => { setMode("manual"); setPicked(null); }}
                className="w-full text-center text-sm text-muted-foreground hover:text-foreground underline underline-offset-4 py-1"
              >
                Otro horario (elegir a mano)
              </button>
            </>
          ) : (
            <>
              <p className="text-xs text-muted-foreground">
                Elegí cualquier fecha y hora, incluso fuera de tu semana tipo.
              </p>
              <div className="space-y-2">
                <Label htmlFor="resched-date" className="text-sm font-semibold">Fecha *</Label>
                <Input
                  id="resched-date"
                  type="date"
                  value={manualDate}
                  onChange={(e) => {
                    setManualDate(e.target.value);
                    setPicked(e.target.value && manualTime ? { day: e.target.value, time: manualTime } : null);
                  }}
                  className="h-11 rounded-xl"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-sm font-semibold">Hora de inicio *</Label>
                <div className="flex items-center gap-2">
                  <Select
                    value={manualTime ? manualTime.split(":")[0] : undefined}
                    onValueChange={(h) => {
                      const t = `${h}:${manualTime.split(":")[1] || "00"}`;
                      setManualTime(t);
                      setPicked(manualDate ? { day: manualDate, time: t } : null);
                    }}
                  >
                    <SelectTrigger className="h-11 rounded-xl flex-1">
                      <SelectValue placeholder="Hora" />
                    </SelectTrigger>
                    <SelectContent className="max-h-64">
                      {Array.from({ length: 18 }, (_, i) => String(i + 6).padStart(2, "0")).map((h) => (
                        <SelectItem key={h} value={h}>{h} hs</SelectItem>
                      ))}
                      {["00", "01", "02", "03", "04", "05"].map((h) => (
                        <SelectItem key={h} value={h}>{h} hs</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <span className="text-lg font-bold text-muted-foreground">:</span>
                  <Select
                    value={manualTime ? (manualTime.split(":")[1] || "00") : undefined}
                    onValueChange={(m) => {
                      const t = `${manualTime.split(":")[0] || "09"}:${m}`;
                      setManualTime(t);
                      setPicked(manualDate ? { day: manualDate, time: t } : null);
                    }}
                  >
                    <SelectTrigger className="h-11 rounded-xl flex-1">
                      <SelectValue placeholder="Minutos" />
                    </SelectTrigger>
                    <SelectContent className="max-h-64">
                      {["00", "05", "10", "15", "20", "25", "30", "35", "40", "45", "50", "55"].map((m) => (
                        <SelectItem key={m} value={m}>{m} min</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <button
                type="button"
                onClick={() => { setMode("slots"); setPicked(null); }}
                className="w-full text-center text-sm text-muted-foreground hover:text-foreground underline underline-offset-4 py-1"
              >
                Volver a los horarios libres
              </button>
            </>
          )}

          {/* Confirmar */}
          <div className="pt-2 border-t border-border/40 space-y-2">
            {newStartAt && (
              <p className="text-xs text-muted-foreground">
                Le avisamos al paciente por email y WhatsApp, y sus recordatorios se rearman solos con la fecha nueva. El cobro pendiente también se mueve.
              </p>
            )}
            <Button
              onClick={confirmReschedule}
              disabled={!newStartAt || saving}
              className="w-full h-11 rounded-xl font-semibold gap-2"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              {saving ? "Reprogramando..." : "Confirmar reprogramación"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
