-- Parámetros financieros de la plataforma (solo superadmin).
-- Los usa la sección Finanzas del panel admin: costo por mensaje de
-- WhatsApp, tipo de cambio y mensajes estimados por paciente/mes.
-- Editables desde el panel con confirmación fuerte (escribir CONFIRMAR).

CREATE TABLE IF NOT EXISTS public.platform_settings (
  key text PRIMARY KEY,
  value numeric NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.platform_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS platform_settings_super_admin ON public.platform_settings;
CREATE POLICY platform_settings_super_admin
ON public.platform_settings
FOR ALL
USING (public.is_super_admin(auth.uid()))
WITH CHECK (public.is_super_admin(auth.uid()));

INSERT INTO public.platform_settings (key, value) VALUES
  ('whatsapp_msg_cost_usd', 0.0113),
  ('usd_to_uyu', 40),
  ('msgs_per_patient_month', 6)
ON CONFLICT (key) DO NOTHING;
