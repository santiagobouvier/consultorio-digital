-- Step 1/7: Add coordination_mode to user_roles
ALTER TABLE public.user_roles
  ADD COLUMN IF NOT EXISTS coordination_mode text NOT NULL DEFAULT 'shared'
  CHECK (coordination_mode IN ('shared','independent'));

CREATE INDEX IF NOT EXISTS idx_user_roles_coordination_mode
  ON public.user_roles(business_id, coordination_mode)
  WHERE business_id IS NOT NULL;

COMMENT ON COLUMN public.user_roles.coordination_mode IS
  'shared: usa espacios compartidos del consultorio. independent: maneja sus propios espacios. Default shared. Solo significativo cuando business_id IS NOT NULL.';