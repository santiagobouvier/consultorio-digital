-- Modo capturas (datos ficticios para capturas y tutoriales): quién puede
-- activarlo.
--
-- El modo vive entero en el navegador (src/lib/showcase): no lee ni escribe
-- datos reales. Esta tabla solo decide a quién se le OFRECE. Se autoriza por
-- consultorio (id) y por usuario (id), nunca por nombre visible. La
-- migración NO autoriza a nadie: las filas las carga Santiago a mano después
-- de verificar el consultorio (ver PR). Sin filas, el modo no existe para
-- ninguna cuenta. Idempotente.

CREATE TABLE IF NOT EXISTS public.showcase_mode_access (
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (business_id, user_id)
);

-- Nadie la lee ni la escribe desde la API (solo la función de abajo)
ALTER TABLE public.showcase_mode_access ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.showcase_mode_access FROM anon, authenticated;

-- ¿La persona con sesión puede usar el modo en este consultorio?
-- Hace falta: fila explícita (consultorio, usuario) Y que la persona siga
-- perteneciendo al consultorio (dueña, miembro) o sea superadmin.
CREATE OR REPLACE FUNCTION public.can_use_showcase_mode(p_business_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT auth.uid() IS NOT NULL
    AND p_business_id IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.showcase_mode_access a
      WHERE a.business_id = p_business_id AND a.user_id = auth.uid()
    )
    AND (
      EXISTS (SELECT 1 FROM public.businesses b WHERE b.id = p_business_id AND b.owner_user_id = auth.uid())
      OR EXISTS (SELECT 1 FROM public.user_roles r WHERE r.business_id = p_business_id AND r.user_id = auth.uid())
      OR public.is_super_admin(auth.uid())
    );
$$;

REVOKE ALL ON FUNCTION public.can_use_showcase_mode(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.can_use_showcase_mode(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.can_use_showcase_mode(uuid) TO authenticated;
