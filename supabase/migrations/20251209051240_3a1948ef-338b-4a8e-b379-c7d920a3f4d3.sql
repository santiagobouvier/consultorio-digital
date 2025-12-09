-- Add policy for patients to view available slots of their clinic
CREATE POLICY "Patients can view available slots of their business"
ON public.availability_slots
FOR SELECT
USING (
  status = 'available' 
  AND date >= CURRENT_DATE
  AND EXISTS (
    SELECT 1 
    FROM public.patients p 
    WHERE p.business_id = availability_slots.business_id 
      AND p.auth_user_id = auth.uid()
      AND p.is_active = true
  )
);

-- Add policy for patients to update slots when booking (to mark as booked)
CREATE POLICY "Patients can book available slots of their business"
ON public.availability_slots
FOR UPDATE
USING (
  status = 'available'
  AND EXISTS (
    SELECT 1 
    FROM public.patients p 
    WHERE p.business_id = availability_slots.business_id 
      AND p.auth_user_id = auth.uid()
      AND p.is_active = true
  )
);

-- Add policy for patients to insert appointments in their business
CREATE POLICY "Patients can create appointments in their business"
ON public.appointments
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 
    FROM public.patients p 
    WHERE p.business_id = appointments.business_id 
      AND p.id = appointments.patient_id
      AND p.auth_user_id = auth.uid()
      AND p.is_active = true
  )
);