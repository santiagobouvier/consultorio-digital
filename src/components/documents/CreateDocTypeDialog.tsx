import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "@/hooks/use-toast";
import { Loader2, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { DOC_TYPE_ICONS, type BusinessDocType } from "@/lib/document-types";

// Tipos de documento propios del consultorio: crear (nombre + ícono) y
// eliminar. Al eliminar, los documentos que usaban ese tipo NO se tocan:
// pasan al tipo "Otro" y los archivos quedan intactos. Eso se avisa
// clarito en la confirmación, con la cantidad exacta.

interface CreateDocTypeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  businessId: string;
  /** Tipos propios ya existentes (para listarlos y poder eliminarlos). */
  customTypes: BusinessDocType[];
  /** Se llama con el tipo recién creado (para seleccionarlo al toque). */
  onCreated: (type: BusinessDocType) => void;
  /** Se llama tras eliminar un tipo (los docs afectados pasaron a "Otro"). */
  onDeleted?: (typeId: string) => void;
}

export const CreateDocTypeDialog = ({
  open,
  onOpenChange,
  businessId,
  customTypes,
  onCreated,
  onDeleted,
}: CreateDocTypeDialogProps) => {
  const [label, setLabel] = useState("");
  const [icon, setIcon] = useState("folder");
  const [saving, setSaving] = useState(false);
  // Eliminación: primero contamos cuántos documentos usan el tipo,
  // después confirmamos con ese número adelante.
  const [deleteTarget, setDeleteTarget] = useState<{ type: BusinessDocType; count: number } | null>(null);
  const [countingId, setCountingId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const save = async () => {
    const clean = label.trim();
    if (!clean) {
      toast({ title: "Poné un nombre", description: "Ej: Radiografía, Receta, Test...", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const { data, error } = await supabase
        .from("business_document_types")
        .insert({ business_id: businessId, label: clean, icon })
        .select("id, label, icon")
        .single();
      if (error) throw error;
      toast({ title: "Tipo creado ✓", description: `"${clean}" ya está disponible en todo el sistema.` });
      setLabel("");
      setIcon("folder");
      onOpenChange(false);
      onCreated(data as BusinessDocType);
    } catch (err) {
      console.error("Error creando tipo de documento:", err);
      toast({ title: "Error", description: "No se pudo crear el tipo", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const requestDelete = async (type: BusinessDocType) => {
    setCountingId(type.id);
    try {
      const { count } = await supabase
        .from("patient_documents")
        .select("id", { count: "exact", head: true })
        .eq("business_id", businessId)
        .eq("document_type", type.id);
      setDeleteTarget({ type, count: count ?? 0 });
    } finally {
      setCountingId(null);
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      // 1. Respaldo: los documentos que usaban este tipo pasan a "Otro".
      //    Los archivos no se tocan — solo cambia la etiqueta.
      if (deleteTarget.count > 0) {
        const { error: reassignError } = await supabase
          .from("patient_documents")
          .update({ document_type: "otro" })
          .eq("business_id", businessId)
          .eq("document_type", deleteTarget.type.id);
        if (reassignError) throw reassignError;
      }
      // 2. Recién ahí se elimina el tipo.
      const { error } = await supabase
        .from("business_document_types")
        .delete()
        .eq("id", deleteTarget.type.id);
      if (error) throw error;

      toast({
        title: "Tipo eliminado",
        description:
          deleteTarget.count > 0
            ? `${deleteTarget.count} ${deleteTarget.count === 1 ? "documento pasó" : "documentos pasaron"} a "Otro". Ningún archivo se borró.`
            : "No había documentos usando este tipo.",
      });
      const deletedId = deleteTarget.type.id;
      setDeleteTarget(null);
      onDeleted?.(deletedId);
    } catch (err) {
      console.error("Error eliminando tipo de documento:", err);
      toast({ title: "Error", description: "No se pudo eliminar el tipo", variant: "destructive" });
    } finally {
      setDeleting(false);
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={(o) => !saving && onOpenChange(o)}>
        <DialogContent className="max-w-md max-h-[90dvh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Tipos de documento</DialogTitle>
            <DialogDescription>
              Creá los tipos que usa tu especialidad — radiografías, recetas, tests...
              Quedan disponibles para todos tus pacientes, en Documentos y en el expediente.
            </DialogDescription>
          </DialogHeader>

          {/* ── Tus tipos: lista con eliminación segura ── */}
          {customTypes.length > 0 && (
            <div className="space-y-2">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                Tus tipos
              </p>
              {customTypes.map((t) => {
                const Icon = DOC_TYPE_ICONS[t.icon] ?? DOC_TYPE_ICONS.folder;
                return (
                  <div
                    key={t.id}
                    className="flex items-center gap-2.5 rounded-xl border border-border/60 bg-muted/30 px-3 py-2"
                  >
                    <span className="shrink-0 h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
                      <Icon className="h-4 w-4 text-primary" />
                    </span>
                    <p className="text-sm font-medium min-w-0 flex-1 truncate">{t.label}</p>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-8 w-8 p-0 rounded-lg text-muted-foreground hover:text-destructive shrink-0"
                      title="Eliminar tipo"
                      disabled={countingId === t.id}
                      onClick={() => void requestDelete(t)}
                    >
                      {countingId === t.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                    </Button>
                  </div>
                );
              })}
            </div>
          )}

          {/* ── Crear uno nuevo ── */}
          <div className="space-y-4 pt-1">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Crear uno nuevo
            </p>
            <div className="space-y-1.5">
              <Label>Nombre *</Label>
              <Input
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                placeholder="Ej: Radiografía"
                maxLength={40}
                className="h-11 rounded-xl"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Ícono</Label>
              <div className="grid grid-cols-5 gap-2">
                {Object.entries(DOC_TYPE_ICONS).map(([key, Icon]) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setIcon(key)}
                    className={cn(
                      "h-11 rounded-xl border flex items-center justify-center transition-colors",
                      icon === key
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border/60 text-muted-foreground hover:border-primary/40 hover:text-foreground"
                    )}
                    aria-label={key}
                  >
                    <Icon className="h-5 w-5" />
                  </button>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter className="flex-col-reverse sm:flex-row gap-2">
            <Button variant="outline" className="rounded-xl w-full sm:w-auto" onClick={() => onOpenChange(false)} disabled={saving}>
              Cerrar
            </Button>
            <Button className="rounded-xl w-full sm:w-auto" onClick={save} disabled={saving || !label.trim()}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : null}
              Crear tipo
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirmación de eliminación, con la cantidad exacta adelante */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && !deleting && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar el tipo "{deleteTarget?.type.label}"?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTarget && deleteTarget.count > 0 ? (
                <>
                  Hay <span className="font-semibold text-foreground">{deleteTarget.count} {deleteTarget.count === 1 ? "documento" : "documentos"}</span> usando
                  este tipo. <span className="font-semibold text-foreground">No se borra ningún archivo</span>: esos
                  documentos pasan al tipo "Otro" y siguen intactos, con su estado de compartido y su sesión.
                  Solo desaparece la etiqueta "{deleteTarget.type.label}".
                </>
              ) : (
                <>Ningún documento usa este tipo. Se elimina de la lista y listo.</>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                void confirmDelete();
              }}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : null}
              {deleting ? "Eliminando..." : "Sí, eliminar tipo"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export default CreateDocTypeDialog;
