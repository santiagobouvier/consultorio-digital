
-- 1. TABLE
CREATE TABLE public.patient_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id uuid NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  type text NOT NULL CHECK (type IN (
    'appointment_confirmed',
    'appointment_cancelled_by_professional',
    'reschedule_approved',
    'reschedule_rejected',
    'payment_received'
  )),
  title text NOT NULL,
  body text NOT NULL,
  related_appointment_id uuid,
  related_payment_id uuid,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_pn_patient_created ON public.patient_notifications(patient_id, created_at DESC);
CREATE INDEX idx_pn_patient_unread ON public.patient_notifications(patient_id) WHERE read_at IS NULL;

-- 2. RLS
ALTER TABLE public.patient_notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY notif_patient_select_own ON public.patient_notifications
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.patients p WHERE p.id = patient_id AND p.auth_user_id = auth.uid()));

CREATE POLICY notif_patient_update_own ON public.patient_notifications
  FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.patients p WHERE p.id = patient_id AND p.auth_user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.patients p WHERE p.id = patient_id AND p.auth_user_id = auth.uid()));

CREATE POLICY notif_business_insert ON public.patient_notifications
  FOR INSERT TO authenticated
  WITH CHECK (public.user_belongs_to_business(auth.uid(), business_id));

CREATE POLICY notif_super_admin_all ON public.patient_notifications
  FOR ALL TO authenticated
  USING (public.is_super_admin(auth.uid()))
  WITH CHECK (public.is_super_admin(auth.uid()));

-- 3. REALTIME
ALTER TABLE public.patient_notifications REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.patient_notifications;

-- 4. TRIGGER appointments
CREATE OR REPLACE FUNCTION public.notify_patient_appointment_status()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_title text;
  v_body text;
  v_type text;
  v_when text;
BEGIN
  IF NEW.patient_id IS NULL THEN RETURN NEW; END IF;

  -- Guard: skip if old status was reschedule_requested (handled by RPCs)
  IF OLD.status = 'reschedule_requested' THEN
    RETURN NEW;
  END IF;

  v_when := to_char(NEW.start_at AT TIME ZONE 'America/Montevideo', 'DD/MM/YYYY HH24:MI');

  IF OLD.status = 'pending' AND NEW.status = 'scheduled' THEN
    v_type := 'appointment_confirmed';
    v_title := 'Cita confirmada';
    v_body := 'Tu cita del ' || v_when || ' fue confirmada.';
  ELSIF OLD.status <> 'cancelled' AND NEW.status IN ('cancelled', 'cancelled_by_professional') THEN
    v_type := 'appointment_cancelled_by_professional';
    v_title := 'Cita cancelada';
    v_body := 'Tu cita del ' || v_when || ' fue cancelada por el profesional.';
  ELSE
    RETURN NEW;
  END IF;

  INSERT INTO public.patient_notifications (patient_id, business_id, type, title, body, related_appointment_id)
  VALUES (NEW.patient_id, NEW.business_id, v_type, v_title, v_body, NEW.id);

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_patient_appointment ON public.appointments;
CREATE TRIGGER trg_notify_patient_appointment
  AFTER UPDATE OF status ON public.appointments
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_patient_appointment_status();

