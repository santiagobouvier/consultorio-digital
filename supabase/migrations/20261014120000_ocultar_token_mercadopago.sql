-- Cobros de PACIENTES a profesionales: el access token de Mercado Pago de cada
-- consultorio deja de ser legible desde el navegador.
--
-- Antes: la política "Business members can view payment policies" permitía a
-- cualquier miembro del consultorio leer payment_policies.mp_access_token, y el
-- frontend lo pedía solo para saber si Mercado Pago estaba conectado.
--
-- Ahora:
--   * mp_connected: columna generada (true/false), lo único que necesita la UI;
--   * authenticated/anon pierden SELECT sobre la tabla y recuperan SELECT por
--     columna sobre TODAS las columnas salvo mp_access_token (se calcula del
--     esquema real, así no se pierde ninguna columna que exista en producción);
--   * INSERT/UPDATE/DELETE no cambian (guardar la política y desconectar MP
--     siguen funcionando); las funciones del servidor usan service_role.
-- Idempotente.

ALTER TABLE public.payment_policies
  ADD COLUMN IF NOT EXISTS mp_connected boolean
  GENERATED ALWAYS AS (mp_access_token IS NOT NULL) STORED;

DO $$
DECLARE
  cols text;
BEGIN
  SELECT string_agg(quote_ident(column_name), ', ' ORDER BY ordinal_position)
    INTO cols
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND table_name = 'payment_policies'
    AND column_name <> 'mp_access_token';

  EXECUTE 'REVOKE SELECT ON public.payment_policies FROM anon, authenticated';
  EXECUTE 'REVOKE SELECT (mp_access_token) ON public.payment_policies FROM anon, authenticated';
  EXECUTE format('GRANT SELECT (%s) ON public.payment_policies TO authenticated', cols);
END $$;
