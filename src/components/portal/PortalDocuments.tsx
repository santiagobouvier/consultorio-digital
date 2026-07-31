import { useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import { Download, ExternalLink, FolderOpen, Loader2, Search } from "lucide-react";
import { resolveDocType, type BusinessDocType } from "@/lib/document-types";
import {
  openSharedDocument,
  type SharedDocument,
} from "@/components/portal/use-shared-documents";

// Pestaña "Documentos" del portal del paciente: todo lo que el profesional
// compartió, en filas compactas con el ícono de su tipo, la sesión de la que
// viene (si tiene) y Ver/Descargar. Con buscador cuando se acumulan.

interface PortalDocumentsProps {
  documents: SharedDocument[];
  customTypes: BusinessDocType[];
  loading: boolean;
  /** En el demo se muestran documentos de ejemplo (nada se descarga). */
  isDemo?: boolean;
}

const formatBytes = (bytes: number | null) => {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

export const PortalDocuments = ({ documents, customTypes, loading, isDemo = false }: PortalDocumentsProps) => {
  const [busyId, setBusyId] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return documents;
    return documents.filter(
      (d) => d.file_name.toLowerCase().includes(q) || (d.notes || "").toLowerCase().includes(q),
    );
  }, [documents, search]);

  const open = async (doc: SharedDocument, download: boolean) => {
    setBusyId(doc.id);
    try {
      await openSharedDocument(doc, download, isDemo);
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <h2 className="text-lg lg:text-xl font-bold flex items-center gap-2">
          <FolderOpen className="h-5 w-5 text-primary" /> Mis documentos
        </h2>
        {documents.length > 0 && (
          <Badge variant="secondary" className="text-xs">
            {documents.length} documento{documents.length !== 1 ? "s" : ""}
          </Badge>
        )}
      </div>
      <p className="text-xs text-muted-foreground -mt-2">
        Todo lo que tu profesional compartió con vos: informes, materiales, recibos.
      </p>

      {loading ? (
        <div className="py-10 flex justify-center text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
        </div>
      ) : documents.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <FolderOpen className="h-12 w-12 text-muted-foreground/40 mx-auto mb-3" />
            <p className="text-muted-foreground font-medium">Todavía no hay documentos</p>
            <p className="text-xs text-muted-foreground mt-1 max-w-xs mx-auto">
              Cuando tu profesional te comparta un informe o material, aparece acá
              y te llega una notificación.
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          {documents.length > 5 && (
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar un documento..."
                className="h-10 pl-9 rounded-xl text-sm"
              />
            </div>
          )}

          {filtered.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">
              Nada coincide con la búsqueda.
            </p>
          ) : (
            <div className="space-y-2">
              {filtered.map((doc) => {
                const { label, Icon } = resolveDocType(doc.document_type, customTypes);
                const sharedDate = doc.shared_at || doc.created_at;
                return (
                  <div
                    key={doc.id}
                    className="flex items-center gap-2.5 sm:gap-3 rounded-xl border bg-card hover:shadow-sm transition-all px-3 py-2.5"
                  >
                    <div className="shrink-0 h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
                      <Icon className="h-5 w-5 text-primary" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold truncate leading-snug" title={doc.file_name}>
                        {doc.file_name}
                      </p>
                      <p className="text-[11px] text-muted-foreground truncate mt-0.5">
                        {label}
                        {" · "}{format(parseISO(sharedDate), "d MMM yyyy", { locale: es })}
                        {doc.appointments?.start_at
                          ? ` · Sesión del ${format(parseISO(doc.appointments.start_at), "d MMM", { locale: es })}`
                          : ""}
                        {doc.file_size ? ` · ${formatBytes(doc.file_size)}` : ""}
                        {doc.notes ? ` · ${doc.notes}` : ""}
                      </p>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <Button
                        size="sm"
                        className="rounded-lg h-9 gap-1.5 px-2.5 sm:px-3"
                        onClick={() => void open(doc, false)}
                        disabled={busyId === doc.id}
                      >
                        {busyId === doc.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <ExternalLink className="h-4 w-4" />
                        )}
                        <span className="hidden sm:inline">Ver</span>
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        title="Descargar"
                        className="rounded-lg h-9 w-9 p-0"
                        onClick={() => void open(doc, true)}
                        disabled={busyId === doc.id}
                      >
                        <Download className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default PortalDocuments;
