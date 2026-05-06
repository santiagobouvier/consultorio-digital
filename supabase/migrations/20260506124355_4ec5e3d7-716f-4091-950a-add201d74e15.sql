
ALTER TABLE public.appointments ADD COLUMN recurrence_group_id uuid DEFAULT NULL;

CREATE INDEX idx_appointments_recurrence_group ON public.appointments (recurrence_group_id) WHERE recurrence_group_id IS NOT NULL;
