// Modal de evento personal: la agenda de TODA la vida del profesional.
// Etiquetas 100% libres (nombre + color a elección), riel de horarios
// deslizable, repetición diaria/semanal/mensual.
// Responsive de verdad: en el celular es un bottom sheet que sube desde
// abajo con el botón de guardar fijo; en escritorio, un diálogo centrado.
import { useEffect, useMemo, useRef, useState } from "react";
import { addDays, format } from "date-fns";
import { es } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { useIsMobile } from "@/hooks/use-mobile";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Loader2, Trash2, Lock, Plus, Check, X, Pipette, Minus, ArrowLeft } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  LABEL_PALETTE,
  type PersonalEvent,
  type PersonalEventLabel,
} from "@/components/calendar-v2/types";

interface PersonalEventModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  businessId: string | null;
  /** Evento existente para editar; null/undefined = crear uno nuevo. */
  event?: PersonalEvent | null;
  /** Fecha sugerida al crear (día visible en la agenda). */
  defaultDate?: Date;
  /** Hora sugerida al crear ("15:00") — al tocar un lapso de la grilla. */
  defaultStartTime?: string | null;
  onSaved: () => void;
}

// Ejemplos que RELLENAN el título (editable). No son etiquetas ni presets.
const TITLE_EXAMPLES = ["Gimnasio", "Almuerzo", "Estudio", "Familia", "Trámite", "Descanso"];

const DURATIONS = [
  { label: "30 min", min: 30 },
  { label: "45 min", min: 45 },
  { label: "1 h", min: 60 },
  { label: "1½ h", min: 90 },
  { label: "2 h", min: 120 },
  { label: "3 h", min: 180 },
];

type Recurrence = "none" | "daily" | "weekly" | "monthly";

const RECURRENCES: { id: Recurrence; label: string }[] = [
  { id: "none", label: "Una vez" },
  { id: "daily", label: "Todos los días" },
  { id: "weekly", label: "Cada semana" },
  { id: "monthly", label: "Cada mes" },
];

const NEUTRAL = "#64748b";

type WizStep = "title" | "when" | "time" | "repeat" | "label" | "summary";
const WIZ_ORDER: WizStep[] = ["title", "when", "time", "repeat", "label", "summary"];
const WIZ_TITLES: Record<WizStep, string> = {
  title: "¿Qué tenés?",
  when: "¿Qué día?",
  time: "¿A qué hora?",
  repeat: "¿Se repite?",
  label: "Etiqueta y color",
  summary: "Revisá y listo",
};

const toMin = (time: string) => Number(time.slice(0, 2)) * 60 + Number(time.slice(3, 5));
const toTime = (min: number) => {
  const clamped = Math.min(Math.max(min, 0), 23 * 60 + 59);
  return `${String(Math.floor(clamped / 60)).padStart(2, "0")}:${String(clamped % 60).padStart(2, "0")}`;
};
const addMinutes = (time: string, min: number) => toTime(toMin(time) + min);

/**
 * Riel de horarios: chips deslizables cada 30 min (06:00-23:30) que se
 * centran solos en la hora elegida. Cero relojito nativo: tocar y listo.
 */
const TimeRail = ({
  value,
  onChange,
}: {
  value: string;
  onChange: (t: string) => void;
}) => {
  const railRef = useRef<HTMLDivElement>(null);

  const times = useMemo(() => {
    const out: string[] = [];
    for (let m = 6 * 60; m <= 23 * 60 + 30; m += 30) out.push(toTime(m));
    // Si el valor actual no cae en la grilla de 30 (ajuste fino), se inserta
    if (value && !out.includes(value)) {
      out.push(value);
      out.sort();
    }
    return out;
  }, [value]);

  useEffect(() => {
    const el = railRef.current?.querySelector<HTMLElement>('[data-selected="true"]');
    el?.scrollIntoView({ inline: "center", block: "nearest", behavior: "smooth" });
  }, [value]);

  return (
    <div
      ref={railRef}
      className="flex gap-1.5 overflow-x-auto py-1 -mx-1 px-1 snap-x [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]"
    >
      {times.map((t) => {
        const selected = t === value;
        return (
          <button
            key={t}
            type="button"
            data-selected={selected || undefined}
            onClick={() => onChange(t)}
            className={cn(
              "shrink-0 snap-center rounded-full px-3.5 py-2 text-[13.5px] font-semibold tabular-nums transition-all",
              selected
                ? "bg-primary text-primary-foreground shadow-md scale-105"
                : "bg-muted/60 text-muted-foreground hover:text-foreground"
            )}
          >
            {t}
          </button>
        );
      })}
    </div>
  );
};

