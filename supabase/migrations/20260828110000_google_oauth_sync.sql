-- "Continuar con Google": cuentas conectadas por OAuth para sincronización
-- instantánea de citas. El refresh_token es secreto: la tabla tiene RLS sin
-- políticas, así que SOLO las edge functions (service role) pueden tocarla.

CREATE TABLE IF NOT EXISTS public.google_calendar_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  professional_user_id uuid NOT NULL UNIQUE,
  business_id uuid REFERENCES public.businesses(id) ON DELETE CASCADE,
  google_email text,
  refresh_token text NOT NULL,
  calendar_id text NOT NULL DEFAULT 'primary',
  sync_enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.google_calendar_accounts ENABLE ROW LEVEL SECURITY;

-- Estados temporales del flujo OAuth (atan el callback al profesional)
CREATE TABLE IF NOT EXISTS public.google_oauth_states (
  state uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  professional_user_id uuid NOT NULL,
  business_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.google_oauth_states ENABLE ROW LEVEL SECURITY;

-- Rastro del espejo en Google por cita (para crear/editar/borrar allá)
ALTER TABLE public.appointments ADD COLUMN IF NOT EXISTS google_event_id text;
ALTER TABLE public.appointments ADD COLUMN IF NOT EXISTS google_synced_at timestamptz;
