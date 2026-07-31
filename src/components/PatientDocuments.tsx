import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import {
  FileText,
  Download,
  Trash2,
  Upload,
  Lock,
  Loader2,
  Paperclip,
  Eye,
  EyeOff,
  ExternalLink,
  Search,
  MoreVertical,
  Plus,
} from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { useAuth } from "@/contexts/AuthContext";
import { useDashboardBranding } from "@/contexts/DashboardBrandingContext";
import { notifyPatient } from "@/lib/push-notifications";
import { ListPagination, ITEMS_PER_PAGE } from "@/components/ListPagination";
import { cn } from "@/lib/utils";
import { BUILT_IN_DOC_TYPES, resolveDocType } from "@/lib/document-types";
import { useDocumentTypes } from "@/hooks/use-document-types";
import { CreateDocTypeDialog } from "@/components/documents/CreateDocTypeDialog";

// DOCUMENTOS del paciente, pensado para acumular muchos sin volverse un
// pantano: filas compactas de una línea, buscador + filtros arriba, el
// destino (privado / compartido) se decide al subir, y las acciones viven
// en un menú. Los tipos de documento son los de fábrica más los que crea
// cada consultorio con su ícono (business_document_types).

type ShareFilter = "all" | "shared" | "private";

/** Valor del Select de subida que abre el creador de tipos. */
const NEW_TYPE_VALUE = "__new__";

interface PatientDocument {
  id: string;
  business_id: string;
  patient_id: string;
  uploaded_by: string;
  file_path: string;
  file_name: string;
  file_size: number | null;
  mime_type: string | null;
  document_type: string;
  notes: string | null;
  created_at: string;
  shared_with_patient: boolean;
  shared_at: string | null;
}

interface PatientDocumentsProps {
  patientId: string;
  businessId: string;
}

const MAX_FILE_SIZE = 15 * 1024 * 1024; // 15 MB
const ACCEPTED_MIME =
  ".pdf,.doc,.docx,.jpg,.jpeg,.png,.webp,.gif,.heic,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,image/*";

