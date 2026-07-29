
-- 1) Drop broad anon SELECT on businesses; public data goes through the view
DROP POLICY IF EXISTS "Anon can view active businesses (branding only)" ON public.businesses;
REVOKE SELECT ON public.businesses FROM anon;

-- Ensure the public branding view is readable by anon/authenticated
GRANT SELECT ON public.businesses_public_branding TO anon, authenticated;

-- 2) Lock down SECURITY DEFINER functions: revoke from PUBLIC/anon/authenticated,
--    then grant EXECUTE only where actually needed (RLS helpers and client RPCs).
DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT n.nspname, p.proname,
           pg_catalog.pg_get_function_identity_arguments(p.oid) AS args
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.prosecdef = true
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %I.%I(%s) FROM PUBLIC, anon, authenticated',
                   r.nspname, r.proname, r.args);
  END LOOP;
END $$;

-- RLS helpers referenced inside policies (authenticated must be able to run them)
GRANT EXECUTE ON FUNCTION public.is_super_admin(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.user_belongs_to_business(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_business_owner(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_patient_professional(uuid, uuid) TO authenticated;

-- Client RPCs invoked from the authenticated app
GRANT EXECUTE ON FUNCTION public.get_user_business_id(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.approve_reschedule_request(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.reject_reschedule_request(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_available_starts(uuid, uuid, integer, date, date) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_portal_payment_config(uuid) TO authenticated;

-- Anon-invoked RPCs (pre-login invite/activation flows)
GRANT EXECUTE ON FUNCTION public.validate_business_activation_token(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.validate_patient_invite(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.validate_professional_invite(text) TO anon, authenticated;
