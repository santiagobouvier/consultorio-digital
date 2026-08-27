-- Calendarios personales conectados (Google Calendar / iCloud / Outlook).
-- El profesional pega el link iCal privado de SU calendario; el sistema lo
-- lee (solo lectura, del lado del servidor) para avisar choques al agendar.
-- La URL es secreta: solo la lee la edge function con service role.

CREATE TABLE IF NOT EXISTS public.external_calendars (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  professional_user_id uuid NOT NULL,
  business_id uuid REFERENCES public.businesses(id) ON DELETE CASCADE,
  label text NOT NULL DEFAULT 'Mi calendario',
  ics_url text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS external_calendars_professional_idx
  ON public.external_calendars (professional_user_id);

ALTER TABLE public.external_calendars ENABLE ROW LEVEL SECURITY;

-- Cada profesional ve y maneja SOLO sus calendarios. (La edge function usa
-- service role; esta política protege el acceso directo desde el cliente.)
DROP POLICY IF EXISTS "own external calendars" ON public.external_calendars;
CREATE POLICY "own external calendars"
  ON public.external_calendars
  FOR ALL
  USING (professional_user_id = auth.uid())
  WITH CHECK (professional_user_id = auth.uid());
