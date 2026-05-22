
-- =========================================================
-- Phase 1 / Sub-fase 1.A: appointments RLS refactor
-- Modelo: cada profesional ve y crea SOLO sus propias citas.
-- Owner = profesional con poderes administrativos (vía edge functions).
-- =========================================================

-- 1) DROP de policies viejas (genéricas o redundantes)
DROP POLICY IF EXISTS "appointments_select_own_business" ON public.appointments;
DROP POLICY IF EXISTS "appointments_insert_own_business" ON public.appointments;
DROP POLICY IF EXISTS "appointments_update_own_business" ON public.appointments;
DROP POLICY IF EXISTS "appointments_delete_own_business" ON public.appointments;
DROP POLICY IF EXISTS "Patients can create appointments in their business" ON public.appointments;
DROP POLICY IF EXISTS "Patients can view their own appointments" ON public.appointments;
DROP POLICY IF EXISTS "Super admin can delete appointments" ON public.appointments;

-- KEEP: appointments_patient_update_own (ya validado por trigger enforce_patient_appointment_update)

-- 2) Super admin: full access
CREATE POLICY appointments_super_admin_all
  ON public.appointments
  AS PERMISSIVE
  FOR ALL
  TO authenticated
  USING (public.is_super_admin(auth.uid()))
  WITH CHECK (public.is_super_admin(auth.uid()));

-- 3) Professional: SELECT solo sus propias citas
CREATE POLICY appointments_professional_select_own
  ON public.appointments
  AS PERMISSIVE
  FOR SELECT
  TO authenticated
  USING (professional_id = auth.uid());

-- 4) Professional: INSERT solo asignándose a sí mismo,
--    y solo en businesses donde es miembro (owner o professional)
CREATE POLICY appointments_professional_insert_own
  ON public.appointments
  AS PERMISSIVE
  FOR INSERT
  TO authenticated
  WITH CHECK (
    professional_id = auth.uid()
    AND public.user_belongs_to_business(auth.uid(), business_id)
  );

-- 5) Professional: UPDATE solo sus propias citas
CREATE POLICY appointments_professional_update_own
  ON public.appointments
  AS PERMISSIVE
  FOR UPDATE
  TO authenticated
  USING (professional_id = auth.uid())
  WITH CHECK (
    professional_id = auth.uid()
    AND public.user_belongs_to_business(auth.uid(), business_id)
  );

-- 6) Professional: DELETE solo sus propias citas
CREATE POLICY appointments_professional_delete_own
  ON public.appointments
  AS PERMISSIVE
  FOR DELETE
  TO authenticated
  USING (professional_id = auth.uid());

-- 7) Patient: SELECT sus propias citas (portal)
CREATE POLICY appointments_patient_select_own
  ON public.appointments
  AS PERMISSIVE
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.patients p
      WHERE p.id = appointments.patient_id
        AND p.auth_user_id = auth.uid()
    )
  );

-- 8) Patient: INSERT solo desde el portal, en su business,
--    y el professional_id debe ser un profesional real del business
CREATE POLICY appointments_patient_insert_own
  ON public.appointments
  AS PERMISSIVE
  FOR INSERT
  TO authenticated
  WITH CHECK (
    source = 'patient_portal'
    AND EXISTS (
      SELECT 1 FROM public.patients p
      WHERE p.id = appointments.patient_id
        AND p.business_id = appointments.business_id
        AND p.auth_user_id = auth.uid()
        AND p.is_active = true
    )
    AND (
      -- professional_id es owner del business
      EXISTS (
        SELECT 1 FROM public.businesses b
        WHERE b.id = appointments.business_id
          AND b.owner_user_id = appointments.professional_id
      )
      OR
      -- o es miembro del business via user_roles
      EXISTS (
        SELECT 1 FROM public.user_roles ur
        WHERE ur.user_id = appointments.professional_id
          AND ur.business_id = appointments.business_id
          AND ur.role IN ('owner', 'professional')
      )
    )
  );
