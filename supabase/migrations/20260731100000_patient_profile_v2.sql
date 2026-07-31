-- Perfil de paciente v2 (julio 2026)
--
-- 1. Campos nuevos en `patients`: datos personales, contacto de emergencia,
--    adulto responsable y administrativos. Todos nullable — la reserva pública
--    crea pacientes solo con nombre, email y teléfono y no se debe romper.
--    El paciente puede leer su propia fila desde el portal, así que acá van
--    SOLO datos que no son un problema si el propio paciente los ve.
--
-- 2. Tabla nueva `patient_clinical_status`: el estado clínico presente
--    (medicación, diagnóstico, antecedentes, riesgo, estado del tratamiento).
--    Va en tabla aparte a propósito: las políticas RLS de Postgres son por
--    fila, no por columna, y el paciente tiene SELECT/UPDATE sobre su propia
--    fila de `patients`. Si esto fueran columnas ahí, el paciente podría leer
--    (y escribir) su propio diagnóstico y flag de riesgo directo contra la
--    API. En esta tabla el paciente no tiene NINGUNA política: solo accede
--    el profesional a cargo (mismo modelo que session_notes).
--
-- Los "enums" van como text + CHECK, no como tipos enum de Postgres.

-- ============ 1. Columnas nuevas en patients ============

ALTER TABLE public.patients
  -- Datos personales
  ADD COLUMN IF NOT EXISTS birth_date date,
  ADD COLUMN IF NOT EXISTS document_id text,
  -- Contacto de emergencia
  ADD COLUMN IF NOT EXISTS emergency_contact_name text,
  ADD COLUMN IF NOT EXISTS emergency_contact_relationship text,
  ADD COLUMN IF NOT EXISTS emergency_contact_phone text,
  -- Adulto responsable (menores)
  ADD COLUMN IF NOT EXISTS guardian_name text,
  ADD COLUMN IF NOT EXISTS guardian_relationship text,
  ADD COLUMN IF NOT EXISTS guardian_phone text,
  ADD COLUMN IF NOT EXISTS guardian_email text,
  -- Administrativo
  ADD COLUMN IF NOT EXISTS health_insurance text,
  ADD COLUMN IF NOT EXISTS payment_type text,
  ADD COLUMN IF NOT EXISTS first_consultation_date date,
  ADD COLUMN IF NOT EXISTS referred_by text,
  -- Tratamiento (no clínico-sensible: la frecuencia acordada la conoce el paciente)
  ADD COLUMN IF NOT EXISTS agreed_frequency text;

ALTER TABLE public.patients
  DROP CONSTRAINT IF EXISTS patients_payment_type_check,
  ADD CONSTRAINT patients_payment_type_check
    CHECK (payment_type IS NULL OR payment_type IN ('particular', 'convenio'));

ALTER TABLE public.patients
  DROP CONSTRAINT IF EXISTS patients_agreed_frequency_check,
  ADD CONSTRAINT patients_agreed_frequency_check
    CHECK (agreed_frequency IS NULL OR agreed_frequency IN ('semanal', 'quincenal', 'mensual', 'sin_frecuencia')),
  DROP CONSTRAINT IF EXISTS patients_birth_date_check,
  ADD CONSTRAINT patients_birth_date_check
    CHECK (birth_date IS NULL OR birth_date <= CURRENT_DATE);

-- ============ 2. Estado clínico: tabla aparte, solo profesional ============

CREATE TABLE IF NOT EXISTS public.patient_clinical_status (
  patient_id uuid PRIMARY KEY REFERENCES public.patients(id) ON DELETE CASCADE,
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  treatment_status text CHECK (treatment_status IS NULL OR treatment_status IN ('activo', 'en_pausa', 'alta', 'abandono')),
  current_medication text,
  current_diagnosis text,
  medical_history text,
  risk_flag text NOT NULL DEFAULT 'ninguno' CHECK (risk_flag IN ('ninguno', 'seguimiento', 'riesgo_alto')),
  risk_notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_patient_clinical_status_business
  ON public.patient_clinical_status (business_id);

DROP TRIGGER IF EXISTS set_patient_clinical_status_updated_at ON public.patient_clinical_status;
CREATE TRIGGER set_patient_clinical_status_updated_at
  BEFORE UPDATE ON public.patient_clinical_status
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.patient_clinical_status ENABLE ROW LEVEL SECURITY;

-- Grants explícitos (no confiamos en los default privileges: ya nos pasó
-- con businesses que faltara un GRANT y se rompiera producción).
REVOKE ALL ON public.patient_clinical_status FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.patient_clinical_status TO authenticated;
GRANT ALL ON public.patient_clinical_status TO service_role;

-- Sin política para pacientes ni para anon: estructuralmente inaccesible
-- desde el portal del paciente y la reserva pública.

CREATE POLICY patient_clinical_status_select_prof
ON public.patient_clinical_status FOR SELECT TO authenticated
USING (
  is_super_admin(auth.uid())
  OR is_patient_professional(auth.uid(), patient_id)
);

CREATE POLICY patient_clinical_status_insert_prof
ON public.patient_clinical_status FOR INSERT TO authenticated
WITH CHECK (
  user_belongs_to_business(auth.uid(), business_id)
  AND (is_super_admin(auth.uid()) OR is_patient_professional(auth.uid(), patient_id))
);

CREATE POLICY patient_clinical_status_update_prof
ON public.patient_clinical_status FOR UPDATE TO authenticated
USING (
  is_super_admin(auth.uid())
  OR is_patient_professional(auth.uid(), patient_id)
)
WITH CHECK (
  is_super_admin(auth.uid())
  OR is_patient_professional(auth.uid(), patient_id)
);

CREATE POLICY patient_clinical_status_delete_prof
ON public.patient_clinical_status FOR DELETE TO authenticated
USING (
  is_super_admin(auth.uid())
  OR is_patient_professional(auth.uid(), patient_id)
);
