
-- Allow patients to update their own profile fields
CREATE POLICY "Patients can update their own record"
ON public.patients
FOR UPDATE
TO authenticated
USING (auth_user_id = auth.uid())
WITH CHECK (auth_user_id = auth.uid());
