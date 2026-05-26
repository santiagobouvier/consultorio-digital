-- Migración 2: policies de privacidad para patients

DROP POLICY IF EXISTS "patients_select_own_business" ON public.patients;
DROP POLICY IF EXISTS "patients_insert_own_business" ON public.patients;
DROP POLICY IF EXISTS "patients_update_own_business" ON public.patients;
DROP POLICY IF EXISTS "patients_delete_own_business" ON public.patients;

-- SELECT: super admin, profesional asignado o creador
CREATE POLICY "patients_select_assigned_or_creator"
ON public.patients
FOR SELECT
TO authenticated
USING (
  public.is_super_admin(auth.uid())
  OR assigned_professional_id = auth.uid()
  OR created_by = auth.uid()
);

-- INSERT: miembro del business; assigned/created_by deben quedar como auth.uid() (o NULL → trigger los completa)
CREATE POLICY "patients_insert_business_member"
ON public.patients
FOR INSERT
TO authenticated
WITH CHECK (
  public.user_belongs_to_business(auth.uid(), business_id)
  AND (assigned_professional_id IS NULL OR assigned_professional_id = auth.uid() OR public.is_super_admin(auth.uid()))
  AND (created_by IS NULL OR created_by = auth.uid() OR public.is_super_admin(auth.uid()))
);

-- UPDATE: super admin, profesional asignado o creador
CREATE POLICY "patients_update_assigned"
ON public.patients
FOR UPDATE
TO authenticated
USING (
  public.is_super_admin(auth.uid())
  OR assigned_professional_id = auth.uid()
  OR created_by = auth.uid()
)
WITH CHECK (
  public.is_super_admin(auth.uid())
  OR assigned_professional_id = auth.uid()
  OR created_by = auth.uid()
);

-- DELETE: profesional asignado o creador (super admin ya tiene su policy aparte)
CREATE POLICY "patients_delete_assigned"
ON public.patients
FOR DELETE
TO authenticated
USING (
  assigned_professional_id = auth.uid()
  OR created_by = auth.uid()
);