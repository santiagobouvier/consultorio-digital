-- Migración 3: policies de privacidad para payments

DROP POLICY IF EXISTS "payments_select_own_business" ON public.payments;
DROP POLICY IF EXISTS "payments_insert_own_business" ON public.payments;
DROP POLICY IF EXISTS "payments_update_own_business" ON public.payments;
DROP POLICY IF EXISTS "payments_delete_own_business" ON public.payments;

-- SELECT: super admin, profesional asignado/creador del paciente, o profesional de la cita asociada
CREATE POLICY "payments_select_prof"
ON public.payments
FOR SELECT
TO authenticated
USING (
  public.is_super_admin(auth.uid())
  OR public.is_patient_professional(auth.uid(), patient_id)
  OR (
    appointment_id IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.appointments a
      WHERE a.id = payments.appointment_id
        AND a.professional_id = auth.uid()
    )
  )
);

-- INSERT: super admin o profesional asignado/creador del paciente
CREATE POLICY "payments_insert_prof"
ON public.payments
FOR INSERT
TO authenticated
WITH CHECK (
  public.is_super_admin(auth.uid())
  OR public.is_patient_professional(auth.uid(), patient_id)
);

-- UPDATE: super admin, profesional asignado/creador, o profesional de la cita asociada
CREATE POLICY "payments_update_prof"
ON public.payments
FOR UPDATE
TO authenticated
USING (
  public.is_super_admin(auth.uid())
  OR public.is_patient_professional(auth.uid(), patient_id)
  OR (
    appointment_id IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.appointments a
      WHERE a.id = payments.appointment_id
        AND a.professional_id = auth.uid()
    )
  )
)
WITH CHECK (
  public.is_super_admin(auth.uid())
  OR public.is_patient_professional(auth.uid(), patient_id)
  OR (
    appointment_id IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.appointments a
      WHERE a.id = payments.appointment_id
        AND a.professional_id = auth.uid()
    )
  )
);

-- DELETE: profesional asignado/creador del paciente (super admin ya tiene su policy aparte)
CREATE POLICY "payments_delete_prof"
ON public.payments
FOR DELETE
TO authenticated
USING (
  public.is_patient_professional(auth.uid(), patient_id)
);