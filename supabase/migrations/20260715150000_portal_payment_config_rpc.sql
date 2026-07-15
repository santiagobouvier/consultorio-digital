-- El portal del paciente necesita saber si el consultorio tiene Mercado Pago
-- conectado y cuál es su política de cobro, pero el RLS de payment_policies
-- (correctamente) solo deja leer la tabla a los miembros del consultorio,
-- porque ahí vive el mp_access_token (secreto).
--
-- Resultado: a los pacientes reales nunca les aparecía "Pagar sesión".
--
-- Solución: una función SECURITY DEFINER que expone SOLO los dos datos
-- inofensivos (conectado sí/no + tipo de política), nunca el token.

CREATE OR REPLACE FUNCTION public.get_portal_payment_config(p_business_id uuid)
RETURNS TABLE (mp_connected boolean, policy_type text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT (mp_access_token IS NOT NULL), policy_type::text
  FROM public.payment_policies
  WHERE business_id = p_business_id;
$$;

REVOKE ALL ON FUNCTION public.get_portal_payment_config(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_portal_payment_config(uuid) TO authenticated;
