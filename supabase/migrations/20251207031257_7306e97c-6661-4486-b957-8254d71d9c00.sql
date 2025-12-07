-- Create table for patient portal invitations
CREATE TABLE public.patient_portal_invites (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  patient_id UUID NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  auth_user_id UUID NOT NULL,
  token TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT (now() + INTERVAL '7 days'),
  used_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create index for token lookup
CREATE INDEX idx_patient_portal_invites_token ON public.patient_portal_invites(token);

-- Enable RLS
ALTER TABLE public.patient_portal_invites ENABLE ROW LEVEL SECURITY;

-- Policy: Business owners can manage invites for their patients
CREATE POLICY "Business owners can manage patient invites"
ON public.patient_portal_invites
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM patients p
    JOIN businesses b ON b.id = p.business_id
    WHERE p.id = patient_portal_invites.patient_id
    AND b.owner_user_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM patients p
    JOIN businesses b ON b.id = p.business_id
    WHERE p.id = patient_portal_invites.patient_id
    AND b.owner_user_id = auth.uid()
  )
);

-- Policy: Allow public read access for token validation (needed for invitation flow)
CREATE POLICY "Public can validate invite tokens"
ON public.patient_portal_invites
FOR SELECT
USING (true);