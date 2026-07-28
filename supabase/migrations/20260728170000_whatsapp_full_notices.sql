-- Avisos completos por WhatsApp:
--   * Al PACIENTE: cancelación de sesión (plantilla cancelacion_sesion).
--   * Al PROFESIONAL (a su whatsapp_contact_phone): nueva reserva online
--     (nueva_reserva_pro), cancelación del paciente (cancelacion_pro) y
--     pedido de reprogramación (reprogramacion_pro).
-- Los avisos al profesional guardan recipient_phone (destino ≠ paciente) y
-- wa_params (los parámetros ya armados para la plantilla).

ALTER TABLE public.scheduled_reminders
  ADD COLUMN IF NOT EXISTS recipient_phone text,
  ADD COLUMN IF NOT EXISTS wa_params jsonb;

-- ── 1) auto_create_reminders: + aviso al profesional por reserva pública ──
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
  v_prof_first text;
  v_patient_name text;
  v_patient_phone text;
  v_patient_email text;
  v_reminder_template text;
  v_message text;
  v_wa_message text;
  v_confirm_message text;
  v_pro_message text;
  v_reminder_date timestamptz;
  v_owner_id uuid;
  v_fecha text;
  v_hora text;
BEGIN
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

    v_fecha := to_char(NEW.start_at AT TIME ZONE 'America/Montevideo', 'DD/MM/YYYY');
    v_hora := to_char(NEW.start_at AT TIME ZONE 'America/Montevideo', 'HH24:MI');

    v_reminder_template := COALESCE(v_reminder_template,
      'Hola {{paciente}}, te recuerdo tu sesión del {{fecha}} a las {{hora}}. Modalidad: {{modalidad}}.');

    v_message := replace(v_reminder_template, '{{paciente}}', COALESCE(v_patient_name, 'Paciente'));
    v_message := replace(v_message, '{{fecha}}', v_fecha);
    v_message := replace(v_message, '{{hora}}', v_hora);
    v_message := replace(v_message, '{{modalidad}}', CASE WHEN NEW.modality = 'online' THEN 'Online' ELSE 'Presencial' END);
    v_message := replace(v_message, '{{link}}', COALESCE(NEW.location, ''));

    v_reminder_date := NEW.start_at - (v_hours_before || ' hours')::interval;

    -- Confirmación por WhatsApp al paciente (salida inmediata)
    IF v_auto_whatsapp
       AND NEW.patient_id IS NOT NULL
       AND v_wa_contact IS NOT NULL AND btrim(v_wa_contact) <> ''
       AND v_patient_phone IS NOT NULL AND btrim(v_patient_phone) <> ''
       AND NEW.start_at > now()
       AND (TG_OP = 'UPDATE' OR COALESCE(NEW.status, '') <> 'pending_payment')
       AND NOT EXISTS (
         SELECT 1 FROM public.scheduled_reminders
         WHERE appointment_id = NEW.id AND type = 'confirmation'
       ) THEN
      v_confirm_message := 'Hola ' || split_part(COALESCE(v_patient_name, 'Paciente'), ' ', 1)
        || ' 👋 ¡Tu sesión con ' || COALESCE(v_prof_name, 'tu profesional') || ' quedó agendada! 📅 '
        || v_fecha || ' 🕐 ' || v_hora
        || ' hs. Si necesitás reprogramar o cancelar, escribile a tu profesional: '
        || v_wa_contact || ' ¡Nos vemos!';
      INSERT INTO public.scheduled_reminders
        (appointment_id, patient_id, business_id, scheduled_for, message, channel, type, status, auto_send)
      VALUES
        (NEW.id, NEW.patient_id, NEW.business_id, now(), v_confirm_message, 'whatsapp', 'confirmation', 'scheduled', true);
    END IF;

    -- Aviso al PROFESIONAL por reserva pública (salida inmediata)
    IF v_auto_whatsapp
       AND NEW.source = 'public_booking'
       AND v_wa_contact IS NOT NULL AND btrim(v_wa_contact) <> ''
       AND NEW.start_at > now()
       AND (TG_OP = 'UPDATE' OR COALESCE(NEW.status, '') <> 'pending_payment')
       AND NOT EXISTS (
         SELECT 1 FROM public.scheduled_reminders
         WHERE appointment_id = NEW.id AND type = 'pro_new_booking'
       ) THEN
      SELECT split_part(COALESCE(p.name, 'Profesional'), ' ', 1) INTO v_prof_first
      FROM public.profiles p WHERE p.id = v_owner_id;
      v_prof_first := COALESCE(v_prof_first, 'Profesional');
      v_pro_message := 'Hola ' || v_prof_first || ' 👋 ¡Nueva reserva en tu consultorio! 🧑 '
        || COALESCE(v_patient_name, 'Paciente') || ' 📅 ' || v_fecha || ' 🕐 ' || v_hora
        || ' hs. La cita ya está confirmada en tu agenda.';
      INSERT INTO public.scheduled_reminders
        (appointment_id, patient_id, business_id, scheduled_for, message, channel, type, status, auto_send, recipient_phone, wa_params)
      VALUES
        (NEW.id, NEW.patient_id, NEW.business_id, now(), v_pro_message, 'whatsapp', 'pro_new_booking', 'scheduled', true, v_wa_contact,
         jsonb_build_array(v_prof_first, COALESCE(v_patient_name, 'Paciente'), v_fecha, v_hora));
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

      -- Recordatorio por WhatsApp al paciente
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
          || v_fecha || ' 🕐 ' || v_hora
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

