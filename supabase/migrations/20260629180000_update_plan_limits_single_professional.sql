-- Update plan limits to the single-professional model.
--
-- Public plans are now all single-professional and differ only by active-patient
-- capacity: Emprendedor 20, Esencial 50, Profesional sin límite. The DB function
-- get_plan_limits is the source of truth for the patient/professional enforcement
-- triggers, so it must match src/lib/plan-definitions.ts.
--
-- consultorio stays at 8 / 300 (hidden from public, still assignable by admin).

CREATE OR REPLACE FUNCTION public.get_plan_limits(p_plan_code text)
 RETURNS TABLE(max_professionals integer, max_patients integer)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT
    CASE p_plan_code
      -- New plan codes (single professional)
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
      -- New plan codes
      WHEN 'emprendedor' THEN 20
      WHEN 'esencial' THEN 50
      WHEN 'profesional' THEN NULL
      WHEN 'consultorio' THEN 300
      WHEN 'clinica' THEN NULL
      WHEN 'personalizado' THEN NULL
      -- Legacy plan codes (mapped)
      WHEN 'starter' THEN 20
      WHEN 'individual' THEN 50
      WHEN 'inicial' THEN 50
      WHEN 'professional' THEN NULL
      WHEN 'advanced' THEN 300
      WHEN 'equipo' THEN 300
      WHEN 'enterprise' THEN NULL
      WHEN 'custom' THEN NULL
      ELSE 20
    END as max_patients;
$function$;
