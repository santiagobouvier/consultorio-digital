-- Recordatorios: solo canal automático (email) hasta conectar la API de
-- WhatsApp. El flujo manual de WhatsApp (pending_manual + wa.me) se retira:
--   * auto_create_reminders deja de crear recordatorios whatsapp manuales;
--   * los pending_manual existentes se cancelan (nunca van a enviarse solos).
-- Cuando se conecte la API oficial, este trigger vuelve a crear el canal
-- whatsapp pero con auto_send = true.

CREATE OR REPLACE FUNCTION public.auto_create_reminders()
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
  -- Only trigger on new appointments or status change to confirmed
  IF TG_OP = 'INSERT' OR (TG_OP = 'UPDATE' AND OLD.status != 'confirmed' AND NEW.status = 'confirmed') THEN

    -- Idempotency guard: if a reminder already exists for this appointment,
    -- do nothing.
    IF EXISTS (
      SELECT 1 FROM public.scheduled_reminders
      WHERE appointment_id = NEW.id
        AND type = 'reminder'
        AND status <> 'cancelled'
    ) THEN
      RETURN NEW;
    END IF;

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

    IF v_reminder_date > now() THEN
      -- Email automático, solo si hay destinatario
      IF v_auto_email AND v_patient_email IS NOT NULL AND v_patient_email <> '' THEN
        INSERT INTO public.scheduled_reminders
          (appointment_id, patient_id, business_id, scheduled_for, message, channel, type, status, auto_send)
        VALUES
          (NEW.id, NEW.patient_id, NEW.business_id, v_reminder_date, v_message, 'email', 'reminder', 'scheduled', true);
      END IF;
      -- Canal whatsapp: se reincorpora (auto_send = true) al conectar la API.
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- Los whatsapp manuales que quedaron esperando no van a enviarse nunca solos:
-- se cancelan para que no confundan en el panel nuevo.
UPDATE public.scheduled_reminders
SET status = 'cancelled'
WHERE channel = 'whatsapp'
  AND status = 'pending_manual';
