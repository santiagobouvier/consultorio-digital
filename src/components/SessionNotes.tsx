import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
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
import { toast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { FileText, Plus, Pencil, Trash2, Lock, CheckCircle2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { HelpTooltip } from "@/components/HelpTooltip";

interface AppointmentRef {
  id: string;
  start_at: string;
}

interface SessionNote {
  id: string;
  business_id: string;
  patient_id: string;
  appointment_id: string | null;
  author_user_id: string;
  note_date: string;
  content: string;
  status: "draft" | "finalized";
  created_at: string;
  updated_at: string;
}

interface SessionNotesProps {
  patientId: string;
  businessId: string;
  appointments: AppointmentRef[];
}

export const SessionNotes = ({ patientId, businessId, appointments }: SessionNotesProps) => {
  const { user } = useAuth();
  const [notes, setNotes] = useState<SessionNote[]>([]);
  const [loading, setLoading] = useState(true);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState<SessionNote | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Form state
  const [noteDate, setNoteDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [appointmentId, setAppointmentId] = useState<string>("none");
  const [content, setContent] = useState("");
  const [status, setStatus] = useState<"draft" | "finalized">("draft");
  const [saving, setSaving] = useState(false);

  const fetchNotes = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("session_notes")
      .select("*")
      .eq("patient_id", patientId)
      .order("note_date", { ascending: false })
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching session notes:", error);
      toast({ title: "Error", description: "No se pudieron cargar las notas", variant: "destructive" });
    } else {
      setNotes((data || []) as SessionNote[]);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchNotes();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [patientId]);

  const openCreate = () => {
    setEditing(null);
    setNoteDate(format(new Date(), "yyyy-MM-dd"));
    setAppointmentId("none");
    setContent("");
    setStatus("draft");
    setEditorOpen(true);
  };

  const openEdit = (note: SessionNote) => {
    setEditing(note);
    setNoteDate(note.note_date);
    setAppointmentId(note.appointment_id ?? "none");
    setContent(note.content);
    setStatus(note.status);
    setEditorOpen(true);
  };

  const handleSave = async () => {
    if (!user) return;
    if (!content.trim()) {
      toast({ title: "Contenido vacío", description: "Escribí algo antes de guardar", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      if (editing) {
        const { error } = await supabase
          .from("session_notes")
          .update({
            note_date: noteDate,
            appointment_id: appointmentId === "none" ? null : appointmentId,
            content: content.trim(),
            status,
          })
          .eq("id", editing.id);
        if (error) throw error;
        toast({ title: "Nota actualizada" });
      } else {
        const { error } = await supabase.from("session_notes").insert({
          business_id: businessId,
          patient_id: patientId,
          author_user_id: user.id,
          note_date: noteDate,
          appointment_id: appointmentId === "none" ? null : appointmentId,
          content: content.trim(),
          status,
        });
        if (error) throw error;
        toast({ title: "Nota creada" });
      }
      setEditorOpen(false);
      fetchNotes();
    } catch (err) {
      console.error(err);
      toast({ title: "Error", description: "No se pudo guardar la nota", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deletingId) return;
    const { error } = await supabase.from("session_notes").delete().eq("id", deletingId);
    if (error) {
      toast({ title: "Error", description: "No se pudo eliminar", variant: "destructive" });
    } else {
      toast({ title: "Nota eliminada" });
      fetchNotes();
    }
    setDeletingId(null);
  };

  const formatNoteDate = (d: string) => format(new Date(d + "T00:00:00"), "d 'de' MMMM yyyy", { locale: es });
  const formatTimestamp = (d: string) => format(new Date(d), "d MMM yyyy, HH:mm", { locale: es });

  return (
    <Card className="rounded-2xl">
      <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0">
        <div className="flex items-center gap-2">
          <FileText className="h-5 w-5 text-primary" />
          <CardTitle className="text-lg inline-flex items-center gap-1.5">
            Notas de sesión
            <HelpTooltip id="sessionNotes" />
          </CardTitle>
          <Badge variant="outline" className="gap-1 text-xs">
            <Lock className="h-3 w-3" /> Privadas
          </Badge>
        </div>
        <Button size="sm" onClick={openCreate} className="rounded-xl">
          <Plus className="h-4 w-4" /> Nueva nota
        </Button>
      </CardHeader>
      <CardContent className="space-y-3">
        {loading ? (
          <p className="text-sm text-muted-foreground">Cargando notas...</p>
        ) : notes.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <FileText className="h-10 w-10 mx-auto mb-2 opacity-40" />
            <p className="text-sm">Aún no hay notas para este paciente</p>
          </div>
        ) : (
          notes.map((note) => {
            const linkedAppt = appointments.find((a) => a.id === note.appointment_id);
            return (
              <div key={note.id} className="border rounded-xl p-4 bg-card hover:bg-accent/30 transition-colors">
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-medium">{formatNoteDate(note.note_date)}</span>
                    {note.status === "finalized" ? (
                      <Badge className="gap-1 bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-500/20 border-0">
                        <CheckCircle2 className="h-3 w-3" /> Finalizada
                      </Badge>
                    ) : (
                      <Badge variant="secondary" className="gap-1">Borrador</Badge>
                    )}
                    {linkedAppt && (
                      <Badge variant="outline" className="text-xs">
                        Turno: {format(new Date(linkedAppt.start_at), "d MMM HH:mm", { locale: es })}
                      </Badge>
                    )}
                  </div>
                  <div className="flex gap-1">
                    <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => openEdit(note)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8 text-destructive hover:text-destructive"
                      onClick={() => setDeletingId(note.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                <p className="text-sm whitespace-pre-wrap leading-relaxed">{note.content}</p>
                <p className="text-xs text-muted-foreground mt-2">
                  Actualizada: {formatTimestamp(note.updated_at)}
                </p>
              </div>
            );
          })
        )}
      </CardContent>

      {/* Editor */}
      <Dialog open={editorOpen} onOpenChange={setEditorOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? "Editar nota" : "Nueva nota de sesión"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label htmlFor="note-date">Fecha</Label>
                <Input
                  id="note-date"
                  type="date"
                  value={noteDate}
                  onChange={(e) => setNoteDate(e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <Label>Estado</Label>
                <Select value={status} onValueChange={(v) => setStatus(v as "draft" | "finalized")}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="draft">Borrador</SelectItem>
                    <SelectItem value="finalized">Finalizada</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1">
              <Label>Turno asociado (opcional)</Label>
              <Select value={appointmentId} onValueChange={setAppointmentId}>
                <SelectTrigger>
                  <SelectValue placeholder="Sin turno" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Sin turno</SelectItem>
                  {appointments.map((a) => (
                    <SelectItem key={a.id} value={a.id}>
                      {format(new Date(a.start_at), "d MMM yyyy, HH:mm", { locale: es })}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="note-content">Contenido</Label>
              <Textarea
                id="note-content"
                value={content}
                onChange={(e) => setContent(e.target.value)}
                rows={10}
                placeholder="Escribí las observaciones de la sesión..."
                className="resize-y min-h-[200px]"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditorOpen(false)} disabled={saving}>
              Cancelar
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? "Guardando..." : "Guardar nota"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <AlertDialog open={!!deletingId} onOpenChange={(open) => !open && setDeletingId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar nota?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción no se puede deshacer. La nota se borrará permanentemente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
};
