-- Drop the vulnerable public SELECT policy
DROP POLICY IF EXISTS "Public can validate invite tokens" ON public.patient_portal_invites;

-- Create a security definer function to validate patient invite tokens
-- This only returns the invite if the exact token matches, preventing enumeration
CREATE OR REPLACE FUNCTION public.validate_patient_invite(p_token text)
RETURNS TABLE (
  id uuid,
  patient_id uuid,
  expires_at timestamptz,
  used_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    id,
    patient_id,
    expires_at,
    used_at
  FROM public.patient_portal_invites
  WHERE token = p_token
  LIMIT 1;
$$;