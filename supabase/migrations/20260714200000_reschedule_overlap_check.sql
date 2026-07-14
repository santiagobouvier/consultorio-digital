-- Solicitudes · aprobar reprogramación sin doble reserva:
-- las solicitudes del portal (Horarios 2.0) vienen sin casillero
-- (requested_slot_id NULL), y la verificación vieja solo miraba el estado
-- del casillero. Ahora, si no hay casillero, se verifica contra las CITAS:
-- si otra cita ocupa el nuevo horario, devuelve slot_unavailable.

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
    -- Flujo viejo por casillero (legacy)
    SELECT status INTO v_slot_status FROM public.availability_slots
      WHERE id = v_req.requested_slot_id FOR UPDATE;
    IF v_slot_status IS NULL OR v_slot_status <> 'available' THEN
      RETURN jsonb_build_object('ok', false, 'error', 'slot_unavailable',
        'message', 'Este horario ya no está disponible. Contactá al paciente para acordar otro.');
    END IF;
    UPDATE public.availability_slots SET status = 'booked', updated_at = now()
      WHERE id = v_req.requested_slot_id;
  ELSIF v_req.requested_slot_id IS NULL THEN
    -- Flujo nuevo (motor): verificar que ninguna otra cita ocupe el horario
    IF EXISTS (
      SELECT 1 FROM public.appointments a
      WHERE a.business_id = v_req.business_id
        AND a.id <> v_appt.id
        AND a.status NOT IN ('cancelled', 'cancelled_by_patient')
        AND (a.professional_id = v_appt.professional_id OR a.professional_id IS NULL OR v_appt.professional_id IS NULL)
        AND a.start_at < v_req.requested_end_at
        AND a.end_at > v_req.requested_start_at
    ) THEN
      RETURN jsonb_build_object('ok', false, 'error', 'slot_unavailable',
        'message', 'Ese horario se ocupó con otra cita. Contactá al paciente para acordar otro.');
    END IF;
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
