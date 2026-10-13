-- Pruebas de 20261014160000_modo_capturas_acceso.sql.
-- migraciones: 20261014160000_modo_capturas_acceso.sql
\set ON_ERROR_STOP on
SET client_min_messages = notice;

CREATE OR REPLACE FUNCTION public.test_ok(cond boolean, msg text) RETURNS void
LANGUAGE plpgsql AS $$
BEGIN
  IF cond IS NOT TRUE THEN RAISE EXCEPTION 'FALLA: %', msg; END IF;
  RAISE NOTICE 'OK: %', msg;
END $$;
GRANT EXECUTE ON FUNCTION public.test_ok(boolean, text) TO PUBLIC;

CREATE OR REPLACE FUNCTION public.test_denied(q text) RETURNS boolean
LANGUAGE plpgsql AS $$
BEGIN
  EXECUTE q;
  RETURN false;
EXCEPTION WHEN insufficient_privilege THEN
  RETURN true;
END $$;
GRANT EXECUTE ON FUNCTION public.test_denied(text) TO PUBLIC;

-- Consultorios ficticios: uno autorizado, otro con EL MISMO nombre visible
INSERT INTO public.businesses (id, owner_user_id, name, public_slug, is_demo) VALUES
  ('bbbbbbbb-0000-4000-8000-0000000000f1', 'aaaaaaaa-0000-4000-8000-0000000000f1', 'Consultorio QA', 'qa-capturas', true),
  ('bbbbbbbb-0000-4000-8000-0000000000f2', 'aaaaaaaa-0000-4000-8000-0000000000f2', 'Consultorio QA', 'qa-otro', true);
INSERT INTO public.user_roles (user_id, business_id, role) VALUES
  ('aaaaaaaa-0000-4000-8000-0000000000f3', 'bbbbbbbb-0000-4000-8000-0000000000f1', 'professional'),
  ('aaaaaaaa-0000-4000-8000-0000000000f4', 'bbbbbbbb-0000-4000-8000-0000000000f1', 'professional'),
  ('aaaaaaaa-0000-4000-8000-0000000000f9', NULL, 'super_admin');

CREATE OR REPLACE FUNCTION public.test_puede(uid text, biz text) RETURNS boolean
LANGUAGE plpgsql AS $$
DECLARE r boolean;
BEGIN
  PERFORM set_config('request.jwt.claim.sub', coalesce(uid, ''), true);
  EXECUTE 'SET LOCAL ROLE authenticated';
  SELECT public.can_use_showcase_mode(biz::uuid) INTO r;
  RETURN r;
END $$;

-- Sin filas, nadie
SELECT public.test_ok(NOT public.test_puede('aaaaaaaa-0000-4000-8000-0000000000f1', 'bbbbbbbb-0000-4000-8000-0000000000f1'),
  'sin autorización explícita ni la dueña puede (la migración no habilita a nadie)');
RESET ROLE;

-- Santiago habilita a la dueña y a un miembro del consultorio verificado (por id)
INSERT INTO public.showcase_mode_access (business_id, user_id, note) VALUES
  ('bbbbbbbb-0000-4000-8000-0000000000f1', 'aaaaaaaa-0000-4000-8000-0000000000f1', 'dueña'),
  ('bbbbbbbb-0000-4000-8000-0000000000f1', 'aaaaaaaa-0000-4000-8000-0000000000f3', 'cuenta para tutoriales'),
  ('bbbbbbbb-0000-4000-8000-0000000000f1', 'aaaaaaaa-0000-4000-8000-0000000000f9', 'superadmin'),
  -- fila para alguien que NO pertenece al consultorio
  ('bbbbbbbb-0000-4000-8000-0000000000f1', 'aaaaaaaa-0000-4000-8000-0000000000f2', 'ajeno');

SELECT public.test_ok(public.test_puede('aaaaaaaa-0000-4000-8000-0000000000f1', 'bbbbbbbb-0000-4000-8000-0000000000f1'), 'la dueña autorizada puede');
RESET ROLE;
SELECT public.test_ok(public.test_puede('aaaaaaaa-0000-4000-8000-0000000000f3', 'bbbbbbbb-0000-4000-8000-0000000000f1'), 'el miembro autorizado puede');
RESET ROLE;
SELECT public.test_ok(public.test_puede('aaaaaaaa-0000-4000-8000-0000000000f9', 'bbbbbbbb-0000-4000-8000-0000000000f1'), 'el superadmin autorizado puede');
RESET ROLE;
SELECT public.test_ok(NOT public.test_puede('aaaaaaaa-0000-4000-8000-0000000000f4', 'bbbbbbbb-0000-4000-8000-0000000000f1'), 'un miembro SIN fila no puede');
RESET ROLE;
SELECT public.test_ok(NOT public.test_puede('aaaaaaaa-0000-4000-8000-0000000000f2', 'bbbbbbbb-0000-4000-8000-0000000000f1'), 'con fila pero sin pertenecer al consultorio, no puede');
RESET ROLE;
SELECT public.test_ok(NOT public.test_puede('aaaaaaaa-0000-4000-8000-0000000000f2', 'bbbbbbbb-0000-4000-8000-0000000000f2'), 'otro consultorio con el mismo nombre visible: no puede');
RESET ROLE;
SELECT public.test_ok(NOT public.test_puede('aaaaaaaa-0000-4000-8000-0000000000f1', 'bbbbbbbb-0000-4000-8000-0000000000f2'), 'la persona autorizada no puede usarlo en otro consultorio');
RESET ROLE;
SELECT public.test_ok(NOT public.test_puede(NULL, 'bbbbbbbb-0000-4000-8000-0000000000f1'), 'sin sesión: no');
RESET ROLE;

-- Si deja de pertenecer al consultorio, pierde el acceso aunque quede la fila
DELETE FROM public.user_roles WHERE user_id = 'aaaaaaaa-0000-4000-8000-0000000000f3';
SELECT public.test_ok(NOT public.test_puede('aaaaaaaa-0000-4000-8000-0000000000f3', 'bbbbbbbb-0000-4000-8000-0000000000f1'), 'quien deja el consultorio pierde el acceso');
RESET ROLE;

-- La función no cambia nada
SELECT public.test_ok((SELECT count(*) FROM public.showcase_mode_access) = 4, 'consultar no modifica la tabla');
SELECT public.test_ok((SELECT provolatile FROM pg_proc WHERE proname = 'can_use_showcase_mode') = 's', 'la función es STABLE (solo lectura)');

-- Permisos
SELECT public.test_ok(NOT has_function_privilege('anon', 'public.can_use_showcase_mode(uuid)', 'EXECUTE'), 'anon no puede consultar');
SELECT public.test_ok(has_function_privilege('authenticated', 'public.can_use_showcase_mode(uuid)', 'EXECUTE'), 'authenticated puede consultar');
SET ROLE authenticated;
SELECT public.test_ok(public.test_denied('SELECT * FROM public.showcase_mode_access'), 'authenticated no lee la lista de autorizados');
SELECT public.test_ok(public.test_denied($q$INSERT INTO public.showcase_mode_access (business_id, user_id) VALUES ('bbbbbbbb-0000-4000-8000-0000000000f2', 'aaaaaaaa-0000-4000-8000-0000000000f2')$q$), 'authenticated no puede autorizarse a sí mismo');
RESET ROLE;
SET ROLE anon;
SELECT public.test_ok(public.test_denied('SELECT * FROM public.showcase_mode_access'), 'anon no lee la lista');
RESET ROLE;
