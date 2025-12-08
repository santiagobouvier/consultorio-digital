-- Add custom limit columns to businesses table
ALTER TABLE public.businesses 
ADD COLUMN IF NOT EXISTS custom_max_professionals integer,
ADD COLUMN IF NOT EXISTS custom_max_patients integer;

-- Update get_plan_limits function to handle custom plan
CREATE OR REPLACE FUNCTION public.get_plan_limits(p_plan_code text)
RETURNS TABLE(max_professionals integer, max_patients integer)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    CASE p_plan_code
      WHEN 'individual' THEN 1
      WHEN 'professional' THEN 3
      WHEN 'advanced' THEN 7
      WHEN 'enterprise' THEN NULL
      WHEN 'custom' THEN NULL -- Custom uses separate fields
      ELSE 1
    END as max_professionals,
    CASE p_plan_code
      WHEN 'individual' THEN 80
      WHEN 'professional' THEN 300
      WHEN 'advanced' THEN 800
      WHEN 'enterprise' THEN NULL
      WHEN 'custom' THEN NULL -- Custom uses separate fields
      ELSE 80
    END as max_patients;
$$;

-- Update can_add_professional to handle custom plan
CREATE OR REPLACE FUNCTION public.can_add_professional(p_business_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    CASE 
      -- Enterprise has no limits
      WHEN (SELECT plan_code FROM public.businesses WHERE id = p_business_id) = 'enterprise' THEN true
      -- Custom plan uses custom_max_professionals
      WHEN (SELECT plan_code FROM public.businesses WHERE id = p_business_id) = 'custom' THEN
        CASE
          WHEN (SELECT custom_max_professionals FROM public.businesses WHERE id = p_business_id) IS NULL THEN true
          ELSE public.count_business_professionals(p_business_id) < 
            (SELECT custom_max_professionals FROM public.businesses WHERE id = p_business_id)
        END
      -- Standard plans use get_plan_limits
      WHEN (SELECT max_professionals FROM public.get_plan_limits(
        (SELECT plan_code FROM public.businesses WHERE id = p_business_id)
      )) IS NULL THEN true
      ELSE public.count_business_professionals(p_business_id) < 
        (SELECT max_professionals FROM public.get_plan_limits(
          (SELECT plan_code FROM public.businesses WHERE id = p_business_id)
        ))
    END;
$$;

-- Update can_add_patient to handle custom plan
CREATE OR REPLACE FUNCTION public.can_add_patient(p_business_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    CASE 
      -- Enterprise has no limits
      WHEN (SELECT plan_code FROM public.businesses WHERE id = p_business_id) = 'enterprise' THEN true
      -- Custom plan uses custom_max_patients
      WHEN (SELECT plan_code FROM public.businesses WHERE id = p_business_id) = 'custom' THEN
        CASE
          WHEN (SELECT custom_max_patients FROM public.businesses WHERE id = p_business_id) IS NULL THEN true
          ELSE public.count_business_active_patients(p_business_id) < 
            (SELECT custom_max_patients FROM public.businesses WHERE id = p_business_id)
        END
      -- Standard plans use get_plan_limits
      WHEN (SELECT max_patients FROM public.get_plan_limits(
        (SELECT plan_code FROM public.businesses WHERE id = p_business_id)
      )) IS NULL THEN true
      ELSE public.count_business_active_patients(p_business_id) < 
        (SELECT max_patients FROM public.get_plan_limits(
          (SELECT plan_code FROM public.businesses WHERE id = p_business_id)
        ))
    END;
$$;