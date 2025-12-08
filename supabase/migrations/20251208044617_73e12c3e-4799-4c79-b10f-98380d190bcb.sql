-- Drop the existing check constraint and add one that includes 'custom'
ALTER TABLE public.businesses DROP CONSTRAINT IF EXISTS businesses_plan_code_check;

ALTER TABLE public.businesses ADD CONSTRAINT businesses_plan_code_check 
CHECK (plan_code IN ('individual', 'professional', 'advanced', 'enterprise', 'custom'));