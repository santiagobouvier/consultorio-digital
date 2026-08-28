-- Iconito (emoji) opcional en los eventos personales: se ve en la grilla
-- del día y viaja a Google Calendar como prefijo del título.
ALTER TABLE public.personal_events ADD COLUMN IF NOT EXISTS icon text;
