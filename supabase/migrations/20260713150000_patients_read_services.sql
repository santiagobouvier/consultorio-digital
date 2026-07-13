-- Horarios 2.0 · Etapa 4: los pacientes logueados del portal necesitan leer
-- los tipos de sesión ACTIVOS de su consultorio para reservar (mismo patrón
-- que la política de availability_slots para pacientes).

CREATE POLICY "Patients can view active services of their business"
ON public.services
FOR SELECT
TO authenticated
USING (
  is_active = true
  AND EXISTS (
    SELECT 1
    FROM public.patients p
    WHERE p.business_id = services.business_id
      AND p.auth_user_id = auth.uid()
      AND p.is_active = true
  )
);
