-- Un link de feed POR DESTINO (google / apple): así el profesional puede
-- desconectar Google Calendar sin cortar el del iPhone, y viceversa.
-- Antes había un único token por profesional (constraint _unique_pro).

ALTER TABLE public.calendar_feed_tokens
  ADD COLUMN IF NOT EXISTS destination text NOT NULL DEFAULT 'any';

ALTER TABLE public.calendar_feed_tokens
  DROP CONSTRAINT IF EXISTS calendar_feed_tokens_unique_pro;

-- Un token por (profesional, destino)
ALTER TABLE public.calendar_feed_tokens
  DROP CONSTRAINT IF EXISTS calendar_feed_tokens_unique_dest;
ALTER TABLE public.calendar_feed_tokens
  ADD CONSTRAINT calendar_feed_tokens_unique_dest
  UNIQUE (business_id, professional_user_id, destination);
