-- Migración 4: policies + RPCs de appointment_reschedule_requests

DROP POLICY IF EXISTS "reschedule_business_members_all" ON public.appointment_reschedule_requests;

-- SELECT: profesional dueño de la cita original
CREATE POLICY "reschedule_prof_select"
ON public.appointment_reschedule_requests
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.appointments a
    WHERE a.id = appointment_reschedule_requests.original_appointment_id
      AND a.professional_id = auth.uid()
  )
);

-- UPDATE: profesional dueño de la cita original (cambia status vía RPC con SECURITY DEFINER, pero dejamos esto por si se edita directo)
CREATE POLICY "reschedule_prof_update"
ON public.appointment_reschedule_requests
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.appointments a
    WHERE a.id = appointment_reschedule_requests.original_appointment_id
      AND a.professional_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.appointments a
    WHERE a.id = appointment_reschedule_requests.original_appointment_id
      AND a.professional_id = auth.uid()
  )
);

-- DELETE: profesional dueño de la cita original
CREATE POLICY "reschedule_prof_delete"
ON public.appointment_reschedule_requests
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.appointments a
    WHERE a.id = appointment_reschedule_requests.original_appointment_id
      AND a.professional_id = auth.uid()
  )
);

-- RPCs: cambiar chequeo de user_belongs_to_business → professional_id de la cita original O super_admin
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

  SELECT * INTO v_appt FROM public.appointments
    WHERE id = v_req.original_appointment_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Cita original no encontrada'; END IF;

  -- Permisos: profesional dueño de la cita o super admin
  IF NOT (v_appt.professional_id = auth.uid() OR public.is_super_admin(auth.uid())) THEN
    RAISE EXCEPTION 'Sin permisos';
  END IF;

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

CREATE OR REPLACE FUNCTION public.reject_reschedule_request(p_request_id uuid, p_rejection_reason text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_req public.appointment_reschedule_requests%ROWTYPE;
  v_appt public.appointments%ROWTYPE;
  v_appt_prof uuid;
BEGIN
  SELECT * INTO v_req FROM public.appointment_reschedule_requests
    WHERE id = p_request_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Solicitud no encontrada'; END IF;
  IF v_req.status <> 'pending' THEN RAISE EXCEPTION 'La solicitud ya fue resuelta'; END IF;

  SELECT professional_id INTO v_appt_prof FROM public.appointments
    WHERE id = v_req.original_appointment_id;

  IF NOT (v_appt_prof = auth.uid() OR public.is_super_admin(auth.uid())) THEN
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