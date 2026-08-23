// Modal de evento personal: "Gimnasio", "Pediatra", "Almuerzo con mamá".
// Vive en la agenda como un bloque gris, bloquea la reserva online y es
// privado del consultorio (los pacientes nunca lo ven).
import { useEffect, useState } from "react";
import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
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
import { Loader2, Trash2, Repeat, Lock } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  PERSONAL_CATEGORIES,
  getPersonalCategory,
  type PersonalEvent,
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
  const [category, setCategory] = useState("personal");
  const [date, setDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("10:00");
  const [weekly, setWeekly] = useState(false);
  const [until, setUntil] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  // Prefill al abrir: datos del evento (editar) o fecha sugerida (crear).
  useEffect(() => {
    if (!open) return;
    if (event) {
      const s = new Date(event.start_at);
      const e = new Date(event.end_at);
      setTitle(event.title);
      setCategory(getPersonalCategory(event.category).id);
      setDate(format(s, "yyyy-MM-dd"));
      setStartTime(format(s, "HH:mm"));
      setEndTime(format(e, "HH:mm"));
      setWeekly(event.recurrence === "weekly");
      setUntil(event.recurrence_until ?? "");
      setNotes(event.notes ?? "");
    } else {
      setTitle("");
      setCategory("personal");
      setDate(format(defaultDate ?? new Date(), "yyyy-MM-dd"));
      setStartTime("09:00");
      setEndTime("10:00");
      setWeekly(false);
      setUntil("");
      setNotes("");
    }
  }, [open, event, defaultDate]);

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
      const startAt = new Date(`${date}T${startTime}:00`).toISOString();
      const endAt = new Date(`${date}T${endTime}:00`).toISOString();
      const payload = {
        title: title.trim(),
        category,
        notes: notes.trim() || null,
        start_at: startAt,
        end_at: endAt,
        recurrence: weekly ? "weekly" : "none",
        recurrence_until: weekly && until ? until : null,
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
        toast({
          title: "Evento agregado",
          description: "Ese horario ya no se puede reservar online.",
        });
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
    } catch (e: any) {
      console.error(e);
      toast({ title: "Error", description: "No se pudo eliminar el evento", variant: "destructive" });
    } finally {
      setDeleting(false);
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{isEdit ? "Evento personal" : "Nuevo evento personal"}</DialogTitle>
            <DialogDescription className="flex items-center gap-1.5">
              <Lock className="h-3.5 w-3.5" />
              Solo lo ve tu equipo. Nadie puede reservar en ese horario.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="pe-title">Título</Label>
              <Input
                id="pe-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Ej: Gimnasio, Pediatra, Almuerzo"
                maxLength={80}
                autoFocus
              />
            </div>

            <div className="space-y-2">
              <Label>Etiqueta</Label>
              <div className="flex flex-wrap gap-1.5">
                {PERSONAL_CATEGORIES.map((cat) => {
                  const selected = category === cat.id;
                  return (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => setCategory(cat.id)}
                      className={cn(
                        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1.5 text-xs font-medium transition-all",
                        selected
                          ? "text-white border-transparent shadow-sm"
                          : "border-border text-muted-foreground hover:text-foreground hover:border-foreground/30"
                      )}
                      style={selected ? { backgroundColor: cat.color } : undefined}
                    >
                      <span
                        className="w-2 h-2 rounded-full"
                        style={{ backgroundColor: selected ? "rgba(255,255,255,0.9)" : cat.color }}
                      />
                      {cat.label}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-2 col-span-3 sm:col-span-1">
                <Label htmlFor="pe-date">Fecha</Label>
                <Input id="pe-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
              </div>
              <div className="space-y-2 col-span-3 sm:col-span-1">
                <Label htmlFor="pe-start">Desde</Label>
                <Input id="pe-start" type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} />
              </div>
              <div className="space-y-2 col-span-3 sm:col-span-1">
                <Label htmlFor="pe-end">Hasta</Label>
                <Input id="pe-end" type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} />
              </div>
            </div>

            <div className="rounded-xl border border-border/70 p-3 space-y-3">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 min-w-0">
                  <Repeat className="h-4 w-4 text-muted-foreground shrink-0" />
                  <div className="min-w-0">
                    <p className="text-sm font-medium">Repetir todas las semanas</p>
                    <p className="text-xs text-muted-foreground">
                      Mismo día y horario, cada semana.
                    </p>
                  </div>
                </div>
                <Switch checked={weekly} onCheckedChange={setWeekly} />
              </div>
              {weekly && (
                <div className="space-y-2">
                  <Label htmlFor="pe-until">Hasta el (opcional)</Label>
                  <Input
                    id="pe-until"
                    type="date"
                    value={until}
                    min={date}
                    onChange={(e) => setUntil(e.target.value)}
                  />
                </div>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="pe-notes">Notas (opcional)</Label>
              <Textarea
                id="pe-notes"
                rows={2}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Algo para acordarte"
              />
            </div>
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
            <Button type="button" onClick={handleSave} disabled={saving || deleting}>
              {saving ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Guardando...
                </>
              ) : isEdit ? (
                "Guardar cambios"
              ) : (
                "Agregar a mi agenda"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar este evento?</AlertDialogTitle>
            <AlertDialogDescription>
              {event?.recurrence === "weekly"
                ? "Se elimina la serie completa (todas las semanas). El horario vuelve a quedar reservable."
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
    </>
  );
};
