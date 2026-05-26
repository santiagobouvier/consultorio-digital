-- Step 3/7: Helper functions
CREATE OR REPLACE FUNCTION public.get_user_coordination_mode(_user_id uuid, _business_id uuid)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT coordination_mode
  FROM public.user_roles
  WHERE user_id = _user_id
    AND business_id = _business_id
  ORDER BY (role = 'owner') DESC
  LIMIT 1
$$;

CREATE OR REPLACE FUNCTION public.is_business_owner(_user_id uuid, _business_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.businesses
    WHERE id = _business_id AND owner_user_id = _user_id
  )
$$;

REVOKE ALL ON FUNCTION public.get_user_coordination_mode(uuid, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.is_business_owner(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_user_coordination_mode(uuid, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_business_owner(uuid, uuid) TO authenticated, service_role;