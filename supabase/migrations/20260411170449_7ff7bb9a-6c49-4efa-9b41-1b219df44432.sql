-- Prevent privilege escalation: block inserting super_admin role via RLS
CREATE OR REPLACE FUNCTION public.prevent_super_admin_self_assign()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.role = 'super_admin' THEN
    -- Only allow if current_user is the service role (not a regular authenticated user)
    IF current_setting('role', true) != 'service_role' THEN
      RAISE EXCEPTION 'Cannot assign super_admin role';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER prevent_super_admin_insert
  BEFORE INSERT ON public.user_roles
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_super_admin_self_assign();

CREATE TRIGGER prevent_super_admin_update
  BEFORE UPDATE ON public.user_roles
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_super_admin_self_assign();