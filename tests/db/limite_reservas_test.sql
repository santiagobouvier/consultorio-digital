-- Pruebas de 20261014150000_limite_reservas_publicas.sql.
-- migraciones: 20261014150000_limite_reservas_publicas.sql
\set ON_ERROR_STOP on
SET client_min_messages = notice;

CREATE OR REPLACE FUNCTION public.test_ok(cond boolean, msg text) RETURNS void
LANGUAGE plpgsql AS $$
BEGIN
  IF cond IS NOT TRUE THEN RAISE EXCEPTION 'FALLA: %', msg; END IF;
  RAISE NOTICE 'OK: %', msg;
END $$;
GRANT EXECUTE ON FUNCTION public.test_ok(boolean, text) TO PUBLIC;

CREATE OR REPLACE FUNCTION public.test_intentos(n int, client text, biz uuid, phone_prefix text)
RETURNS text LANGUAGE plpgsql AS $$
DECLARE r text; i int;
BEGIN
  FOR i IN 1..n LOOP
    r := public.register_public_booking_attempt(client, biz, CASE WHEN phone_prefix IS NULL THEN NULL ELSE phone_prefix || i END);
    IF r IS NOT NULL THEN RETURN r || ' en el intento ' || i; END IF;
  END LOOP;
  RETURN NULL;
END $$;
GRANT EXECUTE ON FUNCTION public.test_intentos(int, text, uuid, text) TO service_role;

SET ROLE service_role;
-- Por conexión: 8 en 10 minutos
SELECT public.test_ok(public.test_intentos(8, 'ip-a', 'bbbbbbbb-0000-4000-8000-0000000000d1', 'tel-a') IS NULL, '8 reservas seguidas desde una conexión: aceptadas');
SELECT public.test_ok(public.register_public_booking_attempt('ip-a', 'bbbbbbbb-0000-4000-8000-0000000000d1', 'tel-a-otro') = 'client_10min', 'la 9.ª en 10 minutos: frenada');
SELECT public.test_ok(public.register_public_booking_attempt('ip-b', 'bbbbbbbb-0000-4000-8000-0000000000d1', 'tel-b') IS NULL, 'otra conexión sigue pudiendo reservar');
RESET ROLE;

-- Por conexión: 20 en el día (intentos viejos de más de 10 minutos)
UPDATE public.public_booking_attempts SET created_at = now() - interval '2 hours' WHERE client_key = 'ip-a';
INSERT INTO public.public_booking_attempts (client_key, business_id, created_at)
SELECT 'ip-a', 'bbbbbbbb-0000-4000-8000-0000000000d1', now() - interval '3 hours' FROM generate_series(1, 12);
SET ROLE service_role;
SELECT public.test_ok(public.register_public_booking_attempt('ip-a', 'bbbbbbbb-0000-4000-8000-0000000000d1', NULL) = 'client_day', '20 en el día desde una conexión: frenada');

-- Por teléfono en el consultorio: 4 por día, aunque cambie la conexión
SELECT public.test_ok(public.register_public_booking_attempt('ip-c1', 'bbbbbbbb-0000-4000-8000-0000000000d2', 'tel-x') IS NULL, 'teléfono: 1');
SELECT public.test_ok(public.register_public_booking_attempt('ip-c2', 'bbbbbbbb-0000-4000-8000-0000000000d2', 'tel-x') IS NULL, 'teléfono: 2');
SELECT public.test_ok(public.register_public_booking_attempt('ip-c3', 'bbbbbbbb-0000-4000-8000-0000000000d2', 'tel-x') IS NULL, 'teléfono: 3');
SELECT public.test_ok(public.register_public_booking_attempt('ip-c4', 'bbbbbbbb-0000-4000-8000-0000000000d2', 'tel-x') IS NULL, 'teléfono: 4');
SELECT public.test_ok(public.register_public_booking_attempt('ip-c5', 'bbbbbbbb-0000-4000-8000-0000000000d2', 'tel-x') = 'phone_day', 'el mismo teléfono por 5.ª vez en el día: frenado');
SELECT public.test_ok(public.register_public_booking_attempt('ip-c5', 'bbbbbbbb-0000-4000-8000-0000000000d3', 'tel-x') IS NULL, 'el mismo teléfono en otro consultorio: aceptado');

-- Sin IP conocida no hay límite por conexión (sí por consultorio)
SELECT public.test_ok(public.test_intentos(10, NULL, 'bbbbbbbb-0000-4000-8000-0000000000d4', 'tel-sin-ip') IS NULL, 'sin IP: no se agrupa a todos los visitantes como una sola conexión');
RESET ROLE;

-- Por consultorio: 60 por hora
INSERT INTO public.public_booking_attempts (client_key, business_id)
SELECT 'ip-flood-' || g, 'bbbbbbbb-0000-4000-8000-0000000000d5' FROM generate_series(1, 60) g;
SET ROLE service_role;
SELECT public.test_ok(public.register_public_booking_attempt('ip-nueva', 'bbbbbbbb-0000-4000-8000-0000000000d5', 'tel-n') = 'business_hour', 'más de 60 por hora en un consultorio: frenada');
RESET ROLE;

-- Limpieza a los 2 días
INSERT INTO public.public_booking_attempts (client_key, business_id, created_at)
VALUES ('ip-vieja', 'bbbbbbbb-0000-4000-8000-0000000000d6', now() - interval '3 days');
SET ROLE service_role;
SELECT public.register_public_booking_attempt('ip-z', 'bbbbbbbb-0000-4000-8000-0000000000d6', NULL);
RESET ROLE;
SELECT public.test_ok(NOT EXISTS (SELECT 1 FROM public.public_booking_attempts WHERE client_key = 'ip-vieja'), 'los intentos de más de 2 días se borran');

-- Permisos
SELECT public.test_ok(NOT has_function_privilege('anon', 'public.register_public_booking_attempt(text, uuid, text)', 'EXECUTE'), 'anon no puede llamar al límite');
SELECT public.test_ok(NOT has_function_privilege('authenticated', 'public.register_public_booking_attempt(text, uuid, text)', 'EXECUTE'), 'authenticated no puede llamar al límite');
SELECT public.test_ok(NOT has_table_privilege('anon', 'public.public_booking_attempts', 'SELECT'), 'anon no lee los intentos');
SELECT public.test_ok(NOT has_table_privilege('authenticated', 'public.public_booking_attempts', 'SELECT'), 'authenticated no lee los intentos');
