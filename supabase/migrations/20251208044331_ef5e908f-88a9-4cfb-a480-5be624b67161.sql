-- Update businesses insert policy to allow super_admin
DROP POLICY IF EXISTS "businesses_insert_own" ON public.businesses;

CREATE POLICY "businesses_insert_own_or_superadmin"
ON public.businesses
FOR INSERT
WITH CHECK (
  owner_user_id = auth.uid() 
  OR is_super_admin(auth.uid())
);

-- Also update the update policy to allow super_admin to update any business
DROP POLICY IF EXISTS "businesses_update_own" ON public.businesses;

CREATE POLICY "businesses_update_own_or_superadmin"
ON public.businesses
FOR UPDATE
USING (
  owner_user_id = auth.uid() 
  OR is_super_admin(auth.uid())
)
WITH CHECK (
  owner_user_id = auth.uid() 
  OR is_super_admin(auth.uid())
);