import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";
import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import {
  FileText,
  FileImage,
  FileType,
  Download,
  ExternalLink,
  FolderOpen,
  Loader2,
} from "lucide-react";

// "Mis documentos" en el portal del paciente: SOLO los documentos que el
// profesional compartió explícitamente (RLS garantiza que no vea otra cosa).

interface SharedDocument {
  id: string;
  file_path: string;
  file_name: string;
  file_size: number | null;
  mime_type: string | null;
  document_type: string;
  notes: string | null;
  shared_at: string | null;
  created_at: string;
}

interface PortalDocumentsProps {
  patientId: string;
  /** En el demo no hay sesión de paciente real: no se muestra la sección. */
  isDemo?: boolean;
}

const TYPE_LABELS: Record<string, string> = {
  consentimiento: "Consentimiento",
  informe: "Informe",
  evaluacion: "Evaluación",
  indicaciones: "Indicaciones / Material",
  recibo: "Recibo",
  otro: "Documento",
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

export const PortalDocuments = ({ patientId, isDemo = false }: PortalDocumentsProps) => {
  const [documents, setDocuments] = useState<SharedDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    if (isDemo || !patientId) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase
        .from("patient_documents")
        .select("id, file_path, file_name, file_size, mime_type, document_type, notes, shared_at, created_at")
        .eq("patient_id", patientId)
        .eq("shared_with_patient", true)
        .order("shared_at", { ascending: false });
      if (!cancelled) {
        if (error) console.error("Error loading shared documents:", error);
        setDocuments((data as SharedDocument[]) || []);
        setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [patientId, isDemo]);

  const openDocument = async (doc: SharedDocument, download: boolean) => {
    setBusyId(doc.id);
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
      console.error("Open shared document error:", err);
      toast({
        title: "No se pudo abrir el documento",
        description: "Probá de nuevo en unos segundos.",
        variant: "destructive",
      });
    } finally {
      setBusyId(null);
    }
  };

  // Sin documentos compartidos, la sección no existe (cero ruido)
  if (isDemo || loading || documents.length === 0) return null;

  return (
    <div className="space-y-3 lg:space-y-4 pt-2">
      <div className="flex items-center justify-between">
        <h2 className="text-lg lg:text-xl font-bold flex items-center gap-2">
          <FolderOpen className="h-5 w-5 text-primary" /> Mis documentos
        </h2>
        <Badge variant="secondary" className="text-xs">
          {documents.length} documento{documents.length !== 1 ? "s" : ""}
        </Badge>
      </div>
      <p className="text-xs text-muted-foreground -mt-1">
        Documentos que tu profesional compartió con vos.
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {documents.map((doc) => {
          const Icon = fileIcon(doc.mime_type);
          const sharedDate = doc.shared_at || doc.created_at;
          return (
            <Card key={doc.id} className="hover:shadow-md transition-all">
              <CardContent className="p-4 flex flex-col gap-3 h-full">
                <div className="flex items-start gap-3">
                  <div className="shrink-0 h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
                    <Icon className="h-5 w-5 text-primary" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold break-all leading-snug">{doc.file_name}</p>
                    <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                      <Badge variant="secondary" className="text-[10px]">
                        {TYPE_LABELS[doc.document_type] || "Documento"}
                      </Badge>
                      <span className="text-[11px] text-muted-foreground">
                        {format(parseISO(sharedDate), "d MMM yyyy", { locale: es })}
                        {doc.file_size ? ` · ${formatBytes(doc.file_size)}` : ""}
                      </span>
                    </div>
                    {doc.notes && (
                      <p className="text-xs text-muted-foreground mt-1.5 whitespace-pre-wrap break-words">
                        {doc.notes}
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex gap-2 mt-auto">
                  <Button
                    size="sm"
                    className="rounded-lg flex-1 gap-1.5"
                    onClick={() => openDocument(doc, false)}
                    disabled={busyId === doc.id}
                  >
                    {busyId === doc.id ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <ExternalLink className="h-4 w-4" />
                    )}
                    Ver
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="rounded-lg flex-1 gap-1.5"
                    onClick={() => openDocument(doc, true)}
                    disabled={busyId === doc.id}
                  >
                    <Download className="h-4 w-4" />
                    Descargar
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
};

export default PortalDocuments;
