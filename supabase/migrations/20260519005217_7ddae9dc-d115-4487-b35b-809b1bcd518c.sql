ALTER TABLE public.appointments
  ADD COLUMN IF NOT EXISTS cancellation_acknowledged_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_appointments_unack_cancellations
  ON public.appointments (business_id, cancelled_at DESC)
  WHERE status = 'cancelled_by_patient' AND cancellation_acknowledged_at IS NULL;