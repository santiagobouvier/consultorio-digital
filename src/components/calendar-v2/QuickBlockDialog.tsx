import { useEffect, useState } from "react";
import { addDays, differenceInCalendarDays, format, isToday, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import { Sunrise, Sunset, CalendarOff, Loader2, Plane, ChevronDown, Clock, ArrowLeft, Ban, X, User } from "lucide-react";
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

// Medias horas de 07:00 a 21:30 para el rango puntual
const HALF_HOURS: string[] = (() => {
  const out: string[] = [];
  for (let h = 7; h <= 21; h++) {
    out.push(`${String(h).padStart(2, "0")}:00`);
    if (h < 21) out.push(`${String(h).padStart(2, "0")}:30`);
  }
  return out;
})();

/** Un bloqueo planificado, listo para confirmar contra las citas del rango. */
interface PlannedBlock {
  title: string;
  /** Filas de personal_events a insertar (una por día). */
  rows: { start_at: string; end_at: string }[];
  from: Date;
  to: Date;
  summary: string;
}

interface ConflictApt {
  id: string;
  start_at: string;
  name: string;
}

/**
 * Percance resuelto en dos toques: bloquea la mañana, la tarde, el día,
 * un rato puntual o varios días. Si hay sesiones agendadas en el rango,
 * pregunta si también las cancela — inteligencia, no sorpresas.
 */
export const QuickBlockDialog = ({ open, onOpenChange, businessId, date, onSaved }: QuickBlockDialogProps) => {
  const [loadingKey, setLoadingKey] = useState<string | null>(null);
  // Rango puntual dentro del día
  const [customOpen, setCustomOpen] = useState(false);
  const [customFrom, setCustomFrom] = useState("14:00");
  const [customTo, setCustomTo] = useState("16:00");
  // Una sesión concreta del día
  const [sessionsOpen, setSessionsOpen] = useState(false);
  const [sessions, setSessions] = useState<{ id: string; start_at: string; end_at: string; name: string }[]>([]);
  const [sessionsLoading, setSessionsLoading] = useState(false);
  const [sessionsFetched, setSessionsFetched] = useState(false);
  // Licencia / vacaciones
  const [rangeOpen, setRangeOpen] = useState(false);
  const [rangeFrom, setRangeFrom] = useState(() => format(date, "yyyy-MM-dd"));
  const [rangeTo, setRangeTo] = useState(() => format(addDays(date, 6), "yyyy-MM-dd"));
  // Confirmación cuando hay sesiones en el rango
  const [planned, setPlanned] = useState<PlannedBlock | null>(null);
  const [conflicts, setConflicts] = useState<ConflictApt[]>([]);
  const [confirming, setConfirming] = useState(false);

  const dayLabel = format(date, "EEEE d 'de' MMMM", { locale: es });
  const dateStr = format(date, "yyyy-MM-dd");

  useEffect(() => {
    if (open) {
      setRangeFrom(format(date, "yyyy-MM-dd"));
      setRangeTo(format(addDays(date, 6), "yyyy-MM-dd"));
      setRangeOpen(false);
      setCustomOpen(false);
      setSessionsOpen(false);
      setSessions([]);
      setSessionsFetched(false);
      setPlanned(null);
      setConflicts([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  /** Sesiones activas del día (del profesional): para bloquear una puntual. */
  const loadSessions = async () => {
    setSessionsLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Sesión no válida");
      const from = new Date(`${dateStr}T00:00:00`);
      const to = new Date(`${dateStr}T23:59:59`);
      const { data, error } = await supabase
        .from("appointments")
        .select("id, start_at, end_at, professional_id, patients (full_name)")
        .eq("business_id", businessId)
        .gte("start_at", from.toISOString())
        .lte("start_at", to.toISOString())
        .not("status", "in", '("cancelled","cancelled_by_patient")')
        .order("start_at", { ascending: true });
      if (error) throw error;
      setSessions(
        (data ?? [])
          .filter((a: any) => !a.professional_id || a.professional_id === user.id)
          .map((a: any) => ({
            id: a.id,
            start_at: a.start_at,
            end_at: a.end_at,
            name: a.patients?.full_name ?? "Paciente",
          }))
      );
      setSessionsFetched(true);
    } catch (e) {
      console.error(e);
      setSessions([]);
      setSessionsFetched(true);
    } finally {
      setSessionsLoading(false);
    }
  };

  const pickSession = (s: { id: string; start_at: string; end_at: string; name: string }) => {
    const hhmm = format(new Date(s.start_at), "HH:mm");
    void prepareBlock("session", {
      title: "Imprevisto",
      rows: [{ start_at: s.start_at, end_at: s.end_at }],
      from: new Date(s.start_at),
      to: new Date(s.end_at),
      summary: `Bloqueada la sesión de las ${hhmm} (${s.name.split(" ")[0]}) el ${dayLabel}`,
    });
  };

  /** Inserta los bloqueos (y opcionalmente cancela las sesiones del rango). */
  const executeBlock = async (block: PlannedBlock, cancelIds: string[]) => {
    setConfirming(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Sesión no válida");

      if (cancelIds.length > 0) {
        const { error: cancelErr } = await supabase
          .from("appointments")
          .update({ status: "cancelled" })
          .in("id", cancelIds);
        if (cancelErr) throw cancelErr;
      }

      const { error } = await (supabase as any).from("personal_events").insert(
        block.rows.map((r) => ({
          business_id: businessId,
          professional_user_id: user.id,
          title: block.title,
          category: "personal",
          label_id: null,
          notes: null,
          start_at: r.start_at,
          end_at: r.end_at,
          recurrence: "none",
          recurrence_until: null,
        }))
      );
      if (error) throw error;

      toast({
        title: "Listo ✓",
        description:
          `${block.summary}.` +
          (cancelIds.length > 0
            ? ` Se cancelaron ${cancelIds.length} sesi${cancelIds.length === 1 ? "ón" : "ones"} — avisales a los pacientes.`
            : " Nadie puede reservar en ese rango."),
      });
      onOpenChange(false);
      onSaved();
    } catch (e: any) {
      console.error(e);
      toast({ title: "Error", description: e?.message ?? "No se pudo aplicar el bloqueo", variant: "destructive" });
    } finally {
      setConfirming(false);
    }
  };

  /** Busca sesiones activas en el rango; si hay, pide confirmación. */
  const prepareBlock = async (key: string, block: PlannedBlock) => {
    setLoadingKey(key);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Sesión no válida");
      const { data, error } = await supabase
        .from("appointments")
        .select("id, start_at, end_at, professional_id, patients (full_name)")
        .eq("business_id", businessId)
        .lt("start_at", block.to.toISOString())
        .gt("end_at", block.from.toISOString())
        .not("status", "in", '("cancelled","cancelled_by_patient")');
      if (error) throw error;
      // Solo las del profesional (o sin asignar) y dentro de las horas del bloqueo
      const mine = (data ?? []).filter(
        (a: any) => !a.professional_id || a.professional_id === user.id
      );
      const overlapping = mine.filter((a: any) =>
        block.rows.some(
          (r) => new Date(a.start_at) < new Date(r.end_at) && new Date(a.end_at) > new Date(r.start_at)
        )
      );
      if (overlapping.length === 0) {
        await executeBlock(block, []);
        return;
      }
      setConflicts(
        overlapping
          .map((a: any) => ({
            id: a.id,
            start_at: a.start_at,
            name: a.patients?.full_name ?? "Paciente",
          }))
          .sort((a, b) => a.start_at.localeCompare(b.start_at))
      );
      setPlanned(block);
    } catch (e: any) {
      console.error(e);
      toast({ title: "Error", description: e?.message ?? "No se pudo preparar el bloqueo", variant: "destructive" });
    } finally {
      setLoadingKey(null);
    }
  };

  const pickOption = (opt: BlockOption) => {
    void prepareBlock(opt.key, {
      title: "Imprevisto",
      rows: [
        {
          start_at: new Date(`${dateStr}T${opt.startTime}:00`).toISOString(),
          end_at: new Date(`${dateStr}T${opt.endTime}:00`).toISOString(),
        },
      ],
      from: new Date(`${dateStr}T${opt.startTime}:00`),
      to: new Date(`${dateStr}T${opt.endTime}:00`),
      summary: `${opt.label} del ${dayLabel}`,
    });
  };

  const pickCustom = () => {
    if (customFrom >= customTo) {
      toast({ title: "Rango inválido", description: "La hora de fin debe ser posterior a la de inicio.", variant: "destructive" });
      return;
    }
    void prepareBlock("custom", {
      title: "Imprevisto",
      rows: [
        {
          start_at: new Date(`${dateStr}T${customFrom}:00`).toISOString(),
          end_at: new Date(`${dateStr}T${customTo}:00`).toISOString(),
        },
      ],
      from: new Date(`${dateStr}T${customFrom}:00`),
      to: new Date(`${dateStr}T${customTo}:00`),
      summary: `Bloqueado de ${customFrom} a ${customTo} el ${dayLabel}`,
    });
  };

  const pickVacation = () => {
    const days = differenceInCalendarDays(parseISO(rangeTo), parseISO(rangeFrom)) + 1;
    if (days < 1) {
      toast({ title: "Rango inválido", description: "La fecha de fin debe ser igual o posterior a la de inicio.", variant: "destructive" });
      return;
    }
    if (days > 60) {
      toast({ title: "Máximo 60 días", description: "Para licencias más largas, hacelo en dos tandas.", variant: "destructive" });
      return;
    }
    const rows = Array.from({ length: days }, (_, i) => {
      const d = format(addDays(parseISO(rangeFrom), i), "yyyy-MM-dd");
      return {
        start_at: new Date(`${d}T07:00:00`).toISOString(),
        end_at: new Date(`${d}T21:00:00`).toISOString(),
      };
    });
    void prepareBlock("vacation", {
      title: "Licencia",
      rows,
      from: new Date(`${rangeFrom}T07:00:00`),
      to: new Date(`${rangeTo}T21:00:00`),
      summary: `${days} día${days !== 1 ? "s" : ""} cerrado${days !== 1 ? "s" : ""} (${format(parseISO(rangeFrom), "d/M")} al ${format(parseISO(rangeTo), "d/M")})`,
    });
  };

  const timeSelect = (value: string, onChange: (v: string) => void) => (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="h-11 flex-1 rounded-xl border border-input bg-background px-3 text-sm tabular-nums"
    >
      {HALF_HOURS.map((t) => (
        <option key={t} value={t}>{t}</option>
      ))}
    </select>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md max-h-[88dvh] overflow-y-auto">
        {planned ? (
          /* ── Confirmación: hay sesiones dentro del rango ── */
          <>
            <DialogHeader>
              <DialogTitle>
                Hay {conflicts.length} sesi{conflicts.length === 1 ? "ón" : "ones"} en ese rango
              </DialogTitle>
              <DialogDescription>
                {planned.summary}. Decidí qué pasa con las sesiones ya agendadas.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-1.5 max-h-[30dvh] overflow-y-auto rounded-xl border p-2.5">
              {conflicts.map((c) => (
                <div key={c.id} className="flex items-center gap-2.5 text-sm py-1">
                  <span className="font-semibold tabular-nums text-foreground">
                    {format(new Date(c.start_at), "EEE d/M HH:mm", { locale: es })}
                  </span>
                  <span className="truncate text-muted-foreground">{c.name}</span>
                </div>
              ))}
            </div>
            <div className="space-y-2.5">
              <button
                type="button"
                disabled={confirming}
                onClick={() => void executeBlock(planned, conflicts.map((c) => c.id))}
                className="w-full flex items-center gap-4 rounded-2xl border-2 border-rose-500/40 bg-rose-500/5 p-4 text-left transition-all hover:bg-rose-500/10 active:scale-[0.98] disabled:opacity-60"
              >
                {confirming ? (
                  <Loader2 className="h-5 w-5 text-rose-400 animate-spin shrink-0" />
                ) : (
                  <X className="h-5 w-5 text-rose-400 shrink-0" />
                )}
                <div className="min-w-0">
                  <p className="font-semibold text-[15px]">Bloquear y cancelar las {conflicts.length}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Después avisales a los pacientes</p>
                </div>
              </button>
              <button
                type="button"
                disabled={confirming}
                onClick={() => void executeBlock(planned, [])}
                className="w-full flex items-center gap-4 rounded-2xl border-2 border-border bg-card p-4 text-left transition-all hover:border-amber-500/60 hover:bg-amber-500/5 active:scale-[0.98] disabled:opacity-60"
              >
                <Ban className="h-5 w-5 text-amber-500 shrink-0" />
                <div className="min-w-0">
                  <p className="font-semibold text-[15px]">Solo bloquear — las sesiones quedan</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Frena reservas nuevas, no toca lo agendado</p>
                </div>
              </button>
              <button
                type="button"
                disabled={confirming}
                onClick={() => {
                  setPlanned(null);
                  setConflicts([]);
                }}
                className="w-full inline-flex items-center justify-center gap-1.5 text-sm text-muted-foreground hover:text-foreground py-2 min-h-[44px]"
              >
                <ArrowLeft className="h-4 w-4" /> Volver
              </button>
            </div>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>{isToday(date) ? "¿Se te complicó hoy?" : `¿Se te complicó el ${dayLabel}?`}</DialogTitle>
              <DialogDescription>
                Bloqueá en un toque. Si hay sesiones en el rango, te pregunto qué hacer con ellas.
              </DialogDescription>
            </DialogHeader>

            {/* A qué día se aplica — clarísimo, sin sorpresas */}
            <div className="rounded-xl bg-amber-500/10 border border-amber-500/25 px-3.5 py-2.5 space-y-1">
              <p className="text-sm font-semibold capitalize flex items-center gap-2">
                <CalendarOff className="h-4 w-4 text-amber-500 shrink-0" />
                {isToday(date) ? `Hoy · ${dayLabel}` : dayLabel}
                {isToday(date) && (
                  <span className="ml-auto text-[10px] font-bold uppercase tracking-wide text-amber-600 dark:text-amber-400 shrink-0">
                    Día de hoy
                  </span>
                )}
              </p>
              {isToday(date) && (
                <p className="text-xs text-muted-foreground">
                  Para otro día, tocá primero ese día en el calendario y usá Imprevisto desde ahí.
                </p>
              )}
            </div>

            <div className="space-y-2.5 pt-1">
              {OPTIONS.map((opt) => {
                const Icon = opt.icon;
                const loading = loadingKey === opt.key;
                return (
                  <button
                    key={opt.key}
                    type="button"
                    disabled={loadingKey !== null}
                    onClick={() => pickOption(opt)}
                    className="w-full flex items-center gap-4 rounded-2xl border-2 border-border bg-card p-4 text-left transition-all hover:border-primary hover:bg-primary/5 active:scale-[0.98] disabled:opacity-60"
                  >
                    <div className="w-12 h-12 shrink-0 rounded-2xl bg-amber-500/10 flex items-center justify-center">
                      {loading ? (
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

              {/* Una sesión concreta del día */}
              <div className="rounded-2xl border-2 border-border overflow-hidden">
                <button
                  type="button"
                  onClick={() => {
                    const next = !sessionsOpen;
                    setSessionsOpen(next);
                    if (next && !sessionsFetched) void loadSessions();
                  }}
                  className="w-full flex items-center gap-4 bg-card p-4 text-left transition-colors hover:bg-primary/5"
                >
                  <div className="w-12 h-12 shrink-0 rounded-2xl bg-amber-500/10 flex items-center justify-center">
                    <User className="h-6 w-6 text-amber-500" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-[15px]">Una sesión del día</p>
                    <p className="text-xs text-muted-foreground mt-0.5">Elegí cuál de las sesiones agendadas no podés dar</p>
                  </div>
                  <ChevronDown className={`h-4 w-4 text-muted-foreground shrink-0 transition-transform ${sessionsOpen ? "rotate-180" : ""}`} />
                </button>
                {sessionsOpen && (
                  <div className="px-4 pb-4 space-y-2 bg-card">
                    {sessionsLoading ? (
                      <div className="py-4 flex items-center justify-center text-muted-foreground text-sm">
                        <Loader2 className="h-4 w-4 animate-spin mr-2" /> Buscando sesiones...
                      </div>
                    ) : sessions.length === 0 ? (
                      <p className="text-sm text-muted-foreground text-center py-3">
                        No hay sesiones agendadas este día.
                      </p>
                    ) : (
                      sessions.map((s) => (
                        <button
                          key={s.id}
                          type="button"
                          disabled={loadingKey !== null}
                          onClick={() => pickSession(s)}
                          className="w-full flex items-center gap-3 rounded-xl border border-border bg-background p-3.5 text-left transition-all hover:border-amber-500/60 hover:bg-amber-500/5 active:scale-[0.98] disabled:opacity-60 min-h-[52px]"
                        >
                          <span className="font-bold tabular-nums text-[15px] shrink-0">
                            {format(new Date(s.start_at), "HH:mm")}–{format(new Date(s.end_at), "HH:mm")}
                          </span>
                          <span className="truncate text-sm text-muted-foreground flex-1">{s.name}</span>
                          {loadingKey === "session" ? (
                            <Loader2 className="h-4 w-4 animate-spin text-amber-500 shrink-0" />
                          ) : (
                            <Ban className="h-4 w-4 text-amber-500 shrink-0" />
                          )}
                        </button>
                      ))
                    )}
                  </div>
                )}
              </div>

              {/* Un rato puntual: el lapso exacto que no podés atender */}
              <div className="rounded-2xl border-2 border-border overflow-hidden">
                <button
                  type="button"
                  onClick={() => setCustomOpen((v) => !v)}
                  className="w-full flex items-center gap-4 bg-card p-4 text-left transition-colors hover:bg-primary/5"
                >
                  <div className="w-12 h-12 shrink-0 rounded-2xl bg-amber-500/10 flex items-center justify-center">
                    <Clock className="h-6 w-6 text-amber-500" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-[15px]">Un rato puntual</p>
                    <p className="text-xs text-muted-foreground mt-0.5">Elegí desde y hasta qué hora no podés</p>
                  </div>
                  <ChevronDown className={`h-4 w-4 text-muted-foreground shrink-0 transition-transform ${customOpen ? "rotate-180" : ""}`} />
                </button>
                {customOpen && (
                  <div className="px-4 pb-4 space-y-3 bg-card">
                    <div className="flex items-center gap-2">
                      {timeSelect(customFrom, (v) => {
                        setCustomFrom(v);
                        if (v >= customTo) setCustomTo(HALF_HOURS[Math.min(HALF_HOURS.indexOf(v) + 2, HALF_HOURS.length - 1)]);
                      })}
                      <span className="text-muted-foreground text-sm shrink-0">a</span>
                      {timeSelect(customTo, setCustomTo)}
                    </div>
                    <Button
                      type="button"
                      disabled={loadingKey !== null}
                      onClick={pickCustom}
                      className="w-full h-11 rounded-xl font-bold"
                    >
                      {loadingKey === "custom" ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <>Bloquear {customFrom}–{customTo}</>
                      )}
                    </Button>
                  </div>
                )}
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
                      disabled={loadingKey !== null}
                      onClick={pickVacation}
                      className="w-full h-11 rounded-xl font-bold"
                    >
                      {loadingKey === "vacation" ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <>Cerrar del {format(parseISO(rangeFrom), "d/M")} al {format(parseISO(rangeTo), "d/M")}</>
                      )}
                    </Button>
                  </div>
                )}
              </div>
            </div>

            <p className="text-xs text-muted-foreground text-center">
              Los bloqueos aparecen en tu agenda como eventos personales: tocalos para deshacerlos.
            </p>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
};
