-- Drop the old CHECK constraint and recreate it accepting both new (Spanish) and legacy (English) plan codes
ALTER TABLE public.businesses DROP CONSTRAINT IF EXISTS businesses_plan_code_check;

ALTER TABLE public.businesses ADD CONSTRAINT businesses_plan_code_check
CHECK (plan_code IN (
  -- New plan codes (Spanish)
  'emprendedor',
  'esencial',
  'profesional',
  'consultorio',
  'clinica',
  'personalizado',
  -- Legacy plan codes (English / older Spanish)
  'starter',
  'individual',
  'inicial',
  'professional',
  'advanced',
  'equipo',
  'enterprise',
  'custom'
));

-- Same for subscriptions table, which mirrors plan_code
ALTER TABLE public.subscriptions DROP CONSTRAINT IF EXISTS subscriptions_plan_code_check;

ALTER TABLE public.subscriptions ADD CONSTRAINT subscriptions_plan_code_check
CHECK (plan_code IN (
  'emprendedor',
  'esencial',
  'profesional',
  'consultorio',
  'clinica',
  'personalizado',
  'starter',
  'individual',
  'inicial',
  'professional',
  'advanced',
  'equipo',
  'enterprise',
  'custom'
));