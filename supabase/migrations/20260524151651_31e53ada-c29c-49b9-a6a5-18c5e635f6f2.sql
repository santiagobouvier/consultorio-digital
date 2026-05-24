-- 1) Columnas
ALTER TABLE public.appointments
  ADD COLUMN IF NOT EXISTS session_price numeric;

ALTER TABLE public.businesses
  ADD COLUMN IF NOT EXISTS default_session_price numeric;

-- 2) Actualizar CHECK constraint de patient_notifications.type
DO $$
DECLARE
  v_conname text;
BEGIN
  SELECT conname INTO v_conname
  FROM pg_constraint
  WHERE conrelid = 'public.patient_notifications'::regclass
    AND contype = 'c'
    AND pg_get_constraintdef(oid) ILIKE '%type%';
  IF v_conname IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.patient_notifications DROP CONSTRAINT %I', v_conname);
  END IF;
END $$;

ALTER TABLE public.patient_notifications
  ADD CONSTRAINT patient_notifications_type_check
  CHECK (type IN (
    'appointment_confirmed',
    'appointment_cancelled_by_professional',
    'reschedule_approved',
    'reschedule_rejected',
    'payment_received',
    'appointment_created_by_professional',
    'payment_due_soon'
  ));

-- 3) Trigger: auto-crear pago pendiente al crear cita desde panel
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
BEGIN
  -- Solo citas creadas desde el panel (no portal/público) con paciente registrado
  IF NEW.source IN ('patient_portal', 'public_booking') THEN
    RETURN NEW;
  END IF;
  IF NEW.patient_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Determinar monto: session_price de la cita > default del consultorio > 0
  v_amount := NEW.session_price;
  IF v_amount IS NULL OR v_amount <= 0 THEN
    SELECT default_session_price INTO v_default
      FROM public.businesses WHERE id = NEW.business_id;
    v_amount := v_default;
  END IF;

  -- Si no hay monto válido, no crear pago (clínica gratis / sin tarifa configurada)
  IF v_amount IS NULL OR v_amount <= 0 THEN
    RETURN NEW;
  END IF;

  -- Crear pago pendiente vinculado
  INSERT INTO public.payments (
    business_id, patient_id, appointment_id,
    amount, currency, status, due_date, recurrence_type
  ) VALUES (
    NEW.business_id, NEW.patient_id, NEW.id,
    v_amount, 'UYU', 'pending', NEW.start_at, 'one_time'
  ) RETURNING id INTO v_payment_id;

  -- Notificación in-app
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

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_create_payment_on_appointment ON public.appointments;
CREATE TRIGGER trg_create_payment_on_appointment
  AFTER INSERT ON public.appointments
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_create_payment_for_panel_appointment();