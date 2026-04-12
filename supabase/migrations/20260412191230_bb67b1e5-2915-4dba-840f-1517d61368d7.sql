CREATE OR REPLACE FUNCTION public.get_plan_limits(p_plan_code text)
RETURNS TABLE(max_professionals integer, max_patients integer)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = 'public'
AS $$
  SELECT 
    CASE p_plan_code
      -- New plan codes
      WHEN 'emprendedor' THEN 1
      WHEN 'esencial' THEN 1
      WHEN 'profesional' THEN 2
      WHEN 'consultorio' THEN 5
      WHEN 'clinica' THEN NULL
      WHEN 'personalizado' THEN NULL
      -- Legacy plan codes (mapped)
      WHEN 'starter' THEN 1
      WHEN 'individual' THEN 1
      WHEN 'inicial' THEN 1
      WHEN 'professional' THEN 2
      WHEN 'advanced' THEN 5
      WHEN 'equipo' THEN 5
      WHEN 'enterprise' THEN NULL
      WHEN 'custom' THEN NULL
      ELSE 1
    END as max_professionals,
    CASE p_plan_code
      -- New plan codes
      WHEN 'emprendedor' THEN 15
      WHEN 'esencial' THEN 30
      WHEN 'profesional' THEN 80
      WHEN 'consultorio' THEN 250
      WHEN 'clinica' THEN NULL
      WHEN 'personalizado' THEN NULL
      -- Legacy plan codes (mapped)
      WHEN 'starter' THEN 15
      WHEN 'individual' THEN 30
      WHEN 'inicial' THEN 30
      WHEN 'professional' THEN 80
      WHEN 'advanced' THEN 250
      WHEN 'equipo' THEN 250
      WHEN 'enterprise' THEN NULL
      WHEN 'custom' THEN NULL
      ELSE 15
    END as max_patients;
$$;