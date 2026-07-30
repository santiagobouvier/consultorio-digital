-- Segunda parte del fix de la web pública caída: tras restaurar el SELECT de
-- anon sobre businesses, la consulta seguía fallando con "permission denied
-- for function is_super_admin". Las políticas RLS de businesses (y otras
-- tablas) llaman a estos helpers para TODOS los roles — anon incluido — así
-- que necesitan EXECUTE. Son funciones que solo devuelven boolean; otorgarlas
-- no expone datos.

GRANT EXECUTE ON FUNCTION public.is_super_admin(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.user_belongs_to_business(uuid, uuid) TO anon, authenticated;
