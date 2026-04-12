
-- Patients need to read their business data for the portal
CREATE POLICY "Patients can read their business"
ON public.businesses
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.patients p
    WHERE p.business_id = businesses.id
      AND p.auth_user_id = auth.uid()
      AND p.is_active = true
  )
);
