-- Links de cobro de Mercado Pago atados a pagos del sistema.
--   mp_link_url        -> URL del checkout para compartir con el paciente
--   mp_link_status     -> created | in_process | rejected | approved
--   mp_link_created_at -> cuándo se generó/actualizó el link
-- (mp_preference_id ya existía: lo usa el pago desde el portal del paciente)

ALTER TABLE public.payments
  ADD COLUMN IF NOT EXISTS mp_link_url text,
  ADD COLUMN IF NOT EXISTS mp_link_status text,
  ADD COLUMN IF NOT EXISTS mp_link_created_at timestamptz;
