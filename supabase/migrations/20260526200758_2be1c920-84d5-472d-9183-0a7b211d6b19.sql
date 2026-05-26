-- Step 6/7: get_agenda_view RPC
CREATE OR REPLACE FUNCTION public.get_agenda_view(
  p_business_id uuid,
  p_from timestamptz,
  p_to timestamptz
)
RETURNS TABLE (
  id uuid,
  start_at timestamptz,
  end_at timestamptz,
  space_id uuid,
  space_name text,
  professional_id uuid,
  is_own boolean,
  patient_id uuid,
  patient_name text,
  status text,
  modality text,
  notes text,
  contact_name text,
  contact_phone text,
  session_price numeric,
  payment_status text
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_mode text;
  v_is_super boolean;
  v_belongs boolean;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  v_is_super := public.is_super_admin(v_uid);
  v_belongs  := public.user_belongs_to_business(v_uid, p_business_id);

  IF NOT v_is_super AND NOT v_belongs THEN
    RAISE EXCEPTION 'access denied to business %', p_business_id;
  END IF;

  v_mode := public.get_user_coordination_mode(v_uid, p_business_id);
  -- super_admin: treat as shared so they see anonymized blocks of everyone
  IF v_is_super THEN
    v_mode := 'shared';
  END IF;
  -- safety default
  IF v_mode IS NULL THEN
    v_mode := 'shared';
  END IF;

  RETURN QUERY
  SELECT
    a.id,
    a.start_at,
    a.end_at,
    a.space_id,
    s.name AS space_name,
    a.professional_id,
    (a.professional_id = v_uid) AS is_own,
    CASE WHEN a.professional_id = v_uid THEN a.patient_id ELSE NULL END,
    CASE WHEN a.professional_id = v_uid THEN p.full_name ELSE NULL END,
    CASE WHEN a.professional_id = v_uid THEN a.status ELSE NULL END,
    CASE WHEN a.professional_id = v_uid THEN a.modality ELSE NULL END,
    CASE WHEN a.professional_id = v_uid THEN a.notes ELSE NULL END,
    CASE WHEN a.professional_id = v_uid THEN a.contact_name ELSE NULL END,
    CASE WHEN a.professional_id = v_uid THEN a.contact_phone ELSE NULL END,
    CASE WHEN a.professional_id = v_uid THEN a.session_price ELSE NULL END,
    CASE WHEN a.professional_id = v_uid THEN a.payment_status ELSE NULL END
  FROM public.appointments a
  LEFT JOIN public.spaces s ON s.id = a.space_id
  LEFT JOIN public.patients p ON p.id = a.patient_id
  WHERE a.business_id = p_business_id
    AND a.start_at < p_to
    AND a.end_at   > p_from
    AND a.status NOT IN ('cancelled','cancelled_by_patient','cancelled_by_professional','no_show')
    AND (
      a.professional_id = v_uid
      OR (
        v_mode = 'shared'
        AND public.get_user_coordination_mode(a.professional_id, p_business_id) = 'shared'
      )
    );
END;
$$;

REVOKE ALL ON FUNCTION public.get_agenda_view(uuid, timestamptz, timestamptz) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_agenda_view(uuid, timestamptz, timestamptz) TO authenticated, service_role;