CREATE OR REPLACE FUNCTION public.get_plan_limits(p_plan_code text)
 RETURNS TABLE(max_professionals integer, max_patients integer)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $$
  SELECT 
    CASE p_plan_code
      WHEN 'starter' THEN 1
      WHEN 'esencial' THEN 1
      WHEN 'profesional' THEN 2
      WHEN 'clinica' THEN 5
      WHEN 'personalizado' THEN NULL
      WHEN 'individual' THEN 1
      WHEN 'professional' THEN 2
      WHEN 'advanced' THEN 5
      WHEN 'enterprise' THEN 5
      WHEN 'custom' THEN NULL
      WHEN 'inicial' THEN 1
      WHEN 'equipo' THEN 5
      ELSE 1
    END as max_professionals,
    CASE p_plan_code
      WHEN 'starter' THEN 5
      WHEN 'esencial' THEN 15
      WHEN 'profesional' THEN 50
      WHEN 'clinica' THEN 200
      WHEN 'personalizado' THEN NULL
      WHEN 'individual' THEN 15
      WHEN 'professional' THEN 50
      WHEN 'advanced' THEN 200
      WHEN 'enterprise' THEN 200
      WHEN 'custom' THEN NULL
      WHEN 'inicial' THEN 15
      WHEN 'equipo' THEN 200
      ELSE 5
    END as max_patients;
$$;