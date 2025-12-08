-- Add plan fields to businesses table
ALTER TABLE public.businesses 
ADD COLUMN IF NOT EXISTS plan_code text NOT NULL DEFAULT 'individual',
ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true,
ADD COLUMN IF NOT EXISTS billing_period text NOT NULL DEFAULT 'annual',
ADD COLUMN IF NOT EXISTS plan_started_at timestamp with time zone DEFAULT now(),
ADD COLUMN IF NOT EXISTS plan_expires_at timestamp with time zone;

-- Add constraint for valid plan codes
ALTER TABLE public.businesses 
ADD CONSTRAINT businesses_plan_code_check 
CHECK (plan_code IN ('individual', 'professional', 'advanced', 'enterprise'));

-- Add constraint for valid billing periods
ALTER TABLE public.businesses 
ADD CONSTRAINT businesses_billing_period_check 
CHECK (billing_period IN ('annual', 'monthly'));

-- Create function to get plan limits
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
      ELSE 1
    END as max_professionals,
    CASE p_plan_code
      WHEN 'individual' THEN 80
      WHEN 'professional' THEN 300
      WHEN 'advanced' THEN 800
      WHEN 'enterprise' THEN NULL
      ELSE 80
    END as max_patients;
$$;

-- Create function to count business professionals
CREATE OR REPLACE FUNCTION public.count_business_professionals(p_business_id uuid)
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COUNT(*)::integer
  FROM public.user_roles
  WHERE business_id = p_business_id 
    AND role IN ('owner', 'professional');
$$;

-- Create function to count active patients
CREATE OR REPLACE FUNCTION public.count_business_active_patients(p_business_id uuid)
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COUNT(*)::integer
  FROM public.patients
  WHERE business_id = p_business_id 
    AND is_active = true;
$$;

-- Create function to check if can add professional
CREATE OR REPLACE FUNCTION public.can_add_professional(p_business_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    CASE 
      WHEN (SELECT max_professionals FROM public.get_plan_limits(
        (SELECT plan_code FROM public.businesses WHERE id = p_business_id)
      )) IS NULL THEN true
      ELSE public.count_business_professionals(p_business_id) < 
        (SELECT max_professionals FROM public.get_plan_limits(
          (SELECT plan_code FROM public.businesses WHERE id = p_business_id)
        ))
    END;
$$;

-- Create function to check if can add patient
CREATE OR REPLACE FUNCTION public.can_add_patient(p_business_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    CASE 
      WHEN (SELECT max_patients FROM public.get_plan_limits(
        (SELECT plan_code FROM public.businesses WHERE id = p_business_id)
      )) IS NULL THEN true
      ELSE public.count_business_active_patients(p_business_id) < 
        (SELECT max_patients FROM public.get_plan_limits(
          (SELECT plan_code FROM public.businesses WHERE id = p_business_id)
        ))
    END;
$$;