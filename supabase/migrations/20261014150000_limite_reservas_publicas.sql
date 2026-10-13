-- Límite de reservas públicas (public-book-appointment).
--
-- La reserva pública no pide sesión: sin límite, un script podía crear
-- pacientes y citas en serie (y disparar avisos por WhatsApp/email a cargo
-- del consultorio). La función registra cada intento y dice si se pasa de:
--   * por conexión (IP, guardada como HMAC, nunca en claro):
--       8 en 10 minutos y 20 en 24 horas;
--   * por teléfono en el mismo consultorio (HMAC): 4 en 24 horas;
--   * por consultorio (todas las conexiones): 60 por hora.
-- Solo la usa la edge function con service_role. Los intentos se borran a
-- los 2 días. Idempotente.

CREATE TABLE IF NOT EXISTS public.public_booking_attempts (
  id bigserial PRIMARY KEY,
  client_key text,
  business_id uuid NOT NULL,
  phone_key text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS public_booking_attempts_client_idx
  ON public.public_booking_attempts (client_key, created_at);
CREATE INDEX IF NOT EXISTS public_booking_attempts_business_idx
  ON public.public_booking_attempts (business_id, created_at);
CREATE INDEX IF NOT EXISTS public_booking_attempts_created_idx
  ON public.public_booking_attempts (created_at);

-- Sin acceso desde la API (RLS sin políticas + sin permisos)
ALTER TABLE public.public_booking_attempts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.public_booking_attempts FROM anon, authenticated;

-- Devuelve NULL si el intento se acepta (y lo registra) o el nombre del
-- límite superado (y no lo registra).
CREATE OR REPLACE FUNCTION public.register_public_booking_attempt(
  p_client_key text,
  p_business_id uuid,
  p_phone_key text
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_now timestamptz := now();
BEGIN
  IF p_business_id IS NULL THEN
    RAISE EXCEPTION 'business_id requerido';
  END IF;

  -- Intentos simultáneos de la misma conexión se evalúan de a uno
  PERFORM pg_advisory_xact_lock(hashtext('public_booking:' || coalesce(p_client_key, p_business_id::text)));

  IF p_client_key IS NOT NULL THEN
    IF (SELECT count(*) FROM public.public_booking_attempts
        WHERE client_key = p_client_key AND created_at > v_now - interval '10 minutes') >= 8 THEN
      RETURN 'client_10min';
    END IF;
    IF (SELECT count(*) FROM public.public_booking_attempts
        WHERE client_key = p_client_key AND created_at > v_now - interval '24 hours') >= 20 THEN
      RETURN 'client_day';
    END IF;
  END IF;

  IF p_phone_key IS NOT NULL AND (SELECT count(*) FROM public.public_booking_attempts
      WHERE business_id = p_business_id AND phone_key = p_phone_key
        AND created_at > v_now - interval '24 hours') >= 4 THEN
    RETURN 'phone_day';
  END IF;

  IF (SELECT count(*) FROM public.public_booking_attempts
      WHERE business_id = p_business_id AND created_at > v_now - interval '1 hour') >= 60 THEN
    RETURN 'business_hour';
  END IF;

  INSERT INTO public.public_booking_attempts (client_key, business_id, phone_key)
  VALUES (p_client_key, p_business_id, p_phone_key);

  DELETE FROM public.public_booking_attempts WHERE created_at < v_now - interval '2 days';

  RETURN NULL;
END;
$$;

REVOKE ALL ON FUNCTION public.register_public_booking_attempt(text, uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.register_public_booking_attempt(text, uuid, text) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.register_public_booking_attempt(text, uuid, text) TO service_role;
