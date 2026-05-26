ALTER TABLE public.appointments REPLICA IDENTITY FULL;
ALTER TABLE public.appointment_reschedule_requests REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.appointments;
ALTER PUBLICATION supabase_realtime ADD TABLE public.appointment_reschedule_requests;