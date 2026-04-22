-- Tabla de activaciones pendientes de consultorios
CREATE TABLE public.pending_business_activations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  business_name TEXT NOT NULL,
  owner_email TEXT NOT NULL,
  plan_code TEXT NOT NULL DEFAULT 'inicial',
  custom_max_patients INTEGER,
  custom_max_professionals INTEGER,
  token TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '7 days'),
  used_at TIMESTAMPTZ,
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Índices
CREATE INDEX idx_pending_business_activations_token ON public.pending_business_activations(token);
CREATE INDEX idx_pending_business_activations_email ON public.pending_business_activations(owner_email);

-- RLS
ALTER TABLE public.pending_business_activations ENABLE ROW LEVEL SECURITY;

-- Solo super_admin puede ver/gestionar pendientes
CREATE POLICY "Super admins can view pending activations"
ON public.pending_business_activations
FOR SELECT
TO authenticated
USING (public.is_super_admin(auth.uid()));

CREATE POLICY "Super admins can insert pending activations"
ON public.pending_business_activations
FOR INSERT
TO authenticated
WITH CHECK (public.is_super_admin(auth.uid()));

CREATE POLICY "Super admins can update pending activations"
ON public.pending_business_activations
FOR UPDATE
TO authenticated
USING (public.is_super_admin(auth.uid()));

CREATE POLICY "Super admins can delete pending activations"
ON public.pending_business_activations
FOR DELETE
TO authenticated
USING (public.is_super_admin(auth.uid()));

-- Trigger updated_at
CREATE TRIGGER update_pending_business_activations_updated_at
BEFORE UPDATE ON public.pending_business_activations
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Función pública para validar el token (sin login)
-- Devuelve datos mínimos para mostrar en la página de activación
CREATE OR REPLACE FUNCTION public.validate_business_activation_token(p_token TEXT)
RETURNS TABLE (
  id UUID,
  business_name TEXT,
  owner_email TEXT,
  plan_code TEXT,
  expires_at TIMESTAMPTZ,
  used_at TIMESTAMPTZ
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    id,
    business_name,
    owner_email,
    plan_code,
    expires_at,
    used_at
  FROM public.pending_business_activations
  WHERE token = p_token
  LIMIT 1;
$$;

-- Permitir ejecución pública (anon + authenticated) para que la página de activación funcione sin login
GRANT EXECUTE ON FUNCTION public.validate_business_activation_token(TEXT) TO anon, authenticated;