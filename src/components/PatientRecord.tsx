import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "@/hooks/use-toast";
import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import {
  FileText, Plus, Pencil, Trash2, Loader2, Paperclip, Upload, Download,
  StickyNote, ClipboardList, Eye, Video, MapPin, CalendarClock, Filter, Maximize2,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";
import { ClinicalStatusBlock } from "@/components/ClinicalStatusBlock";

// EXPEDIENTE del paciente: la historia clínica organizada POR SESIÓN.
// Cada sesión es una entrada de la línea de tiempo con su nota clínica,
// sus documentos anclados y el estado del cobro. Las notas sin sesión
// viven aparte como "Notas generales".

interface RecordAppointment {
  id: string;
  start_at: string;
  end_at: string;
  status: string;
  modality: string | null;
  services: { name: string } | null;
}

interface RecordNote {
  id: string;
  appointment_id: string | null;
  note_date: string;
  content: string;
  status: "draft" | "finalized";
}

interface RecordDocument {
  id: string;
  appointment_id: string | null;
  file_path: string;
  file_name: string;
  file_size: number | null;
  mime_type: string | null;
  document_type: string;
  shared_with_patient?: boolean;
}

interface RecordPayment {
  appointment_id: string | null;
  status: string;
  amount: number;
  due_date: string;
}

interface PatientRecordProps {
  patientId: string;
  businessId: string;
  /** Motivo de consulta (se muestra arriba como contexto clínico). */
  reasonForConsultation?: string | null;
}

type NoteFilter = "all" | "with_note" | "without_note";

const CANCELLED = ["cancelled", "cancelled_by_patient"];
const MAX_FILE_SIZE = 15 * 1024 * 1024;
const ACCEPTED_MIME =
  ".pdf,.doc,.docx,.jpg,.jpeg,.png,.webp,.gif,.heic,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,image/*";

const DOC_TYPE_LABELS: Record<string, string> = {
  consentimiento: "Consentimiento",
  informe: "Informe",
  evaluacion: "Evaluación",
  indicaciones: "Indicaciones / Material",
  recibo: "Recibo",
  otro: "Otro",
};

// Orden fijo de los grupos en el modal de adjuntos
const DOC_TYPE_ORDER = ["informe", "evaluacion", "consentimiento", "indicaciones", "recibo", "otro"];

const formatBytes = (bytes: number | null) => {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

const sessionStatusBadge = (status: string) => {
  switch (status) {
    case "attended":
      return <Badge className="text-[10px] bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30 hover:bg-emerald-500/15">Realizada</Badge>;
    case "no_show":
      return <Badge variant="destructive" className="text-[10px]">Ausente</Badge>;
    case "cancelled":
    case "cancelled_by_patient":
      return <Badge variant="secondary" className="text-[10px] text-muted-foreground">Cancelada</Badge>;
    case "confirmed":
    case "scheduled":
      return <Badge className="text-[10px]">Confirmada</Badge>;
    default:
      return <Badge variant="secondary" className="text-[10px]">Programada</Badge>;
  }
};

export const PatientRecord = ({ patientId, businessId, reasonForConsultation }: PatientRecordProps) => {
  const { user } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [loading, setLoading] = useState(true);
  const [appointments, setAppointments] = useState<RecordAppointment[]>([]);
  const [notes, setNotes] = useState<RecordNote[]>([]);
  const [documents, setDocuments] = useState<RecordDocument[]>([]);
  const [payments, setPayments] = useState<RecordPayment[]>([]);
  const [filter, setFilter] = useState<NoteFilter>("all");

  // ── Editor de nota (por sesión o general) ──
  const [noteEditor, setNoteEditor] = useState<{
    open: boolean;
    noteId: string | null;
    appointmentId: string | null;
    sessionLabel: string | null;
    noteDate: string; // yyyy-MM-dd
  }>({ open: false, noteId: null, appointmentId: null, sessionLabel: null, noteDate: format(new Date(), "yyyy-MM-dd") });
  const [noteContent, setNoteContent] = useState("");
  const [noteStatus, setNoteStatus] = useState<"draft" | "finalized">("draft");
  const [savingNote, setSavingNote] = useState(false);
  const [deletingNoteId, setDeletingNoteId] = useState<string | null>(null);

  // ── Modal de adjuntos de una sesión (agrupados por tipo) ──
  const [detailApt, setDetailApt] = useState<RecordAppointment | null>(null);

  // ── Adjuntar documento a una sesión ──
  const [attachTarget, setAttachTarget] = useState<{ appointmentId: string; label: string } | null>(null);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [attachType, setAttachType] = useState("informe");
  const [attachNotes, setAttachNotes] = useState("");
  const [uploading, setUploading] = useState(false);
  const [busyDocId, setBusyDocId] = useState<string | null>(null);

  const fetchAll = async () => {
    setLoading(true);
    const [aptRes, noteRes, docRes, payRes] = await Promise.all([
      supabase
        .from("appointments")
        .select("id, start_at, end_at, status, modality, services(name)")
        .eq("patient_id", patientId)
        .order("start_at", { ascending: false }),
      supabase
        .from("session_notes")
        .select("id, appointment_id, note_date, content, status")
        .eq("patient_id", patientId)
        .order("note_date", { ascending: false }),
      supabase
        .from("patient_documents")
        .select("*")
        .eq("patient_id", patientId)
        .order("created_at", { ascending: false }),
      supabase
        .from("payments")
        .select("appointment_id, status, amount, due_date")
        .eq("patient_id", patientId)
        .neq("status", "cancelled"),
    ]);
    setAppointments((aptRes.data as any[] as RecordAppointment[]) || []);
    setNotes((noteRes.data as RecordNote[]) || []);
    setDocuments((docRes.data as any[] as RecordDocument[]) || []);
    setPayments((payRes.data as RecordPayment[]) || []);
    setLoading(false);
  };

  useEffect(() => {
    void fetchAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [patientId]);

  // ── Índices por sesión ──
  const notesByAppointment = useMemo(() => {
    const map = new Map<string, RecordNote[]>();
    for (const n of notes) {
      if (!n.appointment_id) continue;
      const list = map.get(n.appointment_id) ?? [];
      list.push(n);
      map.set(n.appointment_id, list);
    }
    return map;
  }, [notes]);

  const docsByAppointment = useMemo(() => {
    const map = new Map<string, RecordDocument[]>();
    for (const d of documents) {
      if (!d.appointment_id) continue;
      const list = map.get(d.appointment_id) ?? [];
      list.push(d);
      map.set(d.appointment_id, list);
    }
    return map;
  }, [documents]);

  const paymentByAppointment = useMemo(() => {
    const map = new Map<string, RecordPayment>();
    for (const p of payments) {
      if (p.appointment_id) map.set(p.appointment_id, p);
    }
    return map;
  }, [payments]);

  const generalNotes = useMemo(() => notes.filter((n) => !n.appointment_id), [notes]);

  const now = Date.now();
  const upcoming = useMemo(
    () =>
      appointments
        .filter((a) => new Date(a.start_at).getTime() > now && !CANCELLED.includes(a.status))
        .sort((a, b) => a.start_at.localeCompare(b.start_at)),
    [appointments, now]
  );
  const pastSessions = useMemo(
    () => appointments.filter((a) => new Date(a.start_at).getTime() <= now),
    [appointments, now]
  );
  const filteredPast = useMemo(() => {
    if (filter === "all") return pastSessions;
    return pastSessions.filter((a) => {
      const has = (notesByAppointment.get(a.id)?.length ?? 0) > 0;
      return filter === "with_note" ? has : !has;
    });
  }, [pastSessions, filter, notesByAppointment]);

  const sinNotaCount = useMemo(
    () =>
      pastSessions.filter(
        (a) => !CANCELLED.includes(a.status) && (notesByAppointment.get(a.id)?.length ?? 0) === 0
      ).length,
    [pastSessions, notesByAppointment]
  );

  // ── Notas ──
  const openNoteEditor = (apt: RecordAppointment | null, existing?: RecordNote) => {
    const sessionLabel = apt
      ? `${format(parseISO(apt.start_at), "EEEE d 'de' MMMM", { locale: es })} · ${format(parseISO(apt.start_at), "HH:mm")}`
      : null;
    setNoteEditor({
      open: true,
      noteId: existing?.id ?? null,
      appointmentId: apt?.id ?? existing?.appointment_id ?? null,
      sessionLabel,
      noteDate: existing?.note_date ?? (apt ? format(parseISO(apt.start_at), "yyyy-MM-dd") : format(new Date(), "yyyy-MM-dd")),
    });
    setNoteContent(existing?.content ?? "");
    setNoteStatus(existing?.status ?? "draft");
  };

  const saveNote = async () => {
    if (!user || !noteContent.trim()) {
      toast({ title: "Contenido vacío", description: "Escribí algo antes de guardar", variant: "destructive" });
      return;
    }
    setSavingNote(true);
    try {
      if (noteEditor.noteId) {
        const { error } = await supabase
          .from("session_notes")
          .update({ content: noteContent.trim(), status: noteStatus })
          .eq("id", noteEditor.noteId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("session_notes").insert({
          business_id: businessId,
          patient_id: patientId,
          appointment_id: noteEditor.appointmentId,
          author_user_id: user.id,
          note_date: noteEditor.noteDate,
          content: noteContent.trim(),
          status: noteStatus,
        });
        if (error) throw error;
      }
      toast({ title: noteStatus === "finalized" ? "Nota finalizada ✓" : "Nota guardada" });
      setNoteEditor((e) => ({ ...e, open: false }));
      await fetchAll();
    } catch (err) {
      console.error("Save note error:", err);
      toast({ title: "Error", description: "No se pudo guardar la nota", variant: "destructive" });
    } finally {
      setSavingNote(false);
    }
  };

  const deleteNote = async () => {
    if (!deletingNoteId) return;
    const { error } = await supabase.from("session_notes").delete().eq("id", deletingNoteId);
    if (error) {
      toast({ title: "Error", description: "No se pudo eliminar la nota", variant: "destructive" });
    } else {
      toast({ title: "Nota eliminada" });
      await fetchAll();
    }
    setDeletingNoteId(null);
  };

  // ── Documentos por sesión ──
  const startAttach = (apt: RecordAppointment) => {
    setAttachTarget({
      appointmentId: apt.id,
      label: format(parseISO(apt.start_at), "d 'de' MMMM", { locale: es }),
    });
    fileInputRef.current?.click();
  };

  const onFileSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) { setAttachTarget(null); return; }
    if (file.size > MAX_FILE_SIZE) {
      toast({ title: "Archivo demasiado grande", description: "El tamaño máximo es 15 MB", variant: "destructive" });
      setAttachTarget(null);
      return;
    }
    setPendingFile(file);
    setAttachType("informe");
    setAttachNotes("");
  };

  const uploadAttachment = async () => {
    if (!pendingFile || !attachTarget || !user) return;
    setUploading(true);
    try {
      const ext = pendingFile.name.includes(".") ? pendingFile.name.split(".").pop() : "";
      const safeBase = pendingFile.name.replace(/\.[^.]+$/, "").replace(/[^a-zA-Z0-9-_]+/g, "_").slice(0, 60) || "documento";
      const filePath = `${businessId}/${patientId}/${Date.now()}_${safeBase}${ext ? "." + ext : ""}`;

      const { error: upErr } = await supabase.storage
        .from("patient-documents")
        .upload(filePath, pendingFile, { contentType: pendingFile.type || "application/octet-stream", upsert: false });
      if (upErr) throw upErr;

      const { error: insErr } = await supabase.from("patient_documents").insert({
        business_id: businessId,
        patient_id: patientId,
        appointment_id: attachTarget.appointmentId,
        uploaded_by: user.id,
        file_path: filePath,
        file_name: pendingFile.name,
        file_size: pendingFile.size,
        mime_type: pendingFile.type || null,
        document_type: attachType,
        notes: attachNotes.trim() || null,
      });
      if (insErr) {
        await supabase.storage.from("patient-documents").remove([filePath]);
        throw insErr;
      }
      toast({ title: "Documento adjuntado a la sesión ✓" });
      setPendingFile(null);
      setAttachTarget(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      await fetchAll();
    } catch (err: any) {
      console.error("Attach error:", err);
      toast({ title: "Error", description: err?.message || "No se pudo adjuntar el documento", variant: "destructive" });
    } finally {
      setUploading(false);
    }
  };

  const viewDocument = async (doc: RecordDocument, download = false) => {
    setBusyDocId(doc.id);
    // Para "Ver" abrimos la pestaña ANTES del await: si no, el bloqueador
    // de pop-ups del navegador la mata (el click ya no cuenta como gesto).
    const win = download ? null : window.open("", "_blank");
    try {
      const { data, error } = await supabase.storage
        .from("patient-documents")
        .createSignedUrl(doc.file_path, 60, download ? { download: doc.file_name } : undefined);
      if (error || !data?.signedUrl) throw error || new Error("Sin URL");
      if (download) {
        // La URL firmada trae Content-Disposition: attachment → descarga directa
        const a = document.createElement("a");
        a.href = data.signedUrl;
        a.download = doc.file_name;
        document.body.appendChild(a);
        a.click();
        a.remove();
      } else if (win) {
        win.location.href = data.signedUrl;
      } else {
        window.open(data.signedUrl, "_blank", "noopener,noreferrer");
      }
    } catch {
      if (win) win.close();
      toast({
        title: "Error",
        description: download ? "No se pudo descargar el documento" : "No se pudo abrir el documento",
        variant: "destructive",
      });
    } finally {
      setBusyDocId(null);
    }
  };

  // ── Bloque de nota dentro de una sesión ──
  const NoteBlock = ({ note, apt }: { note: RecordNote; apt: RecordAppointment }) => (
    <div className="rounded-xl bg-muted/40 border border-border/60 p-3">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-1.5 min-w-0">
          <StickyNote className="h-3.5 w-3.5 text-primary shrink-0" />
          {note.status === "finalized" ? (
            <Badge className="text-[9px] bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30 hover:bg-emerald-500/15">Finalizada</Badge>
          ) : (
            <Badge variant="outline" className="text-[9px] text-amber-600 dark:text-amber-400 border-amber-500/40">Borrador</Badge>
          )}
        </div>
        <div className="flex gap-0.5 shrink-0">
          <Button size="sm" variant="ghost" className="h-7 w-7 p-0 rounded-lg" onClick={() => openNoteEditor(apt, note)}>
            <Pencil className="h-3.5 w-3.5" />
          </Button>
          <Button size="sm" variant="ghost" className="h-7 w-7 p-0 rounded-lg text-muted-foreground hover:text-destructive" onClick={() => setDeletingNoteId(note.id)}>
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
      <p className="text-sm mt-2 whitespace-pre-wrap break-words leading-relaxed">{note.content}</p>
    </div>
  );

  if (loading) {
    return (
      <div className="py-12 flex items-center justify-center text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin mr-2" /> Cargando expediente...
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <input ref={fileInputRef} type="file" accept={ACCEPTED_MIME} className="hidden" onChange={onFileSelected} />

      {/* ── Estado actual: fijo arriba de la cronología, nunca en el portal ── */}
      <ClinicalStatusBlock patientId={patientId} businessId={businessId} onSaved={fetchAll} />

      {/* ── Contexto clínico ── */}
      {reasonForConsultation && (
        <Card className="rounded-2xl border-primary/20 bg-primary/[0.03]">
          <CardContent className="p-4">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-primary mb-1 flex items-center gap-1.5">
              <ClipboardList className="h-3.5 w-3.5" /> Motivo de consulta
            </p>
            <p className="text-sm leading-relaxed whitespace-pre-wrap">{reasonForConsultation}</p>
          </CardContent>
        </Card>
      )}

      {/* ── Próximas sesiones (contexto, compactas) ── */}
      {upcoming.length > 0 && (
        <div className="flex items-center gap-2 overflow-x-auto pb-1 -mx-1 px-1">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground shrink-0">Próximas</span>
          {upcoming.slice(0, 4).map((apt) => (
            <span key={apt.id} className="inline-flex items-center gap-1.5 text-xs bg-primary/5 border border-primary/20 text-foreground rounded-full px-3 py-1.5 shrink-0 capitalize">
              <CalendarClock className="h-3 w-3 text-primary" />
              {format(parseISO(apt.start_at), "EEE d MMM · HH:mm", { locale: es })}
            </span>
          ))}
        </div>
      )}

      {/* ── Encabezado + filtros ── */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <h3 className="text-base font-bold flex items-center gap-2">
            <FileText className="h-4 w-4 text-primary" /> Historia por sesión
          </h3>
          {sinNotaCount > 0 && (
            <Badge variant="outline" className="text-[10px] text-amber-600 dark:text-amber-400 border-amber-500/40">
              {sinNotaCount} sin nota
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-1 rounded-xl bg-muted/60 p-1">
          {([
            { id: "all", label: "Todas" },
            { id: "with_note", label: "Con nota" },
            { id: "without_note", label: "Sin nota" },
          ] as { id: NoteFilter; label: string }[]).map((f) => (
            <button
              key={f.id}
              onClick={() => setFilter(f.id)}
              className={cn(
                "px-3 py-1 rounded-lg text-xs font-medium transition-colors",
                filter === f.id ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Línea de tiempo de sesiones ── */}
      {filteredPast.length === 0 ? (
        <Card className="rounded-2xl border-dashed">
          <CardContent className="py-10 text-center text-muted-foreground">
            <Filter className="h-8 w-8 mx-auto mb-2 opacity-40" />
            <p className="text-sm">
              {pastSessions.length === 0
                ? "Todavía no hubo sesiones — el expediente arranca con la primera."
                : "Ninguna sesión coincide con el filtro."}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="relative">
          <div className="absolute left-[5px] top-3 bottom-3 w-px bg-border" aria-hidden="true" />
          <div className="space-y-4">
            {filteredPast.map((apt) => {
              const isCancelled = CANCELLED.includes(apt.status);
              const sessionNotes = notesByAppointment.get(apt.id) ?? [];
              const sessionDocs = docsByAppointment.get(apt.id) ?? [];
              const payment = paymentByAppointment.get(apt.id);
              const payBadge = payment
                ? payment.status === "paid"
                  ? { label: "Pagada", cls: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30" }
                  : new Date(payment.due_date).getTime() < now
                  ? { label: "Pago vencido", cls: "bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/30" }
                  : { label: "Pago pendiente", cls: "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30" }
                : null;

              return (
                <div key={apt.id} className="relative pl-6">
                  {/* Nodo */}
                  <span
                    className={cn(
                      "absolute left-0 top-5 w-[11px] h-[11px] rounded-full ring-4 ring-background",
                      isCancelled ? "bg-muted-foreground/40" : apt.status === "attended" ? "bg-emerald-500" : "bg-primary"
                    )}
                    aria-hidden="true"
                  />

                  {/* Tarjeta minimalista: toda la tarjeta abre el detalle */}
                  <Card
                    role="button"
                    tabIndex={0}
                    onClick={() => setDetailApt(apt)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        setDetailApt(apt);
                      }
                    }}
                    className={cn(
                      "rounded-2xl cursor-pointer transition-all hover:shadow-md hover:border-primary/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
                      isCancelled && "opacity-55"
                    )}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <p className="font-semibold text-sm capitalize">
                            {format(parseISO(apt.start_at), "EEEE d 'de' MMMM yyyy", { locale: es })}
                          </p>
                          <p className="text-xs text-muted-foreground flex items-center gap-1.5 flex-wrap mt-0.5">
                            {format(parseISO(apt.start_at), "HH:mm")} – {format(parseISO(apt.end_at), "HH:mm")} hs
                            {apt.services?.name && <>· {apt.services.name}</>}
                            {apt.modality && (
                              <span className="inline-flex items-center gap-1">
                                · {apt.modality === "online" ? <Video className="h-3 w-3" /> : <MapPin className="h-3 w-3" />}
                                {apt.modality === "online" ? "Online" : "Presencial"}
                              </span>
                            )}
                          </p>
                          {/* Indicadores sutiles de contenido */}
                          {(!isCancelled || sessionDocs.length > 0) && (
                            <div className="flex items-center gap-3 flex-wrap mt-2">
                              {!isCancelled &&
                                (sessionNotes.length > 0 ? (
                                  <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
                                    <StickyNote className="h-3 w-3 text-primary" /> Con nota
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1 text-[11px] text-amber-600 dark:text-amber-400">
                                    <StickyNote className="h-3 w-3" /> Sin nota
                                  </span>
                                ))}
                              {sessionDocs.length > 0 && (
                                <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
                                  <Paperclip className="h-3 w-3" /> {sessionDocs.length}{" "}
                                  {sessionDocs.length === 1 ? "adjunto" : "adjuntos"}
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                        <div className="flex items-center gap-1.5 flex-wrap justify-end shrink-0">
                          {sessionStatusBadge(apt.status)}
                          {payBadge && (
                            <Badge className={cn("text-[10px] border hover:bg-transparent", payBadge.cls)} variant="outline">
                              {payBadge.label}
                            </Badge>
                          )}
                          <Button
                            size="sm"
                            variant="ghost"
                            title="Ver detalle de la sesión"
                            className="h-7 w-7 p-0 rounded-lg text-muted-foreground hover:text-foreground"
                            onClick={(e) => {
                              e.stopPropagation();
                              setDetailApt(apt);
                            }}
                          >
                            <Maximize2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Notas generales (sin sesión) ── */}
      <div className="space-y-3 pt-2">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-base font-bold flex items-center gap-2">
            <StickyNote className="h-4 w-4 text-primary" /> Notas generales
          </h3>
          <Button size="sm" variant="outline" className="rounded-xl gap-1.5" onClick={() => openNoteEditor(null)}>
            <Plus className="h-4 w-4" /> Nueva nota
          </Button>
        </div>
        {generalNotes.length === 0 ? (
          <p className="text-xs text-muted-foreground">
            Para apuntes que no pertenecen a una sesión puntual (antecedentes, objetivos del tratamiento, etc.).
          </p>
        ) : (
          <div className="space-y-2">
            {generalNotes.map((n) => (
              <Card key={n.id} className="rounded-2xl">
                <CardContent className="p-3.5">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-xs font-semibold text-muted-foreground shrink-0">
                        {format(parseISO(n.note_date), "d MMM yyyy", { locale: es })}
                      </span>
                      {n.status === "finalized" ? (
                        <Badge className="text-[9px] bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30 hover:bg-emerald-500/15">Finalizada</Badge>
                      ) : (
                        <Badge variant="outline" className="text-[9px] text-amber-600 dark:text-amber-400 border-amber-500/40">Borrador</Badge>
                      )}
                    </div>
                    <div className="flex gap-0.5 shrink-0">
                      <Button size="sm" variant="ghost" className="h-7 w-7 p-0 rounded-lg" onClick={() => openNoteEditor(null, n)}>
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button size="sm" variant="ghost" className="h-7 w-7 p-0 rounded-lg text-muted-foreground hover:text-destructive" onClick={() => setDeletingNoteId(n.id)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                  <p className="text-sm mt-2 whitespace-pre-wrap break-words leading-relaxed">{n.content}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* ── Editor de nota ── */}
      <Dialog open={noteEditor.open} onOpenChange={(o) => !savingNote && setNoteEditor((e) => ({ ...e, open: o }))}>
        <DialogContent className="max-w-lg max-h-[90dvh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{noteEditor.noteId ? "Editar nota" : "Nueva nota"}</DialogTitle>
            <DialogDescription className="capitalize">
              {noteEditor.sessionLabel ? `Sesión del ${noteEditor.sessionLabel}` : "Nota general del paciente"}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <Textarea
              value={noteContent}
              onChange={(e) => setNoteContent(e.target.value)}
              rows={8}
              placeholder="Escribí la nota clínica..."
              className="rounded-xl resize-y min-h-[160px] text-sm leading-relaxed"
              autoFocus
            />
            <div className="space-y-1.5">
              <Label>Estado</Label>
              <Select value={noteStatus} onValueChange={(v) => setNoteStatus(v as "draft" | "finalized")}>
                <SelectTrigger className="rounded-xl">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="draft">Borrador (la sigo editando)</SelectItem>
                  <SelectItem value="finalized">Finalizada</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter className="flex-col-reverse sm:flex-row gap-2">
            <Button variant="outline" className="rounded-xl w-full sm:w-auto" onClick={() => setNoteEditor((e) => ({ ...e, open: false }))} disabled={savingNote}>
              Cancelar
            </Button>
            <Button className="rounded-xl w-full sm:w-auto" onClick={saveNote} disabled={savingNote || !noteContent.trim()}>
              {savingNote ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : null}
              Guardar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Detalle completo de la sesión: info + nota + adjuntos agrupados ── */}
      <Dialog open={!!detailApt} onOpenChange={(o) => !o && setDetailApt(null)}>
        <DialogContent className="max-w-lg max-h-[90dvh] overflow-y-auto p-0 gap-0 rounded-2xl">
          {detailApt && (() => {
            const apt = detailApt;
            const isCancelled = CANCELLED.includes(apt.status);
            const sessionNotes = notesByAppointment.get(apt.id) ?? [];
            const payment = paymentByAppointment.get(apt.id);
            const payBadge = payment
              ? payment.status === "paid"
                ? { label: "Pagada", cls: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30" }
                : new Date(payment.due_date).getTime() < now
                ? { label: "Pago vencido", cls: "bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/30" }
                : { label: "Pago pendiente", cls: "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30" }
              : null;

            const docs = docsByAppointment.get(apt.id) ?? [];
            const groups = DOC_TYPE_ORDER
              .map((type) => ({ type, items: docs.filter((d) => (d.document_type || "otro") === type) }))
              .filter((g) => g.items.length > 0);
            // Tipos fuera del catálogo (por si hubiera datos viejos)
            const known = new Set(DOC_TYPE_ORDER);
            const rest = docs.filter((d) => !known.has(d.document_type || "otro"));
            if (rest.length > 0) groups.push({ type: "otro", items: rest });

            return (
              <>
                {/* Encabezado con banda sutil */}
                <div className="px-5 sm:px-6 pt-6 pb-4 bg-gradient-to-b from-primary/[0.07] to-transparent border-b border-border/60">
                  <DialogHeader className="text-left space-y-0">
                    <div className="flex items-start gap-3">
                      <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                        <FileText className="h-5 w-5 text-primary" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-[10px] font-semibold uppercase tracking-wider text-primary">
                          Detalle de la sesión
                        </p>
                        <DialogTitle className="text-base capitalize leading-tight mt-0.5">
                          {format(parseISO(apt.start_at), "EEEE d 'de' MMMM yyyy", { locale: es })}
                        </DialogTitle>
                        <DialogDescription className="text-xs mt-0.5 flex items-center gap-1.5 flex-wrap">
                          {format(parseISO(apt.start_at), "HH:mm")} – {format(parseISO(apt.end_at), "HH:mm")} hs
                          {apt.services?.name && <>· {apt.services.name}</>}
                          {apt.modality && (
                            <span className="inline-flex items-center gap-1">
                              · {apt.modality === "online" ? <Video className="h-3 w-3" /> : <MapPin className="h-3 w-3" />}
                              {apt.modality === "online" ? "Online" : "Presencial"}
                            </span>
                          )}
                        </DialogDescription>
                      </div>
                    </div>
                  </DialogHeader>
                  <div className="flex items-center gap-1.5 flex-wrap mt-3">
                    {sessionStatusBadge(apt.status)}
                    {payBadge && (
                      <Badge className={cn("text-[10px] border hover:bg-transparent", payBadge.cls)} variant="outline">
                        {payBadge.label}
                        {payment ? ` · $${Number(payment.amount).toLocaleString("es-UY")}` : ""}
                      </Badge>
                    )}
                  </div>
                </div>

                <div className="px-5 sm:px-6 py-5 space-y-6">
                  {/* Nota clínica de la sesión */}
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1.5">
                      <StickyNote className="h-3 w-3" /> Nota de la sesión
                    </p>
                    {sessionNotes.length > 0 ? (
                      <div className="space-y-2">
                        {sessionNotes.map((n) => (
                          <NoteBlock key={n.id} note={n} apt={apt} />
                        ))}
                      </div>
                    ) : !isCancelled ? (
                      <button
                        onClick={() => {
                          setDetailApt(null);
                          openNoteEditor(apt);
                        }}
                        className="w-full rounded-xl border border-dashed border-border hover:border-primary/50 hover:bg-primary/[0.03] transition-colors p-3 text-left flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
                      >
                        <Plus className="h-4 w-4 text-primary shrink-0" />
                        Escribir la nota de esta sesión
                      </button>
                    ) : (
                      <p className="text-xs text-muted-foreground">Sesión cancelada, sin nota clínica.</p>
                    )}
                  </div>

                  {/* Adjuntos agrupados por tipo */}
                  <div className="space-y-4">
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                      <Paperclip className="h-3 w-3" /> Adjuntos{docs.length > 0 ? ` · ${docs.length}` : ""}
                    </p>
                    {groups.length === 0 && (
                      <p className="text-xs text-muted-foreground">
                        Esta sesión todavía no tiene documentos adjuntos.
                      </p>
                    )}
                    {groups.map(({ type, items }) => (
                      <div key={type}>
                        <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground/80 mb-1.5">
                          {DOC_TYPE_LABELS[type] || "Otro"}{items.length > 1 ? `s · ${items.length}` : ""}
                        </p>
                        <div className="space-y-2">
                          {items.map((doc) => (
                            <div
                              key={doc.id}
                              className="flex items-center gap-3 rounded-xl border border-border/60 bg-muted/30 p-2.5 transition-colors hover:bg-muted/50"
                            >
                              <div className="shrink-0 h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center">
                                <FileText className="h-4 w-4 text-primary" />
                              </div>
                              <div className="min-w-0 flex-1">
                                <p className="text-sm font-medium break-all leading-snug">{doc.file_name}</p>
                                <p className="text-[11px] text-muted-foreground flex items-center gap-1.5">
                                  {formatBytes(doc.file_size)}
                                  {doc.shared_with_patient && (
                                    <span className="inline-flex items-center gap-0.5 text-emerald-600 dark:text-emerald-400">
                                      <Eye className="h-3 w-3" /> compartido
                                    </span>
                                  )}
                                </p>
                              </div>
                              <div className="flex gap-1.5 shrink-0">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="rounded-lg h-8"
                                  onClick={() => viewDocument(doc)}
                                  disabled={busyDocId === doc.id}
                                >
                                  {busyDocId === doc.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Ver"}
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  title="Descargar"
                                  className="rounded-lg h-8 w-8 p-0"
                                  onClick={() => viewDocument(doc, true)}
                                  disabled={busyDocId === doc.id}
                                >
                                  <Download className="h-3.5 w-3.5" />
                                </Button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                    {!isCancelled && (
                      <button
                        onClick={() => {
                          setDetailApt(null);
                          startAttach(apt);
                        }}
                        className="w-full rounded-xl border border-dashed border-border hover:border-primary/50 hover:bg-primary/[0.03] transition-colors p-2.5 flex items-center justify-center gap-2 text-xs font-medium text-muted-foreground hover:text-foreground"
                      >
                        <Upload className="h-3.5 w-3.5" /> Adjuntar documento
                      </button>
                    )}
                  </div>
                </div>

                <DialogFooter className="px-5 sm:px-6 pb-6 pt-0">
                  <Button className="rounded-xl w-full sm:w-auto" onClick={() => setDetailApt(null)}>
                    Listo
                  </Button>
                </DialogFooter>
              </>
            );
          })()}
        </DialogContent>
      </Dialog>

      {/* ── Adjuntar documento (metadatos) ── */}
      <Dialog
        open={!!pendingFile && !!attachTarget}
        onOpenChange={(o) => {
          if (!uploading && !o) {
            setPendingFile(null);
            setAttachTarget(null);
            if (fileInputRef.current) fileInputRef.current.value = "";
          }
        }}
      >
        <DialogContent className="max-w-md max-h-[90dvh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Adjuntar a la sesión del {attachTarget?.label}</DialogTitle>
            <DialogDescription className="break-all">{pendingFile?.name}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Tipo de documento</Label>
              <Select value={attachType} onValueChange={setAttachType}>
                <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(DOC_TYPE_LABELS).map(([value, label]) => (
                    <SelectItem key={value} value={value}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Descripción (opcional)</Label>
              <Textarea
                value={attachNotes}
                onChange={(e) => setAttachNotes(e.target.value)}
                rows={2}
                className="rounded-xl resize-none"
                placeholder="Ej: resultados del test aplicado en la sesión"
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Queda privado. Si querés compartirlo con el paciente, lo hacés desde la pestaña Docs.
            </p>
          </div>
          <DialogFooter className="flex-col-reverse sm:flex-row gap-2">
            <Button
              variant="outline"
              className="rounded-xl w-full sm:w-auto"
              disabled={uploading}
              onClick={() => {
                setPendingFile(null);
                setAttachTarget(null);
                if (fileInputRef.current) fileInputRef.current.value = "";
              }}
            >
              Cancelar
            </Button>
            <Button className="rounded-xl w-full sm:w-auto" onClick={uploadAttachment} disabled={uploading || !pendingFile}>
              {uploading ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : <Upload className="h-4 w-4 mr-1.5" />}
              Adjuntar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Confirmar borrado de nota ── */}
      <AlertDialog open={!!deletingNoteId} onOpenChange={(o) => !o && setDeletingNoteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar esta nota?</AlertDialogTitle>
            <AlertDialogDescription>
              La nota se elimina definitivamente del expediente. Esta acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={deleteNote} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default PatientRecord;