-- ── 2) sync_reminders_on_appointment_change: + avisos de cancelación ──
CREATE OR REPLACE FUNCTION public.sync_reminders_on_appointment_change()
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
  v_prof_first text;
  v_patient_name text;
  v_patient_phone text;
  v_patient_email text;
  v_reminder_template text;
  v_message text;
  v_wa_message text;
  v_resched_message text;
  v_cancel_message text;
  v_pro_message text;
  v_reminder_date timestamptz;
  v_owner_id uuid;
  v_fecha text;
  v_hora text;
BEGIN
  -- 1) Cancelación: matar los recordatorios programados + avisar
  IF NEW.status IN ('cancelled', 'cancelled_by_patient')
     AND OLD.status NOT IN ('cancelled', 'cancelled_by_patient') THEN

    UPDATE public.scheduled_reminders
    SET status = 'cancelled'
    WHERE appointment_id = NEW.id
      AND status = 'scheduled';

    -- Avisos solo para citas futuras con paciente identificado
    IF NEW.start_at > now() AND NEW.patient_id IS NOT NULL THEN
      SELECT owner_user_id, COALESCE(portal_clinic_display_name, dashboard_display_name, name)
      INTO v_owner_id, v_prof_name
      FROM public.businesses WHERE id = NEW.business_id;

      SELECT COALESCE(cs.auto_whatsapp_reminders, true), cs.whatsapp_contact_phone
      INTO v_auto_whatsapp, v_wa_contact
      FROM public.clinic_settings cs WHERE cs.user_id = v_owner_id;

      SELECT full_name, whatsapp_phone
      INTO v_patient_name, v_patient_phone
      FROM public.patients WHERE id = NEW.patient_id;

      v_fecha := to_char(NEW.start_at AT TIME ZONE 'America/Montevideo', 'DD/MM/YYYY');
      v_hora := to_char(NEW.start_at AT TIME ZONE 'America/Montevideo', 'HH24:MI');

      -- Cancelada por el PROFESIONAL -> avisar al paciente por WhatsApp.
      -- Dedupe de 2 minutos: si se cancela una serie entera, un solo aviso.
      IF NEW.status = 'cancelled'
         AND v_auto_whatsapp
         AND v_wa_contact IS NOT NULL AND btrim(v_wa_contact) <> ''
         AND v_patient_phone IS NOT NULL AND btrim(v_patient_phone) <> ''
         AND NOT EXISTS (
           SELECT 1 FROM public.scheduled_reminders
           WHERE patient_id = NEW.patient_id
             AND type = 'cancellation'
             AND created_at > now() - interval '2 minutes'
         ) THEN
        v_cancel_message := 'Hola ' || split_part(COALESCE(v_patient_name, 'Paciente'), ' ', 1)
          || ', te avisamos que tu sesión con ' || COALESCE(v_prof_name, 'tu profesional')
          || ' fue cancelada: 📅 ' || v_fecha || ' 🕐 ' || v_hora
          || ' hs. Si fue un error o querés reagendar, escribile a tu profesional: '
          || v_wa_contact || ' Gracias!';
        INSERT INTO public.scheduled_reminders
          (appointment_id, patient_id, business_id, scheduled_for, message, channel, type, status, auto_send)
        VALUES
          (NEW.id, NEW.patient_id, NEW.business_id, now(), v_cancel_message, 'whatsapp', 'cancellation', 'scheduled', true);
      END IF;

      -- Cancelada por el PACIENTE -> avisar al profesional por WhatsApp.
      IF NEW.status = 'cancelled_by_patient'
         AND v_auto_whatsapp
         AND v_wa_contact IS NOT NULL AND btrim(v_wa_contact) <> ''
         AND NOT EXISTS (
           SELECT 1 FROM public.scheduled_reminders
           WHERE patient_id = NEW.patient_id
             AND type = 'pro_cancellation'
             AND created_at > now() - interval '2 minutes'
         ) THEN
        SELECT split_part(COALESCE(p.name, 'Profesional'), ' ', 1) INTO v_prof_first
        FROM public.profiles p WHERE p.id = v_owner_id;
        v_prof_first := COALESCE(v_prof_first, 'Profesional');
        v_pro_message := 'Hola ' || v_prof_first || ', ' || COALESCE(v_patient_name, 'un paciente')
          || ' canceló su sesión: 📅 ' || v_fecha || ' 🕐 ' || v_hora
          || ' hs. Ese horario quedó libre en tu agenda.';
        INSERT INTO public.scheduled_reminders
          (appointment_id, patient_id, business_id, scheduled_for, message, channel, type, status, auto_send, recipient_phone, wa_params)
        VALUES
          (NEW.id, NEW.patient_id, NEW.business_id, now(), v_pro_message, 'whatsapp', 'pro_cancellation', 'scheduled', true, v_wa_contact,
           jsonb_build_array(v_prof_first, COALESCE(v_patient_name, 'Un paciente'), v_fecha, v_hora));
      END IF;
    END IF;

    RETURN NEW;
  END IF;

  -- 2) Reprogramación: recrear los recordatorios con la fecha nueva
  IF NEW.start_at IS DISTINCT FROM OLD.start_at
     AND NEW.status NOT IN ('cancelled', 'cancelled_by_patient') THEN

    UPDATE public.scheduled_reminders
    SET status = 'cancelled'
    WHERE appointment_id = NEW.id
      AND status = 'scheduled';

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

    v_fecha := to_char(NEW.start_at AT TIME ZONE 'America/Montevideo', 'DD/MM/YYYY');
    v_hora := to_char(NEW.start_at AT TIME ZONE 'America/Montevideo', 'HH24:MI');

    v_reminder_template := COALESCE(v_reminder_template,
      'Hola {{paciente}}, te recuerdo tu sesión del {{fecha}} a las {{hora}}. Modalidad: {{modalidad}}.');

    v_message := replace(v_reminder_template, '{{paciente}}', COALESCE(v_patient_name, 'Paciente'));
    v_message := replace(v_message, '{{fecha}}', v_fecha);
    v_message := replace(v_message, '{{hora}}', v_hora);
    v_message := replace(v_message, '{{modalidad}}', CASE WHEN NEW.modality = 'online' THEN 'Online' ELSE 'Presencial' END);
    v_message := replace(v_message, '{{link}}', COALESCE(NEW.location, ''));

    v_reminder_date := NEW.start_at - (v_hours_before || ' hours')::interval;

    -- Aviso inmediato de reprogramación por WhatsApp (solo citas futuras)
    IF v_auto_whatsapp
       AND NEW.patient_id IS NOT NULL
       AND v_wa_contact IS NOT NULL AND btrim(v_wa_contact) <> ''
       AND v_patient_phone IS NOT NULL AND btrim(v_patient_phone) <> ''
       AND NEW.start_at > now() THEN
      v_resched_message := 'Hola ' || split_part(COALESCE(v_patient_name, 'Paciente'), ' ', 1)
        || ' 👋 Tu sesión con ' || COALESCE(v_prof_name, 'tu profesional') || ' fue reprogramada. La nueva fecha es: 📅 '
        || v_fecha || ' 🕐 ' || v_hora
        || ' hs. Si el nuevo horario no te sirve o fue un error, escribile a tu profesional: '
        || v_wa_contact || ' ¡Gracias!';
      INSERT INTO public.scheduled_reminders
        (appointment_id, patient_id, business_id, scheduled_for, message, channel, type, status, auto_send)
      VALUES
        (NEW.id, NEW.patient_id, NEW.business_id, now(), v_resched_message, 'whatsapp', 'reschedule', 'scheduled', true);
    END IF;

    IF v_reminder_date > now() THEN
      IF v_auto_email
         AND v_patient_email IS NOT NULL AND v_patient_email <> '' THEN
        INSERT INTO public.scheduled_reminders
          (appointment_id, patient_id, business_id, scheduled_for, message, channel, type, status, auto_send)
        VALUES
          (NEW.id, NEW.patient_id, NEW.business_id, v_reminder_date, v_message, 'email', 'reminder', 'scheduled', true);
      END IF;

      IF v_auto_whatsapp
         AND NEW.patient_id IS NOT NULL
         AND v_wa_contact IS NOT NULL AND btrim(v_wa_contact) <> ''
         AND v_patient_phone IS NOT NULL AND btrim(v_patient_phone) <> '' THEN
        v_wa_message := 'Hola ' || split_part(COALESCE(v_patient_name, 'Paciente'), ' ', 1)
          || ' 👋 Te recordamos tu próxima sesión con ' || COALESCE(v_prof_name, 'tu profesional') || ': 📅 '
          || v_fecha || ' 🕐 ' || v_hora
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

