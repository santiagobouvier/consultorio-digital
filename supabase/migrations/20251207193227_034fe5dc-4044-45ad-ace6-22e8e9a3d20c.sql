-- Drop the old check constraint
ALTER TABLE public.user_roles DROP CONSTRAINT IF EXISTS user_roles_role_check;

-- Add new check constraint with all allowed roles
ALTER TABLE public.user_roles ADD CONSTRAINT user_roles_role_check 
CHECK (role IN ('super_admin', 'owner', 'admin', 'professional', 'patient'));

-- Now insert the super_admin user's profile and role
INSERT INTO public.profiles (id, email, name) 
VALUES ('a9af38b2-c2cd-48ef-86ab-1fed9cc4d895', 'santib1997@gmail.com', 'Super Admin')
ON CONFLICT (id) DO UPDATE SET email = EXCLUDED.email;

-- The trigger will automatically create the super_admin role