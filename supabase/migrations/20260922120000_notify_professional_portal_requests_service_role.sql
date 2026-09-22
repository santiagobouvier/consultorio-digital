-- send-resend-email dejó de aceptar la anon key (es pública): solo la
-- service role o un profesional logueado. Este trigger la llamaba con la
-- anon key desde pg_net, así que ahora toma la service role de Vault.
--
-- Requisito de despliegue (una sola vez, desde el SQL Editor de Supabase,
-- nunca en una migración ni en un chat):
--   select vault.create_secret('<SUPABASE_SERVICE_ROLE_KEY>', 'edge_service_role_key');
-- Si el secreto no existe, la reserva/reprogramación se guarda igual y el
-- aviso por email al profesional se omite con un WARNING en los logs.

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
  v_key text;
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

  BEGIN
    SELECT decrypted_secret INTO v_key
    FROM vault.decrypted_secrets
    WHERE name = 'edge_service_role_key'
    LIMIT 1;
  EXCEPTION WHEN OTHERS THEN
    v_key := NULL;
  END;

  IF v_key IS NULL OR v_key = '' THEN
    RAISE WARNING 'notify_professional_portal_requests: falta el secreto edge_service_role_key en Vault; aviso por email omitido';
    RETURN NEW;
  END IF;

  v_when := to_char(NEW.start_at AT TIME ZONE 'America/Montevideo', 'DD/MM/YYYY HH24:MI');
  v_subject := v_subject || ' · ' || v_when;
  v_message := replace(v_message, '%WHEN%', v_when);

  PERFORM net.http_post(
    url := 'https://sfvuuzpmsgepooeamkin.supabase.co/functions/v1/send-resend-email',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || v_key
    ),
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
