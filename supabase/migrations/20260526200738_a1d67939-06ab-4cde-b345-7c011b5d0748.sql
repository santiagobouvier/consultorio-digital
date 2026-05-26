-- Step 5/7: RLS refactor for public.spaces
-- Drop old broad policy + patient policy (will recreate patient with new filter)
DROP POLICY IF EXISTS spaces_business_all ON public.spaces;
DROP POLICY IF EXISTS spaces_patient_select ON public.spaces;

-- SELECT: members see shared spaces of their business + their own independent ones
CREATE POLICY spaces_select_member
  ON public.spaces
  FOR SELECT
  TO authenticated
  USING (
    public.user_belongs_to_business(auth.uid(), business_id)
    AND (owned_by_user_id IS NULL OR owned_by_user_id = auth.uid())
  );

-- SELECT for active patients: only shared spaces of their business
CREATE POLICY spaces_patient_select
  ON public.spaces
  FOR SELECT
  TO authenticated
  USING (
    owned_by_user_id IS NULL
    AND EXISTS (
      SELECT 1 FROM public.patients p
      WHERE p.business_id = spaces.business_id
        AND p.auth_user_id = auth.uid()
        AND p.is_active
    )
  );

-- INSERT shared: only business owner can create shared spaces
CREATE POLICY spaces_insert_shared_owner
  ON public.spaces
  FOR INSERT
  TO authenticated
  WITH CHECK (
    owned_by_user_id IS NULL
    AND public.is_business_owner(auth.uid(), business_id)
  );

-- INSERT independent: any member can create their own independent spaces
CREATE POLICY spaces_insert_independent_self
  ON public.spaces
  FOR INSERT
  TO authenticated
  WITH CHECK (
    owned_by_user_id = auth.uid()
    AND public.user_belongs_to_business(auth.uid(), business_id)
  );

-- UPDATE shared: only owner
CREATE POLICY spaces_update_shared_owner
  ON public.spaces
  FOR UPDATE
  TO authenticated
  USING (
    owned_by_user_id IS NULL
    AND public.is_business_owner(auth.uid(), business_id)
  )
  WITH CHECK (
    owned_by_user_id IS NULL
    AND public.is_business_owner(auth.uid(), business_id)
  );

-- UPDATE own independent
CREATE POLICY spaces_update_own_independent
  ON public.spaces
  FOR UPDATE
  TO authenticated
  USING (
    owned_by_user_id = auth.uid()
    AND public.user_belongs_to_business(auth.uid(), business_id)
  )
  WITH CHECK (
    owned_by_user_id = auth.uid()
    AND public.user_belongs_to_business(auth.uid(), business_id)
  );

-- DELETE shared: only owner
CREATE POLICY spaces_delete_shared_owner
  ON public.spaces
  FOR DELETE
  TO authenticated
  USING (
    owned_by_user_id IS NULL
    AND public.is_business_owner(auth.uid(), business_id)
  );

-- DELETE own independent
CREATE POLICY spaces_delete_own_independent
  ON public.spaces
  FOR DELETE
  TO authenticated
  USING (
    owned_by_user_id = auth.uid()
    AND public.user_belongs_to_business(auth.uid(), business_id)
  );