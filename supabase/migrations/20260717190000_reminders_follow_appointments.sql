-- Los recordatorios siguen a la cita:
--   * Cita cancelada  -> su recordatorio programado se cancela (antes quedaba
--     vivo y el paciente recibía el aviso de una cita inexistente).
--   * Cita reprogramada -> el recordatorio viejo se cancela y se crea uno
--     nuevo con la fecha/hora nuevas (antes salía en el momento viejo y con
--     la fecha vieja en el texto).

CREATE OR REPLACE FUNCTION public.sync_reminders_on_appointment_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_hours_before integer := 24;
  v_auto_email boolean := true;
  v_patient_name text;
  v_patient_phone text;
  v_patient_email text;
  v_reminder_template text;
  v_message text;
  v_reminder_date timestamptz;
  v_owner_id uuid;
BEGIN
  -- 1) Cancelación: matar los recordatorios programados de la cita
  IF NEW.status IN ('cancelled', 'cancelled_by_patient')
     AND OLD.status NOT IN ('cancelled', 'cancelled_by_patient') THEN
    UPDATE public.scheduled_reminders
    SET status = 'cancelled'
    WHERE appointment_id = NEW.id
      AND status = 'scheduled';
    RETURN NEW;
  END IF;

  -- 2) Reprogramación: recrear el recordatorio con la fecha nueva
  IF NEW.start_at IS DISTINCT FROM OLD.start_at
     AND NEW.status NOT IN ('cancelled', 'cancelled_by_patient') THEN

    UPDATE public.scheduled_reminders
    SET status = 'cancelled'
    WHERE appointment_id = NEW.id
      AND status = 'scheduled';

    SELECT owner_user_id INTO v_owner_id FROM public.businesses WHERE id = NEW.business_id;

    SELECT
      COALESCE(cs.reminder_hours_before, 24),
      COALESCE(cs.auto_email_reminders, true),
      cs.default_reminder_message
    INTO v_hours_before, v_auto_email, v_reminder_template
    FROM public.clinic_settings cs
    WHERE cs.user_id = v_owner_id;

    IF NEW.patient_id IS NOT NULL THEN
      SELECT full_name, whatsapp_phone, email
      INTO v_patient_name, v_patient_phone, v_patient_email
      FROM public.patients WHERE id = NEW.patient_id;
    ELSE
      v_patient_name := COALESCE(NEW.contact_name, 'Paciente');
      v_patient_phone := NEW.contact_phone;
      v_patient_email := NEW.contact_email;
    END IF;

    v_reminder_template := COALESCE(v_reminder_template,
      'Hola {{paciente}}, te recuerdo tu sesión del {{fecha}} a las {{hora}}. Modalidad: {{modalidad}}.');

    v_message := replace(v_reminder_template, '{{paciente}}', COALESCE(v_patient_name, 'Paciente'));
    v_message := replace(v_message, '{{fecha}}', to_char(NEW.start_at AT TIME ZONE 'America/Montevideo', 'DD/MM/YYYY'));
    v_message := replace(v_message, '{{hora}}', to_char(NEW.start_at AT TIME ZONE 'America/Montevideo', 'HH24:MI'));
    v_message := replace(v_message, '{{modalidad}}', CASE WHEN NEW.modality = 'online' THEN 'Online' ELSE 'Presencial' END);
    v_message := replace(v_message, '{{link}}', COALESCE(NEW.location, ''));

    v_reminder_date := NEW.start_at - (v_hours_before || ' hours')::interval;

    IF v_reminder_date > now()
       AND v_auto_email
       AND v_patient_email IS NOT NULL AND v_patient_email <> '' THEN
      INSERT INTO public.scheduled_reminders
        (appointment_id, patient_id, business_id, scheduled_for, message, channel, type, status, auto_send)
      VALUES
        (NEW.id, NEW.patient_id, NEW.business_id, v_reminder_date, v_message, 'email', 'reminder', 'scheduled', true);
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_reminders_on_appointment_change ON public.appointments;
CREATE TRIGGER trg_sync_reminders_on_appointment_change
  AFTER UPDATE OF status, start_at ON public.appointments
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_reminders_on_appointment_change();

-- Saneo: cancelar recordatorios programados de citas ya canceladas
UPDATE public.scheduled_reminders sr
SET status = 'cancelled'
WHERE sr.status = 'scheduled'
  AND EXISTS (
    SELECT 1 FROM public.appointments a
    WHERE a.id = sr.appointment_id
      AND a.status IN ('cancelled', 'cancelled_by_patient')
  );
