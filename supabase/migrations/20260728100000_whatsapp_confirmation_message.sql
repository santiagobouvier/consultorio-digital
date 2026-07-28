-- WhatsApp de CONFIRMACIÓN al agendar (además del recordatorio previo).
-- Al crearse una cita (o confirmarse una que estaba pendiente de pago), se
-- encola un aviso whatsapp tipo 'confirmation' con salida inmediata
-- (scheduled_for = now(); el robot de cada 5 min lo envía con la plantilla
-- "confirmacion_cita"). Requiere las mismas condiciones que el recordatorio:
-- canal whatsapp activo, número de contacto del profesional y teléfono del
-- paciente. Máximo una confirmación por cita (dedupe por tipo).

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
  v_wa_contact text;
  v_prof_name text;
  v_patient_name text;
  v_patient_phone text;
  v_patient_email text;
  v_reminder_template text;
  v_message text;
  v_wa_message text;
  v_confirm_message text;
  v_reminder_date timestamptz;
  v_owner_id uuid;
BEGIN
  -- Only trigger on new appointments or status change to confirmed
  IF TG_OP = 'INSERT' OR (TG_OP = 'UPDATE' AND OLD.status != 'confirmed' AND NEW.status = 'confirmed') THEN

    SELECT owner_user_id, COALESCE(portal_clinic_display_name, dashboard_display_name, name)
    INTO v_owner_id, v_prof_name
    FROM public.businesses WHERE id = NEW.business_id;

    SELECT
      COALESCE(cs.reminder_hours_before, 24),
      COALESCE(cs.auto_email_reminders, true),
      COALESCE(cs.auto_whatsapp_reminders, true),
      cs.whatsapp_contact_phone,
      cs.default_reminder_message
    INTO v_hours_before, v_auto_email, v_auto_whatsapp, v_wa_contact, v_reminder_template
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

    -- ── Confirmación por WhatsApp (salida inmediata) ──
    -- En INSERT solo si la cita no está esperando un pago para confirmarse;
    -- en UPDATE ya sabemos que acaba de pasar a confirmada.
    IF v_auto_whatsapp
       AND NEW.patient_id IS NOT NULL
       AND v_wa_contact IS NOT NULL AND btrim(v_wa_contact) <> ''
       AND v_patient_phone IS NOT NULL AND btrim(v_patient_phone) <> ''
       AND NEW.start_at > now()
       AND (TG_OP = 'UPDATE' OR COALESCE(NEW.status, '') <> 'pending_payment')
       AND NOT EXISTS (
         SELECT 1 FROM public.scheduled_reminders
         WHERE appointment_id = NEW.id
           AND type = 'confirmation'
       ) THEN
      v_confirm_message := 'Hola ' || split_part(COALESCE(v_patient_name, 'Paciente'), ' ', 1)
        || ' 👋 ¡Tu sesión con ' || COALESCE(v_prof_name, 'tu profesional') || ' quedó agendada! 📅 '
        || to_char(NEW.start_at AT TIME ZONE 'America/Montevideo', 'DD/MM/YYYY') || ' 🕐 '
        || to_char(NEW.start_at AT TIME ZONE 'America/Montevideo', 'HH24:MI')
        || ' hs. Si necesitás reprogramar o cancelar, escribile a tu profesional: '
        || v_wa_contact || ' ¡Nos vemos!';
      INSERT INTO public.scheduled_reminders
        (appointment_id, patient_id, business_id, scheduled_for, message, channel, type, status, auto_send)
      VALUES
        (NEW.id, NEW.patient_id, NEW.business_id, now(), v_confirm_message, 'whatsapp', 'confirmation', 'scheduled', true);
    END IF;

    IF v_reminder_date > now() THEN
      -- Email automático, solo si hay destinatario (dedupe por canal)
      IF v_auto_email AND v_patient_email IS NOT NULL AND v_patient_email <> ''
         AND NOT EXISTS (
           SELECT 1 FROM public.scheduled_reminders
           WHERE appointment_id = NEW.id
             AND type = 'reminder'
             AND channel = 'email'
             AND status <> 'cancelled'
         ) THEN
        INSERT INTO public.scheduled_reminders
          (appointment_id, patient_id, business_id, scheduled_for, message, channel, type, status, auto_send)
        VALUES
          (NEW.id, NEW.patient_id, NEW.business_id, v_reminder_date, v_message, 'email', 'reminder', 'scheduled', true);
      END IF;

      -- WhatsApp automático (API oficial): requiere paciente con teléfono y
      -- el número de contacto del profesional configurado en Recordatorios.
      IF v_auto_whatsapp
         AND NEW.patient_id IS NOT NULL
         AND v_wa_contact IS NOT NULL AND btrim(v_wa_contact) <> ''
         AND v_patient_phone IS NOT NULL AND btrim(v_patient_phone) <> ''
         AND NOT EXISTS (
           SELECT 1 FROM public.scheduled_reminders
           WHERE appointment_id = NEW.id
             AND type = 'reminder'
             AND channel = 'whatsapp'
             AND status <> 'cancelled'
         ) THEN
        v_wa_message := 'Hola ' || split_part(COALESCE(v_patient_name, 'Paciente'), ' ', 1)
          || ' 👋 Te recordamos tu próxima sesión con ' || COALESCE(v_prof_name, 'tu profesional') || ': 📅 '
          || to_char(NEW.start_at AT TIME ZONE 'America/Montevideo', 'DD/MM/YYYY') || ' 🕐 '
          || to_char(NEW.start_at AT TIME ZONE 'America/Montevideo', 'HH24:MI')
          || ' hs. Si necesitás reprogramar o cancelar, escribile a tu profesional: '
          || v_wa_contact || ' ¡Te esperamos!';
        INSERT INTO public.scheduled_reminders
          (appointment_id, patient_id, business_id, scheduled_for, message, channel, type, status, auto_send)
        VALUES
          (NEW.id, NEW.patient_id, NEW.business_id, v_reminder_date, v_wa_message, 'whatsapp', 'reminder', 'scheduled', true);
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;
