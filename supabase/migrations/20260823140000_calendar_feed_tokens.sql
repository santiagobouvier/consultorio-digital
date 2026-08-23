-- Link privado de suscripción iCal: el profesional agrega su agenda del
-- consultorio a Google Calendar / iPhone con una URL secreta (token).
-- El token es la única llave: quien lo tenga ve SOLO los turnos de ese
-- profesional (nunca datos clínicos). Se puede regenerar cuando quiera.

CREATE TABLE IF NOT EXISTS public.calendar_feed_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL,
  professional_user_id uuid NOT NULL,
  token uuid NOT NULL UNIQUE DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT calendar_feed_tokens_unique_pro UNIQUE (business_id, professional_user_id)
);

CREATE INDEX IF NOT EXISTS idx_calendar_feed_tokens_token
  ON public.calendar_feed_tokens(token);

ALTER TABLE public.calendar_feed_tokens ENABLE ROW LEVEL SECURITY;

DROP TRIGGER IF EXISTS trg_calendar_feed_tokens_updated_at ON public.calendar_feed_tokens;
CREATE TRIGGER trg_calendar_feed_tokens_updated_at
  BEFORE UPDATE ON public.calendar_feed_tokens
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Cada profesional maneja SOLO su propio token, dentro de su consultorio.
DROP POLICY IF EXISTS "feed_tokens_own_all" ON public.calendar_feed_tokens;
CREATE POLICY "feed_tokens_own_all"
  ON public.calendar_feed_tokens
  FOR ALL
  USING (
    professional_user_id = auth.uid()
    AND public.user_belongs_to_business(auth.uid(), business_id)
  )
  WITH CHECK (
    professional_user_id = auth.uid()
    AND public.user_belongs_to_business(auth.uid(), business_id)
  );

DROP POLICY IF EXISTS "feed_tokens_super_admin_all" ON public.calendar_feed_tokens;
CREATE POLICY "feed_tokens_super_admin_all"
  ON public.calendar_feed_tokens
  FOR ALL
  USING (public.is_super_admin(auth.uid()))
  WITH CHECK (public.is_super_admin(auth.uid()));