-- ── 3) Aviso al profesional cuando un paciente pide reprogramar ──
CREATE OR REPLACE FUNCTION public.notify_pro_on_reschedule_request()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_business_id uuid;
  v_patient_id uuid;
  v_owner_id uuid;
  v_auto_whatsapp boolean := true;
  v_wa_contact text;
  v_prof_first text;
  v_patient_name text;
  v_fecha text;
  v_hora text;
  v_msg text;
BEGIN
  SELECT a.business_id, a.patient_id
  INTO v_business_id, v_patient_id
  FROM public.appointments a WHERE a.id = NEW.original_appointment_id;
  IF v_business_id IS NULL THEN RETURN NEW; END IF;

  SELECT owner_user_id INTO v_owner_id FROM public.businesses WHERE id = v_business_id;

  SELECT COALESCE(cs.auto_whatsapp_reminders, true), cs.whatsapp_contact_phone
  INTO v_auto_whatsapp, v_wa_contact
  FROM public.clinic_settings cs WHERE cs.user_id = v_owner_id;

  IF NOT COALESCE(v_auto_whatsapp, true)
     OR v_wa_contact IS NULL OR btrim(v_wa_contact) = '' THEN
    RETURN NEW;
  END IF;

  SELECT full_name INTO v_patient_name FROM public.patients WHERE id = v_patient_id;
  SELECT split_part(COALESCE(p.name, 'Profesional'), ' ', 1) INTO v_prof_first
  FROM public.profiles p WHERE p.id = v_owner_id;
  v_prof_first := COALESCE(v_prof_first, 'Profesional');

  v_fecha := to_char(NEW.requested_start_at AT TIME ZONE 'America/Montevideo', 'DD/MM/YYYY');
  v_hora := to_char(NEW.requested_start_at AT TIME ZONE 'America/Montevideo', 'HH24:MI');

  v_msg := 'Hola ' || v_prof_first || ', ' || COALESCE(v_patient_name, 'un paciente')
    || ' pidió reprogramar su sesión para: 📅 ' || v_fecha || ' 🕐 ' || v_hora
    || ' hs. Entrá a tu panel para aprobarla o rechazarla.';

  INSERT INTO public.scheduled_reminders
    (appointment_id, patient_id, business_id, scheduled_for, message, channel, type, status, auto_send, recipient_phone, wa_params)
  VALUES
    (NEW.original_appointment_id, v_patient_id, v_business_id, now(), v_msg, 'whatsapp', 'pro_reschedule', 'scheduled', true, v_wa_contact,
     jsonb_build_array(v_prof_first, COALESCE(v_patient_name, 'Un paciente'), v_fecha, v_hora));

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_pro_on_reschedule_request ON public.appointment_reschedule_requests;
CREATE TRIGGER trg_notify_pro_on_reschedule_request
  AFTER INSERT ON public.appointment_reschedule_requests
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_pro_on_reschedule_request();
