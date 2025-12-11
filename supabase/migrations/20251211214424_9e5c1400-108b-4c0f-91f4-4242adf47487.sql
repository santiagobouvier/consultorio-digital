-- Add private clinic fields to businesses table
-- These fields will be used for the "private clinic" add-on feature
-- where clinics can have their own custom domain/subdomain for the patient portal

ALTER TABLE public.businesses
ADD COLUMN IF NOT EXISTS is_private_clinic boolean NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS custom_subdomain text,
ADD COLUMN IF NOT EXISTS custom_domain text;

-- Add comments for documentation
COMMENT ON COLUMN public.businesses.is_private_clinic IS 'Indicates if the business has the private clinic add-on enabled for custom domain patient portal';
COMMENT ON COLUMN public.businesses.custom_subdomain IS 'Custom subdomain for patient portal (e.g., psilaura for psilaura.midominio.com)';
COMMENT ON COLUMN public.businesses.custom_domain IS 'Custom domain for patient portal (e.g., psicologalaura.com)';