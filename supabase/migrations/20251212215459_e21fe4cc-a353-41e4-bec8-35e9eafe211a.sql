-- Add professional_id to appointments to track which professional handles each appointment
ALTER TABLE public.appointments 
ADD COLUMN professional_id uuid REFERENCES auth.users(id);

-- Add shared_calendar setting to businesses
ALTER TABLE public.businesses
ADD COLUMN shared_calendar boolean NOT NULL DEFAULT true;

-- Create index for better performance on professional queries
CREATE INDEX idx_appointments_professional_id ON public.appointments(professional_id);

-- Add color to user_roles for professional calendar colors
ALTER TABLE public.user_roles
ADD COLUMN calendar_color text DEFAULT '#00b5b5';