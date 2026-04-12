ALTER TABLE public.businesses
  ADD COLUMN IF NOT EXISTS dashboard_primary_color text DEFAULT '176 100% 32%',
  ADD COLUMN IF NOT EXISTS dashboard_logo_url text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS dashboard_display_name text DEFAULT NULL;