-- Add missing foreign keys on payments so PostgREST can embed related rows
ALTER TABLE public.payments
  ADD CONSTRAINT payments_patient_id_fkey
  FOREIGN KEY (patient_id) REFERENCES public.patients(id) ON DELETE CASCADE;

ALTER TABLE public.payments
  ADD CONSTRAINT payments_business_id_fkey
  FOREIGN KEY (business_id) REFERENCES public.businesses(id) ON DELETE CASCADE;

ALTER TABLE public.payments
  ADD CONSTRAINT payments_appointment_id_fkey
  FOREIGN KEY (appointment_id) REFERENCES public.appointments(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_payments_patient_id ON public.payments(patient_id);
CREATE INDEX IF NOT EXISTS idx_payments_business_id ON public.payments(business_id);
CREATE INDEX IF NOT EXISTS idx_payments_appointment_id ON public.payments(appointment_id);