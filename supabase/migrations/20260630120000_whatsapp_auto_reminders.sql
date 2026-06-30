-- Make WhatsApp reminders auto-send (previously created as 'pending_manual'
-- because there was no sending API). Now that send-whatsapp (Twilio) exists,
-- the auto_create_reminders trigger creates WhatsApp reminders the same way as
-- email: status 'scheduled' + auto_send true, so the process-scheduled-reminders
-- cron delivers them automatically. Gated by clinic_settings.auto_whatsapp_reminders.

CREATE OR REPLACE FUNCTION public.auto_create_reminders()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_hours_before integer := 24;
  v_auto_email boolean := true;
  v_auto_whatsapp boolean := true;
  v_patient_name text;
  v_patient_phone text;
  v_reminder_template text;
  v_message text;
  v_reminder_date timestamptz;
  v_owner_id uuid;
BEGIN
  -- Only trigger on new appointments or status change to confirmed
  IF TG_OP = 'INSERT' OR (TG_OP = 'UPDATE' AND OLD.status != 'confirmed' AND NEW.status = 'confirmed') THEN

    -- Get business owner for clinic_settings lookup
    SELECT owner_user_id INTO v_owner_id FROM public.businesses WHERE id = NEW.business_id;

    -- Load clinic settings
    SELECT
      COALESCE(cs.reminder_hours_before, 24),
      COALESCE(cs.auto_email_reminders, true),
      COALESCE(cs.auto_whatsapp_reminders, true),
      cs.default_reminder_message
    INTO v_hours_before, v_auto_email, v_auto_whatsapp, v_reminder_template
    FROM public.clinic_settings cs
    WHERE cs.user_id = v_owner_id;

    -- Get patient info
    IF NEW.patient_id IS NOT NULL THEN
      SELECT full_name, whatsapp_phone INTO v_patient_name, v_patient_phone
      FROM public.patients WHERE id = NEW.patient_id;
    ELSE
      v_patient_name := COALESCE(NEW.contact_name, 'Paciente');
      v_patient_phone := NEW.contact_phone;
    END IF;

    -- Build message
    v_reminder_template := COALESCE(v_reminder_template,
      'Hola {{paciente}}, te recuerdo tu sesión del {{fecha}} a las {{hora}}. Modalidad: {{modalidad}}.');

    v_message := replace(v_reminder_template, '{{paciente}}', COALESCE(v_patient_name, 'Paciente'));
    v_message := replace(v_message, '{{fecha}}', to_char(NEW.start_at AT TIME ZONE 'America/Montevideo', 'DD/MM/YYYY'));
    v_message := replace(v_message, '{{hora}}', to_char(NEW.start_at AT TIME ZONE 'America/Montevideo', 'HH24:MI'));
    v_message := replace(v_message, '{{modalidad}}', CASE WHEN NEW.modality = 'online' THEN 'Online' ELSE 'Presencial' END);
    v_message := replace(v_message, '{{link}}', COALESCE(NEW.location, ''));

    -- Calculate reminder date
    v_reminder_date := NEW.start_at - (v_hours_before || ' hours')::interval;

    -- Don't create reminders for past dates
    IF v_reminder_date > now() THEN
      -- Create email reminder (auto-send)
      IF v_auto_email THEN
        INSERT INTO public.scheduled_reminders
          (appointment_id, patient_id, business_id, scheduled_for, message, channel, type, status, auto_send)
        VALUES
          (NEW.id, NEW.patient_id, NEW.business_id, v_reminder_date, v_message, 'email', 'reminder', 'scheduled', true);
      END IF;

      -- Create WhatsApp reminder (auto-send via Twilio)
      IF v_auto_whatsapp AND v_patient_phone IS NOT NULL THEN
        INSERT INTO public.scheduled_reminders
          (appointment_id, patient_id, business_id, scheduled_for, message, channel, type, status, auto_send)
        VALUES
          (NEW.id, NEW.patient_id, NEW.business_id, v_reminder_date, v_message, 'whatsapp', 'reminder', 'scheduled', true);
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;
