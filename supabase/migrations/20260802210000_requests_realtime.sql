-- El badge de Solicitudes (sidebar) escucha cambios por Realtime en
-- appointment_requests y appointment_reschedule_requests, pero esas tablas
-- nunca entraron a la publicación supabase_realtime: el contador quedaba
-- congelado hasta recargar la página. Idempotente, como el del dashboard.

DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['appointment_requests', 'appointment_reschedule_requests']
  LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime'
        AND schemaname = 'public'
        AND tablename = t
    ) THEN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', t);
    END IF;
  END LOOP;
END $$;
