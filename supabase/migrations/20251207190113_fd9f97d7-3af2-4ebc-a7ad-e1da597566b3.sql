-- 1. Add business_id column to user_roles
ALTER TABLE public.user_roles 
ADD COLUMN IF NOT EXISTS business_id uuid REFERENCES public.businesses(id) ON DELETE CASCADE;

-- 2. Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_user_roles_business_id ON public.user_roles(business_id);
CREATE INDEX IF NOT EXISTS idx_user_roles_user_business ON public.user_roles(user_id, business_id);

-- 3. Create professional_portal_invites table
CREATE TABLE IF NOT EXISTS public.professional_portal_invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  auth_user_id uuid,
  email text NOT NULL,
  name text NOT NULL,
  token text NOT NULL UNIQUE,
  expires_at timestamp with time zone DEFAULT (now() + interval '7 days'),
  used_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS on professional_portal_invites
ALTER TABLE public.professional_portal_invites ENABLE ROW LEVEL SECURITY;

-- 4. Create security definer function to check if user belongs to a business
CREATE OR REPLACE FUNCTION public.user_belongs_to_business(_user_id uuid, _business_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.businesses b
    WHERE b.id = _business_id AND b.owner_user_id = _user_id
  )
  OR EXISTS (
    SELECT 1
    FROM public.user_roles ur
    WHERE ur.user_id = _user_id 
      AND ur.business_id = _business_id 
      AND ur.role IN ('owner', 'professional')
  )
$$;

-- 5. Create function to get user's business_id
CREATE OR REPLACE FUNCTION public.get_user_business_id(_user_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT id FROM public.businesses WHERE owner_user_id = _user_id LIMIT 1),
    (SELECT business_id FROM public.user_roles WHERE user_id = _user_id AND role IN ('owner', 'professional') LIMIT 1)
  )
$$;

-- 6. RLS policies for professional_portal_invites
CREATE POLICY "Business owners can manage professional invites"
ON public.professional_portal_invites
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.businesses b
    WHERE b.id = professional_portal_invites.business_id 
    AND b.owner_user_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.businesses b
    WHERE b.id = professional_portal_invites.business_id 
    AND b.owner_user_id = auth.uid()
  )
);

CREATE POLICY "Public can validate professional invite tokens"
ON public.professional_portal_invites
FOR SELECT
USING (true);

-- 7. Update user_roles RLS to allow business owners to manage roles
DROP POLICY IF EXISTS "Users can view their own roles" ON public.user_roles;

CREATE POLICY "Users can view their own roles"
ON public.user_roles
FOR SELECT
USING (user_id = auth.uid());

CREATE POLICY "Business owners can view business roles"
ON public.user_roles
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.businesses b
    WHERE b.id = user_roles.business_id 
    AND b.owner_user_id = auth.uid()
  )
);

CREATE POLICY "Business owners can insert business roles"
ON public.user_roles
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.businesses b
    WHERE b.id = user_roles.business_id 
    AND b.owner_user_id = auth.uid()
  )
);

CREATE POLICY "Business owners can delete business roles"
ON public.user_roles
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.businesses b
    WHERE b.id = user_roles.business_id 
    AND b.owner_user_id = auth.uid()
  )
);

-- 8. Update RLS policies for businesses to include professionals
DROP POLICY IF EXISTS "businesses_select_own" ON public.businesses;

CREATE POLICY "businesses_select_own_or_member"
ON public.businesses
FOR SELECT
USING (
  owner_user_id = auth.uid()
  OR public.user_belongs_to_business(auth.uid(), id)
);

-- 9. Update RLS policies for patients
DROP POLICY IF EXISTS "patients_select_own_business" ON public.patients;
DROP POLICY IF EXISTS "patients_insert_own_business" ON public.patients;
DROP POLICY IF EXISTS "patients_update_own_business" ON public.patients;
DROP POLICY IF EXISTS "patients_delete_own_business" ON public.patients;

CREATE POLICY "patients_select_own_business"
ON public.patients
FOR SELECT
USING (public.user_belongs_to_business(auth.uid(), business_id));

