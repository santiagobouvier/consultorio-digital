-- Drop the vulnerable public SELECT policy
DROP POLICY IF EXISTS "Public can validate professional invite tokens" ON public.professional_portal_invites;

-- Create a security definer function to validate professional invite tokens
-- This only returns the invite if the exact token matches, preventing enumeration
CREATE OR REPLACE FUNCTION public.validate_professional_invite(p_token text)
RETURNS TABLE (
  id uuid,
  business_id uuid,
  email text,
  name text,
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
    business_id,
    email,
    name,
    expires_at,
    used_at
  FROM public.professional_portal_invites
  WHERE token = p_token
  LIMIT 1;
$$;