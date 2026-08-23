-- Cron nocturno: a las 20:00 de Montevideo (23:00 UTC) dispara el push
-- "Tu día de mañana" a cada profesional con turnos al día siguiente.
-- Mismo patrón que los demás crons: pg_net → edge function con la anon key.

DO $$
BEGIN
  PERFORM cron.unschedule('daily-agenda-summary');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

SELECT cron.schedule(
  'daily-agenda-summary',
  '0 23 * * *',
  $$
  SELECT net.http_post(
    url := 'https://sfvuuzpmsgepooeamkin.supabase.co/functions/v1/daily-agenda-summary',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNmdnV1enBtc2dlcG9vZWFta2luIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ1ODc3NjgsImV4cCI6MjA4MDE2Mzc2OH0.P_Iaw8XxkPA5sY04-v5gUYFJ2ZSS2kyo3js6X9MQamA',
      'apikey', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNmdnV1enBtc2dlcG9vZWFta2luIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ1ODc3NjgsImV4cCI6MjA4MDE2Mzc2OH0.P_Iaw8XxkPA5sY04-v5gUYFJ2ZSS2kyo3js6X9MQamA'
    ),
    body := '{}'::jsonb
  )
  $$
);
