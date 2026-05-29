import { useState } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { toast } from "sonner";
import {
  DoorOpen,
  Plus,
  Pencil,
  Archive,
  ArchiveRestore,
  Trash2,
  ChevronDown,
  Video,
  Building2,
} from "lucide-react";
import {
  useBusinessSpaces,
  type BusinessSpace,
  type SpaceInput,
} from "@/hooks/use-business-spaces";

interface Props {
  businessId: string;
}

const EMPTY: SpaceInput = { name: "", type: "physical", capacity: 1, color: null, notes: null };

export function SpacesManagementSection({ businessId }: Props) {
  const {
    sharedSpaces,
    loading,
    createSharedSpace,
    updateSpace,
    archiveSpace,
    restoreSpace,
    deleteSpace,
  } = useBusinessSpaces(businessId);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<BusinessSpace | null>(null);
  const [form, setForm] = useState<SpaceInput>(EMPTY);
  const [saving, setSaving] = useState(false);

  const [confirmAction, setConfirmAction] = useState<
    | { kind: "archive" | "delete"; space: BusinessSpace }
    | null
  >(null);

  const active = sharedSpaces.filter((s) => s.is_active);
  const archived = sharedSpaces.filter((s) => !s.is_active);

  const openCreate = () => {
    setEditing(null);
    setForm(EMPTY);
    setDialogOpen(true);
  };

  const openEdit = (s: BusinessSpace) => {
    setEditing(s);
    setForm({
      name: s.name,
      type: s.type,
      capacity: s.capacity,
      color: s.color,
      notes: s.notes,
    });
    setDialogOpen(true);
  };

  const handleSubmit = async () => {
    if (!form.name.trim()) {
      toast.error("El nombre es obligatorio");
      return;
    }
    setSaving(true);
    try {
      if (editing) {
        await updateSpace(editing.id, form);
        toast.success("Espacio actualizado");
      } else {
        await createSharedSpace(form);
        toast.success("Espacio creado");
      }
      setDialogOpen(false);
    } catch (e: any) {
      toast.error(e.message ?? "Error al guardar");
    } finally {
      setSaving(false);
    }
  };

  const handleConfirm = async () => {
    if (!confirmAction) return;
    try {
      if (confirmAction.kind === "archive") {
        await archiveSpace(confirmAction.space.id);
        toast.success("Espacio archivado");
      } else {
        await deleteSpace(confirmAction.space.id);
        toast.success("Espacio eliminado");
      }
    } catch (e: any) {
      toast.error(e.message ?? "Error");
    } finally {
      setConfirmAction(null);
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div>
            <CardTitle className="text-base flex items-center gap-2">
              <DoorOpen className="h-4 w-4" /> Espacios físicos del consultorio
            </CardTitle>
            <p className="text-xs text-muted-foreground mt-1">
              Espacios compartidos que cualquier profesional del consultorio puede usar al agendar.
            </p>
          </div>
          <Button size="sm" onClick={openCreate} className="gap-2 h-10">
            <Plus className="h-4 w-4" /> Nuevo espacio
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {loading ? (
          <p className="text-sm text-muted-foreground">Cargando espacios...</p>
        ) : active.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No hay espacios compartidos. Creá uno para que el equipo lo pueda asignar a sus citas.
          </p>
        ) : (
          <div className="space-y-2">
            {active.map((s) => (
              <SpaceRow
                key={s.id}
                space={s}
                onEdit={() => openEdit(s)}
                onArchive={() => setConfirmAction({ kind: "archive", space: s })}
              />
            ))}
          </div>
        )}

        {archived.length > 0 && (
          <Collapsible>
            <CollapsibleTrigger asChild>
              <Button variant="ghost" size="sm" className="gap-2 w-full justify-between">
                <span className="text-xs text-muted-foreground">
                  Archivados ({archived.length})
                </span>
                <ChevronDown className="h-4 w-4" />
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="space-y-2 pt-2">
              {archived.map((s) => (
                <SpaceRow
                  key={s.id}
                  space={s}
                  archived
                  onRestore={async () => {
                    try {
                      await restoreSpace(s.id);
                      toast.success("Espacio restaurado");
                    } catch (e: any) {
                      toast.error(e.message ?? "Error");
                    }
                  }}
                  onDelete={() => setConfirmAction({ kind: "delete", space: s })}
                />
              ))}
            </CollapsibleContent>
          </Collapsible>
        )}
      </CardContent>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? "Editar espacio" : "Nuevo espacio compartido"}</DialogTitle>
            <DialogDescription>
              Cualquier profesional del consultorio podrá asignar citas a este espacio.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="sp-name">Nombre</Label>
              <Input
                id="sp-name"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Ej: Consultorio 1, Sala verde"
                className="h-10"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Tipo</Label>
                <Select
                  value={form.type}
                  onValueChange={(v) => setForm({ ...form, type: v as "physical" | "virtual" })}
                >
                  <SelectTrigger className="h-10">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="physical">Presencial</SelectItem>
                    <SelectItem value="virtual">Virtual</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="sp-cap">Capacidad</Label>
                <Input
                  id="sp-cap"
                  type="number"
                  min={1}
                  value={form.capacity}
                  onChange={(e) =>
                    setForm({ ...form, capacity: Math.max(1, parseInt(e.target.value || "1", 10)) })
                  }
                  className="h-10"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="sp-notes">Notas (opcional)</Label>
              <Textarea
                id="sp-notes"
                rows={2}
                value={form.notes ?? ""}
                onChange={(e) => setForm({ ...form, notes: e.target.value || null })}
                className="resize-none"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSubmit} disabled={saving}>
              {saving ? "Guardando..." : editing ? "Guardar" : "Crear"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={!!confirmAction}
        onOpenChange={(open) => !open && setConfirmAction(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirmAction?.kind === "archive" ? "Archivar espacio" : "Eliminar espacio"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirmAction?.kind === "archive" ? (
                <>
                  El espacio <strong>{confirmAction?.space.name}</strong> dejará de aparecer al crear
                  nuevas citas. Las citas existentes mantienen su asignación. Podés restaurarlo cuando
                  quieras.
                </>
              ) : (
                <>
                  Esta acción eliminará <strong>{confirmAction?.space.name}</strong> permanentemente.
                  Solo está permitido eliminar espacios archivados sin citas asociadas.
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirm}>
              {confirmAction?.kind === "archive" ? "Archivar" : "Eliminar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}

interface RowProps {
  space: BusinessSpace;
  archived?: boolean;
  onEdit?: () => void;
  onArchive?: () => void;
  onRestore?: () => void;
  onDelete?: () => void;
}

function SpaceRow({ space, archived, onEdit, onArchive, onRestore, onDelete }: RowProps) {
  const canDelete = archived && space.appointmentCount === 0;
  return (
    <div className="p-4 bg-muted/40 rounded-xl space-y-3 sm:space-y-0 sm:flex sm:items-center sm:justify-between sm:gap-3">
      <div className="flex items-center gap-3 min-w-0">
        <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
          {space.type === "virtual" ? (
            <Video className="h-5 w-5 text-primary" />
          ) : (
            <Building2 className="h-5 w-5 text-primary" />
          )}
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="font-medium text-sm truncate">{space.name}</p>
            {archived && (
              <Badge variant="outline" className="text-[10px]">
                Archivado
              </Badge>
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            {space.type === "virtual" ? "Virtual" : "Presencial"} · Capacidad {space.capacity}
            {space.appointmentCount > 0 && ` · ${space.appointmentCount} citas`}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-2 flex-wrap">
        {!archived && (
          <>
            <Button variant="outline" size="sm" className="h-9 gap-1.5" onClick={onEdit}>
              <Pencil className="h-3.5 w-3.5" /> Editar
            </Button>
            <Button variant="outline" size="sm" className="h-9 gap-1.5" onClick={onArchive}>
              <Archive className="h-3.5 w-3.5" /> Archivar
            </Button>
          </>
        )}
        {archived && (
          <>
            <Button variant="outline" size="sm" className="h-9 gap-1.5" onClick={onRestore}>
              <ArchiveRestore className="h-3.5 w-3.5" /> Restaurar
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="h-9 gap-1.5 text-destructive hover:text-destructive"
              onClick={onDelete}
              disabled={!canDelete}
              title={canDelete ? "" : "Solo se pueden eliminar espacios archivados sin citas"}
            >
              <Trash2 className="h-3.5 w-3.5" /> Eliminar
            </Button>
          </>
        )}
      </div>
    </div>
  );
}