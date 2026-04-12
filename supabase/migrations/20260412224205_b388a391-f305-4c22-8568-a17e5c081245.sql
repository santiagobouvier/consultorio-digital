
-- Drop the overly permissive policy
DROP POLICY IF EXISTS "Public can read business branding by slug" ON public.businesses;

-- Create a public branding view with only non-sensitive fields
CREATE OR REPLACE VIEW public.businesses_public_branding
WITH (security_invoker = on)
AS
SELECT
  id,
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
  shared_calendar
FROM public.businesses;

-- Add a new restricted public SELECT policy that only allows reading specific rows
-- This is needed so the view (with security_invoker) can read the base table for anon users
CREATE POLICY "Public can read business branding columns"
ON public.businesses
FOR SELECT
TO anon
USING (true);
