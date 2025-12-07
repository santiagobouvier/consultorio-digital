-- Add auth_user_id to patients for linking patient to auth user
ALTER TABLE public.patients 
ADD COLUMN IF NOT EXISTS auth_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_patients_auth_user_id ON public.patients(auth_user_id);

-- Add RLS policy for patients to view their own record
CREATE POLICY "Patients can view their own record"
ON public.patients
FOR SELECT
TO authenticated
USING (auth_user_id = auth.uid());

-- Add RLS policy for patients to view their own appointments
CREATE POLICY "Patients can view their own appointments"
ON public.appointments
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.patients p 
    WHERE p.id = appointments.patient_id 
    AND p.auth_user_id = auth.uid()
  )
);

-- Add RLS policy for patients to view their own payments
CREATE POLICY "Patients can view their own payments"
ON public.payments
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.patients p 
    WHERE p.id = payments.patient_id 
    AND p.auth_user_id = auth.uid()
  )
);

-- Enable RLS on user_roles if not already enabled
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Policy for users to view their own roles
CREATE POLICY "Users can view their own roles"
ON public.user_roles
FOR SELECT
TO authenticated
USING (user_id = auth.uid());