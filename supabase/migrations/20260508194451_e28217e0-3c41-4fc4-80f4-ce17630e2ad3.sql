ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS mp_preference_id text;
CREATE INDEX IF NOT EXISTS idx_payments_mp_preference_id ON public.payments(mp_preference_id);