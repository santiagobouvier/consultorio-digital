-- Esquema extra para token_tareas_test.sql: imitaciones mínimas de Vault,
-- pg_cron y pg_net (solo lo que usa la migración). SOLO Postgres desechable.
CREATE SCHEMA IF NOT EXISTS extensions;
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

CREATE SCHEMA IF NOT EXISTS vault;
CREATE TABLE vault.secrets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text,
  description text,
  secret text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE VIEW vault.decrypted_secrets AS
  SELECT id, name, description, secret AS decrypted_secret, created_at FROM vault.secrets;
CREATE FUNCTION vault.create_secret(new_secret text, new_name text, new_description text)
RETURNS uuid LANGUAGE sql AS $$
  INSERT INTO vault.secrets (name, description, secret) VALUES (new_name, new_description, new_secret) RETURNING id
$$;
CREATE FUNCTION vault.update_secret(secret_id uuid, new_secret text)
RETURNS void LANGUAGE sql AS $$
  UPDATE vault.secrets SET secret = new_secret WHERE id = secret_id
$$;

-- pg_net: registra las llamadas en vez de hacerlas
CREATE SCHEMA IF NOT EXISTS net;
CREATE TABLE net.calls (id bigserial PRIMARY KEY, url text, headers jsonb, body jsonb);
CREATE FUNCTION net.http_post(url text, headers jsonb DEFAULT '{}'::jsonb, body jsonb DEFAULT '{}'::jsonb)
RETURNS bigint LANGUAGE sql AS $$
  INSERT INTO net.calls (url, headers, body) VALUES (url, headers, body) RETURNING id
$$;

-- pg_cron: tabla de jobs y alter_job
CREATE SCHEMA IF NOT EXISTS cron;
CREATE TABLE cron.job (jobid bigserial PRIMARY KEY, schedule text, command text, jobname text);
CREATE FUNCTION cron.alter_job(job_id bigint, schedule text DEFAULT NULL, command text DEFAULT NULL)
RETURNS void LANGUAGE sql AS $$
  UPDATE cron.job SET schedule = coalesce(alter_job.schedule, job.schedule),
                      command = coalesce(alter_job.command, job.command)
  WHERE jobid = job_id
$$;

-- Crons como están hoy (anon key ficticia; el de recordatorios sin nombre)
INSERT INTO cron.job (schedule, command, jobname) VALUES
  ('* * * * *', $c$SELECT net.http_post(url := 'https://sfvuuzpmsgepooeamkin.supabase.co/functions/v1/process-scheduled-reminders', headers := '{"Authorization":"Bearer anon-ficticia"}'::jsonb)$c$, NULL),
  ('0 23 * * *', $c$SELECT net.http_post(url := 'https://sfvuuzpmsgepooeamkin.supabase.co/functions/v1/daily-agenda-summary', headers := '{"Authorization":"Bearer anon-ficticia"}'::jsonb, body := '{}'::jsonb)$c$, 'daily-agenda-summary'),
  ('*/5 * * * *', $c$UPDATE public.businesses SET name = name WHERE false$c$, 'otro-cron');
