-- Documentos compartidos con el paciente (Etapa 1):
--   * patient_documents.shared_with_patient: el profesional decide, por
--     documento, si el paciente lo ve en su portal (privado por defecto).
--   * RLS: el paciente SOLO puede leer sus documentos compartidos, tanto la
--     fila (metadatos) como el archivo en Storage.

ALTER TABLE public.patient_documents
  ADD COLUMN IF NOT EXISTS shared_with_patient boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS shared_at timestamptz;

-- Metadatos: el paciente ve solo lo suyo y solo lo compartido
DROP POLICY IF EXISTS patient_documents_patient_read ON public.patient_documents;
CREATE POLICY patient_documents_patient_read
ON public.patient_documents
FOR SELECT
USING (
  shared_with_patient = true
  AND EXISTS (
    SELECT 1 FROM public.patients p
    WHERE p.id = patient_documents.patient_id
      AND p.auth_user_id = auth.uid()
  )
);

-- Archivo en Storage: mismo criterio (necesario para Ver/Descargar)
DROP POLICY IF EXISTS "patient_documents_shared_read" ON storage.objects;
CREATE POLICY "patient_documents_shared_read"
ON storage.objects
FOR SELECT
USING (
  bucket_id = 'patient-documents'
  AND EXISTS (
    SELECT 1
    FROM public.patient_documents d
    JOIN public.patients p ON p.id = d.patient_id
    WHERE d.file_path = storage.objects.name
      AND d.shared_with_patient = true
      AND p.auth_user_id = auth.uid()
  )
);
