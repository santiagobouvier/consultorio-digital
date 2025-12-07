-- 1. Create function to check if user is super_admin
CREATE OR REPLACE FUNCTION public.is_super_admin(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id 
      AND role = 'super_admin'
  )
$$;

-- 2. Update user_belongs_to_business to also allow super_admin
CREATE OR REPLACE FUNCTION public.user_belongs_to_business(_user_id uuid, _business_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    -- Super admin can access everything
    public.is_super_admin(_user_id)
    OR
    -- Owner of the business
    EXISTS (
      SELECT 1
      FROM public.businesses b
      WHERE b.id = _business_id AND b.owner_user_id = _user_id
    )
    OR
    -- Member of the business via user_roles
    EXISTS (
      SELECT 1
      FROM public.user_roles ur
      WHERE ur.user_id = _user_id 
        AND ur.business_id = _business_id 
        AND ur.role IN ('owner', 'professional')
    )
$$;

-- 3. Update businesses RLS to allow super_admin to see all
DROP POLICY IF EXISTS "businesses_select_own_or_member" ON public.businesses;

CREATE POLICY "businesses_select_own_or_member_or_superadmin"
ON public.businesses
FOR SELECT
USING (
  public.is_super_admin(auth.uid())
  OR owner_user_id = auth.uid()
  OR public.user_belongs_to_business(auth.uid(), id)
);

-- Keep existing update/delete/insert policies for owners only
-- Super admin viewing is enough for now

-- 4. Update clinic_settings RLS to allow super_admin
DROP POLICY IF EXISTS "Users can view their own clinic settings" ON public.clinic_settings;

CREATE POLICY "Users can view clinic settings"
ON public.clinic_settings
FOR SELECT
USING (
  public.is_super_admin(auth.uid())
  OR auth.uid() = user_id
);

-- 5. Update appointment_requests RLS
DROP POLICY IF EXISTS "Clinic owners can view their appointment requests" ON public.appointment_requests;

CREATE POLICY "Clinic owners or superadmin can view appointment requests"
ON public.appointment_requests
FOR SELECT
USING (
  public.is_super_admin(auth.uid())
  OR clinic_user_id = auth.uid()
);

-- 6. Update user_roles view policy for super_admin
CREATE POLICY "Super admin can view all roles"
ON public.user_roles
FOR SELECT
USING (public.is_super_admin(auth.uid()));

-- 7. Update profiles RLS to allow super_admin to view all
DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;

CREATE POLICY "Users can view profiles"
ON public.profiles
FOR SELECT
USING (
  public.is_super_admin(auth.uid())
  OR id = auth.uid()
);

-- 8. Update professional_portal_invites RLS for super_admin
CREATE POLICY "Super admin can view all professional invites"
ON public.professional_portal_invites
FOR SELECT
USING (public.is_super_admin(auth.uid()));

-- 9. Update patient_portal_invites RLS for super_admin  
CREATE POLICY "Super admin can view all patient invites"
ON public.patient_portal_invites
FOR SELECT
USING (public.is_super_admin(auth.uid()));

-- 10. Update scheduled_reminders RLS for super_admin
CREATE POLICY "Super admin can view all reminders"
ON public.scheduled_reminders
FOR SELECT
USING (public.is_super_admin(auth.uid()));