const formatBytes = (bytes: number | null) => {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

export const PatientDocuments = ({ patientId, businessId }: PatientDocumentsProps) => {
  const { user } = useAuth();
  const { displayName: clinicDisplayName } = useDashboardBranding();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [documents, setDocuments] = useState<PatientDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [docType, setDocType] = useState<string>("informe");
  const [notes, setNotes] = useState("");
  // Tipos propios del consultorio + creador ("Radiografía", "Receta"...)
  const { customTypes, refresh: refreshTypes } = useDocumentTypes(businessId);
  const [createTypeOpen, setCreateTypeOpen] = useState(false);
  const [shareOnUpload, setShareOnUpload] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [deletingDoc, setDeletingDoc] = useState<PatientDocument | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  // Compartir con el paciente: confirmación al activar + estado de guardado
  const [sharingDoc, setSharingDoc] = useState<PatientDocument | null>(null);
  const [togglingShareId, setTogglingShareId] = useState<string | null>(null);
  const [page, setPage] = useState(1);

  // ── Filtros: para cuando los documentos se acumulan ──
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [shareFilter, setShareFilter] = useState<ShareFilter>("all");

  const fetchDocuments = async () => {
    setLoading(true);
    const { data, error } = await (supabase as any)
      .from("patient_documents")
      .select("*")
      .eq("patient_id", patientId)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching patient documents:", error);
      toast({
        title: "Error",
        description: "No se pudieron cargar los documentos",
        variant: "destructive",
      });
    } else {
      setDocuments((data || []) as PatientDocument[]);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchDocuments();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [patientId]);

  const filteredDocs = useMemo(() => {
    const q = search.trim().toLowerCase();
    return documents.filter((d) => {
      if (q && !d.file_name.toLowerCase().includes(q) && !(d.notes || "").toLowerCase().includes(q)) return false;
      if (typeFilter !== "all" && d.document_type !== typeFilter) return false;
      if (shareFilter === "shared" && !d.shared_with_patient) return false;
      if (shareFilter === "private" && d.shared_with_patient) return false;
      return true;
    });
  }, [documents, search, typeFilter, shareFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredDocs.length / ITEMS_PER_PAGE));
  const currentPage = Math.min(page, totalPages);
  const pageStart = (currentPage - 1) * ITEMS_PER_PAGE;
  const pageDocs = filteredDocs.slice(pageStart, pageStart + ITEMS_PER_PAGE);

  const hasActiveFilters = search.trim() !== "" || typeFilter !== "all" || shareFilter !== "all";

  const resetUploadForm = () => {
    setPendingFile(null);
    setDocType("informe");
    setNotes("");
    setShareOnUpload(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleUploadTypeChange = (v: string) => {
    if (v === NEW_TYPE_VALUE) {
      setCreateTypeOpen(true);
      return; // el valor se setea cuando el tipo nuevo queda creado
    }
    setDocType(v);
  };

  const handleFileSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > MAX_FILE_SIZE) {
      toast({
        title: "Archivo demasiado grande",
        description: "El tamaño máximo permitido es 15 MB",
        variant: "destructive",
      });
      return;
    }
    setPendingFile(file);
    setUploadOpen(true);
  };

  // Aviso al paciente cuando algo se comparte (push + email, best-effort)
  const notifySharedDocument = (fileName: string) => {
    const clinic = clinicDisplayName || "Tu profesional";
    notifyPatient({
      patientId,
      title: "Nuevo documento 📄",
      body: `${clinic} te compartió "${fileName}". Entrá a tu portal para verlo.`,
      url: "/portal",
    });
    void (async () => {
      try {
        const { data: pat } = await supabase
          .from("patients")
          .select("full_name, email")
          .eq("id", patientId)
          .maybeSingle();
        if (!pat?.email) return;
        const firstName = (pat.full_name || "").split(" ")[0] || "Hola";
        await supabase.functions.invoke("send-resend-email", {
          body: {
            to: pat.email,
            template: "raw",
            businessId,
            data: {
              subject: `Te compartieron un documento — ${clinic}`,
              message: `Hola ${firstName},\n\n${clinic} te compartió un documento: "${fileName}".\n\nEntrá a tu portal para verlo y descargarlo (sección Historial → Mis documentos).\n\n${clinic}`,
            },
          },
        });
      } catch (err) {
        console.warn("Share-document email failed:", err);
      }
    })();
  };

  const handleUpload = async () => {
    if (!pendingFile || !user) return;
    setUploading(true);
    try {
      const ext = pendingFile.name.includes(".")
        ? pendingFile.name.split(".").pop()
        : "";
      const safeBase =
        pendingFile.name
          .replace(/\.[^.]+$/, "")
          .replace(/[^a-zA-Z0-9-_]+/g, "_")
          .slice(0, 60) || "documento";
      const uniqueName = `${Date.now()}_${safeBase}${ext ? "." + ext : ""}`;
      const filePath = `${businessId}/${patientId}/${uniqueName}`;

      const { error: uploadError } = await supabase.storage
        .from("patient-documents")
        .upload(filePath, pendingFile, {
          contentType: pendingFile.type || "application/octet-stream",
          upsert: false,
        });

      if (uploadError) throw uploadError;

      const { error: insertError } = await (supabase as any)
        .from("patient_documents")
        .insert({
          business_id: businessId,
          patient_id: patientId,
          uploaded_by: user.id,
          file_path: filePath,
          file_name: pendingFile.name,
          file_size: pendingFile.size,
          mime_type: pendingFile.type || null,
          document_type: docType,
          notes: notes.trim() || null,
          // El destino se decide al subir: privado o directo al portal
          shared_with_patient: shareOnUpload,
          shared_at: shareOnUpload ? new Date().toISOString() : null,
        });

      if (insertError) {
        // Rollback storage upload if metadata insert fails
        await supabase.storage.from("patient-documents").remove([filePath]);
        throw insertError;
      }

      if (shareOnUpload) {
        notifySharedDocument(pendingFile.name);
        toast({
          title: "Documento subido y compartido ✓",
          description: "El paciente ya lo ve en su portal. Le avisamos con una notificación.",
        });
      } else {
        toast({ title: "Documento subido", description: "Quedó privado — lo compartís cuando quieras." });
      }
      setUploadOpen(false);
      resetUploadForm();
      fetchDocuments();
    } catch (err: any) {
      console.error("Upload error:", err);
      toast({
        title: "Error",
        description: err?.message || "No se pudo subir el documento",
        variant: "destructive",
      });
    } finally {
      setUploading(false);
    }
  };

  const openDocument = async (doc: PatientDocument, download: boolean) => {
    setDownloadingId(doc.id);
    // Para "Ver" abrimos la pestaña ANTES del await: si no, el bloqueador
    // de pop-ups del navegador la mata (el click ya no cuenta como gesto).
    const win = download ? null : window.open("", "_blank");
    try {
      const { data, error } = await supabase.storage
        .from("patient-documents")
        .createSignedUrl(doc.file_path, 60, download ? { download: doc.file_name } : undefined);
      if (error || !data?.signedUrl) throw error || new Error("Sin URL");
      if (download) {
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
    } catch (err) {
      if (win) win.close();
      console.error("Open document error:", err);
      toast({
        title: "Error",
        description: download ? "No se pudo descargar el documento" : "No se pudo abrir el documento",
        variant: "destructive",
      });
    } finally {
      setDownloadingId(null);
    }
  };

  // Compartir / dejar de compartir con el paciente
  const setShared = async (doc: PatientDocument, shared: boolean) => {
    setTogglingShareId(doc.id);
    try {
      const { error } = await supabase
        .from("patient_documents")
        .update({ shared_with_patient: shared, shared_at: shared ? new Date().toISOString() : null })
        .eq("id", doc.id);
      if (error) throw error;

      setDocuments((docs) =>
        docs.map((d) => (d.id === doc.id ? { ...d, shared_with_patient: shared } : d))
      );

      if (shared) {
        notifySharedDocument(doc.file_name);
        toast({
          title: "Documento compartido ✓",
          description: "El paciente ya lo ve en su portal. Le avisamos con una notificación.",
        });
      } else {
        toast({
          title: "Documento privado de nuevo",
          description: "El paciente dejó de verlo en su portal.",
        });
      }
    } catch (err) {
      console.error("Share toggle error:", err);
      toast({ title: "Error", description: "No se pudo cambiar el estado de compartido", variant: "destructive" });
    } finally {
      setTogglingShareId(null);
      setSharingDoc(null);
    }
  };

  const handleDelete = async () => {
    if (!deletingDoc) return;
    try {
      const { error: storageError } = await supabase.storage
        .from("patient-documents")
        .remove([deletingDoc.file_path]);
      if (storageError) {
        console.warn("Storage delete warning:", storageError);
      }
      const { error } = await (supabase as any)
        .from("patient_documents")
        .delete()
        .eq("id", deletingDoc.id);
      if (error) throw error;
      toast({ title: "Documento eliminado" });
      setDeletingDoc(null);
      fetchDocuments();
    } catch (err: any) {
      console.error("Delete error:", err);
      toast({
        title: "Error",
        description: "No se pudo eliminar el documento",
        variant: "destructive",
      });
    }
  };

  return (
    <Card className="rounded-2xl">
      <CardHeader className="pb-3 space-y-3">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <CardTitle className="text-base font-bold flex items-center gap-2.5">
            <span className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
              <Paperclip className="h-4 w-4 text-primary" />
            </span>
            Documentos
            {documents.length > 0 && (
              <Badge variant="secondary" className="rounded-full">{documents.length}</Badge>
            )}
          </CardTitle>
          <Button size="sm" onClick={() => fileInputRef.current?.click()} className="rounded-xl gap-1.5 h-8">
            <Upload className="h-3.5 w-3.5" /> Subir
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            accept={ACCEPTED_MIME}
            className="hidden"
            onChange={handleFileSelected}
          />
        </div>

        {/* Buscador + filtros: aparecen cuando ya hay algo que filtrar */}
        {documents.length > 0 && (
          <div className="flex flex-col sm:flex-row gap-2">
            <div className="relative flex-1 min-w-0">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                placeholder="Buscar por nombre..."
                className="h-9 pl-9 rounded-xl text-sm"
              />
            </div>
            <div className="flex gap-2">
              <Select value={typeFilter} onValueChange={(v) => { setTypeFilter(v as any); setPage(1); }}>
                <SelectTrigger className="h-9 rounded-xl text-xs flex-1 sm:flex-initial sm:w-[160px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos los tipos</SelectItem>
                  {BUILT_IN_DOC_TYPES.map((t) => (
                    <SelectItem key={t.code} value={t.code}>{t.label}</SelectItem>
                  ))}
                  {customTypes.map((t) => (
                    <SelectItem key={t.id} value={t.id}>{t.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={shareFilter} onValueChange={(v) => { setShareFilter(v as ShareFilter); setPage(1); }}>
                <SelectTrigger className="h-9 rounded-xl text-xs flex-1 sm:flex-initial sm:w-[140px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="shared">Compartidos</SelectItem>
                  <SelectItem value="private">Privados</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        )}
      </CardHeader>

      <CardContent className="space-y-2">
        {loading ? (
          <p className="text-sm text-muted-foreground">Cargando documentos...</p>
        ) : documents.length === 0 ? (
          <button
            onClick={() => fileInputRef.current?.click()}
            className="w-full rounded-xl border border-dashed border-border hover:border-primary/50 hover:bg-primary/[0.03] transition-colors py-8 text-center"
          >
            <Paperclip className="h-8 w-8 mx-auto mb-2 opacity-40" />
            <p className="text-sm font-medium">Subí el primer documento</p>
            <p className="text-xs text-muted-foreground mt-1">
              PDF, Word o imágenes hasta 15 MB. Quedan privados salvo que los compartas.
            </p>
          </button>
        ) : filteredDocs.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Search className="h-8 w-8 mx-auto mb-2 opacity-40" />
            <p className="text-sm">Nada coincide con la búsqueda o los filtros.</p>
          </div>
        ) : (
          pageDocs.map((doc) => {
            const { label: typeLabel, Icon } = resolveDocType(doc.document_type, customTypes);
            const busy = downloadingId === doc.id || togglingShareId === doc.id;
            return (
              // Fila compacta de UNA línea: nombre truncado, meta abajo,
              // estado como chip y acciones en el menú — nunca se desborda.
              <div
                key={doc.id}
                className="flex items-center gap-2.5 sm:gap-3 border rounded-xl px-3 py-2.5 bg-card hover:bg-accent/30 transition-colors"
              >
                <div className="shrink-0 h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Icon className="h-4 w-4 text-primary" />
                </div>

                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium truncate leading-snug" title={doc.file_name}>
                    {doc.file_name}
                  </p>
                  <p className="text-[11px] text-muted-foreground truncate mt-0.5">
                    {typeLabel}
                    {" · "}{format(new Date(doc.created_at), "d MMM yyyy", { locale: es })}
                    {doc.file_size ? ` · ${formatBytes(doc.file_size)}` : ""}
                    {doc.notes ? ` · ${doc.notes}` : ""}
                  </p>
                </div>

                {/* Estado: chip compacto (solo ícono en mobile) */}
                <span
                  className={cn(
                    "shrink-0 inline-flex items-center gap-1 rounded-full px-2 py-1 text-[10px] font-semibold border",
                    doc.shared_with_patient
                      ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-300 border-emerald-500/30"
                      : "bg-muted/40 text-muted-foreground border-border/60"
                  )}
                  title={doc.shared_with_patient ? "El paciente lo ve en su portal" : "Privado: solo lo ves vos"}
                >
                  {doc.shared_with_patient ? <Eye className="h-3 w-3" /> : <Lock className="h-3 w-3" />}
                  <span className="hidden md:inline">{doc.shared_with_patient ? "Compartido" : "Privado"}</span>
                </span>

                {/* Acciones rápidas: solo desktop (en mobile viven en el menú) */}
                <div className="hidden sm:flex items-center gap-0.5 shrink-0">
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-8 w-8 p-0 rounded-lg"
                    title="Ver"
                    onClick={() => openDocument(doc, false)}
                    disabled={busy}
                  >
                    {downloadingId === doc.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <ExternalLink className="h-4 w-4" />}
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-8 w-8 p-0 rounded-lg"
                    title="Descargar"
                    onClick={() => openDocument(doc, true)}
                    disabled={busy}
                  >
                    <Download className="h-4 w-4" />
                  </Button>
                </div>

                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button size="sm" variant="ghost" className="h-8 w-8 p-0 rounded-lg shrink-0 text-muted-foreground" disabled={busy}>
                      {togglingShareId === doc.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <MoreVertical className="h-4 w-4" />}
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-52 rounded-xl">
                    <DropdownMenuItem className="gap-2 sm:hidden" onClick={() => openDocument(doc, false)}>
                      <ExternalLink className="h-4 w-4" /> Ver
                    </DropdownMenuItem>
                    <DropdownMenuItem className="gap-2 sm:hidden" onClick={() => openDocument(doc, true)}>
                      <Download className="h-4 w-4" /> Descargar
                    </DropdownMenuItem>
                    <DropdownMenuSeparator className="sm:hidden" />
                    {doc.shared_with_patient ? (
                      <DropdownMenuItem className="gap-2" onClick={() => void setShared(doc, false)}>
                        <EyeOff className="h-4 w-4" /> Hacer privado
                      </DropdownMenuItem>
                    ) : (
                      <DropdownMenuItem className="gap-2" onClick={() => setSharingDoc(doc)}>
                        <Eye className="h-4 w-4" /> Compartir con el paciente
                      </DropdownMenuItem>
                    )}
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      className="gap-2 text-destructive focus:text-destructive"
                      onClick={() => setDeletingDoc(doc)}
                    >
                      <Trash2 className="h-4 w-4" /> Eliminar
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            );
          })
        )}
        {filteredDocs.length > ITEMS_PER_PAGE && (
          <ListPagination
            currentPage={currentPage}
            totalPages={totalPages}
            onPageChange={setPage}
            totalItems={filteredDocs.length}
            pageSize={ITEMS_PER_PAGE}
          />
        )}
        {!loading && documents.length > 0 && hasActiveFilters && (
          <p className="text-[11px] text-muted-foreground text-center pt-1">
            Mostrando {filteredDocs.length} de {documents.length} documentos
          </p>
        )}
      </CardContent>

      {/* Subida: tipo + descripción + destino, todo decidido acá */}
      <Dialog
        open={uploadOpen}
        onOpenChange={(open) => {
          if (!uploading) {
            setUploadOpen(open);
            if (!open) resetUploadForm();
          }
        }}
      >
        <DialogContent className="max-w-md max-h-[90dvh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Subir documento</DialogTitle>
            <DialogDescription className="break-all">
              {pendingFile?.name}{" "}
              {pendingFile && (
                <span className="text-muted-foreground">
                  ({formatBytes(pendingFile.size)})
                </span>
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Tipo de documento</Label>
              <Select value={docType} onValueChange={handleUploadTypeChange}>
                <SelectTrigger className="rounded-xl">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {BUILT_IN_DOC_TYPES.map((t) => {
                    const { Icon } = resolveDocType(t.code, customTypes);
                    return (
                      <SelectItem key={t.code} value={t.code}>
                        <span className="flex items-center gap-2">
                          <Icon className="h-3.5 w-3.5 text-muted-foreground" /> {t.label}
                        </span>
                      </SelectItem>
                    );
                  })}
                  {customTypes.map((t) => {
                    const { Icon } = resolveDocType(t.id, customTypes);
                    return (
                      <SelectItem key={t.id} value={t.id}>
                        <span className="flex items-center gap-2">
                          <Icon className="h-3.5 w-3.5 text-primary" /> {t.label}
                        </span>
                      </SelectItem>
                    );
                  })}
                  <SelectItem value={NEW_TYPE_VALUE}>
                    <span className="flex items-center gap-2 font-medium text-primary">
                      <Plus className="h-3.5 w-3.5" /> Crear tipo nuevo...
                    </span>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="doc-notes">Descripción (opcional)</Label>
              <Textarea
                id="doc-notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
                placeholder="Ej: resultados del test aplicado en abril"
                className="resize-none rounded-xl"
              />
            </div>
            {/* Destino: se decide acá, no después revolviendo la lista */}
            <label className="flex items-start gap-3 rounded-xl border border-border/60 bg-muted/30 p-3 cursor-pointer select-none">
              <Switch
                checked={shareOnUpload}
                onCheckedChange={setShareOnUpload}
                className="mt-0.5"
              />
              <span className="min-w-0">
                <span className="block text-sm font-medium">
                  Compartir con el paciente
                </span>
                <span className="block text-xs text-muted-foreground mt-0.5">
                  {shareOnUpload
                    ? "Va a aparecer en su portal y le avisamos con una notificación y un email."
                    : "Queda privado: solo lo ves vos. Lo podés compartir después."}
                </span>
              </span>
            </label>
          </div>
          <DialogFooter className="flex-col-reverse sm:flex-row gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setUploadOpen(false);
                resetUploadForm();
              }}
              disabled={uploading}
              className="w-full sm:w-auto rounded-xl"
            >
              Cancelar
            </Button>
            <Button
              onClick={handleUpload}
              disabled={uploading || !pendingFile}
              className="w-full sm:w-auto rounded-xl"
            >
              {uploading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-1 animate-spin" /> Subiendo...
                </>
              ) : (
                <>
                  <Upload className="h-4 w-4 mr-1" /> {shareOnUpload ? "Subir y compartir" : "Subir"}
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Crear tipo de documento propio (nombre + ícono) */}
      <CreateDocTypeDialog
        open={createTypeOpen}
        onOpenChange={setCreateTypeOpen}
        businessId={businessId}
        onCreated={(t) => {
          void refreshTypes();
          setDocType(t.id);
        }}
      />

      {/* Confirmación de compartir con el paciente */}
      <AlertDialog
        open={!!sharingDoc}
        onOpenChange={(open) => !open && setSharingDoc(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Compartir con el paciente?</AlertDialogTitle>
            <AlertDialogDescription>
              <span className="font-medium text-foreground break-all">{sharingDoc?.file_name}</span>{" "}
              va a aparecer en el portal del paciente, donde podrá verlo y descargarlo.
              Le avisamos con una notificación y un email. Podés volver a hacerlo privado cuando quieras.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => sharingDoc && void setShared(sharingDoc, true)}>
              Sí, compartir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete confirm */}
      <AlertDialog
        open={!!deletingDoc}
        onOpenChange={(open) => !open && setDeletingDoc(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar documento?</AlertDialogTitle>
            <AlertDialogDescription>
              Se eliminará permanentemente el archivo{" "}
              <span className="font-medium break-all">{deletingDoc?.file_name}</span>. Esta
              acción no se puede deshacer.
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
