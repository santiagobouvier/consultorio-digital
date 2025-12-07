-- Create trigger function to assign super_admin role to specific email
CREATE OR REPLACE FUNCTION public.assign_super_admin_on_profile_create()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Check if this is the super admin email
  IF NEW.email = 'santib1997@gmail.com' THEN
    -- Insert super_admin role if not exists
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'super_admin')
    ON CONFLICT DO NOTHING;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger on profiles table
DROP TRIGGER IF EXISTS on_profile_created_assign_super_admin ON public.profiles;
CREATE TRIGGER on_profile_created_assign_super_admin
  AFTER INSERT ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.assign_super_admin_on_profile_create();

-- Also check existing profiles and assign role if user already exists
DO $$
DECLARE
  admin_user_id UUID;
BEGIN
  SELECT id INTO admin_user_id FROM public.profiles WHERE email = 'santib1997@gmail.com';
  IF admin_user_id IS NOT NULL THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (admin_user_id, 'super_admin')
    ON CONFLICT DO NOTHING;
  END IF;
END $$;