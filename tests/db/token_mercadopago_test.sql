-- Pruebas de 20261014120000_ocultar_token_mercadopago.sql (cobros de pacientes).
-- migraciones: 20261014120000_ocultar_token_mercadopago.sql
\set ON_ERROR_STOP on
SET client_min_messages = notice;

CREATE OR REPLACE FUNCTION public.test_ok(cond boolean, msg text) RETURNS void
LANGUAGE plpgsql AS $$
BEGIN
  IF cond IS NOT TRUE THEN RAISE EXCEPTION 'FALLA: %', msg; END IF;
  RAISE NOTICE 'OK: %', msg;
END $$;
GRANT EXECUTE ON FUNCTION public.test_ok(boolean, text) TO authenticated, anon;

-- Datos ficticios (como postgres, igual que el backend)
INSERT INTO public.businesses (id, owner_user_id, name) VALUES
  ('bbbbbbbb-0000-4000-8000-0000000000a1', 'aaaaaaaa-0000-4000-8000-0000000000a1', 'QA Conectado'),
  ('bbbbbbbb-0000-4000-8000-0000000000b1', 'aaaaaaaa-0000-4000-8000-0000000000b1', 'QA Otro');
INSERT INTO public.user_roles (user_id, business_id, role) VALUES
  ('aaaaaaaa-0000-4000-8000-0000000000a2', 'bbbbbbbb-0000-4000-8000-0000000000a1', 'professional');
INSERT INTO public.payment_policies (business_id, policy_type, mp_access_token, mp_public_key) VALUES
  ('bbbbbbbb-0000-4000-8000-0000000000a1', 'required', 'APP_USR-token-ficticio', 'pk-ficticia'),
  ('bbbbbbbb-0000-4000-8000-0000000000b1', 'none', NULL, NULL);

-- El servidor (service_role) sigue leyendo el token
SET ROLE service_role;
SELECT public.test_ok((SELECT mp_access_token FROM public.payment_policies
  WHERE business_id = 'bbbbbbbb-0000-4000-8000-0000000000a1') = 'APP_USR-token-ficticio',
  'service_role (funciones del servidor) sigue leyendo el token');
RESET ROLE;

-- Dueño del consultorio
SET ROLE authenticated;
SET request.jwt.claim.sub = 'aaaaaaaa-0000-4000-8000-0000000000a1';
SELECT public.test_ok((SELECT mp_connected FROM public.payment_policies
  WHERE business_id = 'bbbbbbbb-0000-4000-8000-0000000000a1'), 'el dueño ve mp_connected = true');
SELECT public.test_ok((SELECT policy_type::text FROM public.payment_policies
  WHERE business_id = 'bbbbbbbb-0000-4000-8000-0000000000a1') = 'required', 'el dueño ve la política');
DO $$ BEGIN
  PERFORM mp_access_token FROM public.payment_policies;
  RAISE EXCEPTION 'FALLA: el dueño pudo leer mp_access_token';
EXCEPTION WHEN insufficient_privilege THEN RAISE NOTICE 'OK: el dueño NO puede leer mp_access_token';
END $$;
DO $$ BEGIN
  PERFORM * FROM public.payment_policies;
  RAISE EXCEPTION 'FALLA: select * expone la tabla completa';
EXCEPTION WHEN insufficient_privilege THEN RAISE NOTICE 'OK: select * no alcanza el token';
END $$;
-- Guardar la política como lo hace la app (upsert de PostgREST, sin RETURNING)
INSERT INTO public.payment_policies (business_id, policy_type, deposit_percentage)
VALUES ('bbbbbbbb-0000-4000-8000-0000000000a1', 'optional', NULL)
ON CONFLICT (business_id) DO UPDATE SET policy_type = EXCLUDED.policy_type, deposit_percentage = EXCLUDED.deposit_percentage;
SELECT public.test_ok((SELECT policy_type::text FROM public.payment_policies
  WHERE business_id = 'bbbbbbbb-0000-4000-8000-0000000000a1') = 'optional', 'guardar la política sigue funcionando (upsert)');
-- Desconectar Mercado Pago como lo hace la app
UPDATE public.payment_policies SET mp_access_token = NULL, mp_public_key = NULL
WHERE business_id = 'bbbbbbbb-0000-4000-8000-0000000000a1';
SELECT public.test_ok((SELECT mp_connected FROM public.payment_policies
  WHERE business_id = 'bbbbbbbb-0000-4000-8000-0000000000a1') IS FALSE, 'desconectar MP sigue funcionando y mp_connected pasa a false');
-- No ve consultorios ajenos (RLS intacta)
SELECT public.test_ok((SELECT count(*) FROM public.payment_policies
  WHERE business_id = 'bbbbbbbb-0000-4000-8000-0000000000b1') = 0, 'no ve la política de otro consultorio');
RESET ROLE;

-- Profesional miembro (no dueño)
UPDATE public.payment_policies SET mp_access_token = 'APP_USR-otro-ficticio'
WHERE business_id = 'bbbbbbbb-0000-4000-8000-0000000000a1';
SET ROLE authenticated;
SET request.jwt.claim.sub = 'aaaaaaaa-0000-4000-8000-0000000000a2';
SELECT public.test_ok((SELECT mp_connected FROM public.payment_policies
  WHERE business_id = 'bbbbbbbb-0000-4000-8000-0000000000a1'), 'el miembro ve mp_connected');
DO $$ BEGIN
  PERFORM mp_access_token FROM public.payment_policies;
  RAISE EXCEPTION 'FALLA: el miembro pudo leer mp_access_token';
EXCEPTION WHEN insufficient_privilege THEN RAISE NOTICE 'OK: el miembro NO puede leer mp_access_token';
END $$;
RESET ROLE;

-- Visitante anónimo
SET ROLE anon;
DO $$ BEGIN
  PERFORM 1 FROM public.payment_policies;
  RAISE EXCEPTION 'FALLA: anon puede leer payment_policies';
EXCEPTION WHEN insufficient_privilege THEN RAISE NOTICE 'OK: anon no lee payment_policies';
END $$;
RESET ROLE;
SELECT 'TODAS LAS PRUEBAS DE TOKEN PASARON';
