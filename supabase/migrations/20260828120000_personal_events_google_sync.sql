-- Los eventos personales también se espejan en Google Calendar.
-- Mismo esquema que appointments: id del evento en Google + última vez
-- que se empujó (updated_at ya existe con su trigger).

ALTER TABLE public.personal_events ADD COLUMN IF NOT EXISTS google_event_id text;
ALTER TABLE public.personal_events ADD COLUMN IF NOT EXISTS google_synced_at timestamptz;
