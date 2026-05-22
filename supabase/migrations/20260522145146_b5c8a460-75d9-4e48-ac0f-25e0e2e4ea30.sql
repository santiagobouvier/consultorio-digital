
ALTER TABLE public.appointment_reschedule_requests
  ADD CONSTRAINT arr_original_appointment_fk
    FOREIGN KEY (original_appointment_id) REFERENCES public.appointments(id) ON DELETE CASCADE,
  ADD CONSTRAINT arr_requested_slot_fk
    FOREIGN KEY (requested_slot_id) REFERENCES public.availability_slots(id) ON DELETE SET NULL,
  ADD CONSTRAINT arr_business_fk
    FOREIGN KEY (business_id) REFERENCES public.businesses(id) ON DELETE CASCADE;

ALTER TABLE public.appointments
  ADD CONSTRAINT appointments_patient_fk
    FOREIGN KEY (patient_id) REFERENCES public.patients(id) ON DELETE SET NULL,
  ADD CONSTRAINT appointments_business_fk
    FOREIGN KEY (business_id) REFERENCES public.businesses(id) ON DELETE CASCADE;
