-- ============================================================
-- 1. businesses
-- ============================================================
ALTER TABLE public.businesses
  ADD COLUMN IF NOT EXISTS cancellation_hours_notice integer NOT NULL DEFAULT 24,
  ADD COLUMN IF NOT EXISTS late_cancellation_message text;

-- ============================================================
-- 2. appointments
-- ============================================================
ALTER TABLE public.appointments
  ADD COLUMN IF NOT EXISTS cancelled_at timestamptz,
  ADD COLUMN IF NOT EXISTS cancellation_reason text,
  ADD COLUMN IF NOT EXISTS cancelled_by uuid;

-- ============================================================
-- 3. appointment_reschedule_requests
-- ============================================================
CREATE TABLE IF NOT EXISTS public.appointment_reschedule_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL,
  original_appointment_id uuid NOT NULL,
  requested_slot_id uuid,
  requested_start_at timestamptz NOT NULL,
  requested_end_at timestamptz NOT NULL,
  reason text,
  status text NOT NULL DEFAULT 'pending',
  rejection_reason text,
  requested_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz,
  CONSTRAINT reschedule_status_valid
    CHECK (status IN ('pending','approved','rejected','cancelled'))
);

CREATE INDEX IF NOT EXISTS idx_reschedule_requests_business
  ON public.appointment_reschedule_requests(business_id);
CREATE INDEX IF NOT EXISTS idx_reschedule_requests_appointment
  ON public.appointment_reschedule_requests(original_appointment_id);
CREATE INDEX IF NOT EXISTS idx_reschedule_requests_status
  ON public.appointment_reschedule_requests(status);

ALTER TABLE public.appointment_reschedule_requests ENABLE ROW LEVEL SECURITY;

DROP TRIGGER IF EXISTS trg_reschedule_requests_updated_at
  ON public.appointment_reschedule_requests;
CREATE TRIGGER trg_reschedule_requests_updated_at
  BEFORE UPDATE ON public.appointment_reschedule_requests
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP POLICY IF EXISTS "reschedule_business_members_all" ON public.appointment_reschedule_requests;
CREATE POLICY "reschedule_business_members_all"
  ON public.appointment_reschedule_requests
  FOR ALL
  USING (public.user_belongs_to_business(auth.uid(), business_id))
  WITH CHECK (public.user_belongs_to_business(auth.uid(), business_id));

DROP POLICY IF EXISTS "reschedule_patient_select_own" ON public.appointment_reschedule_requests;
CREATE POLICY "reschedule_patient_select_own"
  ON public.appointment_reschedule_requests
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.appointments a
      JOIN public.patients p ON p.id = a.patient_id
      WHERE a.id = appointment_reschedule_requests.original_appointment_id
        AND p.auth_user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "reschedule_patient_insert_own" ON public.appointment_reschedule_requests;
CREATE POLICY "reschedule_patient_insert_own"
  ON public.appointment_reschedule_requests
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.appointments a
      JOIN public.patients p ON p.id = a.patient_id
      WHERE a.id = original_appointment_id
        AND p.auth_user_id = auth.uid()
        AND a.business_id = appointment_reschedule_requests.business_id
    )
  );

DROP POLICY IF EXISTS "reschedule_super_admin_all" ON public.appointment_reschedule_requests;
CREATE POLICY "reschedule_super_admin_all"
  ON public.appointment_reschedule_requests
  FOR ALL
  USING (public.is_super_admin(auth.uid()))
  WITH CHECK (public.is_super_admin(auth.uid()));

-- ============================================================
-- 4. Trigger: blindar UPDATE del paciente en appointments
-- ============================================================
CREATE OR REPLACE FUNCTION public.enforce_patient_appointment_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_is_patient_owner boolean;
  v_is_business_member boolean;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM public.patients p
    WHERE p.id = OLD.patient_id
      AND p.auth_user_id = auth.uid()
  ) INTO v_is_patient_owner;

  SELECT public.user_belongs_to_business(auth.uid(), OLD.business_id)
    INTO v_is_business_member;

  IF v_is_business_member THEN
    RETURN NEW;
  END IF;

  IF v_is_patient_owner THEN
    IF NEW.status NOT IN ('cancelled_by_patient', 'reschedule_requested') THEN
      RAISE EXCEPTION 'Pacientes solo pueden cambiar status a cancelled_by_patient o reschedule_requested';
    END IF;

    IF NEW.start_at <> OLD.start_at
       OR NEW.end_at <> OLD.end_at
       OR NEW.patient_id IS DISTINCT FROM OLD.patient_id
       OR NEW.professional_id IS DISTINCT FROM OLD.professional_id
       OR NEW.availability_slot_id IS DISTINCT FROM OLD.availability_slot_id
       OR NEW.business_id <> OLD.business_id
       OR NEW.modality IS DISTINCT FROM OLD.modality
       OR NEW.service_id IS DISTINCT FROM OLD.service_id
       OR NEW.payment_status IS DISTINCT FROM OLD.payment_status
    THEN
      RAISE EXCEPTION 'Pacientes no pueden modificar horario, profesional, slot ni datos de la cita';
    END IF;

    RETURN NEW;
  END IF;

  RAISE EXCEPTION 'Sin permisos para modificar esta cita';
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_patient_appointment_update
  ON public.appointments;
