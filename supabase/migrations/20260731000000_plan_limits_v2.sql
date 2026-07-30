-- Planes v2 (julio 2026): más pacientes ahora que existe la reserva pública.
-- Emprendedor 20→30 · Esencial 50→75 (y sube a $3.290/$2.800 con web
-- personalizada incluida) · Profesional sin límite (igual) · Consultorio 8/300
-- (fuera de la vidriera, igual). Debe coincidir con src/lib/plan-definitions.ts.

CREATE OR REPLACE FUNCTION public.get_plan_limits(p_plan_code text)
 RETURNS TABLE(max_professionals integer, max_patients integer)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT
    CASE p_plan_code
      WHEN 'emprendedor' THEN 1
      WHEN 'esencial' THEN 1
      WHEN 'profesional' THEN 1
      WHEN 'consultorio' THEN 8
      WHEN 'clinica' THEN NULL
      WHEN 'personalizado' THEN NULL
      -- Legacy plan codes (mapped)
      WHEN 'starter' THEN 1
      WHEN 'individual' THEN 1
      WHEN 'inicial' THEN 1
      WHEN 'professional' THEN 1
      WHEN 'advanced' THEN 8
      WHEN 'equipo' THEN 8
      WHEN 'enterprise' THEN NULL
      WHEN 'custom' THEN NULL
      ELSE 1
    END as max_professionals,
    CASE p_plan_code
      WHEN 'emprendedor' THEN 30
      WHEN 'esencial' THEN 75
      WHEN 'profesional' THEN NULL
      WHEN 'consultorio' THEN 300
      WHEN 'clinica' THEN NULL
      WHEN 'personalizado' THEN NULL
      -- Legacy plan codes (mapped)
      WHEN 'starter' THEN 30
      WHEN 'individual' THEN 75
      WHEN 'inicial' THEN 75
      WHEN 'professional' THEN NULL
      WHEN 'advanced' THEN 300
      WHEN 'equipo' THEN 300
      WHEN 'enterprise' THEN NULL
      WHEN 'custom' THEN NULL
      ELSE 30
    END as max_patients;
$function$;
