-- Expediente por sesión: los documentos pueden anclarse a una cita concreta
-- ("el informe del 28/7 vive en la sesión del 28/7"). Nullable: los
-- documentos generales del paciente siguen existiendo sin sesión.

ALTER TABLE public.patient_documents
  ADD COLUMN IF NOT EXISTS appointment_id uuid REFERENCES public.appointments(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_patient_documents_appointment
  ON public.patient_documents(appointment_id);
