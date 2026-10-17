-- Tareas automáticas de avisos: solo pg_cron (o el servidor) puede dispararlas.
--
-- Antes, process-scheduled-reminders y daily-agenda-summary aceptaban
-- cualquier llamada (verify_jwt = false, sin chequeo) y los crons las
-- invocaban con la anon key, que es pública: cualquiera podía forzar envíos.
-- Ahora las funciones exigen Bearer <service role> o Bearer <cron_jobs_token>
-- (ver cron-auth.ts). Mismo patrón que portal_notify_token (CD-001):
--   * el token se genera acá (256 bits, pgcrypto) y vive SOLO en Vault;
--   * los crons lo leen de Vault al momento de llamar (invoke_cron_function,
--     SECURITY DEFINER, sin EXECUTE para los roles de la API);
--   * las funciones no lo leen: preguntan verify_cron_jobs_token → boolean
--     (solo service_role);
--   * rotación: select public.rotate_cron_jobs_token();
--
-- Orden de despliegue: aplicar ESTA migración antes de desplegar las
-- funciones nuevas (las funciones viejas ignoran el header, así que no hay
-- corte). Si el token no se pudo crear, los crons NO se tocan (WARNING).
-- Idempotente.

-- ── 1) Token en Vault (solo si no existe) ──
DO $$
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext('cron_jobs_token'));
  IF NOT EXISTS (SELECT 1 FROM vault.secrets WHERE name = 'cron_jobs_token') THEN
    PERFORM vault.create_secret(
      encode(extensions.gen_random_bytes(32), 'hex'),
      'cron_jobs_token',
      'Token de pg_cron hacia process-scheduled-reminders y daily-agenda-summary'
    );
    RAISE NOTICE 'cron_jobs_token: creado en Vault';
  ELSE
    RAISE NOTICE 'cron_jobs_token: ya existía en Vault, se conserva';
  END IF;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'cron_jobs_token: no se pudo crear en Vault (%). Los crons quedan como estaban.', SQLERRM;
END $$;

-- ── 2) Verificación (la función pregunta, la base responde) ──
CREATE OR REPLACE FUNCTION public.verify_cron_jobs_token(p_token text)
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
  WHERE name = 'cron_jobs_token'
  ORDER BY created_at DESC
  LIMIT 1;
  IF v_secret IS NULL OR v_secret = '' THEN
    RETURN false;
  END IF;
  RETURN extensions.digest(p_token, 'sha256') = extensions.digest(v_secret, 'sha256');
END;
$$;

REVOKE ALL ON FUNCTION public.verify_cron_jobs_token(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.verify_cron_jobs_token(text) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.verify_cron_jobs_token(text) TO service_role;

-- ── 3) Llamada desde pg_cron con el token (solo estas dos funciones) ──
CREATE OR REPLACE FUNCTION public.invoke_cron_function(p_function text)
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, vault, extensions
AS $$
DECLARE
  v_token text;
BEGIN
  IF p_function NOT IN ('process-scheduled-reminders', 'daily-agenda-summary') THEN
    RAISE EXCEPTION 'invoke_cron_function: función no permitida (%)', p_function;
  END IF;
  SELECT decrypted_secret INTO v_token
  FROM vault.decrypted_secrets
  WHERE name = 'cron_jobs_token'
  ORDER BY created_at DESC
  LIMIT 1;
  IF v_token IS NULL OR v_token = '' THEN
    RAISE WARNING 'invoke_cron_function: falta cron_jobs_token en Vault; % no se dispara', p_function;
    RETURN NULL;
  END IF;
  RETURN net.http_post(
    url := 'https://sfvuuzpmsgepooeamkin.supabase.co/functions/v1/' || p_function,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || v_token
    ),
    body := '{}'::jsonb
  );
END;
$$;

REVOKE ALL ON FUNCTION public.invoke_cron_function(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.invoke_cron_function(text) FROM anon, authenticated, service_role;

-- ── 4) Rotación (solo desde SQL como postgres) ──
CREATE OR REPLACE FUNCTION public.rotate_cron_jobs_token()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, vault, extensions
AS $$
DECLARE
  v_id uuid;
  v_new text := encode(extensions.gen_random_bytes(32), 'hex');
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext('cron_jobs_token'));
  SELECT id INTO v_id FROM vault.secrets WHERE name = 'cron_jobs_token' ORDER BY created_at DESC LIMIT 1;
  IF v_id IS NULL THEN
    PERFORM vault.create_secret(v_new, 'cron_jobs_token',
      'Token de pg_cron hacia process-scheduled-reminders y daily-agenda-summary');
  ELSE
    PERFORM vault.update_secret(v_id, v_new);
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.rotate_cron_jobs_token() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.rotate_cron_jobs_token() FROM anon, authenticated, service_role;

-- ── 5) Los crons existentes pasan a usar el token ──
-- Se buscan por la URL que llaman (el de recordatorios no se creó por
-- migración), se conserva su nombre y horario y solo cambia el comando.
DO $$
DECLARE
  v_job record;
  v_fn text;
  v_present boolean := false;
  v_changed int := 0;
BEGIN
  BEGIN
    SELECT EXISTS (SELECT 1 FROM vault.secrets WHERE name = 'cron_jobs_token') INTO v_present;
  EXCEPTION WHEN OTHERS THEN
    v_present := false;
  END;
  IF NOT v_present THEN
    RAISE WARNING 'cron_jobs_token AUSENTE: los crons no se modificaron (siguen con la anon key). No desplegar las funciones nuevas hasta resolverlo.';
    RETURN;
  END IF;

  FOR v_job IN
    SELECT jobid, jobname, command FROM cron.job
    WHERE command ILIKE '%/functions/v1/process-scheduled-reminders%'
       OR command ILIKE '%/functions/v1/daily-agenda-summary%'
  LOOP
    v_fn := CASE WHEN v_job.command ILIKE '%process-scheduled-reminders%'
                 THEN 'process-scheduled-reminders' ELSE 'daily-agenda-summary' END;
    PERFORM cron.alter_job(v_job.jobid, command := format('SELECT public.invoke_cron_function(%L)', v_fn));
    v_changed := v_changed + 1;
    RAISE NOTICE 'cron % (%): ahora usa cron_jobs_token', coalesce(v_job.jobname, v_job.jobid::text), v_fn;
  END LOOP;

  IF NOT EXISTS (SELECT 1 FROM cron.job WHERE command ILIKE '%invoke_cron_function(''process-scheduled-reminders'')%') THEN
    RAISE WARNING 'No se encontró el cron de process-scheduled-reminders: revisar cron.job antes de desplegar la función.';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM cron.job WHERE command ILIKE '%invoke_cron_function(''daily-agenda-summary'')%') THEN
    RAISE WARNING 'No se encontró el cron de daily-agenda-summary: revisar cron.job antes de desplegar la función.';
  END IF;
  RAISE NOTICE 'Crons actualizados: %', v_changed;
END $$;
