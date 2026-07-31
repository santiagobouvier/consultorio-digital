-- Fix: el CHECK original de patient_documents.document_type solo aceptaba
-- los 6 tipos de fábrica, y rompía al subir con un tipo propio del
-- consultorio (que se guarda por su uuid de business_document_types).
-- Se reemplaza por: tipo de fábrica O formato uuid.

ALTER TABLE public.patient_documents
  DROP CONSTRAINT IF EXISTS patient_documents_document_type_check;

ALTER TABLE public.patient_documents
  ADD CONSTRAINT patient_documents_document_type_check
  CHECK (
    document_type IN ('consentimiento', 'informe', 'evaluacion', 'indicaciones', 'recibo', 'otro')
    OR document_type ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  );