CREATE POLICY "patients_insert_own_business"
ON public.patients
FOR INSERT
WITH CHECK (public.user_belongs_to_business(auth.uid(), business_id));

CREATE POLICY "patients_update_own_business"
ON public.patients
FOR UPDATE
USING (public.user_belongs_to_business(auth.uid(), business_id))
WITH CHECK (public.user_belongs_to_business(auth.uid(), business_id));

CREATE POLICY "patients_delete_own_business"
ON public.patients
FOR DELETE
USING (public.user_belongs_to_business(auth.uid(), business_id));

-- 10. Update RLS policies for appointments
DROP POLICY IF EXISTS "appointments_select_own_business" ON public.appointments;
DROP POLICY IF EXISTS "appointments_insert_own_business" ON public.appointments;
DROP POLICY IF EXISTS "appointments_update_own_business" ON public.appointments;
DROP POLICY IF EXISTS "appointments_delete_own_business" ON public.appointments;

CREATE POLICY "appointments_select_own_business"
ON public.appointments
FOR SELECT
USING (public.user_belongs_to_business(auth.uid(), business_id));

CREATE POLICY "appointments_insert_own_business"
ON public.appointments
FOR INSERT
WITH CHECK (public.user_belongs_to_business(auth.uid(), business_id));

CREATE POLICY "appointments_update_own_business"
ON public.appointments
FOR UPDATE
USING (public.user_belongs_to_business(auth.uid(), business_id))
WITH CHECK (public.user_belongs_to_business(auth.uid(), business_id));

CREATE POLICY "appointments_delete_own_business"
ON public.appointments
FOR DELETE
USING (public.user_belongs_to_business(auth.uid(), business_id));

-- 11. Update RLS policies for availability_slots
DROP POLICY IF EXISTS "Business owners can view their availability slots" ON public.availability_slots;
DROP POLICY IF EXISTS "Business owners can create availability slots" ON public.availability_slots;
DROP POLICY IF EXISTS "Business owners can update availability slots" ON public.availability_slots;
DROP POLICY IF EXISTS "Business owners can delete availability slots" ON public.availability_slots;

CREATE POLICY "Business members can view their availability slots"
ON public.availability_slots
FOR SELECT
USING (public.user_belongs_to_business(auth.uid(), business_id));

CREATE POLICY "Business members can create availability slots"
ON public.availability_slots
FOR INSERT
WITH CHECK (public.user_belongs_to_business(auth.uid(), business_id));

CREATE POLICY "Business members can update availability slots"
ON public.availability_slots
FOR UPDATE
USING (public.user_belongs_to_business(auth.uid(), business_id));

CREATE POLICY "Business members can delete availability slots"
ON public.availability_slots
FOR DELETE
USING (public.user_belongs_to_business(auth.uid(), business_id));

-- 12. Update RLS policies for payments
DROP POLICY IF EXISTS "payments_select_own_business" ON public.payments;
DROP POLICY IF EXISTS "payments_insert_own_business" ON public.payments;
DROP POLICY IF EXISTS "payments_update_own_business" ON public.payments;
DROP POLICY IF EXISTS "payments_delete_own_business" ON public.payments;

CREATE POLICY "payments_select_own_business"
ON public.payments
FOR SELECT
USING (public.user_belongs_to_business(auth.uid(), business_id));

CREATE POLICY "payments_insert_own_business"
ON public.payments
FOR INSERT
WITH CHECK (public.user_belongs_to_business(auth.uid(), business_id));

CREATE POLICY "payments_update_own_business"
ON public.payments
FOR UPDATE
USING (public.user_belongs_to_business(auth.uid(), business_id));

CREATE POLICY "payments_delete_own_business"
ON public.payments
FOR DELETE
USING (public.user_belongs_to_business(auth.uid(), business_id));

-- 13. Update RLS policies for services
DROP POLICY IF EXISTS "Business owners can manage their services" ON public.services;

CREATE POLICY "Business members can manage their services"
ON public.services
FOR ALL
USING (public.user_belongs_to_business(auth.uid(), business_id))
WITH CHECK (public.user_belongs_to_business(auth.uid(), business_id));