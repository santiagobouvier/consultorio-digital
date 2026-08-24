// Editor de nota clínica: EL momento más importante del sistema.
// - Grande y legible (texto 16px, botones altos): pensado también para
//   personas que no ven bien o no son tecnológicas.
// - Plantillas propias del profesional (su estructura, un toque).
// - Autosave local: si se cierra sin querer, el borrador se recupera.
// - Responsive: bottom sheet en el celular, diálogo en escritorio.
import { useEffect, useMemo, useRef, useState } from "react";
import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { useIsMobile } from "@/hooks/use-mobile";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
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
import {
  Loader2, StickyNote, LayoutTemplate, Plus, X, Check, History, Sparkles,
} from "lucide-react";
import { cn } from "@/lib/utils";

export interface ExistingNote {
  id: string;
  content: string;
  status: "draft" | "finalized";
  note_date: string;
}

interface NoteTemplate {
  id: string;
  name: string;
  content: string;
}

interface SessionNoteSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  businessId: string;
  patientId: string;
  /** Sesión a la que pertenece la nota; null = nota general del paciente. */
  appointmentId: string | null;
  /** Ej: "lunes 25 de agosto · 10:00". */
  sessionLabel?: string | null;
  /** Nota existente para editar; null = crear. */
  note?: ExistingNote | null;
  /** Fecha de la nota al crear (yyyy-MM-dd). */
  defaultDate?: string;
  onSaved: () => void;
}

// Plantilla sugerida SOLO como ejemplo inicial (el profesional crea las suyas)
const EXAMPLE_TEMPLATE = "Motivo de la sesión:\n\nTrabajo realizado:\n\nTarea para la próxima:\n\nObservaciones:";

