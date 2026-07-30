-- Fix crítico: la web pública mostraba "Este portal no está disponible" a
-- visitantes sin sesión — el rol anon no tenía SELECT sobre businesses
-- ("permission denied for table businesses"). El endurecimiento de seguridad
-- del 23/7 revocó el SELECT de anon y lo re-otorgaba solo para columnas
-- públicas, pero ese GRANT quedó sin aplicar (si una columna de la lista no
-- existe, el GRANT entero falla). Se re-otorga en forma dinámica: solo las
-- columnas públicas que existan en la tabla.

DO $$
DECLARE
  cols text;
BEGIN
  SELECT string_agg(quote_ident(column_name), ', ')
  INTO cols
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND table_name = 'businesses'
    AND column_name IN (
      'id','owner_user_id','name','public_slug','specialty','is_active',
      'is_private_clinic','portal_clinic_display_name','portal_logo_url',
      'portal_primary_color','portal_dark_primary_color','portal_theme_preset',
      'custom_subdomain','custom_domain','dashboard_display_name',
      'dashboard_logo_url','dashboard_primary_color','shared_calendar',
      'plan_code','cancellation_hours_notice','late_cancellation_message',
      'timezone','onboarding_completed'
    );
  EXECUTE format('GRANT SELECT (%s) ON public.businesses TO anon', cols);
END $$;

DROP POLICY IF EXISTS "Anon can view active businesses (branding only)" ON public.businesses;
CREATE POLICY "Anon can view active businesses (branding only)"
  ON public.businesses
  FOR SELECT
  TO anon
  USING (is_active = true);

GRANT SELECT ON public.businesses_public_branding TO anon, authenticated;
