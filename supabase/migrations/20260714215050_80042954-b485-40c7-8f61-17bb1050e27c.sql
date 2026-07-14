-- Recreate branding view with allowlisted columns (adds fields public pages need)
DROP VIEW IF EXISTS public.businesses_public_branding;
CREATE VIEW public.businesses_public_branding
WITH (security_invoker = true)
AS
SELECT
  id,
  owner_user_id,
  name,
  public_slug,
  specialty,
  is_private_clinic,
  portal_clinic_display_name,
  portal_logo_url,
  portal_primary_color,
  portal_dark_primary_color,
  portal_theme_preset,
  custom_subdomain,
  custom_domain,
  dashboard_display_name,
  dashboard_logo_url,
  dashboard_primary_color,
  shared_calendar,
  plan_code,
  cancellation_hours_notice,
  late_cancellation_message,
  contact_email
FROM public.businesses;

GRANT SELECT ON public.businesses_public_branding TO anon, authenticated;

-- Remove overly permissive anon SELECT policy on businesses
DROP POLICY IF EXISTS "Public can read business branding columns" ON public.businesses;
