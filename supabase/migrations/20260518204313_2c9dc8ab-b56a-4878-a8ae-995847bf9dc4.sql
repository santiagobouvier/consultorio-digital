CREATE OR REPLACE FUNCTION public.enforce_patient_appointment_update()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_is_patient_owner boolean;
  v_is_business_member boolean;
BEGIN
  -- Bypass cuando no hay usuario autenticado (service role, migraciones)
  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;

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
$function$;