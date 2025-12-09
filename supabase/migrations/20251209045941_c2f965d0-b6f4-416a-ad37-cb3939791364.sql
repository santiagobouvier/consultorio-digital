-- Add onboarding_completed field to businesses table
ALTER TABLE public.businesses 
ADD COLUMN IF NOT EXISTS onboarding_completed boolean NOT NULL DEFAULT false;

-- Update existing businesses that have clinic_settings as completed
UPDATE public.businesses b
SET onboarding_completed = true
WHERE EXISTS (
  SELECT 1 FROM public.clinic_settings cs 
  WHERE cs.user_id = b.owner_user_id 
  AND cs.clinic_name IS NOT NULL 
  AND cs.clinic_name != ''
);