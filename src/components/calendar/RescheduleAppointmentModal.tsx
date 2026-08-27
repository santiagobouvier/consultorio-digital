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
import { fetchExternalBusyDay, type ExternalBusyBlock } from "@/hooks/use-external-busy";
import { notifyPatient } from "@/lib/push-notifications";
import { useDashboardBranding } from "@/contexts/DashboardBrandingContext";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { Loader2, ArrowRight, RefreshCw, CalendarIcon } from "lucide-react";
import { cn } from "@/lib/utils";

// Reprogramar una cita existente: elegir nuevo día y horario tocando —
// SIEMPRE se ven todos los lapsos del día cada 30 minutos (los ocupados se
// atenúan). Los recordatorios y el cobro la siguen solos (triggers de la
// base); acá además le avisamos al paciente por email + push. El WhatsApp
// de reprogramación lo encola la base.

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
  const [selectedDay, setSelectedDay] = useState<string>("");
  const [farDateOpen, setFarDateOpen] = useState(false);
  const [manualDate, setManualDate] = useState("");
  const [manualTime, setManualTime] = useState("");
  // Selección final (de cualquiera de los dos modos)
  const [picked, setPicked] = useState<{ day: string; time: string } | null>(null);
  const [saving, setSaving] = useState(false);
  // Citas activas del día elegido: se atenúan (sin contar la que se mueve)
  const [busy, setBusy] = useState<{ start: number; end: number; label: string }[]>([]);
  const [busyLoading, setBusyLoading] = useState(false);
  // Calendario personal conectado (Google/iPhone): avisa choques, no bloquea
  const [extBusy, setExtBusy] = useState<ExternalBusyBlock[]>([]);

  const durationMinutes = useMemo(() => {
    if (!appointment) return 60;
    const ms = new Date(appointment.end_at).getTime() - new Date(appointment.start_at).getTime();
    return Math.max(15, Math.round(ms / 60000));
  }, [appointment]);

  const toMin = (hhmm: string) => {
    const [h, m] = hhmm.split(":").map(Number);
    return h * 60 + m;
  };
  const minToHHMM = (min: number) =>
    `${String(Math.floor(min / 60)).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`;

  const loadBusy = useCallback(async (dayStr: string) => {
    if (!businessId || !appointment) return;
    setBusyLoading(true);
    try {
      const from = new Date(`${dayStr}T00:00:00`);
      const to = new Date(`${dayStr}T23:59:59`);
      const { data, error } = await supabase
        .from("appointments")
        .select("id, start_at, end_at, patients (full_name)")
        .eq("business_id", businessId)
        .gte("start_at", from.toISOString())
        .lte("start_at", to.toISOString())
        .not("status", "in", '("cancelled","cancelled_by_patient")');
      if (error) throw error;
      setBusy(
        (data ?? [])
          .filter((a: any) => a.id !== appointment.id)
          .map((a: any) => {
            const s = new Date(a.start_at);
            const e = new Date(a.end_at);
            return {
              start: s.getHours() * 60 + s.getMinutes(),
              end: e.getHours() * 60 + e.getMinutes(),
              label: a.patients?.full_name?.split(" ")[0] ?? "ocupado",
            };
          })
      );
    } catch (e) {
      console.error("Error cargando ocupación del día:", e);
      setBusy([]);
    } finally {
      setBusyLoading(false);
    }
  }, [businessId, appointment]);

  useEffect(() => {
    if (!open) return;
    setMode("slots");
    setFarDateOpen(false);
    setManualDate("");
    setManualTime("");
    setPicked(null);
    // Arranca en mañana: lo más común al reprogramar
    const t = new Date(Date.now() + 86400000);
    setSelectedDay(
      `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, "0")}-${String(t.getDate()).padStart(2, "0")}`
    );
  }, [open]);

  useEffect(() => {
    if (open && selectedDay) void loadBusy(selectedDay);
  }, [open, selectedDay, loadBusy]);

  useEffect(() => {
    if (!open || !selectedDay) return;
    let cancelled = false;
    setExtBusy([]);
    void fetchExternalBusyDay(selectedDay).then((b) => {
      if (!cancelled) setExtBusy(b);
    });
    return () => {
      cancelled = true;
    };
  }, [open, selectedDay]);

  // Tira de días: hoy + 13 (para más lejos, el calendario)
  const dayOptions = useMemo(() => {
    const base = new Date();
    base.setHours(0, 0, 0, 0);
    return Array.from({ length: 14 }, (_, i) => {
      const d = new Date(base.getTime() + i * 86400000);
      return {
        str: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`,
        d,
      };
    });
  }, []);

  const SLOT_TIMES = useMemo(() => {
    const out: number[] = [];
    for (let t = 7 * 60; t <= 21 * 60 + 30; t += 30) out.push(t);
    return out;
  }, []);

  const isOccupied = (slotMin: number) =>
    busy.some((b) => b.start < slotMin + 30 && b.end > slotMin);
  const occupiedBy = (slotMin: number) =>
    busy.find((b) => b.start < slotMin + 30 && b.end > slotMin)?.label ?? null;
  const extClashAt = (slotMin: number) =>
    extBusy.find((b) => b.start < slotMin + 30 && b.end > slotMin) ?? null;

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
              {/* Tira de días + "Otro día" para fechas lejanas */}
              <div className="flex gap-2 overflow-x-auto pb-2 -mx-1 px-1 snap-x lg:flex-wrap lg:overflow-visible lg:pb-0 lg:snap-none [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                {dayOptions.map(({ str, d }) => {
                  const isSelected = selectedDay === str;
                  return (
                    <button
                      key={str}
                      type="button"
                      onClick={() => {
                        setSelectedDay(str);
                        setPicked(null);
                        setFarDateOpen(false);
                      }}
                      className={cn(
                        "flex flex-col items-center justify-center rounded-xl border-2 px-3 py-2 min-w-[64px] min-h-[64px] snap-start transition-all hover:border-primary/50",
                        isSelected
                          ? "border-primary bg-primary text-primary-foreground hover:border-primary"
                          : "border-border bg-card"
                      )}
                    >
                      <span className={cn("text-[10px] uppercase tracking-wide", !isSelected && "text-muted-foreground")}>
                        {DAY_SHORT[d.getDay()]}
                      </span>
                      <span className="text-lg font-bold leading-tight">{d.getDate()}</span>
                      <span className={cn("text-[10px]", !isSelected && "text-muted-foreground")}>
                        {MONTH_SHORT[d.getMonth()]}
                      </span>
                    </button>
                  );
                })}
                <button
                  type="button"
                  onClick={() => setFarDateOpen((v) => !v)}
                  className={cn(
                    "flex flex-col items-center justify-center rounded-xl border-2 border-dashed px-3 py-2 min-w-[64px] min-h-[64px] snap-start transition-all",
                    farDateOpen || !dayOptions.some((o) => o.str === selectedDay)
                      ? "border-primary text-primary bg-primary/5"
                      : "border-border bg-card text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="h-4 w-4" />
                  <span className="text-[10px] mt-1">Otro día</span>
                </button>
              </div>

              {(farDateOpen || !dayOptions.some((o) => o.str === selectedDay)) && (
                <Input
                  type="date"
                  value={selectedDay}
                  min={dayOptions[0]?.str}
                  onChange={(e) => {
                    if (e.target.value) {
                      setSelectedDay(e.target.value);
                      setPicked(null);
                    }
                  }}
                  className="h-11 rounded-xl"
                />
              )}

              {/* TODOS los lapsos del día cada 30 min; los tomados, atenuados */}
              {selectedDay && (
                <div className="space-y-2">
                  <p className="text-sm font-semibold capitalize flex items-center gap-2">
                    {formatDayLong(selectedDay)}
                    {busyLoading && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />}
                  </p>
                  <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-6 gap-2">
                    {SLOT_TIMES.map((t) => {
                      const hhmm = minToHHMM(t);
                      const occupied = isOccupied(t);
                      const who = occupied ? occupiedBy(t) : null;
                      const ext = !occupied ? extClashAt(t) : null;
                      const isPicked = picked?.day === selectedDay && picked?.time === hhmm;
                      return (
                        <button
                          key={t}
                          type="button"
                          disabled={occupied}
                          onClick={() => {
                            setPicked({ day: selectedDay, time: hhmm });
                            if (ext) {
                              toast({
                                title: "Ojo: chocás con tu calendario",
                                description: `A esa hora ya tenés ${ext.label}, ${minToHHMM(ext.start)}–${minToHHMM(ext.end)}. Podés reprogramar igual.`,
                              });
                            }
                          }}
                          title={
                            who
                              ? `Ocupado: ${who}`
                              : ext
                                ? `En tu calendario: ${ext.label}`
                                : undefined
                          }
                          className={cn(
                            "h-12 rounded-xl border-2 tabular-nums transition-all flex flex-col items-center justify-center leading-tight",
                            occupied
                              ? "border-border/50 bg-muted/30 text-muted-foreground/60 cursor-not-allowed"
                              : ext
                                ? "text-[15px] font-semibold border-amber-400/60 bg-amber-500/10 text-amber-700 dark:text-amber-400 hover:bg-amber-500/20"
                                : "text-[15px] font-semibold border-primary/30 bg-primary/5 text-primary hover:bg-primary hover:text-primary-foreground",
                            isPicked && !occupied &&
                              "border-primary bg-primary text-primary-foreground shadow-md"
                          )}
                        >
                          <span className={cn(occupied && "text-[13px] line-through")}>{hhmm}</span>
                          {who && <span className="text-[9px] no-underline truncate max-w-[64px]">{who}</span>}
                          {!who && ext && (
                            <span className="text-[9px] truncate max-w-[64px]">📅 tuyo</span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              <button
                type="button"
                onClick={() => { setMode("manual"); setPicked(null); }}
                className="w-full text-center text-sm text-muted-foreground hover:text-foreground underline underline-offset-4 py-2 min-h-[44px]"
              >
                ¿Necesitás otra hora? (ej: 09:15, elegir a mano)
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
