-- CD-001 · Credencial dedicada para el trigger que avisa al profesional por
-- email cuando un paciente reserva o pide reprogramar desde el portal.
--
-- Antes el trigger llamaba a send-resend-email con la anon key (pública).
-- La service role no puede cargarse en Vault en Lovable Cloud, así que se usa
-- un token propio de mínimo alcance:
--   * lo genera esta migración (256 bits aleatorios, pgcrypto) y lo guarda en
--     Vault con el nombre portal_notify_token — nunca queda en el repo, en
--     logs ni en el frontend;
--   * el trigger lo lee de Vault y lo manda como Bearer por pg_net;
--   * send-resend-email NO lee el token: pregunta a la base si el presentado
--     es el vigente (verify_portal_notify_token → boolean, solo service_role)
--     y, con ese token, solo acepta la plantilla cerrada portal_notice: texto
--     fijo y destinatario resuelto en el servidor (businesses.contact_email);
--   * rotación:  select public.rotate_portal_notify_token();
--   * apagado:   select public.revoke_portal_notify_token();  (el trigger
--     sigue guardando la cita y omite el aviso con WARNING; volver a aplicar
--     esta migración o rotar lo reactiva).
--
-- Idempotente y protegida con lock: aplicarla dos veces no regenera el token
-- ni duplica el secreto (vault.secrets.name no tiene índice único).
-- Requisitos verificados en el proyecto: Vault 0.3.1, pgcrypto en el esquema
-- extensions, migraciones con rol postgres y USAGE sobre vault.
-- Checklist de aplicación y verificación (sin exponer secretos):
--   supabase/functions/send-resend-email/README.md

-- ── 1) Token en Vault (solo si no existe) ──
-- (hashtext acá solo deriva la clave numérica del advisory lock; no
--  interviene en ninguna comparación de secretos.)
DO $$
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext('portal_notify_token'));
  IF NOT EXISTS (SELECT 1 FROM vault.secrets WHERE name = 'portal_notify_token') THEN
    PERFORM vault.create_secret(
      encode(extensions.gen_random_bytes(32), 'hex'),
      'portal_notify_token',
      'Token del trigger notify_professional_portal_requests hacia send-resend-email (CD-001)'
    );
    RAISE NOTICE 'portal_notify_token: creado en Vault';
  ELSE
    RAISE NOTICE 'portal_notify_token: ya existía en Vault, se conserva';
  END IF;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'portal_notify_token: no se pudo crear en Vault (%). Los avisos por email al profesional quedan omitidos hasta resolverlo; ver supabase/functions/send-resend-email/README.md', SQLERRM;
END $$;

-- ── 2) Verificación del token: la edge function pregunta, la base responde ──
-- Devuelve boolean; el secreto nunca sale de Vault. Se comparan digests
-- SHA-256 (pgcrypto): la igualdad de bytea no es de tiempo constante, pero
-- lo que se compara son hashes, así que el timing no revela el token.
CREATE OR REPLACE FUNCTION public.verify_portal_notify_token(p_token text)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, vault, extensions
AS $$
DECLARE
  v_secret text;
BEGIN
  IF p_token IS NULL OR p_token !~ '^[0-9a-f]{64}$' THEN
    RETURN false;
  END IF;
  SELECT decrypted_secret INTO v_secret
  FROM vault.decrypted_secrets
  WHERE name = 'portal_notify_token'
  ORDER BY created_at DESC
  LIMIT 1;
  IF v_secret IS NULL OR v_secret = '' THEN
    RETURN false;
  END IF;
  RETURN extensions.digest(p_token, 'sha256') = extensions.digest(v_secret, 'sha256');
END;
$$;