CREATE TRIGGER trg_enforce_patient_appointment_update
  BEFORE UPDATE ON public.appointments
  FOR EACH ROW EXECUTE FUNCTION public.enforce_patient_appointment_update();

-- ============================================================
-- 5. RLS: paciente puede UPDATE su cita (trigger blinda el resto)
-- ============================================================
DROP POLICY IF EXISTS "appointments_patient_update_own" ON public.appointments;
CREATE POLICY "appointments_patient_update_own"
  ON public.appointments
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.patients p
      WHERE p.id = appointments.patient_id
        AND p.auth_user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.patients p
      WHERE p.id = appointments.patient_id
        AND p.auth_user_id = auth.uid()
    )
    AND status IN ('cancelled_by_patient', 'reschedule_requested')
  );

-- ============================================================
-- 6. RPC: approve_reschedule_request
-- ============================================================
CREATE OR REPLACE FUNCTION public.approve_reschedule_request(p_request_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_req public.appointment_reschedule_requests%ROWTYPE;
  v_appt public.appointments%ROWTYPE;
  v_slot_status text;
BEGIN
  SELECT * INTO v_req FROM public.appointment_reschedule_requests
    WHERE id = p_request_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Solicitud no encontrada';
  END IF;
  IF v_req.status <> 'pending' THEN
    RAISE EXCEPTION 'La solicitud ya fue resuelta';
  END IF;

  IF NOT public.user_belongs_to_business(auth.uid(), v_req.business_id) THEN
    RAISE EXCEPTION 'Sin permisos';
  END IF;

  SELECT * INTO v_appt FROM public.appointments
    WHERE id = v_req.original_appointment_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Cita original no encontrada';
  END IF;

  -- Validar y reservar slot nuevo (si es distinto al original)
  IF v_req.requested_slot_id IS NOT NULL
     AND v_req.requested_slot_id IS DISTINCT FROM v_appt.availability_slot_id THEN
    SELECT status INTO v_slot_status FROM public.availability_slots
      WHERE id = v_req.requested_slot_id FOR UPDATE;
    IF v_slot_status IS NULL OR v_slot_status <> 'available' THEN
      RETURN jsonb_build_object(
        'ok', false,
        'error', 'slot_unavailable',
        'message', 'Este horario ya no está disponible. Contactá al paciente para acordar otro.'
      );
    END IF;
    UPDATE public.availability_slots
      SET status = 'booked', updated_at = now()
      WHERE id = v_req.requested_slot_id;
  END IF;

  -- Liberar slot original solo si es distinto al solicitado
  IF v_appt.availability_slot_id IS NOT NULL
     AND v_appt.availability_slot_id IS DISTINCT FROM v_req.requested_slot_id THEN
    UPDATE public.availability_slots
      SET status = 'available', updated_at = now()
      WHERE id = v_appt.availability_slot_id;
  END IF;

  UPDATE public.appointments
    SET start_at = v_req.requested_start_at,
        end_at = v_req.requested_end_at,
        availability_slot_id = v_req.requested_slot_id,
        status = 'scheduled',
        updated_at = now()
    WHERE id = v_appt.id;

  UPDATE public.appointment_reschedule_requests
    SET status = 'approved', resolved_at = now()
    WHERE id = v_req.id;

  RETURN jsonb_build_object('ok', true);
END;
$$;

-- ============================================================
-- 7. RPC: reject_reschedule_request
-- ============================================================
CREATE OR REPLACE FUNCTION public.reject_reschedule_request(
  p_request_id uuid,
  p_rejection_reason text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_req public.appointment_reschedule_requests%ROWTYPE;
BEGIN
  SELECT * INTO v_req FROM public.appointment_reschedule_requests
    WHERE id = p_request_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Solicitud no encontrada';
  END IF;
  IF v_req.status <> 'pending' THEN
    RAISE EXCEPTION 'La solicitud ya fue resuelta';
  END IF;
  IF NOT public.user_belongs_to_business(auth.uid(), v_req.business_id) THEN
    RAISE EXCEPTION 'Sin permisos';
  END IF;

  UPDATE public.appointments
    SET status = 'scheduled', updated_at = now()
    WHERE id = v_req.original_appointment_id
      AND status = 'reschedule_requested';

  UPDATE public.appointment_reschedule_requests
    SET status = 'rejected',
        rejection_reason = p_rejection_reason,
        resolved_at = now()
    WHERE id = v_req.id;

  RETURN jsonb_build_object('ok', true);
END;
$$;