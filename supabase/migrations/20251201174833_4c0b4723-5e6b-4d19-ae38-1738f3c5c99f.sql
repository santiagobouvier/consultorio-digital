DROP POLICY IF EXISTS test_policy ON public.patients;

CREATE POLICY patients_select_own_business
ON public.patients
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.businesses b
    WHERE b.id = patients.business_id
      AND b.owner_user_id = auth.uid()
  )
);

CREATE POLICY patients_insert_own_business
ON public.patients
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.businesses b
    WHERE b.id = patients.business_id
      AND b.owner_user_id = auth.uid()
  )
);

CREATE POLICY patients_update_own_business
ON public.patients
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.businesses b
    WHERE b.id = patients.business_id
      AND b.owner_user_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.businesses b
    WHERE b.id = patients.business_id
      AND b.owner_user_id = auth.uid()
  )
);

CREATE POLICY patients_delete_own_business
ON public.patients
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.businesses b
    WHERE b.id = patients.business_id
      AND b.owner_user_id = auth.uid()
  )
);