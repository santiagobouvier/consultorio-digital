-- Make service_id nullable since not all appointments require a service
ALTER TABLE public.appointments 
ALTER COLUMN service_id DROP NOT NULL;