-- 1) Schema: nuevas columnas en patients
ALTER TABLE public.patients
  ADD COLUMN IF NOT EXISTS assigned_professional_id uuid,
  ADD COLUMN IF NOT EXISTS created_by uuid;

-- 2) Backfill conservador: asignar al owner del business
UPDATE public.patients p
SET assigned_professional_id = b.owner_user_id
FROM public.businesses b
WHERE p.business_id = b.id
  AND p.assigned_professional_id IS NULL;

UPDATE public.patients p
SET created_by = b.owner_user_id
FROM public.businesses b
WHERE p.business_id = b.id
  AND p.created_by IS NULL;

-- 3) Índice para lookups por profesional
CREATE INDEX IF NOT EXISTS idx_patients_assigned_prof
  ON public.patients(assigned_professional_id);

CREATE INDEX IF NOT EXISTS idx_patients_created_by
  ON public.patients(created_by);

-- 4) Helpers SECURITY DEFINER (reusables por todas las policies derivadas)
CREATE OR REPLACE FUNCTION public.is_patient_professional(_user_id uuid, _patient_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.patients p
    WHERE p.id = _patient_id
      AND (
        p.assigned_professional_id = _user_id
        OR p.created_by = _user_id
      )
  );
$$;

CREATE OR REPLACE FUNCTION public.is_patient_owner_auth(_user_id uuid, _patient_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.patients p
    WHERE p.id = _patient_id AND p.auth_user_id = _user_id
  );
$$;

-- 5) Trigger BEFORE INSERT: default created_by y assigned_professional_id al auth.uid()
CREATE OR REPLACE FUNCTION public.patients_set_defaults_bi()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Si no hay usuario autenticado (service role / migración), no forzar nada
  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;

  IF NEW.created_by IS NULL THEN
    NEW.created_by := auth.uid();
  END IF;

  IF NEW.assigned_professional_id IS NULL THEN
    NEW.assigned_professional_id := auth.uid();
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS patients_set_defaults_bi_trg ON public.patients;
CREATE TRIGGER patients_set_defaults_bi_trg
  BEFORE INSERT ON public.patients
  FOR EACH ROW
  EXECUTE FUNCTION public.patients_set_defaults_bi();

-- 6) Trigger BEFORE UPDATE: proteger campos sensibles (solo super_admin puede reasignar)
CREATE OR REPLACE FUNCTION public.patients_protect_sensitive_bu()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
BEGIN
  -- Bypass para service role / migraciones
  IF v_uid IS NULL THEN
    RETURN NEW;
  END IF;

  -- Super admin puede todo
  IF public.is_super_admin(v_uid) THEN
    RETURN NEW;
  END IF;

  -- Bloquear cambios a campos sensibles para cualquier otro rol
  -- (profesional asignado, creador, paciente vía self-update)
  IF NEW.assigned_professional_id IS DISTINCT FROM OLD.assigned_professional_id THEN
    RAISE EXCEPTION 'Solo un super admin puede reasignar el profesional del paciente';
  END IF;

  IF NEW.business_id IS DISTINCT FROM OLD.business_id THEN
    RAISE EXCEPTION 'No se puede cambiar el consultorio de un paciente existente';
  END IF;

  IF NEW.created_by IS DISTINCT FROM OLD.created_by THEN
    RAISE EXCEPTION 'No se puede modificar el creador del paciente';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS patients_protect_sensitive_bu_trg ON public.patients;
CREATE TRIGGER patients_protect_sensitive_bu_trg
  BEFORE UPDATE ON public.patients
  FOR EACH ROW
  EXECUTE FUNCTION public.patients_protect_sensitive_bu();