-- 5. TRIGGER payments
CREATE OR REPLACE FUNCTION public.notify_patient_payment_paid()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.patient_id IS NULL THEN RETURN NEW; END IF;
  IF OLD.status = 'paid' OR NEW.status <> 'paid' THEN RETURN NEW; END IF;

  INSERT INTO public.patient_notifications (patient_id, business_id, type, title, body, related_payment_id)
  VALUES (
    NEW.patient_id,
    NEW.business_id,
    'payment_received',
    'Pago registrado',
    'Tu pago de $' || NEW.amount::text || ' ' || NEW.currency || ' fue registrado.',
    NEW.id
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_patient_payment ON public.payments;
CREATE TRIGGER trg_notify_patient_payment
  AFTER UPDATE OF status ON public.payments
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_patient_payment_paid();

-- 6. RPC approve_reschedule_request (add notification)
CREATE OR REPLACE FUNCTION public.approve_reschedule_request(p_request_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_req public.appointment_reschedule_requests%ROWTYPE;
  v_appt public.appointments%ROWTYPE;
  v_slot_status text;
  v_when text;
BEGIN
  SELECT * INTO v_req FROM public.appointment_reschedule_requests
    WHERE id = p_request_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Solicitud no encontrada'; END IF;
  IF v_req.status <> 'pending' THEN RAISE EXCEPTION 'La solicitud ya fue resuelta'; END IF;

  IF NOT public.user_belongs_to_business(auth.uid(), v_req.business_id) THEN
    RAISE EXCEPTION 'Sin permisos';
  END IF;

  SELECT * INTO v_appt FROM public.appointments
    WHERE id = v_req.original_appointment_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Cita original no encontrada'; END IF;

  IF v_req.requested_slot_id IS NOT NULL
     AND v_req.requested_slot_id IS DISTINCT FROM v_appt.availability_slot_id THEN
    SELECT status INTO v_slot_status FROM public.availability_slots
      WHERE id = v_req.requested_slot_id FOR UPDATE;
    IF v_slot_status IS NULL OR v_slot_status <> 'available' THEN
      RETURN jsonb_build_object('ok', false, 'error', 'slot_unavailable',
        'message', 'Este horario ya no está disponible. Contactá al paciente para acordar otro.');
    END IF;
    UPDATE public.availability_slots SET status = 'booked', updated_at = now()
      WHERE id = v_req.requested_slot_id;
  END IF;

  IF v_appt.availability_slot_id IS NOT NULL
     AND v_appt.availability_slot_id IS DISTINCT FROM v_req.requested_slot_id THEN
    UPDATE public.availability_slots SET status = 'available', updated_at = now()
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

  v_when := to_char(v_req.requested_start_at AT TIME ZONE 'America/Montevideo', 'DD/MM/YYYY HH24:MI');
  INSERT INTO public.patient_notifications (patient_id, business_id, type, title, body, related_appointment_id)
  VALUES (v_appt.patient_id, v_req.business_id, 'reschedule_approved',
    'Reprogramación aprobada',
    'Tu solicitud fue aprobada. Nueva fecha: ' || v_when || '.',
    v_appt.id);

  RETURN jsonb_build_object('ok', true);
END;
$function$;

-- 7. RPC reject_reschedule_request (add notification)
CREATE OR REPLACE FUNCTION public.reject_reschedule_request(p_request_id uuid, p_rejection_reason text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_req public.appointment_reschedule_requests%ROWTYPE;
  v_appt public.appointments%ROWTYPE;
BEGIN
  SELECT * INTO v_req FROM public.appointment_reschedule_requests
    WHERE id = p_request_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Solicitud no encontrada'; END IF;
  IF v_req.status <> 'pending' THEN RAISE EXCEPTION 'La solicitud ya fue resuelta'; END IF;
  IF NOT public.user_belongs_to_business(auth.uid(), v_req.business_id) THEN
    RAISE EXCEPTION 'Sin permisos';
  END IF;

  UPDATE public.appointments
    SET status = 'scheduled', updated_at = now()
    WHERE id = v_req.original_appointment_id
      AND status = 'reschedule_requested'
    RETURNING * INTO v_appt;

  UPDATE public.appointment_reschedule_requests
    SET status = 'rejected', rejection_reason = p_rejection_reason, resolved_at = now()
    WHERE id = v_req.id;

  IF v_appt.patient_id IS NOT NULL THEN
    INSERT INTO public.patient_notifications (patient_id, business_id, type, title, body, related_appointment_id, metadata)
    VALUES (v_appt.patient_id, v_req.business_id, 'reschedule_rejected',
      'Reprogramación rechazada',
      COALESCE('Motivo: ' || p_rejection_reason, 'Tu solicitud de reprogramación fue rechazada.'),
      v_appt.id,
      jsonb_build_object('rejection_reason', p_rejection_reason));
  END IF;

  RETURN jsonb_build_object('ok', true);
END;
$function$;
