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
      WHEN 'profesional' THEN 1
      WHEN 'clinica' THEN 3
      WHEN 'personalizado' THEN NULL
      WHEN 'individual' THEN 1
      WHEN 'professional' THEN 1
      WHEN 'advanced' THEN 3
      WHEN 'enterprise' THEN 3
      WHEN 'custom' THEN NULL
      WHEN 'inicial' THEN 1
      WHEN 'equipo' THEN 3
      ELSE 1
    END as max_professionals,
    CASE p_plan_code
      WHEN 'starter' THEN 5
      WHEN 'esencial' THEN 15
      WHEN 'profesional' THEN 35
      WHEN 'clinica' THEN 160
      WHEN 'personalizado' THEN NULL
      WHEN 'individual' THEN 15
      WHEN 'professional' THEN 35
      WHEN 'advanced' THEN 160
      WHEN 'enterprise' THEN 160
      WHEN 'custom' THEN NULL
      WHEN 'inicial' THEN 15
      WHEN 'equipo' THEN 160
      ELSE 5
    END as max_patients;
$$;