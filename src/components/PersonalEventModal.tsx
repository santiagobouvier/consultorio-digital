// Modal de evento personal: la agenda de TODA la vida del profesional.
// Etiquetas 100% libres (el usuario crea nombre + color; no hay presets),
// atajos de duración, repetición diaria/semanal y ejemplos que solo
// sugieren (nunca imponen).
import { useEffect, useState } from "react";
import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Loader2, Trash2, Lock, Plus, Check, X, Pipette } from "lucide-react";
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
  onSaved: () => void;
}

// Ejemplos que RELLENAN el título (editable). No son etiquetas ni presets.
const TITLE_EXAMPLES = ["Gimnasio", "Almuerzo", "Estudio", "Familia", "Trámite", "Descanso"];

const DURATIONS = [
  { label: "30 min", min: 30 },
  { label: "1 h", min: 60 },
  { label: "1½ h", min: 90 },
  { label: "2 h", min: 120 },
];

const RECURRENCES: { id: "none" | "daily" | "weekly"; label: string }[] = [
  { id: "none", label: "Una vez" },
  { id: "daily", label: "Todos los días" },
  { id: "weekly", label: "Cada semana" },
];

const NEUTRAL = "#64748b";

const addMinutes = (time: string, min: number) => {
  const [h, m] = time.split(":").map(Number);
  const total = Math.min(h * 60 + m + min, 23 * 60 + 59);
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
};

export const PersonalEventModal = ({
  open,
  onOpenChange,
  businessId,
  event,
  defaultDate,
  onSaved,
}: PersonalEventModalProps) => {
  const isEdit = !!event;

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
  const [recurrence, setRecurrence] = useState<"none" | "daily" | "weekly">("none");
  const [until, setUntil] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

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
      setRecurrence(event.recurrence === "daily" || event.recurrence === "weekly" ? event.recurrence : "none");
      setUntil(event.recurrence_until ?? "");
      setNotes(event.notes ?? "");
    } else {
      setTitle("");
      setLabelId(null);
      setDate(format(defaultDate ?? new Date(), "yyyy-MM-dd"));
      setStartTime("09:00");
      setEndTime("10:00");
      setRecurrence("none");
      setUntil("");
      setNotes("");
    }
    setCreatingLabel(false);
    setNewLabelName("");
  }, [open, event, defaultDate]);

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
      ? (Number(endTime.slice(0, 2)) * 60 + Number(endTime.slice(3))) -
        (Number(startTime.slice(0, 2)) * 60 + Number(startTime.slice(3)))
      : 0;

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-md max-h-[92dvh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <span
                className="h-3 w-3 rounded-full shrink-0 transition-colors"
                style={{ backgroundColor: selectedColor }}
                aria-hidden
              />
              {isEdit ? "Evento personal" : "Nuevo evento personal"}
            </DialogTitle>
            <DialogDescription className="flex items-center gap-1.5">
              <Lock className="h-3.5 w-3.5" />
              Solo lo ve tu equipo. Nadie puede reservar en ese horario.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-5">
            {/* Título + ejemplos que solo sugieren */}
            <div className="space-y-2">
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="¿Qué tenés? Ej: Gimnasio, Pediatra..."
                maxLength={80}
                autoFocus
                className="h-11 text-[15px] font-medium"
              />
              {!isEdit && !title && (
                <div className="flex flex-wrap gap-1.5">
                  {TITLE_EXAMPLES.map((ex) => (
                    <button
                      key={ex}
                      type="button"
                      onClick={() => setTitle(ex)}
                      className="rounded-full border border-dashed border-border px-2.5 py-1 text-xs text-muted-foreground transition-colors hover:text-foreground hover:border-foreground/30"
                    >
                      {ex}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Cuándo */}
            <div className="space-y-2.5">
              <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Cuándo
              </Label>
              <div className="grid grid-cols-3 gap-2.5">
                <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="col-span-3 sm:col-span-1" aria-label="Fecha" />
                <Input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} className="col-span-3 sm:col-span-1" aria-label="Desde" />
                <Input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} className="col-span-3 sm:col-span-1" aria-label="Hasta" />
              </div>
              <div className="flex flex-wrap items-center gap-1.5">
                {DURATIONS.map((d) => (
                  <button
                    key={d.min}
                    type="button"
                    onClick={() => setEndTime(addMinutes(startTime, d.min))}
                    className={cn(
                      "rounded-full px-2.5 py-1 text-xs font-medium transition-colors",
                      durationMin === d.min
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted/60 text-muted-foreground hover:text-foreground"
                    )}
                  >
                    {d.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Repetición */}
            <div className="space-y-2.5">
              <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Repetición
              </Label>
              <div className="flex rounded-full bg-muted/50 p-0.5">
                {RECURRENCES.map((r) => (
                  <button
                    key={r.id}
                    type="button"
                    onClick={() => setRecurrence(r.id)}
                    className={cn(
                      "flex-1 rounded-full py-1.5 text-[12.5px] font-semibold transition-all",
                      recurrence === r.id
                        ? "bg-background shadow-sm"
                        : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    {r.label}
                  </button>
                ))}
              </div>
              {recurrence !== "none" && (
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
                    className="h-9"
                  />
                </div>
              )}
            </div>

            {/* Etiqueta: 100% del usuario */}
            <div className="space-y-2.5">
              <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Etiqueta y color
              </Label>
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
                  Creá tus propias etiquetas con el color que quieras — por ejemplo "Gimnasio" en
                  verde o "Facultad" en violeta.
                </p>
              )}

              {creatingLabel && (
                <div className="rounded-xl border border-border/70 p-3 space-y-3">
                  <Input
                    value={newLabelName}
                    onChange={(e) => setNewLabelName(e.target.value)}
                    placeholder="Nombre de la etiqueta"
                    maxLength={40}
                    autoFocus
                  />
                  <div className="flex flex-wrap items-center gap-1.5">
                    {LABEL_PALETTE.map((hex) => (
                      <button
                        key={hex}
                        type="button"
                        onClick={() => setNewLabelColor(hex)}
                        className="flex h-7 w-7 items-center justify-center rounded-full transition-transform hover:scale-110"
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
                      className="relative flex h-7 w-7 cursor-pointer items-center justify-center rounded-full border border-dashed border-border transition-transform hover:scale-110"
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

            {/* Notas */}
            <Textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Notas (opcional)"
            />
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            {isEdit && (
              <Button
                type="button"
                variant="ghost"
                className="text-destructive hover:text-destructive sm:mr-auto"
                onClick={() => setConfirmDelete(true)}
                disabled={saving || deleting}
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Eliminar
              </Button>
            )}
            <Button type="button" onClick={handleSave} disabled={saving || deleting} className="min-w-[160px]">
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
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
