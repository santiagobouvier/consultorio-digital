-- Visitantes anónimos: ya no ven owner_user_id ni plan_code del consultorio.
--
-- La web pública (reserva y página del consultorio) los leía desde
-- businesses_public_branding: el id interno del usuario dueño y el plan
-- contratado son datos del negocio, no hacen falta para reservar. El
-- frontend deja de pedirlos (la reserva online está en todos los planes).
--
-- 1) Las políticas "de dueño" que aplican a PUBLIC y consultan
--    businesses.owner_user_id/plan_code en una subconsulta pasan a
--    "TO authenticated". Para anon nunca podían cumplirse (auth.uid() es
--    NULL), pero sin este cambio, al quitarle la columna a anon, su consulta
--    daría "permission denied" en vez de "sin filas" (p. ej. horarios de la
--    página pública). Solo se tocan las que exigen auth.uid().
-- 2) anon: SELECT por columna sin owner_user_id ni plan_code.
-- 3) La vista pública se recrea sin esas dos columnas.
-- Idempotente.

-- ── 1) Políticas de dueño: solo para usuarios con sesión ──
DO $$
DECLARE
  p record;
BEGIN
  FOR p IN
    SELECT schemaname, tablename, policyname
    FROM pg_policies
    WHERE schemaname = 'public'
      AND ('public' = ANY (roles) OR 'anon' = ANY (roles))
      AND (coalesce(qual, '') || ' ' || coalesce(with_check, '')) ~ 'businesses'
      AND (coalesce(qual, '') || ' ' || coalesce(with_check, '')) ~ '(owner_user_id|plan_code)'
      AND (coalesce(qual, '') || ' ' || coalesce(with_check, '')) ~ 'auth\.uid\(\)'
      AND tablename <> 'businesses'
  LOOP
    EXECUTE format('ALTER POLICY %I ON %I.%I TO authenticated', p.policyname, p.schemaname, p.tablename);
    RAISE NOTICE 'Política % en % ahora es TO authenticated', p.policyname, p.tablename;
  END LOOP;
END $$;

-- ── 2) Columnas que anon puede leer de businesses ──
DO $$
DECLARE
  cols text;
BEGIN
  SELECT string_agg(quote_ident(column_name), ', ')
  INTO cols
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND table_name = 'businesses'
    AND column_name IN (
      'id','name','public_slug','specialty','is_active',
      'is_private_clinic','portal_clinic_display_name','portal_logo_url',
      'portal_primary_color','portal_dark_primary_color','portal_theme_preset',
      'custom_subdomain','custom_domain','dashboard_display_name',
      'dashboard_logo_url','dashboard_primary_color','shared_calendar',
      'cancellation_hours_notice','late_cancellation_message',
      'timezone','onboarding_completed'
    );
  EXECUTE 'REVOKE SELECT ON public.businesses FROM anon';
  EXECUTE 'REVOKE SELECT (owner_user_id, plan_code) ON public.businesses FROM anon';
  EXECUTE format('GRANT SELECT (%s) ON public.businesses TO anon', cols);
END $$;

-- ── 3) Vista pública sin owner_user_id ni plan_code ──
DROP VIEW IF EXISTS public.businesses_public_branding;
CREATE VIEW public.businesses_public_branding
WITH (security_invoker = true) AS
SELECT
  id, name, public_slug, specialty,
  is_private_clinic, portal_clinic_display_name, portal_logo_url,
  portal_primary_color, portal_dark_primary_color, portal_theme_preset,
  custom_subdomain, custom_domain, dashboard_display_name,
  dashboard_logo_url, dashboard_primary_color, shared_calendar,
  cancellation_hours_notice, late_cancellation_message
FROM public.businesses
WHERE is_active = true;

GRANT SELECT ON public.businesses_public_branding TO anon, authenticated;