export const SessionNoteSheet = ({
  open,
  onOpenChange,
  businessId,
  patientId,
  appointmentId,
  sessionLabel,
  note,
  defaultDate,
  onSaved,
}: SessionNoteSheetProps) => {
  const { user } = useAuth();
  const isMobile = useIsMobile();
  const isEdit = !!note;

  const [content, setContent] = useState("");
  const [status, setStatus] = useState<"draft" | "finalized">("draft");
  const [saving, setSaving] = useState(false);
  const [templates, setTemplates] = useState<NoteTemplate[]>([]);
  const [savingTemplate, setSavingTemplate] = useState(false);
  const [creatingTemplate, setCreatingTemplate] = useState(false);
  const [templateName, setTemplateName] = useState("");
  const [templateToDelete, setTemplateToDelete] = useState<NoteTemplate | null>(null);
  const [recoveredDraft, setRecoveredDraft] = useState<string | null>(null);
  const draftTimer = useRef<number | null>(null);

  // Clave del borrador local: por nota (edición) o por destino (creación)
  const draftKey = useMemo(
    () =>
      `note-draft-${note?.id ?? `new-${patientId}-${appointmentId ?? "general"}`}`,
    [note?.id, patientId, appointmentId]
  );

  // Prefill + recuperación de borrador al abrir
  useEffect(() => {
    if (!open) return;
    const initial = note?.content ?? "";
    setContent(initial);
    setStatus(note?.status ?? "draft");
    setCreatingTemplate(false);
    setTemplateName("");
    try {
      const draft = localStorage.getItem(draftKey);
      if (draft && draft.trim() && draft !== initial) {
        setRecoveredDraft(draft);
      } else {
        setRecoveredDraft(null);
      }
    } catch {
      setRecoveredDraft(null);
    }
  }, [open, note, draftKey]);

  // Autosave local con debounce: la nota NUNCA se pierde
  useEffect(() => {
    if (!open) return;
    if (draftTimer.current) window.clearTimeout(draftTimer.current);
    draftTimer.current = window.setTimeout(() => {
      try {
        if (content.trim()) localStorage.setItem(draftKey, content);
      } catch { /* sin espacio: seguimos sin autosave */ }
    }, 500);
    return () => {
      if (draftTimer.current) window.clearTimeout(draftTimer.current);
    };
  }, [content, open, draftKey]);

  const clearDraft = () => {
    try {
      localStorage.removeItem(draftKey);
    } catch { /* ignore */ }
  };

  // Plantillas del profesional
  useEffect(() => {
    if (!open || !user) return;
    let cancelled = false;
    (async () => {
      const { data } = await (supabase as any)
        .from("note_templates")
        .select("id, name, content")
        .eq("business_id", businessId)
        .eq("professional_user_id", user.id)
        .order("name");
      if (!cancelled) setTemplates((data as NoteTemplate[]) || []);
    })();
    return () => {
      cancelled = true;
    };
  }, [open, user, businessId]);

  const insertTemplate = (tpl: string) => {
    setContent((prev) => (prev.trim() ? `${prev.trimEnd()}\n\n${tpl}` : tpl));
  };

  const handleSaveTemplate = async () => {
    const name = templateName.trim();
    if (!name) {
      toast({ title: "Poné un nombre", description: "Ej: Sesión estándar, Primera consulta." });
      return;
    }
    if (!content.trim()) {
      toast({ title: "Escribí la estructura primero", description: "Lo que esté escrito se guarda como plantilla." });
      return;
    }
    if (!user) return;
    setSavingTemplate(true);
    try {
      const { data, error } = await (supabase as any)
        .from("note_templates")
        .insert({
          business_id: businessId,
          professional_user_id: user.id,
          name,
          content: content.trim(),
        })
        .select("id, name, content")
        .single();
      if (error) {
        if (error.code === "23505") {
          toast({ title: "Ya existe", description: "Ya tenés una plantilla con ese nombre.", variant: "destructive" });
          return;
        }
        if (error.code === "42P01") {
          toast({
            title: "Falta un paso en la base",
            description: "Corré la migración de plantillas (SQL) y probá de nuevo.",
            variant: "destructive",
          });
          return;
        }
        throw error;
      }
      setTemplates((prev) => [...prev, data].sort((a, b) => a.name.localeCompare(b.name)));
      setCreatingTemplate(false);
      setTemplateName("");
      toast({ title: `Plantilla "${name}" guardada`, description: "La vas a tener en todas tus notas." });
    } catch (e) {
      console.error(e);
      toast({ title: "Error", description: "No se pudo guardar la plantilla", variant: "destructive" });
    } finally {
      setSavingTemplate(false);
    }
  };

  const handleDeleteTemplate = async () => {
    if (!templateToDelete) return;
    try {
      const { error } = await (supabase as any)
        .from("note_templates")
        .delete()
        .eq("id", templateToDelete.id);
      if (error) throw error;
      setTemplates((prev) => prev.filter((t) => t.id !== templateToDelete.id));
      toast({ title: "Plantilla eliminada" });
    } catch (e) {
      console.error(e);
      toast({ title: "Error", description: "No se pudo eliminar la plantilla", variant: "destructive" });
    } finally {
      setTemplateToDelete(null);
    }
  };

  const handleSave = async () => {
    if (!user || !content.trim()) {
      toast({ title: "Contenido vacío", description: "Escribí algo antes de guardar", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      if (isEdit && note) {
        const { error } = await supabase
          .from("session_notes")
          .update({ content: content.trim(), status })
          .eq("id", note.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("session_notes").insert({
          business_id: businessId,
          patient_id: patientId,
          appointment_id: appointmentId,
          author_user_id: user.id,
          note_date: defaultDate ?? format(new Date(), "yyyy-MM-dd"),
          content: content.trim(),
          status,
        });
        if (error) throw error;
      }
      clearDraft();
      toast({ title: status === "finalized" ? "Nota finalizada ✓" : "Nota guardada ✓" });
      onOpenChange(false);
      onSaved();
    } catch (err) {
      console.error("Save note error:", err);
      toast({
        title: "Error al guardar",
        description: "Tu texto sigue guardado como borrador en este dispositivo.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const titleText = isEdit ? "Editar nota" : "Nota de la sesión";
  const subtitleText = sessionLabel
    ? `Sesión del ${sessionLabel}`
    : "Nota general del paciente";

  const body = (
    <div className="space-y-4">
      {/* Borrador recuperado: nada se pierde nunca */}
      {recoveredDraft && (
        <div className="rounded-2xl border border-amber-500/40 bg-amber-500/[0.08] p-3.5 space-y-2.5">
          <p className="text-[14px] font-semibold text-amber-700 dark:text-amber-300 flex items-center gap-2">
            <History className="h-4 w-4 shrink-0" />
            Encontramos un borrador sin guardar
          </p>
          <p className="text-[13px] text-muted-foreground line-clamp-2 whitespace-pre-wrap">
            {recoveredDraft}
          </p>
          <div className="flex gap-2">
            <Button
              size="sm"
              className="h-10 flex-1 rounded-xl text-[14px]"
              onClick={() => {
                setContent(recoveredDraft);
                setRecoveredDraft(null);
              }}
            >
              <Check className="h-4 w-4 mr-1.5" />
              Recuperarlo
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="h-10 flex-1 rounded-xl text-[14px]"
              onClick={() => {
                clearDraft();
                setRecoveredDraft(null);
              }}
            >
              Descartarlo
            </Button>
          </div>
        </div>
      )}

      {/* Plantillas: un toque y la estructura aparece */}
      <div className="space-y-2">
        <div className="flex flex-wrap items-center gap-1.5">
          {templates.map((t) => (
            <span key={t.id} className="inline-flex items-center">
              <button
                type="button"
                onClick={() => insertTemplate(t.content)}
                className="inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/[0.06] text-primary rounded-r-none px-3 py-2 text-[13px] font-semibold transition-colors hover:bg-primary/15 active:scale-[0.97]"
                title="Insertar esta plantilla"
              >
                <LayoutTemplate className="h-3.5 w-3.5" />
                {t.name}
              </button>
              <button
                type="button"
                onClick={() => setTemplateToDelete(t)}
                className="rounded-r-full border border-l-0 border-primary/30 bg-primary/[0.06] px-2 py-2 text-primary/50 hover:text-destructive transition-colors"
                aria-label={`Eliminar plantilla ${t.name}`}
                title="Eliminar plantilla"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </span>
          ))}
          {templates.length === 0 && (
            <button
              type="button"
              onClick={() => insertTemplate(EXAMPLE_TEMPLATE)}
              className="inline-flex items-center gap-1.5 rounded-full border border-dashed border-primary/40 text-primary px-3 py-2 text-[13px] font-semibold transition-colors hover:bg-primary/10"
            >
              <Sparkles className="h-3.5 w-3.5" />
              Probar estructura de ejemplo
            </button>
          )}
          <button
            type="button"
            onClick={() => setCreatingTemplate((v) => !v)}
            className={cn(
              "inline-flex items-center gap-1 rounded-full border border-dashed px-3 py-2 text-[13px] font-medium transition-colors",
              creatingTemplate
                ? "border-foreground/40 text-foreground"
                : "border-border text-muted-foreground hover:text-foreground"
            )}
          >
            <Plus className="h-3.5 w-3.5" />
            Guardar como plantilla
          </button>
        </div>

        {creatingTemplate && (
          <div className="rounded-2xl border border-border/70 p-3 space-y-2.5">
            <p className="text-[12.5px] text-muted-foreground">
              Lo que está escrito abajo se guarda como TU plantilla, para
              arrancar cada nota con un toque.
            </p>
            <div className="flex gap-2">
              <Input
                value={templateName}
                onChange={(e) => setTemplateName(e.target.value)}
                placeholder="Nombre (ej: Sesión estándar)"
                maxLength={60}
                className="h-11 text-[15px]"
              />
              <Button
                type="button"
                onClick={handleSaveTemplate}
                disabled={savingTemplate}
                className="h-11 rounded-xl shrink-0"
              >
                {savingTemplate ? <Loader2 className="h-4 w-4 animate-spin" /> : "Guardar"}
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* La nota: grande, cómoda, legible */}
      <Textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        placeholder="Escribí la nota clínica..."
        className={cn(
          "rounded-2xl resize-y text-[16px] leading-[1.7] p-4",
          isMobile ? "min-h-[38dvh]" : "min-h-[260px]"
        )}
      />
      <p className="text-[12px] text-muted-foreground -mt-2 flex items-center gap-1.5">
        <History className="h-3.5 w-3.5 shrink-0" />
        Se guarda solo mientras escribís: si se cierra, no se pierde.
      </p>

      {/* Estado: dos botones grandes, imposible equivocarse */}
      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => setStatus("draft")}
          className={cn(
            "rounded-2xl border-2 px-3 py-3 text-left transition-all",
            status === "draft"
              ? "border-amber-500/60 bg-amber-500/[0.08]"
              : "border-border/60 hover:border-foreground/25"
          )}
        >
          <p className="text-[14px] font-bold">Borrador</p>
          <p className="text-[12px] text-muted-foreground mt-0.5">La sigo editando</p>
        </button>
        <button
          type="button"
          onClick={() => setStatus("finalized")}
          className={cn(
            "rounded-2xl border-2 px-3 py-3 text-left transition-all",
            status === "finalized"
              ? "border-emerald-500/60 bg-emerald-500/[0.08]"
              : "border-border/60 hover:border-foreground/25"
          )}
        >
          <p className="text-[14px] font-bold">Finalizada</p>
          <p className="text-[12px] text-muted-foreground mt-0.5">Quedó completa</p>
        </button>
      </div>
    </div>
  );

  const saveButton = (
    <Button
      type="button"
      onClick={handleSave}
      disabled={saving || !content.trim()}
      className={cn("rounded-xl text-[15px] font-semibold", isMobile ? "flex-1 h-12" : "h-11 min-w-[180px]")}
    >
      {saving ? (
        <>
          <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Guardando...
        </>
      ) : (
        <>
          <StickyNote className="h-4 w-4 mr-2" />
          Guardar nota
        </>
      )}
    </Button>
  );

  return (
    <>
      {isMobile ? (
        <Drawer open={open} onOpenChange={(o) => !saving && onOpenChange(o)}>
          <DrawerContent className="max-h-[95dvh]">
            <DrawerHeader className="text-left pb-2">
              <DrawerTitle className="text-lg">{titleText}</DrawerTitle>
              <DrawerDescription className="capitalize text-[13px]">{subtitleText}</DrawerDescription>
            </DrawerHeader>
            <div className="flex-1 overflow-y-auto overscroll-contain px-4 pb-4">{body}</div>
            <div
              className="shrink-0 border-t bg-background px-4 pt-3 flex items-center gap-2"
              style={{ paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 0.75rem)" }}
            >
              {saveButton}
            </div>
          </DrawerContent>
        </Drawer>
      ) : (
        <Dialog open={open} onOpenChange={(o) => !saving && onOpenChange(o)}>
          <DialogContent className="max-w-xl max-h-[92dvh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="text-lg">{titleText}</DialogTitle>
              <DialogDescription className="capitalize">{subtitleText}</DialogDescription>
            </DialogHeader>
            {body}
            <div className="flex justify-end gap-2 pt-1">
              <Button
                variant="outline"
                className="h-11 rounded-xl"
                onClick={() => onOpenChange(false)}
                disabled={saving}
              >
                Cancelar
              </Button>
              {saveButton}
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Confirmación de borrado de plantilla */}
      <AlertDialog open={!!templateToDelete} onOpenChange={(o) => !o && setTemplateToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar la plantilla "{templateToDelete?.name}"?</AlertDialogTitle>
            <AlertDialogDescription>
              Las notas ya escritas no se tocan; solo desaparece el atajo.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                handleDeleteTemplate();
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
