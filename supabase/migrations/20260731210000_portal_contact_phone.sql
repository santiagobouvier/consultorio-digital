-- Login del portal: botón "Pedir acceso por WhatsApp" para quien todavía
-- no tiene usuario. El número es clinic_settings.whatsapp_contact_phone
-- (el WhatsApp del profesional, el mismo que ya viaja en cada recordatorio
-- para que el paciente le conteste). Esta función expone SOLO ese texto,
-- nada más de clinic_settings, y solo para consultorios activos.

CREATE OR REPLACE FUNCTION public.get_portal_contact_phone(p_slug text)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT cs.whatsapp_contact_phone
  FROM public.businesses b
  JOIN public.clinic_settings cs ON cs.user_id = b.owner_user_id
  WHERE b.public_slug = p_slug
    AND b.is_active = true
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.get_portal_contact_phone(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_portal_contact_phone(text) TO anon;
GRANT EXECUTE ON FUNCTION public.get_portal_contact_phone(text) TO authenticated;
