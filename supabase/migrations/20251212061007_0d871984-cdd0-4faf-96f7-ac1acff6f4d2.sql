-- Add is_demo field to businesses table for identifying demo clinics
ALTER TABLE public.businesses 
ADD COLUMN IF NOT EXISTS is_demo boolean NOT NULL DEFAULT false;

-- Add comment for documentation
COMMENT ON COLUMN public.businesses.is_demo IS 'Flag to identify demo clinics used for sales presentations';