REVOKE ALL ON FUNCTION public.verify_portal_notify_token(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.verify_portal_notify_token(text) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.verify_portal_notify_token(text) TO service_role;

-- ── 3) Rotación y apagado (solo desde SQL como postgres; sin EXECUTE para roles de API) ──
CREATE OR REPLACE FUNCTION public.rotate_portal_notify_token()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, vault, extensions
AS $$
DECLARE
  v_id uuid;
  v_new text := encode(extensions.gen_random_bytes(32), 'hex');
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext('portal_notify_token'));
  SELECT id INTO v_id FROM vault.secrets WHERE name = 'portal_notify_token' ORDER BY created_at DESC LIMIT 1;
  IF v_id IS NULL THEN
    PERFORM vault.create_secret(v_new, 'portal_notify_token',
      'Token del trigger notify_professional_portal_requests hacia send-resend-email (CD-001)');
  ELSE
    PERFORM vault.update_secret(v_id, v_new);
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.revoke_portal_notify_token()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, vault
AS $$
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext('portal_notify_token'));
  DELETE FROM vault.secrets WHERE name = 'portal_notify_token';
END;
$$;

REVOKE ALL ON FUNCTION public.rotate_portal_notify_token() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.rotate_portal_notify_token() FROM anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.revoke_portal_notify_token() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.revoke_portal_notify_token() FROM anon, authenticated, service_role;

-- ── 4) Trigger: manda el token dedicado y la plantilla cerrada ──
CREATE OR REPLACE FUNCTION public.notify_professional_portal_requests()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_kind text;
  v_when text;
  v_token text;
BEGIN
  -- Reserva nueva desde el portal (pendiente de confirmación)
  IF TG_OP = 'INSERT' AND NEW.source = 'patient_portal' AND NEW.status = 'pending' THEN
    v_kind := 'new_booking';
  -- Pedido de reprogramación
  ELSIF TG_OP = 'UPDATE' AND NEW.status = 'reschedule_requested' AND OLD.status IS DISTINCT FROM 'reschedule_requested' THEN
    v_kind := 'reschedule_request';
  ELSE
    RETURN NEW;
  END IF;

  -- Sin email de contacto no hay a quién avisar (la función lo recomprueba)
  IF NOT EXISTS (
    SELECT 1 FROM public.businesses
    WHERE id = NEW.business_id AND contact_email IS NOT NULL AND contact_email <> ''
  ) THEN
    RETURN NEW;
  END IF;

  BEGIN
    SELECT decrypted_secret INTO v_token
    FROM vault.decrypted_secrets
    WHERE name = 'portal_notify_token'
    ORDER BY created_at DESC
    LIMIT 1;
  EXCEPTION WHEN OTHERS THEN
    v_token := NULL;
  END;

  IF v_token IS NULL OR v_token = '' THEN
    RAISE WARNING 'notify_professional_portal_requests: falta portal_notify_token en Vault; aviso por email omitido';
    RETURN NEW;
  END IF;

  v_when := to_char(NEW.start_at AT TIME ZONE 'America/Montevideo', 'DD/MM/YYYY HH24:MI');

  PERFORM net.http_post(
    url := 'https://sfvuuzpmsgepooeamkin.supabase.co/functions/v1/send-resend-email',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || v_token
    ),
    body := jsonb_build_object(
      'template', 'portal_notice',
      'businessId', NEW.business_id,
      'data', jsonb_build_object('kind', v_kind, 'when', v_when)
    )
  );

  RETURN NEW;
END;
$$;

-- El trigger ya existe (20260713170000); se reafirma por si se aplica en una base nueva.
DROP TRIGGER IF EXISTS trg_notify_professional_portal_requests ON public.appointments;
CREATE TRIGGER trg_notify_professional_portal_requests
  AFTER INSERT OR UPDATE OF status ON public.appointments
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_professional_portal_requests();

-- ── 5) Constancia al aplicar (solo presencia, nunca el valor) ──
DO $$
DECLARE
  v_present boolean := false;
BEGIN
  BEGIN
    SELECT EXISTS (SELECT 1 FROM vault.secrets WHERE name = 'portal_notify_token') INTO v_present;
  EXCEPTION WHEN OTHERS THEN
    v_present := false;
  END;
  IF v_present THEN
    RAISE NOTICE 'notify_professional_portal_requests: portal_notify_token presente en Vault';
  ELSE
    RAISE WARNING 'notify_professional_portal_requests: portal_notify_token AUSENTE en Vault; avisos por email al profesional omitidos (ver supabase/functions/send-resend-email/README.md)';
  END IF;
END $$;
