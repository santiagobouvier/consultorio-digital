-- Bug crítico de lanzamiento: businesses no tenía política de SELECT para
-- visitantes anónimos. Resultado: la web pública (/consultorio/<slug>) y el
-- portal (/portal/<slug>) mostraban "no disponible" a cualquier persona sin
-- sesión iniciada — o sea, a todos los pacientes nuevos. Nunca se notó en
-- pruebas porque el dueño navega logueado y su propia política lo deja pasar.
--
-- Fix: cualquiera puede LEER consultorios activos. La escritura sigue cerrada
-- y un consultorio desactivado desde el superadmin desaparece del público.
CREATE POLICY "Anyone can view active businesses"
ON public.businesses
FOR SELECT
USING (is_active = true);
