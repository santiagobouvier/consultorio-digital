-- Pruebas de 20261014130000_token_tareas_automaticas.sql.
-- migraciones: 20261014130000_token_tareas_automaticas.sql
\set ON_ERROR_STOP on
SET client_min_messages = notice;

CREATE OR REPLACE FUNCTION public.test_ok(cond boolean, msg text) RETURNS void
LANGUAGE plpgsql AS $$
BEGIN
  IF cond IS NOT TRUE THEN RAISE EXCEPTION 'FALLA: %', msg; END IF;
  RAISE NOTICE 'OK: %', msg;
END $$;
GRANT EXECUTE ON FUNCTION public.test_ok(boolean, text) TO PUBLIC;

SELECT public.test_ok((SELECT count(*) FROM vault.secrets WHERE name = 'cron_jobs_token') = 1,
  'un solo token en Vault aunque la migración se aplique dos veces');
SELECT public.test_ok((SELECT decrypted_secret ~ '^[0-9a-f]{64}$' FROM vault.decrypted_secrets WHERE name = 'cron_jobs_token'),
  'token de 64 hex');

-- Crons
SELECT public.test_ok((SELECT command FROM cron.job WHERE schedule = '* * * * *') = 'SELECT public.invoke_cron_function(''process-scheduled-reminders'')',
  'el cron de recordatorios (sin nombre) usa el token y conserva su horario');
SELECT public.test_ok((SELECT command FROM cron.job WHERE jobname = 'daily-agenda-summary') = 'SELECT public.invoke_cron_function(''daily-agenda-summary'')',
  'el cron del resumen diario usa el token');
SELECT public.test_ok((SELECT command FROM cron.job WHERE jobname = 'otro-cron') LIKE 'UPDATE public.businesses%',
  'otros crons no se tocan');
SELECT public.test_ok(NOT EXISTS (SELECT 1 FROM cron.job WHERE command ILIKE '%anon-ficticia%'),
  'ningún cron sigue mandando la anon key');

-- Ejecutar el comando del cron manda el token como Bearer
SELECT public.invoke_cron_function('process-scheduled-reminders');
SELECT public.test_ok(
  (SELECT headers->>'Authorization' FROM net.calls ORDER BY id DESC LIMIT 1)
    = 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'cron_jobs_token'),
  'invoke_cron_function manda el token de Vault');
SELECT public.test_ok(
  (SELECT url FROM net.calls ORDER BY id DESC LIMIT 1) = 'https://sfvuuzpmsgepooeamkin.supabase.co/functions/v1/process-scheduled-reminders',
  'invoke_cron_function llama a la función pedida');
DO $$ BEGIN
  PERFORM public.invoke_cron_function('send-whatsapp');
  RAISE EXCEPTION 'FALLA: invoke_cron_function aceptó otra función';
EXCEPTION WHEN raise_exception THEN
  IF SQLERRM LIKE 'FALLA%' THEN RAISE; END IF;
  RAISE NOTICE 'OK: invoke_cron_function solo dispara las dos tareas de avisos';
END $$;

-- Verificación
DO $$
DECLARE v text;
BEGIN
  SELECT decrypted_secret INTO v FROM vault.decrypted_secrets WHERE name = 'cron_jobs_token';
  PERFORM set_config('test.token', v, false);
END $$;
SET ROLE service_role;
SELECT public.test_ok(public.verify_cron_jobs_token(current_setting('test.token')), 'service_role valida el token vigente');
SELECT public.test_ok(NOT public.verify_cron_jobs_token(repeat('0', 64)), 'un token falso no vale');
SELECT public.test_ok(NOT public.verify_cron_jobs_token('anon-ficticia'), 'la anon key no vale');
RESET ROLE;

-- Permisos: nadie de la API puede leer el token ni disparar los crons
SELECT public.test_ok(NOT has_function_privilege('anon', 'public.verify_cron_jobs_token(text)', 'EXECUTE'), 'anon no puede verificar tokens');
SELECT public.test_ok(NOT has_function_privilege('authenticated', 'public.verify_cron_jobs_token(text)', 'EXECUTE'), 'authenticated no puede verificar tokens');
SELECT public.test_ok(NOT has_function_privilege('anon', 'public.invoke_cron_function(text)', 'EXECUTE'), 'anon no puede disparar crons');
SELECT public.test_ok(NOT has_function_privilege('authenticated', 'public.invoke_cron_function(text)', 'EXECUTE'), 'authenticated no puede disparar crons');
SELECT public.test_ok(NOT has_function_privilege('service_role', 'public.invoke_cron_function(text)', 'EXECUTE'), 'service_role no puede disparar crons');
SELECT public.test_ok(NOT has_function_privilege('service_role', 'public.rotate_cron_jobs_token()', 'EXECUTE'), 'service_role no puede rotar el token');

-- Rotación: el viejo deja de valer
SELECT public.rotate_cron_jobs_token();
SET ROLE service_role;
SELECT public.test_ok(NOT public.verify_cron_jobs_token(current_setting('test.token')), 'tras rotar, el token viejo no vale');
RESET ROLE;
