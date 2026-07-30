-- Dashboard "Tu día" en tiempo real: el navegador se suscribe a cambios de
-- citas, pagos y notas por Supabase Realtime. Para que lleguen los eventos,
-- las tablas deben estar en la publicación supabase_realtime.
-- Idempotente: solo agrega las que falten.

DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['appointments', 'payments', 'session_notes']
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
