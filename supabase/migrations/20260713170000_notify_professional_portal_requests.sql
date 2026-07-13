-- Aviso por email al profesional cuando un paciente reserva o pide
-- reprogramar desde el portal. Server-side (trigger + pg_net), igual de
-- confiable que los recordatorios: no depende del navegador del paciente.

CREATE OR REPLACE FUNCTION public.notify_professional_portal_requests()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_email text;
  v_when text;
  v_subject text;
  v_message text;
BEGIN
  -- Reserva nueva desde el portal (pendiente de confirmación)
  IF TG_OP = 'INSERT' AND NEW.source = 'patient_portal' AND NEW.status = 'pending' THEN
    v_subject := 'Nueva reserva desde el portal';
    v_message := 'Un paciente reservó desde su portal para el %WHEN%.' || E'\n\n' ||
                 'La cita está pendiente de tu confirmación en el panel (Solicitudes).';
  -- Pedido de reprogramación
  ELSIF TG_OP = 'UPDATE' AND NEW.status = 'reschedule_requested' AND OLD.status IS DISTINCT FROM 'reschedule_requested' THEN
    v_subject := 'Solicitud de reprogramación';
    v_message := 'Un paciente pidió reprogramar su cita del %WHEN%.' || E'\n\n' ||
                 'Revisala y respondela desde tu panel (Solicitudes).';
  ELSE
    RETURN NEW;
  END IF;

  SELECT contact_email INTO v_email FROM public.businesses WHERE id = NEW.business_id;
  IF v_email IS NULL OR v_email = '' THEN
    RETURN NEW;
  END IF;

  v_when := to_char(NEW.start_at AT TIME ZONE 'America/Montevideo', 'DD/MM/YYYY HH24:MI');
  v_subject := v_subject || ' · ' || v_when;
  v_message := replace(v_message, '%WHEN%', v_when);

  PERFORM net.http_post(
    url := 'https://sfvuuzpmsgepooeamkin.supabase.co/functions/v1/send-resend-email',
    headers := jsonb_build_object('Content-Type', 'application/json'),
    body := jsonb_build_object(
      'to', v_email,
      'template', 'raw',
      'businessId', NEW.business_id,
      'data', jsonb_build_object('subject', v_subject, 'message', v_message)
    )
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_professional_portal_requests ON public.appointments;
CREATE TRIGGER trg_notify_professional_portal_requests
  AFTER INSERT OR UPDATE OF status ON public.appointments
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_professional_portal_requests();
