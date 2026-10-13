-- Pruebas de 20261014140000_datos_publicos_consultorio.sql.
-- migraciones: 20261014140000_datos_publicos_consultorio.sql
\set ON_ERROR_STOP on
SET client_min_messages = notice;

CREATE OR REPLACE FUNCTION public.test_ok(cond boolean, msg text) RETURNS void
LANGUAGE plpgsql AS $$
BEGIN
  IF cond IS NOT TRUE THEN RAISE EXCEPTION 'FALLA: %', msg; END IF;
  RAISE NOTICE 'OK: %', msg;
END $$;
GRANT EXECUTE ON FUNCTION public.test_ok(boolean, text) TO PUBLIC;

-- ¿La consulta falla por permisos? (para probar como anon)
CREATE OR REPLACE FUNCTION public.test_denied(q text) RETURNS boolean
LANGUAGE plpgsql AS $$
BEGIN
  EXECUTE q;
  RETURN false;
EXCEPTION WHEN insufficient_privilege THEN
  RETURN true;
END $$;
GRANT EXECUTE ON FUNCTION public.test_denied(text) TO PUBLIC;

INSERT INTO public.businesses (id, owner_user_id, name, public_slug, plan_code, is_demo) VALUES
  ('bbbbbbbb-0000-4000-8000-0000000000c1', 'aaaaaaaa-0000-4000-8000-0000000000c1', 'QA Pública', 'qa-publica', 'esencial', true);
INSERT INTO public.availability_templates (business_id) VALUES ('bbbbbbbb-0000-4000-8000-0000000000c1');

-- Anónimo
SET ROLE anon;
SELECT public.test_ok((SELECT name FROM public.businesses_public_branding WHERE public_slug = 'qa-publica') = 'QA Pública',
  'anon sigue viendo el consultorio por la vista pública');
SELECT public.test_ok((SELECT count(*) FROM public.businesses WHERE public_slug = 'qa-publica') = 1,
  'anon sigue leyendo las columnas públicas de businesses');
SELECT public.test_ok(public.test_denied('SELECT owner_user_id FROM public.businesses'), 'anon no lee owner_user_id');
SELECT public.test_ok(public.test_denied('SELECT plan_code FROM public.businesses'), 'anon no lee plan_code');
SELECT public.test_ok(public.test_denied('SELECT * FROM public.businesses'), 'anon no puede hacer select * en businesses');
RESET ROLE;
SELECT public.test_ok(NOT EXISTS (
  SELECT 1 FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = 'businesses_public_branding'
    AND column_name IN ('owner_user_id', 'plan_code')), 'la vista pública no tiene owner_user_id ni plan_code');
SET ROLE anon;
SELECT public.test_ok((SELECT count(*) FROM public.availability_templates) = 1,
  'anon sigue leyendo horarios públicos (la política de dueño no rompe la consulta)');
SELECT public.test_ok((SELECT count(*) FROM public.user_roles) = 0,
  'anon consulta user_roles sin error y no ve nada');
RESET ROLE;

-- Políticas
SELECT public.test_ok((SELECT roles FROM pg_policies WHERE policyname = 'Business owners manage team templates') = '{authenticated}',
  'política de dueño de horarios: TO authenticated');
SELECT public.test_ok((SELECT roles FROM pg_policies WHERE policyname = 'Business owners can view business roles') = '{authenticated}',
  'política de dueño de user_roles: TO authenticated');
SELECT public.test_ok((SELECT roles FROM pg_policies WHERE policyname = 'Public can view templates of active businesses') = '{public}',
  'la política pública (sin auth.uid) no se toca');
SELECT public.test_ok((SELECT roles FROM pg_policies WHERE policyname = 'Business owners and super admin can view') = '{public}',
  'las políticas de la propia tabla businesses no se tocan');

-- El dueño con sesión sigue igual
SET ROLE authenticated;
SET request.jwt.claim.sub = 'aaaaaaaa-0000-4000-8000-0000000000c1';
SELECT public.test_ok((SELECT owner_user_id FROM public.businesses WHERE public_slug = 'qa-publica') = 'aaaaaaaa-0000-4000-8000-0000000000c1',
  'el dueño sigue leyendo owner_user_id');
SELECT public.test_ok((SELECT plan_code FROM public.businesses WHERE public_slug = 'qa-publica') = 'esencial',
  'el dueño sigue leyendo su plan');
SELECT public.test_ok((SELECT count(*) FROM public.availability_templates) = 1, 'el dueño sigue viendo sus horarios');
RESET request.jwt.claim.sub;
RESET ROLE;
