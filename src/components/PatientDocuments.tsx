import { useEffect, useRef, useState } from "react";
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
  FileImage,
  FileType,
  Download,
  Trash2,
  Upload,
  Lock,
  Loader2,
  Paperclip,
  Eye,
  ExternalLink,
} from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { useAuth } from "@/contexts/AuthContext";
import { useDashboardBranding } from "@/contexts/DashboardBrandingContext";
import { notifyPatient } from "@/lib/push-notifications";
import { ListPagination, ITEMS_PER_PAGE } from "@/components/ListPagination";

type DocumentType = "consentimiento" | "informe" | "evaluacion" | "indicaciones" | "recibo" | "otro";

interface PatientDocument {
  id: string;
  business_id: string;
  patient_id: string;
  uploaded_by: string;
  file_path: string;
  file_name: string;
  file_size: number | null;
  mime_type: string | null;
  document_type: DocumentType;
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

const typeLabels: Record<DocumentType, string> = {
  consentimiento: "Consentimiento",
  informe: "Informe",
  evaluacion: "Evaluación",
  indicaciones: "Indicaciones / Material",
  recibo: "Recibo",
  otro: "Otro",
};

const formatBytes = (bytes: number | null) => {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

const fileIcon = (mime: string | null) => {
  if (!mime) return FileText;
  if (mime.startsWith("image/")) return FileImage;
  if (mime.includes("pdf")) return FileType;
  return FileText;
};

export const PatientDocuments = ({ patientId, businessId }: PatientDocumentsProps) => {
  const { user } = useAuth();
  const { displayName: clinicDisplayName } = useDashboardBranding();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [documents, setDocuments] = useState<PatientDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [docType, setDocType] = useState<DocumentType>("otro");
  const [notes, setNotes] = useState("");
  const [uploading, setUploading] = useState(false);
  const [deletingDoc, setDeletingDoc] = useState<PatientDocument | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  // Compartir con el paciente: confirmación al activar + estado de guardado
  const [sharingDoc, setSharingDoc] = useState<PatientDocument | null>(null);
  const [togglingShareId, setTogglingShareId] = useState<string | null>(null);
  const [page, setPage] = useState(1);

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

  const totalPages = Math.max(1, Math.ceil(documents.length / ITEMS_PER_PAGE));
  const currentPage = Math.min(page, totalPages);
  const pageStart = (currentPage - 1) * ITEMS_PER_PAGE;
  const pageDocs = documents.slice(pageStart, pageStart + ITEMS_PER_PAGE);

  const resetUploadForm = () => {
    setPendingFile(null);
    setDocType("otro");
    setNotes("");
    if (fileInputRef.current) fileInputRef.current.value = "";
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
        });

      if (insertError) {
        // Rollback storage upload if metadata insert fails
        await supabase.storage.from("patient-documents").remove([filePath]);
        throw insertError;
      }

      toast({ title: "Documento subido" });
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
    try {
      const { data, error } = await supabase.storage
        .from("patient-documents")
        .createSignedUrl(doc.file_path, 60, download ? { download: doc.file_name } : undefined);
      if (error || !data?.signedUrl) throw error || new Error("Sin URL");
      window.open(data.signedUrl, "_blank", "noopener,noreferrer");
    } catch (err) {
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
        const clinic = clinicDisplayName || "Tu profesional";
        // Push + email al paciente (best-effort)
        notifyPatient({
          patientId,
          title: "Nuevo documento 📄",
          body: `${clinic} te compartió "${doc.file_name}". Entrá a tu portal para verlo.`,
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
                  message: `Hola ${firstName},\n\n${clinic} te compartió un documento: "${doc.file_name}".\n\nEntrá a tu portal para verlo y descargarlo (sección Historial → Mis documentos).\n\n${clinic}`,
                },
              },
            });
          } catch (err) {
            console.warn("Share-document email failed:", err);
          }
        })();
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
      <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 space-y-0 pb-3">
        <div className="flex items-center gap-2 flex-wrap">
          <Paperclip className="h-5 w-5 text-primary" />
          <CardTitle className="text-lg">Documentos</CardTitle>
          <Badge variant="outline" className="gap-1 text-xs">
            <Lock className="h-3 w-3" /> Privados salvo que los compartas
          </Badge>
          {documents.length > 0 && (
            <Badge variant="secondary" className="rounded-full">
              {documents.length}
            </Badge>
          )}
        </div>
        <Button
          size="sm"
          onClick={() => fileInputRef.current?.click()}
          className="rounded-xl w-full sm:w-auto"
        >
          <Upload className="h-4 w-4 mr-1" /> Subir documento
        </Button>
        <input
          ref={fileInputRef}
          type="file"
          accept={ACCEPTED_MIME}
          className="hidden"
          onChange={handleFileSelected}
        />
      </CardHeader>
      <CardContent className="space-y-3">
        {loading ? (
          <p className="text-sm text-muted-foreground">Cargando documentos...</p>
        ) : documents.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Paperclip className="h-10 w-10 mx-auto mb-2 opacity-40" />
            <p className="text-sm">Aún no hay documentos para este paciente</p>
            <p className="text-xs mt-1">PDF, Word o imágenes hasta 15 MB</p>
          </div>
        ) : (
          pageDocs.map((doc) => {
            const Icon = fileIcon(doc.mime_type);
            return (
              <div
                key={doc.id}
                className="border rounded-xl p-3 sm:p-4 bg-card hover:bg-accent/30 transition-colors"
              >
                <div className="flex items-start gap-3">
                  <div className="shrink-0 h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                    <Icon className="h-5 w-5 text-primary" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium break-all leading-snug">
                      {doc.file_name}
                    </p>
                    <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                      <Badge variant="secondary" className="text-xs">
                        {typeLabels[doc.document_type] || doc.document_type}
                      </Badge>
                      {doc.shared_with_patient ? (
                        <Badge className="text-[10px] gap-1 bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30 hover:bg-emerald-500/15">
                          <Eye className="h-2.5 w-2.5" /> Compartido
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-[10px] gap-1 text-muted-foreground">
                          <Lock className="h-2.5 w-2.5" /> Privado
                        </Badge>
                      )}
                      <span className="text-xs text-muted-foreground">
                        {format(new Date(doc.created_at), "d MMM yyyy", {
                          locale: es,
                        })}
                      </span>
                      {doc.file_size && (
                        <span className="text-xs text-muted-foreground">
                          • {formatBytes(doc.file_size)}
                        </span>
                      )}
                    </div>
                    {doc.notes && (
                      <p className="text-xs text-muted-foreground mt-2 whitespace-pre-wrap break-words">
                        {doc.notes}
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:justify-between mt-3 pt-3 border-t border-border/50">
                  {/* Compartir con el paciente (con confirmación al activar) */}
                  <label className="flex items-center gap-2.5 cursor-pointer select-none">
                    <Switch
                      checked={doc.shared_with_patient}
                      disabled={togglingShareId === doc.id}
                      onCheckedChange={(next) => {
                        if (next) setSharingDoc(doc);
                        else void setShared(doc, false);
                      }}
                    />
                    <span className="text-xs text-muted-foreground">
                      {togglingShareId === doc.id
                        ? "Guardando…"
                        : doc.shared_with_patient
                        ? "Visible en el portal del paciente"
                        : "Compartir con el paciente"}
                    </span>
                  </label>

                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      className="rounded-lg flex-1 sm:flex-initial"
                      onClick={() => openDocument(doc, false)}
                      disabled={downloadingId === doc.id}
                    >
                      {downloadingId === doc.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <ExternalLink className="h-4 w-4" />
                      )}
                      <span className="ml-1.5">Ver</span>
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="rounded-lg flex-1 sm:flex-initial"
                      onClick={() => openDocument(doc, true)}
                      disabled={downloadingId === doc.id}
                    >
                      <Download className="h-4 w-4" />
                      <span className="ml-1.5 sm:hidden lg:inline">Descargar</span>
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="rounded-lg text-destructive hover:text-destructive hover:bg-destructive/5 border-destructive/30"
                      onClick={() => setDeletingDoc(doc)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>
            );
          })
        )}
        {documents.length > ITEMS_PER_PAGE && (
          <ListPagination
            currentPage={currentPage}
            totalPages={totalPages}
            onPageChange={setPage}
            totalItems={documents.length}
            pageSize={ITEMS_PER_PAGE}
          />
        )}
      </CardContent>

      {/* Upload metadata dialog */}
      <Dialog
        open={uploadOpen}
        onOpenChange={(open) => {
          if (!uploading) {
            setUploadOpen(open);
            if (!open) resetUploadForm();
          }
        }}
      >
        <DialogContent className="max-w-md">
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
            <div className="space-y-1">
              <Label>Tipo de documento</Label>
              <Select
                value={docType}
                onValueChange={(v) => setDocType(v as DocumentType)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="consentimiento">Consentimiento</SelectItem>
                  <SelectItem value="informe">Informe</SelectItem>
                  <SelectItem value="evaluacion">Evaluación</SelectItem>
                  <SelectItem value="indicaciones">Indicaciones / Material</SelectItem>
                  <SelectItem value="recibo">Recibo</SelectItem>
                  <SelectItem value="otro">Otro</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="doc-notes">Notas (opcional)</Label>
              <Textarea
                id="doc-notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={4}
                placeholder="Agregá una breve descripción del documento..."
                className="resize-y min-h-[100px]"
              />
            </div>
          </div>
          <DialogFooter className="flex-col-reverse sm:flex-row gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setUploadOpen(false);
                resetUploadForm();
              }}
              disabled={uploading}
              className="w-full sm:w-auto"
            >
              Cancelar
            </Button>
            <Button
              onClick={handleUpload}
              disabled={uploading || !pendingFile}
              className="w-full sm:w-auto"
            >
              {uploading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-1 animate-spin" /> Subiendo...
                </>
              ) : (
                <>
                  <Upload className="h-4 w-4 mr-1" /> Subir
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
              <span className="font-medium">{deletingDoc?.file_name}</span>. Esta
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