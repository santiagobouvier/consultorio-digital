-- Pagos · Tanda 1: la plata sigue a la cita, venga de donde venga.
--
-- 1) El cobro pendiente se crea para TODAS las citas con precio:
--    - panel: al crearlas (como antes);
--    - web pública: al crearlas (nacen confirmadas con el precio del servicio);
--    - portal: cuando el profesional las acepta (pending -> scheduled/confirmed).
--    Con guarda de idempotencia: nunca dos pagos para la misma cita.
-- 2) Cancelar una cita cancela su cobro pendiente (los pagados no se tocan).

CREATE OR REPLACE FUNCTION public.auto_create_payment_for_panel_appointment()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_amount numeric;
  v_default numeric;
  v_payment_id uuid;
  v_when text;
  v_should_create boolean := false;
  v_notify boolean := false;
BEGIN
  IF NEW.patient_id IS NULL THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    IF NEW.source = 'patient_portal' THEN
      -- Portal: todavía pendiente de confirmación, el cobro nace al aceptarla.
      RETURN NEW;
    END IF;
    -- Panel y web pública: cobro al crear la cita.
    v_should_create := true;
    v_notify := true;
  ELSIF TG_OP = 'UPDATE' THEN
    -- Portal: el profesional aceptó la solicitud.
    IF NEW.source = 'patient_portal'
       AND OLD.status = 'pending'
       AND NEW.status IN ('scheduled', 'confirmed') THEN
      v_should_create := true;
      -- El aviso de cita confirmada ya lo manda notify_patient_appointment.
      v_notify := false;
    ELSE
      RETURN NEW;
    END IF;
  END IF;

  IF NOT v_should_create THEN
    RETURN NEW;
  END IF;

  -- Idempotencia: si la cita ya tiene un pago no cancelado, no crear otro.
  IF EXISTS (
    SELECT 1 FROM public.payments
    WHERE appointment_id = NEW.id
      AND status <> 'cancelled'
  ) THEN
    RETURN NEW;
  END IF;

  -- Monto: precio de la cita (tipo de sesión) > precio por defecto > no crear
  v_amount := NEW.session_price;
  IF v_amount IS NULL OR v_amount <= 0 THEN
    SELECT default_session_price INTO v_default
      FROM public.businesses WHERE id = NEW.business_id;
    v_amount := v_default;
  END IF;

  IF v_amount IS NULL OR v_amount <= 0 THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.payments (
    business_id, patient_id, appointment_id,
    amount, currency, status, due_date, recurrence_type
  ) VALUES (
    NEW.business_id, NEW.patient_id, NEW.id,
    v_amount, 'UYU', 'pending', NEW.start_at, 'one_time'
  ) RETURNING id INTO v_payment_id;

  IF v_notify THEN
    v_when := to_char(NEW.start_at AT TIME ZONE 'America/Montevideo', 'DD/MM/YYYY HH24:MI');
    INSERT INTO public.patient_notifications (
      patient_id, business_id, type, title, body,
      related_appointment_id, related_payment_id
    ) VALUES (
      NEW.patient_id, NEW.business_id,
      'appointment_created_by_professional',
      'Nueva cita agendada',
      'Se agendó una cita para el ' || v_when || '. Monto: $' || v_amount::text || ' UYU.',
      NEW.id, v_payment_id
    );
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_create_payment_on_appointment ON public.appointments;
CREATE TRIGGER trg_create_payment_on_appointment
  AFTER INSERT OR UPDATE OF status ON public.appointments
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_create_payment_for_panel_appointment();

-- 2) Cita cancelada => cobro pendiente cancelado (lo pagado no se toca).
CREATE OR REPLACE FUNCTION public.cancel_payment_on_appointment_cancel()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status IN ('cancelled', 'cancelled_by_patient')
     AND OLD.status NOT IN ('cancelled', 'cancelled_by_patient') THEN
    UPDATE public.payments
    SET status = 'cancelled'
    WHERE appointment_id = NEW.id
      AND paid_at IS NULL
      AND status <> 'paid'
      AND status <> 'cancelled';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_cancel_payment_on_appointment_cancel ON public.appointments;
CREATE TRIGGER trg_cancel_payment_on_appointment_cancel
  AFTER UPDATE OF status ON public.appointments
  FOR EACH ROW
  EXECUTE FUNCTION public.cancel_payment_on_appointment_cancel();
