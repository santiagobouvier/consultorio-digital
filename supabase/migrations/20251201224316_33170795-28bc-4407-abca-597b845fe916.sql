-- Create appointment_requests table
CREATE TABLE public.appointment_requests (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  clinic_user_id UUID NOT NULL,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT NOT NULL,
  message TEXT,
  requested_datetime TIMESTAMP WITH TIME ZONE NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.appointment_requests ENABLE ROW LEVEL SECURITY;

-- Public can create
CREATE POLICY "Anyone can create appointment requests"
ON public.appointment_requests
FOR INSERT
WITH CHECK (true);

-- Only clinic owner can view their requests
CREATE POLICY "Clinic owners can view their appointment requests"
ON public.appointment_requests
FOR SELECT
USING (clinic_user_id = auth.uid());

-- Only clinic owner can update their requests
CREATE POLICY "Clinic owners can update their appointment requests"
ON public.appointment_requests
FOR UPDATE
USING (clinic_user_id = auth.uid())
WITH CHECK (clinic_user_id = auth.uid());

-- Only clinic owner can delete their requests
CREATE POLICY "Clinic owners can delete their appointment requests"
ON public.appointment_requests
FOR DELETE
USING (clinic_user_id = auth.uid());

-- Add trigger for updated_at
CREATE TRIGGER update_appointment_requests_updated_at
BEFORE UPDATE ON public.appointment_requests
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Add auto_accept_bookings field to clinic_settings
ALTER TABLE public.clinic_settings
ADD COLUMN auto_accept_bookings BOOLEAN NOT NULL DEFAULT false;