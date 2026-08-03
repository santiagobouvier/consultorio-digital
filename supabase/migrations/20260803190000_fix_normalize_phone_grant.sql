-- Fix: crear pacientes desde el panel fallaba con
-- "permission denied for function normalize_phone".
--
-- La limpieza de seguridad del 2026-07-23 revocó EXECUTE de varias funciones
-- "internas", pero normalize_phone NO es solo interna: la usa el índice único
-- patients_business_phone_unique (business_id, normalize_phone(whatsapp_phone)),
-- y las expresiones de índice se evalúan con los permisos del rol que hace el
-- INSERT. Sin EXECUTE para authenticated, ningún profesional puede crear
-- pacientes. La función es un regex inofensivo (deja solo dígitos): devolver
-- el permiso no expone nada.

GRANT EXECUTE ON FUNCTION public.normalize_phone(text) TO authenticated, anon, service_role;
