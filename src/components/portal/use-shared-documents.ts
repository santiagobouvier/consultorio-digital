import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import type { BusinessDocType } from "@/lib/document-types";

// Documentos compartidos con el paciente: un solo fetch para todo el portal.
// Alimenta la pestaña "Documentos" Y los adjuntos dentro de cada sesión del
// historial (misma data, dos vistas). El RLS garantiza que el paciente solo
// ve lo que el profesional compartió explícitamente.

export interface SharedDocument {
  id: string;
  business_id: string;
  appointment_id: string | null;
  file_path: string;
  file_name: string;
  file_size: number | null;
  mime_type: string | null;
  document_type: string;
  notes: string | null;
  shared_at: string | null;
  created_at: string;
  /** Fecha de la sesión a la que está anclado (join). */
  appointments?: { start_at: string } | null;
}

// Documentos ficticios para el modo demo: se ven, no se descargan.
export const DEMO_SHARED_DOCUMENTS: SharedDocument[] = [
  {
    id: "demo-doc-1",
    business_id: "demo",
    appointment_id: null,
    file_name: "Informe_de_evolucion.pdf",
    file_path: "demo",
    file_size: 186000,
    mime_type: "application/pdf",
    document_type: "informe",
    notes: null,
    shared_at: new Date(Date.now() - 5 * 86400000).toISOString(),
    created_at: new Date(Date.now() - 5 * 86400000).toISOString(),
  },
  {
    id: "demo-doc-2",
    business_id: "demo",
    appointment_id: null,
    file_name: "Ejercicios_para_casa.pdf",
    file_path: "demo",
    file_size: 92000,
    mime_type: "application/pdf",
    document_type: "indicaciones",
    notes: "Material trabajado en la última sesión.",
    shared_at: new Date(Date.now() - 12 * 86400000).toISOString(),
    created_at: new Date(Date.now() - 12 * 86400000).toISOString(),
  },
];

export function useSharedDocuments(patientId: string | null | undefined, isDemo: boolean) {
  const [documents, setDocuments] = useState<SharedDocument[]>([]);
  const [customTypes, setCustomTypes] = useState<BusinessDocType[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (isDemo) {
      setDocuments(DEMO_SHARED_DOCUMENTS);
      setLoading(false);
      return;
    }
    if (!patientId) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase
        .from("patient_documents")
        .select("id, business_id, appointment_id, file_path, file_name, file_size, mime_type, document_type, notes, shared_at, created_at, appointments(start_at)")
        .eq("patient_id", patientId)
        .eq("shared_with_patient", true)
        .order("shared_at", { ascending: false });
      if (cancelled) return;
      if (error) console.error("Error loading shared documents:", error);
      const docs = (data as unknown as SharedDocument[]) || [];
      setDocuments(docs);
      setLoading(false);

      // Tipos propios del consultorio (solo etiqueta e ícono): para mostrar
      // "Radiografía" con su ícono en vez de un código.
      const businessIds = Array.from(new Set(docs.map((d) => d.business_id)));
      if (businessIds.length > 0) {
        const { data: types } = await supabase
          .from("business_document_types")
          .select("id, label, icon")
          .in("business_id", businessIds);
        if (!cancelled) setCustomTypes((types as BusinessDocType[]) || []);
      }
    })();
    return () => { cancelled = true; };
  }, [patientId, isDemo]);

  return { documents, customTypes, loading };
}

/** Abrir o descargar un documento compartido (URL firmada, pop-up safe). */
export async function openSharedDocument(
  doc: SharedDocument,
  download: boolean,
  isDemo: boolean,
): Promise<void> {
  if (isDemo) {
    toast({ title: "Modo demo", description: "En tu portal real acá se abre el documento." });
    return;
  }
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
  }
}
