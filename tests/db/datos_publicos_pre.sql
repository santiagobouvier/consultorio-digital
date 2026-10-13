-- Esquema extra para datos_publicos_test.sql: lo que hoy existe en producción
-- según las migraciones del repo (20260723185950, 20260730230000, políticas de
-- dueño de 20251207/20260418). SOLO Postgres desechable.
ALTER TABLE public.businesses
  ADD COLUMN IF NOT EXISTS specialty text,
  ADD COLUMN IF NOT EXISTS is_private_clinic boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS portal_clinic_display_name text,
  ADD COLUMN IF NOT EXISTS portal_logo_url text,
  ADD COLUMN IF NOT EXISTS portal_primary_color text,
  ADD COLUMN IF NOT EXISTS portal_dark_primary_color text,
  ADD COLUMN IF NOT EXISTS portal_theme_preset text,
  ADD COLUMN IF NOT EXISTS custom_subdomain text,
  ADD COLUMN IF NOT EXISTS custom_domain text,
  ADD COLUMN IF NOT EXISTS dashboard_display_name text,
  ADD COLUMN IF NOT EXISTS dashboard_logo_url text,
  ADD COLUMN IF NOT EXISTS dashboard_primary_color text,
  ADD COLUMN IF NOT EXISTS shared_calendar boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS cancellation_hours_notice integer,
  ADD COLUMN IF NOT EXISTS late_cancellation_message text,
  ADD COLUMN IF NOT EXISTS timezone text;

-- anon: política de branding y columnas públicas (con owner_user_id y plan_code, como hoy)
CREATE POLICY "Anon can view active businesses (branding only)"
  ON public.businesses FOR SELECT TO anon USING (is_active = true);
REVOKE ALL ON public.businesses FROM anon;
GRANT SELECT (
  id, owner_user_id, name, public_slug, specialty, is_active,
  is_private_clinic, portal_clinic_display_name, portal_logo_url,
  portal_primary_color, portal_dark_primary_color, portal_theme_preset,
  custom_subdomain, custom_domain, dashboard_display_name,
  dashboard_logo_url, dashboard_primary_color, shared_calendar,
  plan_code, cancellation_hours_notice, late_cancellation_message,
  timezone, onboarding_completed
) ON public.businesses TO anon;

CREATE VIEW public.businesses_public_branding WITH (security_invoker = true) AS
SELECT id, owner_user_id, name, public_slug, specialty,
  is_private_clinic, portal_clinic_display_name, portal_logo_url,
  portal_primary_color, portal_dark_primary_color, portal_theme_preset,
  custom_subdomain, custom_domain, dashboard_display_name,
  dashboard_logo_url, dashboard_primary_color, shared_calendar,
  plan_code, cancellation_hours_notice, late_cancellation_message
FROM public.businesses WHERE is_active = true;
GRANT SELECT ON public.businesses_public_branding TO anon, authenticated;

-- Horarios: política de dueño (TO public, subconsulta a owner_user_id) y una
-- política pública que anon sí cumple
CREATE TABLE public.availability_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES public.businesses(id),
  is_active boolean NOT NULL DEFAULT true
);
GRANT SELECT ON public.availability_templates TO anon, authenticated;
ALTER TABLE public.availability_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Business owners manage team templates" ON public.availability_templates FOR ALL
  USING (EXISTS (SELECT 1 FROM public.businesses b WHERE b.id = availability_templates.business_id AND b.owner_user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.businesses b WHERE b.id = availability_templates.business_id AND b.owner_user_id = auth.uid()));
CREATE POLICY "Public can view templates of active businesses" ON public.availability_templates FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.businesses b WHERE b.id = availability_templates.business_id AND b.is_active));

CREATE POLICY "Business owners can view business roles" ON public.user_roles FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.businesses b WHERE b.id = user_roles.business_id AND b.owner_user_id = auth.uid()));
