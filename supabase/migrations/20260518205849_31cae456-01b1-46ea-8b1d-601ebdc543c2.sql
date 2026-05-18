ALTER TABLE public.appointments DROP CONSTRAINT IF EXISTS appointments_source_check;
ALTER TABLE public.appointments ADD CONSTRAINT appointments_source_check
  CHECK (source IN ('panel', 'patient_portal', 'public_booking', 'public', 'web'));