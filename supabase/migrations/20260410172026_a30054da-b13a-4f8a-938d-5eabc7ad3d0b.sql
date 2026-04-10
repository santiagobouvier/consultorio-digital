
-- Update get_plan_limits to use new 3-plan structure
CREATE OR REPLACE FUNCTION public.get_plan_limits(p_plan_code text)
 RETURNS TABLE(max_professionals integer, max_patients integer)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $$
  SELECT 
    CASE p_plan_code
      WHEN 'esencial' THEN 1
      WHEN 'profesional' THEN 3
      WHEN 'clinica' THEN 10
      WHEN 'personalizado' THEN NULL
      -- Legacy codes mapped
      WHEN 'individual' THEN 1
      WHEN 'professional' THEN 3
      WHEN 'advanced' THEN 10
      WHEN 'enterprise' THEN 10
      WHEN 'custom' THEN NULL
      WHEN 'inicial' THEN 1
      WHEN 'equipo' THEN 10
      ELSE 1
    END as max_professionals,
    CASE p_plan_code
      WHEN 'esencial' THEN 15
      WHEN 'profesional' THEN 100
      WHEN 'clinica' THEN 500
      WHEN 'personalizado' THEN NULL
      -- Legacy codes mapped
      WHEN 'individual' THEN 15
      WHEN 'professional' THEN 100
      WHEN 'advanced' THEN 500
      WHEN 'enterprise' THEN 500
      WHEN 'custom' THEN NULL
      WHEN 'inicial' THEN 15
      WHEN 'equipo' THEN 500
      ELSE 15
    END as max_patients;
$$;
