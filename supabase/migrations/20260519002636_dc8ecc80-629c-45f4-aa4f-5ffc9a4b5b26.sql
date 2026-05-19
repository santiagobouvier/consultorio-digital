ALTER TABLE public.appointments DROP CONSTRAINT IF EXISTS appointments_status_check;
ALTER TABLE public.appointments ADD CONSTRAINT appointments_status_check
  CHECK (status IN (
    'pending',
    'scheduled',
    'confirmed',
    'attended',
    'completed',
    'cancelled',
    'cancelled_by_patient',
    'reschedule_requested',
    'no_show'
  ));