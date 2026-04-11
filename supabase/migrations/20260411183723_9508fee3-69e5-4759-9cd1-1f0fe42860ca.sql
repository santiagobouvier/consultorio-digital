-- Add portal customization columns to businesses table
ALTER TABLE public.businesses
  ADD COLUMN IF NOT EXISTS portal_logo_url text,
  ADD COLUMN IF NOT EXISTS portal_clinic_display_name text,
  ADD COLUMN IF NOT EXISTS portal_primary_color text DEFAULT '176 100% 32%',
  ADD COLUMN IF NOT EXISTS portal_dark_primary_color text DEFAULT '176 85% 42%',
  ADD COLUMN IF NOT EXISTS portal_theme_preset text DEFAULT 'teal';