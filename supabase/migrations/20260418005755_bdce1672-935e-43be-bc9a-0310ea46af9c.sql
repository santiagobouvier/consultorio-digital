CREATE OR REPLACE FUNCTION public.normalize_phone(p text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT NULLIF(regexp_replace(COALESCE(p, ''), '\D', '', 'g'), '');
$$;

CREATE UNIQUE INDEX IF NOT EXISTS patients_business_email_unique
  ON public.patients (business_id, lower(email))
  WHERE email IS NOT NULL AND email <> '';

CREATE UNIQUE INDEX IF NOT EXISTS patients_business_phone_unique
  ON public.patients (business_id, public.normalize_phone(whatsapp_phone))
  WHERE whatsapp_phone IS NOT NULL AND whatsapp_phone <> '';