/** Botoncitos de ajuste fino ±15 min. */
const FineTune = ({ onDelta }: { onDelta: (d: number) => void }) => (
  <span className="inline-flex items-center gap-1">
    <button
      type="button"
      onClick={() => onDelta(-15)}
      className="h-7 w-7 rounded-full bg-muted/60 flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
      aria-label="15 minutos antes"
    >
      <Minus className="h-3.5 w-3.5" />
    </button>
    <button
      type="button"
      onClick={() => onDelta(15)}
      className="h-7 w-7 rounded-full bg-muted/60 flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
      aria-label="15 minutos después"
    >
      <Plus className="h-3.5 w-3.5" />
    </button>
  </span>
);

export const PersonalEventModal = ({
  open,
  onOpenChange,
  businessId,
  event,
  defaultDate,
  defaultStartTime = null,
  onSaved,
}: PersonalEventModalProps) => {
  const isEdit = !!event;
  const isMobile = useIsMobile();

  const [title, setTitle] = useState("");
  const [labelId, setLabelId] = useState<string | null>(null);
  const [customLabels, setCustomLabels] = useState<PersonalEventLabel[]>([]);
  const [creatingLabel, setCreatingLabel] = useState(false);
  const [newLabelName, setNewLabelName] = useState("");
  const [newLabelColor, setNewLabelColor] = useState(LABEL_PALETTE[4]);
  const [savingLabel, setSavingLabel] = useState(false);
  const [labelToDelete, setLabelToDelete] = useState<PersonalEventLabel | null>(null);
  const [date, setDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("10:00");
  const [recurrence, setRecurrence] = useState<Recurrence>("none");
  const [until, setUntil] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  // Asistente de a UNA pregunta por vez (el resumen final permite saltar
  // a cualquier paso tocando la fila)
  const [step, setStep] = useState<WizStep>("title");

  // Prefill al abrir
  useEffect(() => {
    if (!open) return;
    if (event) {
      const s = new Date(event.start_at);
      const e = new Date(event.end_at);
      setTitle(event.title);
      setLabelId(event.label_id ?? null);
      setDate(format(s, "yyyy-MM-dd"));
      setStartTime(format(s, "HH:mm"));
      setEndTime(format(e, "HH:mm"));
      setRecurrence(
        (["daily", "weekly", "monthly"] as const).includes(event.recurrence as any)
          ? (event.recurrence as Recurrence)
          : "none"
      );
      setUntil(event.recurrence_until ?? "");
      setNotes(event.notes ?? "");
    } else {
      setTitle("");
      setLabelId(null);
      setDate(format(defaultDate ?? new Date(), "yyyy-MM-dd"));
      const start = defaultStartTime ?? "09:00";
      setStartTime(start);
      setEndTime(addMinutes(start, 60));
      setRecurrence("none");
      setUntil("");
      setNotes("");
    }
    setCreatingLabel(false);
    setNewLabelName("");
    // Crear = asistente pregunta por pregunta; editar = arranca en el resumen
    setStep(event ? "summary" : "title");
  }, [open, event, defaultDate, defaultStartTime]);

  // Etiquetas del profesional
  useEffect(() => {
    if (!open || !businessId) return;
    let cancelled = false;
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || cancelled) return;
      const { data } = await (supabase as any)
        .from("personal_event_labels")
        .select("id, name, color")
        .eq("business_id", businessId)
        .eq("professional_user_id", user.id)
        .order("name");
      if (!cancelled) setCustomLabels((data as PersonalEventLabel[]) || []);
    })();
    return () => {
      cancelled = true;
    };
  }, [open, businessId]);

  const handleCreateLabel = async () => {
    const name = newLabelName.trim();
    if (!name) {
      toast({ title: "Poné un nombre", description: "Ej: Gimnasio, Facultad, Terapia propia." });
      return;
    }
    if (!businessId) return;
    setSavingLabel(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Sesión no válida");
      const { data, error } = await (supabase as any)
        .from("personal_event_labels")
        .insert({
          business_id: businessId,
          professional_user_id: user.id,
          name,
          color: newLabelColor,
        })
        .select("id, name, color")
        .single();
      if (error) {
        if (error.code === "23505") {
          toast({ title: "Ya existe", description: "Ya tenés una etiqueta con ese nombre.", variant: "destructive" });
          return;
        }
        if (error.code === "42P01") {
          toast({
            title: "Falta un paso en la base",
            description: "Corré la migración de etiquetas (SQL) y probá de nuevo.",
            variant: "destructive",
          });
          return;
        }
        throw error;
      }
      setCustomLabels((prev) => [...prev, data].sort((a, b) => a.name.localeCompare(b.name)));
      setLabelId(data.id);
      setCreatingLabel(false);
      setNewLabelName("");
      toast({ title: `Etiqueta "${name}" creada` });
    } catch (e: any) {
      console.error(e);
      toast({ title: "Error", description: e?.message ?? "No se pudo crear la etiqueta", variant: "destructive" });
    } finally {
      setSavingLabel(false);
    }
  };

  const handleDeleteLabel = async () => {
    if (!labelToDelete) return;
    try {
      const { error } = await (supabase as any)
        .from("personal_event_labels")
        .delete()
        .eq("id", labelToDelete.id);
      if (error) throw error;
      setCustomLabels((prev) => prev.filter((l) => l.id !== labelToDelete.id));
      if (labelId === labelToDelete.id) setLabelId(null);
      toast({ title: "Etiqueta eliminada", description: "Los eventos que la usaban quedan sin etiqueta." });
      onSaved();
    } catch (e) {
      console.error(e);
      toast({ title: "Error", description: "No se pudo eliminar la etiqueta", variant: "destructive" });
    } finally {
      setLabelToDelete(null);
    }
  };

  const handleSave = async () => {
    if (!businessId) return;
    if (!title.trim()) {
      toast({ title: "Falta el título", description: "Poné un nombre al evento (ej: Gimnasio).", variant: "destructive" });
      return;
    }
    if (!date || !startTime || !endTime || startTime >= endTime) {
      toast({ title: "Horario inválido", description: "La hora de fin debe ser posterior a la de inicio.", variant: "destructive" });
      return;
    }

    setSaving(true);
    try {
      const payload = {
        title: title.trim(),
        category: "personal", // columna legada; el color vive en la etiqueta
        label_id: labelId,
        notes: notes.trim() || null,
        start_at: new Date(`${date}T${startTime}:00`).toISOString(),
        end_at: new Date(`${date}T${endTime}:00`).toISOString(),
        recurrence,
        recurrence_until: recurrence !== "none" && until ? until : null,
      };

      if (isEdit && event) {
        const { error } = await (supabase as any)
          .from("personal_events")
          .update(payload)
          .eq("id", event.id);
        if (error) throw error;
        toast({ title: "Evento actualizado" });
      } else {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error("Sesión no válida");
        const { error } = await (supabase as any).from("personal_events").insert({
          ...payload,
          business_id: businessId,
          professional_user_id: user.id,
        });
        if (error) throw error;
        toast({ title: "Agendado", description: "Ese horario ya no se puede reservar online." });
      }
      onOpenChange(false);
      onSaved();
    } catch (e: any) {
      console.error(e);
      toast({ title: "Error", description: e?.message ?? "No se pudo guardar el evento", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!event) return;
    setDeleting(true);
    try {
      const { error } = await (supabase as any)
        .from("personal_events")
        .delete()
        .eq("id", event.id);
      if (error) throw error;
      toast({ title: "Evento eliminado", description: "El horario vuelve a estar disponible." });
      setConfirmDelete(false);
      onOpenChange(false);
      onSaved();
    } catch (e) {
      console.error(e);
      toast({ title: "Error", description: "No se pudo eliminar el evento", variant: "destructive" });
    } finally {
      setDeleting(false);
    }
  };

  const selectedColor = customLabels.find((l) => l.id === labelId)?.color ?? NEUTRAL;
  const durationMin =
    startTime && endTime && startTime < endTime
      ? toMin(endTime) - toMin(startTime)
      : 0;

  const titleText = isEdit ? "Evento personal" : "Nuevo evento personal";

  // ── Asistente: navegación entre pasos ──
  const stepIndex = WIZ_ORDER.indexOf(step);

  const goNext = () => {
    if (step === "title" && !title.trim()) {
      toast({ title: "Contame qué tenés", description: "Ej: Gimnasio, Pediatra, Almuerzo..." });
      return;
    }
    if (step === "time" && (!startTime || !endTime || startTime >= endTime)) {
      toast({ title: "Horario inválido", description: "La hora de fin debe ser posterior a la de inicio.", variant: "destructive" });
      return;
    }
    const next = WIZ_ORDER[Math.min(stepIndex + 1, WIZ_ORDER.length - 1)];
    setStep(next);
  };

  const goBack = () => {
    if (stepIndex > 0) setStep(WIZ_ORDER[stepIndex - 1]);
  };

  const fmtDur =
    durationMin > 0
      ? durationMin >= 60
        ? `${Math.floor(durationMin / 60)} h${durationMin % 60 ? ` ${durationMin % 60}` : ""}`
        : `${durationMin} min`
      : "";

  /** Fila del resumen: tocarla salta directo a ese paso. */
  const SummaryRow = ({ label, value, target, color }: { label: string; value: string; target: WizStep; color?: string }) => (
    <button
      type="button"
      onClick={() => setStep(target)}
      className="w-full flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-3.5 text-left transition-colors hover:border-primary/40 min-h-[52px]"
    >
      <span className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground w-20 shrink-0">
        {label}
      </span>
      {color && <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: color }} />}
      <span className="flex-1 text-sm font-semibold truncate capitalize">{value}</span>
      <span className="text-xs text-muted-foreground shrink-0">Cambiar</span>
    </button>
  );

  // ── Paso: ¿Qué tenés? ──
  const stepTitle = (
    <div className="space-y-3">
      <Input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") goNext();
        }}
        placeholder="Ej: Gimnasio, Pediatra, Almuerzo..."
        maxLength={80}
        autoFocus={!isMobile}
        className="h-12 text-[16px] font-medium rounded-xl"
      />
      <div className="flex flex-wrap gap-2">
        {TITLE_EXAMPLES.map((ex) => (
          <button
            key={ex}
            type="button"
            onClick={() => {
              setTitle(ex);
              setStep("when");
            }}
            className="rounded-full border border-dashed border-border px-3.5 py-2 text-sm text-muted-foreground transition-colors hover:text-foreground hover:border-foreground/30 min-h-[40px]"
          >
            {ex}
          </button>
        ))}
      </div>
    </div>
  );

  // ── Paso: ¿Qué día? ──
  const stepWhen = (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2">
        {[
          { label: "Hoy", d: new Date() },
          { label: "Mañana", d: addDays(new Date(), 1) },
        ].map(({ label, d }) => {
          const v = format(d, "yyyy-MM-dd");
          return (
            <button
              key={label}
              type="button"
              onClick={() => {
                setDate(v);
                setStep("time");
              }}
              className={cn(
                "rounded-xl border-2 py-4 text-[15px] font-bold transition-all",
                date === v
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border bg-card text-muted-foreground hover:border-primary/40"
              )}
            >
              {label}
              <span className="block text-[11px] font-normal capitalize mt-0.5">
                {format(d, "EEE d/M", { locale: es })}
              </span>
            </button>
          );
        })}
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs text-muted-foreground">U otro día:</Label>
        <Input
          type="date"
          value={date}
          onChange={(e) => e.target.value && setDate(e.target.value)}
          className="h-12 rounded-xl text-[15px]"
          aria-label="Fecha"
        />
      </div>
    </div>
  );

  // ── Paso: ¿A qué hora? (hora + duración juntas: van de la mano) ──
  const stepTime = (
    <div className="space-y-4 min-w-0">
      <div className="space-y-1">
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">
            Empieza{" "}
            <span className="font-bold text-foreground tabular-nums text-base">{startTime}</span>
          </span>
          <FineTune
            onDelta={(d) => {
              // Mover el inicio conserva la duración (como Google)
              const dur = Math.max(toMin(endTime) - toMin(startTime), 15);
              const ns = addMinutes(startTime, d);
              setStartTime(ns);
              setEndTime(addMinutes(ns, dur));
            }}
          />
        </div>
        <div className="w-full min-w-0 overflow-hidden">
          <TimeRail
            value={startTime}
            onChange={(t) => {
              const dur = Math.max(toMin(endTime) - toMin(startTime), 15);
              setStartTime(t);
              setEndTime(addMinutes(t, dur));
            }}
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">
            Termina{" "}
            <span className="font-bold text-foreground tabular-nums text-base">{endTime}</span>
          </span>
          <FineTune
            onDelta={(d) => {
              const ne = addMinutes(endTime, d);
              if (toMin(ne) > toMin(startTime)) setEndTime(ne);
            }}
          />
        </div>
        <div className="grid grid-cols-3 gap-2">
          {DURATIONS.map((d) => (
            <button
              key={d.min}
              type="button"
              onClick={() => setEndTime(addMinutes(startTime, d.min))}
              className={cn(
                "rounded-xl py-3 text-sm font-semibold transition-all",
                durationMin === d.min
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "bg-muted/50 text-muted-foreground hover:text-foreground"
              )}
            >
              {d.label}
            </button>
          ))}
        </div>
      </div>

      {/* Resumen vivo */}
      <p className="text-[13px] text-muted-foreground capitalize">
        {format(new Date(`${date}T12:00:00`), "EEEE d 'de' MMMM", { locale: es })}
        <span className="normal-case">
          {" "}· {startTime} → {endTime}
          {fmtDur && ` (${fmtDur})`}
        </span>
      </p>
    </div>
  );

  // ── Paso: ¿Se repite? ──
  const stepRepeat = (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2">
        {RECURRENCES.map((r) => (
          <button
            key={r.id}
            type="button"
            onClick={() => {
              setRecurrence(r.id);
              if (r.id === "none") setStep("label");
            }}
            className={cn(
              "rounded-xl border-2 py-4 text-[15px] font-bold transition-all",
              recurrence === r.id
                ? "border-primary bg-primary/10 text-primary"
                : "border-border bg-card text-muted-foreground hover:border-primary/40"
            )}
          >
            {r.label}
          </button>
        ))}
      </div>
      {recurrence !== "none" && (
        <div className="rounded-xl border border-border/70 bg-muted/20 p-3.5 space-y-2.5">
          <p className="text-sm text-muted-foreground">
            {recurrence === "daily" && "Se repite todos los días a esta hora."}
            {recurrence === "weekly" &&
              `Se repite cada ${format(new Date(`${date}T12:00:00`), "EEEE", { locale: es })} a esta hora.`}
            {recurrence === "monthly" &&
              `Se repite el ${format(new Date(`${date}T12:00:00`), "d")} de cada mes a esta hora.`}
          </p>
          <div className="flex items-center gap-2">
            <Label htmlFor="pe-until" className="text-xs text-muted-foreground shrink-0">
              Hasta el (opcional)
            </Label>
            <Input
              id="pe-until"
              type="date"
              value={until}
              min={date}
              onChange={(e) => setUntil(e.target.value)}
              className="h-11 rounded-xl"
            />
          </div>
        </div>
      )}
    </div>
  );

  // ── Paso: etiqueta (opcional, 100% del usuario) ──
  const stepLabel = (
    <div className="space-y-2.5">
        <div className="flex flex-wrap gap-1.5">
          <button
            type="button"
            onClick={() => setLabelId(null)}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1.5 text-xs font-medium transition-all",
              labelId === null
                ? "text-white border-transparent shadow-sm"
                : "border-border text-muted-foreground hover:text-foreground hover:border-foreground/30"
            )}
            style={labelId === null ? { backgroundColor: NEUTRAL } : undefined}
          >
            <span
              className="w-2 h-2 rounded-full"
              style={{ backgroundColor: labelId === null ? "rgba(255,255,255,0.9)" : NEUTRAL }}
            />
            Sin etiqueta
          </button>

          {customLabels.map((l) => {
            const selected = labelId === l.id;
            return (
              <span key={l.id} className="inline-flex items-center">
                <button
                  type="button"
                  onClick={() => setLabelId(l.id)}
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1.5 text-xs font-medium transition-all",
                    selected
                      ? "text-white border-transparent shadow-sm rounded-r-none pr-1.5"
                      : "border-border text-muted-foreground hover:text-foreground hover:border-foreground/30"
                  )}
                  style={selected ? { backgroundColor: l.color } : undefined}
                >
                  <span
                    className="w-2 h-2 rounded-full"
                    style={{ backgroundColor: selected ? "rgba(255,255,255,0.9)" : l.color }}
                  />
                  {l.name}
                </button>
                {selected && (
                  <button
                    type="button"
                    onClick={() => setLabelToDelete(l)}
                    className="h-full rounded-r-full px-1.5 py-1.5 text-white/80 hover:text-white"
                    style={{ backgroundColor: l.color }}
                    aria-label={`Eliminar etiqueta ${l.name}`}
                    title="Eliminar esta etiqueta"
                  >
                    <X className="h-3 w-3" />
                  </button>
                )}
              </span>
            );
          })}

          <button
            type="button"
            onClick={() => setCreatingLabel((v) => !v)}
            className={cn(
              "inline-flex items-center gap-1 rounded-full border border-dashed px-2.5 py-1.5 text-xs font-medium transition-colors",
              creatingLabel
                ? "border-foreground/40 text-foreground"
                : "border-border text-muted-foreground hover:text-foreground hover:border-foreground/30"
            )}
          >
            <Plus className="h-3 w-3" />
            Nueva etiqueta
          </button>
        </div>

        {customLabels.length === 0 && !creatingLabel && (
          <p className="text-[11.5px] text-muted-foreground">
            Creá tus propias etiquetas con el color que quieras — por ejemplo "Gimnasio" en verde o
            "Facultad" en violeta.
          </p>
        )}

        {creatingLabel && (
          <div className="rounded-xl border border-border/70 p-3 space-y-3">
            <Input
              value={newLabelName}
              onChange={(e) => setNewLabelName(e.target.value)}
              placeholder="Nombre de la etiqueta"
              maxLength={40}
            />
            <div className="flex flex-wrap items-center gap-1.5">
              {LABEL_PALETTE.map((hex) => (
                <button
                  key={hex}
                  type="button"
                  onClick={() => setNewLabelColor(hex)}
                  className="flex h-8 w-8 items-center justify-center rounded-full transition-transform hover:scale-110"
                  style={{ backgroundColor: hex }}
                  aria-label={`Color ${hex}`}
                >
                  {newLabelColor.toLowerCase() === hex.toLowerCase() && (
                    <Check className="h-3.5 w-3.5 text-white" />
                  )}
                </button>
              ))}
              {/* Color totalmente libre */}
              <label
                className="relative flex h-8 w-8 cursor-pointer items-center justify-center rounded-full border border-dashed border-border transition-transform hover:scale-110"
                style={
                  !LABEL_PALETTE.some((h) => h.toLowerCase() === newLabelColor.toLowerCase())
                    ? { backgroundColor: newLabelColor, borderStyle: "solid" }
                    : undefined
                }
                title="Elegir otro color"
              >
                <Pipette
                  className={cn(
                    "h-3.5 w-3.5",
                    LABEL_PALETTE.some((h) => h.toLowerCase() === newLabelColor.toLowerCase())
                      ? "text-muted-foreground"
                      : "text-white"
                  )}
                />
                <input
                  type="color"
                  value={newLabelColor}
                  onChange={(e) => setNewLabelColor(e.target.value)}
                  className="absolute inset-0 opacity-0 cursor-pointer"
                  aria-label="Color personalizado"
                />
              </label>
            </div>
            <Button
              type="button"
              size="sm"
              className="w-full text-white"
              style={{ backgroundColor: newLabelColor }}
              onClick={handleCreateLabel}
              disabled={savingLabel}
            >
              {savingLabel ? (
                <Loader2 className="h-3.5 w-3.5 mr-2 animate-spin" />
              ) : (
                <Plus className="h-3.5 w-3.5 mr-2" />
              )}
              Crear "{newLabelName.trim() || "etiqueta"}" y usarla
            </Button>
          </div>
        )}
      </div>
  );

  // ── Paso: resumen final (cada fila salta a su paso) ──
  const recurrenceLabel = RECURRENCES.find((r) => r.id === recurrence)?.label ?? "Una vez";
  const selectedLabelName = customLabels.find((l) => l.id === labelId)?.name ?? "Sin etiqueta";
  const stepSummary = (
    <div className="space-y-2.5">
      <SummaryRow label="Qué" value={title || "—"} target="title" />
      <SummaryRow
        label="Día"
        value={format(new Date(`${date}T12:00:00`), "EEEE d 'de' MMMM", { locale: es })}
        target="when"
      />
      <SummaryRow
        label="Hora"
        value={`${startTime} → ${endTime}${fmtDur ? ` (${fmtDur})` : ""}`}
        target="time"
      />
      <SummaryRow
        label="Repite"
        value={recurrenceLabel + (recurrence !== "none" && until ? ` · hasta ${format(new Date(`${until}T12:00:00`), "d/M")}` : "")}
        target="repeat"
      />
      <SummaryRow label="Etiqueta" value={selectedLabelName} target="label" color={selectedColor} />
      <Textarea
        rows={2}
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        placeholder="Notas (opcional)"
        className="rounded-xl"
      />
    </div>
  );

  const STEP_BODIES: Record<WizStep, JSX.Element> = {
    title: stepTitle,
    when: stepWhen,
    time: stepTime,
    repeat: stepRepeat,
    label: stepLabel,
    summary: stepSummary,
  };

  // Encabezado del asistente: pregunta + puntitos de progreso
  const wizardHeader = (
    <div className="flex items-center gap-2 pt-1 pb-2">
      {stepIndex > 0 && (
        <button
          type="button"
          onClick={goBack}
          className="h-9 w-9 -ml-2 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground shrink-0"
          aria-label="Paso anterior"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
      )}
      <h3 className="text-lg font-bold flex-1 truncate">{WIZ_TITLES[step]}</h3>
      <div className="flex items-center gap-1 shrink-0" aria-label={`Paso ${stepIndex + 1} de ${WIZ_ORDER.length}`}>
        {WIZ_ORDER.map((s, i) => (
          <span
            key={s}
            className={cn(
              "h-1.5 rounded-full transition-all",
              i <= stepIndex ? "w-4 bg-primary" : "w-2 bg-muted"
            )}
          />
        ))}
      </div>
    </div>
  );

  const formBody = (
    <div className="min-w-0 max-w-full overflow-x-hidden">
      {wizardHeader}
      {STEP_BODIES[step]}
    </div>
  );

  const saveButton =
    step === "summary" ? (
      <Button
        type="button"
        onClick={handleSave}
        disabled={saving || deleting}
        className={cn(isMobile ? "flex-1 h-12 text-[15px] rounded-xl" : "min-w-[160px]")}
      >
        {saving ? (
          <>
            <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Guardando...
          </>
        ) : isEdit ? (
          "Guardar cambios"
        ) : (
          "Agendar en mi vida"
        )}
      </Button>
    ) : (
      <Button
        type="button"
        onClick={goNext}
        disabled={saving || deleting}
        className={cn(isMobile ? "flex-1 h-12 text-[15px] rounded-xl" : "min-w-[160px]")}
      >
        Continuar
      </Button>
    );

  const deleteButton = isEdit && step === "summary" ? (
    <Button
      type="button"
      variant="ghost"
      className={cn(
        "text-destructive hover:text-destructive",
        isMobile ? "h-12 w-12 rounded-xl shrink-0 px-0" : "sm:mr-auto"
      )}
      onClick={() => setConfirmDelete(true)}
      disabled={saving || deleting}
      aria-label="Eliminar evento"
    >
      <Trash2 className="h-4 w-4" />
      {!isMobile && <span className="ml-2">Eliminar</span>}
    </Button>
  ) : null;

  return (
    <>
      {isMobile ? (
        // ── Mobile: bottom sheet con scroll interno y guardar fijo abajo ──
        <Drawer open={open} onOpenChange={onOpenChange}>
          <DrawerContent className="max-h-[94dvh]">
            <DrawerHeader className="text-left pb-2">
              <DrawerTitle className="flex items-center gap-2">
                <span
                  className="h-3 w-3 rounded-full shrink-0 transition-colors"
                  style={{ backgroundColor: selectedColor }}
                  aria-hidden
                />
                {titleText}
              </DrawerTitle>
              <DrawerDescription className="flex items-center gap-1.5">
                <Lock className="h-3.5 w-3.5 shrink-0" />
                Solo lo ve tu equipo. Nadie puede reservar en ese horario.
              </DrawerDescription>
            </DrawerHeader>

            <div className="flex-1 overflow-y-auto overflow-x-hidden overscroll-contain px-4 pb-4 min-w-0">
              {formBody}
            </div>

            <div
              className="shrink-0 border-t bg-background px-4 pt-3 flex items-center gap-2"
              style={{ paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 0.75rem)" }}
            >
              {deleteButton}
              {saveButton}
            </div>
          </DrawerContent>
        </Drawer>
      ) : (
        // ── Desktop: diálogo centrado ──
        <Dialog open={open} onOpenChange={onOpenChange}>
          <DialogContent className="sm:max-w-md max-h-[92dvh] overflow-y-auto overflow-x-hidden">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <span
                  className="h-3 w-3 rounded-full shrink-0 transition-colors"
                  style={{ backgroundColor: selectedColor }}
                  aria-hidden
                />
                {titleText}
              </DialogTitle>
              <DialogDescription className="flex items-center gap-1.5">
                <Lock className="h-3.5 w-3.5" />
                Solo lo ve tu equipo. Nadie puede reservar en ese horario.
              </DialogDescription>
            </DialogHeader>

            {formBody}

            <DialogFooter className="gap-2 sm:gap-0">
              {deleteButton}
              {saveButton}
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* Confirmación de borrado del evento */}
      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar este evento?</AlertDialogTitle>
            <AlertDialogDescription>
              {event?.recurrence !== "none"
                ? "Se elimina la serie completa (todas sus repeticiones). El horario vuelve a quedar reservable."
                : "El horario vuelve a quedar reservable online."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                handleDelete();
              }}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Eliminar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Confirmación de borrado de etiqueta */}
      <AlertDialog open={!!labelToDelete} onOpenChange={(o) => !o && setLabelToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar la etiqueta "{labelToDelete?.name}"?</AlertDialogTitle>
            <AlertDialogDescription>
              Los eventos que la usaban no se borran: quedan sin etiqueta.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                handleDeleteLabel();
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};
