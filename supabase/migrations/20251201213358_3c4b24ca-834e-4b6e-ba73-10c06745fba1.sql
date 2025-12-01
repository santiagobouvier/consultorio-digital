-- Create scheduled_reminders table
CREATE TABLE public.scheduled_reminders (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  appointment_id uuid NOT NULL,
  patient_id uuid NOT NULL,
  scheduled_for timestamp with time zone NOT NULL,
  message text NOT NULL,
  sent boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT fk_appointment FOREIGN KEY (appointment_id) REFERENCES public.appointments(id) ON DELETE CASCADE,
  CONSTRAINT fk_patient FOREIGN KEY (patient_id) REFERENCES public.patients(id) ON DELETE CASCADE
);

-- Enable Row Level Security
ALTER TABLE public.scheduled_reminders ENABLE ROW LEVEL SECURITY;

-- RLS Policies: Business owners can manage reminders for their appointments
CREATE POLICY "scheduled_reminders_select_own_business"
ON public.scheduled_reminders
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM appointments a
    JOIN businesses b ON b.id = a.business_id
    WHERE a.id = scheduled_reminders.appointment_id 
    AND b.owner_user_id = auth.uid()
  )
);

CREATE POLICY "scheduled_reminders_insert_own_business"
ON public.scheduled_reminders
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM appointments a
    JOIN businesses b ON b.id = a.business_id
    WHERE a.id = scheduled_reminders.appointment_id 
    AND b.owner_user_id = auth.uid()
  )
);

CREATE POLICY "scheduled_reminders_update_own_business"
ON public.scheduled_reminders
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM appointments a
    JOIN businesses b ON b.id = a.business_id
    WHERE a.id = scheduled_reminders.appointment_id 
    AND b.owner_user_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM appointments a
    JOIN businesses b ON b.id = a.business_id
    WHERE a.id = scheduled_reminders.appointment_id 
    AND b.owner_user_id = auth.uid()
  )
);

CREATE POLICY "scheduled_reminders_delete_own_business"
ON public.scheduled_reminders
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM appointments a
    JOIN businesses b ON b.id = a.business_id
    WHERE a.id = scheduled_reminders.appointment_id 
    AND b.owner_user_id = auth.uid()
  )
);

-- Create index for querying reminders by scheduled date
CREATE INDEX idx_scheduled_reminders_scheduled_for ON public.scheduled_reminders(scheduled_for);
CREATE INDEX idx_scheduled_reminders_sent ON public.scheduled_reminders(sent);