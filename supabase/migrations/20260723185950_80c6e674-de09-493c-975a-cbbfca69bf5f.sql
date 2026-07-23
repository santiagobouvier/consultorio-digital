
-- =====================================================
-- 1) businesses: hide contact_email from anon (column-level) + tighten policy
-- =====================================================
DROP POLICY IF EXISTS "Anyone can view active businesses" ON public.businesses;

CREATE POLICY "Anon can view active businesses (branding only)"
  ON public.businesses
  FOR SELECT
  TO anon
  USING (is_active = true);

-- Column-level: anon can only SELECT non-sensitive columns
REVOKE SELECT ON public.businesses FROM anon;
GRANT SELECT (
  id, owner_user_id, name, public_slug, specialty, is_active,
  is_private_clinic, portal_clinic_display_name, portal_logo_url,
  portal_primary_color, portal_dark_primary_color, portal_theme_preset,
  custom_subdomain, custom_domain, dashboard_display_name,
  dashboard_logo_url, dashboard_primary_color, shared_calendar,
  plan_code, cancellation_hours_notice, late_cancellation_message,
  timezone, onboarding_completed
) ON public.businesses TO anon;

-- Recreate branding view WITHOUT contact_email
DROP VIEW IF EXISTS public.businesses_public_branding;
CREATE VIEW public.businesses_public_branding
WITH (security_invoker = true) AS
SELECT
  id, owner_user_id, name, public_slug, specialty,
  is_private_clinic, portal_clinic_display_name, portal_logo_url,
  portal_primary_color, portal_dark_primary_color, portal_theme_preset,
  custom_subdomain, custom_domain, dashboard_display_name,
  dashboard_logo_url, dashboard_primary_color, shared_calendar,
  plan_code, cancellation_hours_notice, late_cancellation_message
FROM public.businesses
WHERE is_active = true;

GRANT SELECT ON public.businesses_public_branding TO anon, authenticated;

-- =====================================================
-- 2) appointment_requests: remove always-true insert policy
--    (public bookings are inserted by the public-book-appointment edge function using service_role)
-- =====================================================
DROP POLICY IF EXISTS "Anyone can create appointment requests" ON public.appointment_requests;

-- =====================================================
-- 3) storage.objects: remove overly-permissive avatar/portal-logo policies
-- =====================================================
DROP POLICY IF EXISTS "Authenticated can upload business avatars"  ON storage.objects;
DROP POLICY IF EXISTS "Authenticated can update business avatars"  ON storage.objects;
DROP POLICY IF EXISTS "Authenticated can delete business avatars"  ON storage.objects;
DROP POLICY IF EXISTS "Users can upload portal logos" ON storage.objects;
DROP POLICY IF EXISTS "Users can update portal logos" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete portal logos" ON storage.objects;

-- Add ownership-checked portal-logos policies. Filenames are `portal-logos/{businessId}-icon.png`
CREATE POLICY "Business members can upload portal logos"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = 'portal-logos'
    AND public.user_belongs_to_business(
      auth.uid(),
      NULLIF(substring(name from 'portal-logos/([0-9a-fA-F-]{36})'), '')::uuid
    )
  );

CREATE POLICY "Business members can update portal logos"
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = 'portal-logos'
    AND public.user_belongs_to_business(
      auth.uid(),
      NULLIF(substring(name from 'portal-logos/([0-9a-fA-F-]{36})'), '')::uuid
    )
  );

CREATE POLICY "Business members can delete portal logos"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = 'portal-logos'
    AND public.user_belongs_to_business(
      auth.uid(),
      NULLIF(substring(name from 'portal-logos/([0-9a-fA-F-]{36})'), '')::uuid
    )
  );

-- Prevent bucket listing: remove the broad SELECT-all policy.
-- Public URLs still work (bucket is public) — only the ability to list every object is removed.
DROP POLICY IF EXISTS "Avatars are publicly accessible" ON storage.objects;

-- =====================================================
-- 4) Revoke EXECUTE on internal SECURITY DEFINER functions
--    (trigger functions + internal helpers not called from client)
-- =====================================================
DO $$
DECLARE
  fn text;
  fns text[] := ARRAY[
    -- trigger functions
    'assign_super_admin_on_profile_create()',
    'auto_create_payment_for_panel_appointment()',
    'auto_create_reminders()',
    'cancel_payment_on_appointment_cancel()',
    'create_trial_subscription_on_business()',
    'enforce_patient_appointment_update()',
    'enforce_patient_limit()',
    'enforce_professional_limit()',
    'generate_next_recurring_payment()',
    'handle_coordination_mode_change()',
    'notify_patient_appointment_status()',
    'notify_patient_payment_paid()',
    'notify_professional_portal_requests()',
    'patients_protect_sensitive_bu()',
    'patients_set_defaults_bi()',
    'prevent_super_admin_self_assign()',
    'sync_reminders_on_appointment_change()',
    'update_updated_at_column()',
    -- internal helpers (not called from client / not used in RLS)
    'can_add_patient(uuid)',
    'can_add_professional(uuid)',
    'count_business_active_patients(uuid)',
    'count_business_professionals(uuid)',
    'get_agenda_view(uuid, timestamptz, timestamptz)',
    'get_available_slots(uuid, uuid, date, date, integer)',
    'get_plan_limits(text)',
    'get_template_day_ranges(uuid, integer)',
    'normalize_phone(text)',
    'preview_template_generation(uuid, date, date)'
  ];
BEGIN
  FOREACH fn IN ARRAY fns LOOP
    BEGIN
      EXECUTE format('REVOKE EXECUTE ON FUNCTION public.%s FROM PUBLIC, anon, authenticated', fn);
    EXCEPTION WHEN undefined_function THEN
      RAISE NOTICE 'skip %', fn;
    END;
  END LOOP;
END $$;
