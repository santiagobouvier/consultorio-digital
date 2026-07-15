-- Pago requerido para confirmar (web pública) + limpieza de reservas impagas.
--
-- 1) Nuevo estado de cita 'pending_payment': la reserva pública nace en este
--    estado cuando la política de cobro es "required". Bloquea el horario
--    (get_available_starts excluye toda cita no cancelada) hasta que el
--    paciente pague o la reserva expire.
-- 2) El webhook de Mercado Pago ya pasa la cita a 'confirmed' al aprobarse
--    el pago (session_payment) — ese circuito existe y no cambia.
-- 3) Expiración: un cron cancela las reservas 'pending_payment' con más de
--    45 minutos, liberando el horario. El trigger existente cancela el cobro
--    pendiente vinculado.
-- 4) La notificación "cancelada por el profesional" no aplica cuando expira
--    una reserva impaga: se agrega guarda en notify_patient_appointment_status.

-- 1) Permitir el estado pending_payment
ALTER TABLE public.appointments DROP CONSTRAINT IF EXISTS appointments_status_check;
ALTER TABLE public.appointments ADD CONSTRAINT appointments_status_check
  CHECK (status IN (
    'pending',
    'pending_payment',
    'scheduled',
    'confirmed',
    'attended',
    'completed',
    'cancelled',
    'cancelled_by_patient',
    'reschedule_requested',
    'no_show'
  ));

-- 4) Guarda: la expiración de una reserva impaga no es "cancelada por el profesional"
CREATE OR REPLACE FUNCTION public.notify_patient_appointment_status()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_title text;
  v_body text;
  v_type text;
  v_when text;
BEGIN
  IF NEW.patient_id IS NULL THEN RETURN NEW; END IF;

  -- Guard: skip if old status was reschedule_requested (handled by RPCs)
  IF OLD.status = 'reschedule_requested' THEN
    RETURN NEW;
  END IF;

  -- Guard: una reserva impaga que expira no fue cancelada por el profesional
  IF OLD.status = 'pending_payment' THEN
    RETURN NEW;
  END IF;

  v_when := to_char(NEW.start_at AT TIME ZONE 'America/Montevideo', 'DD/MM/YYYY HH24:MI');

  IF OLD.status = 'pending' AND NEW.status = 'scheduled' THEN
    v_type := 'appointment_confirmed';
    v_title := 'Cita confirmada';
    v_body := 'Tu cita del ' || v_when || ' fue confirmada.';
  ELSIF OLD.status <> 'cancelled' AND NEW.status IN ('cancelled', 'cancelled_by_professional') THEN
    v_type := 'appointment_cancelled_by_professional';
    v_title := 'Cita cancelada';
    v_body := 'Tu cita del ' || v_when || ' fue cancelada por el profesional.';
  ELSE
    RETURN NEW;
  END IF;

  INSERT INTO public.patient_notifications (patient_id, business_id, type, title, body, related_appointment_id)
  VALUES (NEW.patient_id, NEW.business_id, v_type, v_title, v_body, NEW.id);

  RETURN NEW;
END;
$$;

-- 3) Cron: expirar reservas impagas a los 45 minutos (corre cada 10)
DO $$
BEGIN
  PERFORM cron.unschedule('expire-unpaid-public-bookings');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

SELECT cron.schedule(
  'expire-unpaid-public-bookings',
  '*/10 * * * *',
  $$
  UPDATE public.appointments
  SET status = 'cancelled'
  WHERE status = 'pending_payment'
    AND created_at < now() - interval '45 minutes'
  $$
);
