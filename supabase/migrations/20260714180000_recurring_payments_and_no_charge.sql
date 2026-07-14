-- Turnos recurrentes · cobro coherente:
--
-- 1) Convención "sin cobro": una cita con session_price = 0 EXPLÍCITO no
--    genera pago automático (antes 0 caía al precio por defecto del
--    consultorio). NULL sigue usando el precio por defecto.
-- 2) Mensualidad: al marcar pagado un pago recurrente (monthly/yearly), la
--    base genera sola el vencimiento del período siguiente — funcione desde
--    Pagos, la ficha del paciente o la agenda. Con guarda anti-duplicados.

-- 1) Sin cobro explícito -------------------------------------------------
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

  -- session_price = 0 explícito => cita sin cobro (mensualidad o bonificada)
  IF NEW.session_price IS NOT NULL AND NEW.session_price = 0 THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    IF NEW.source = 'patient_portal' THEN
      RETURN NEW;
    END IF;
    v_should_create := true;
    v_notify := true;
  ELSIF TG_OP = 'UPDATE' THEN
    IF NEW.source = 'patient_portal'
       AND OLD.status = 'pending'
       AND NEW.status IN ('scheduled', 'confirmed') THEN
      v_should_create := true;
      v_notify := false;
    ELSE
      RETURN NEW;
    END IF;
  END IF;

  IF NOT v_should_create THEN
    RETURN NEW;
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.payments
    WHERE appointment_id = NEW.id
      AND status <> 'cancelled'
  ) THEN
    RETURN NEW;
  END IF;

  v_amount := NEW.session_price;
  IF v_amount IS NULL THEN
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

-- 2) Mensualidad: generar el vencimiento siguiente al cobrar ------------
CREATE OR REPLACE FUNCTION public.generate_next_recurring_payment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_base date;
  v_month date;
  v_days_in_month integer;
  v_day integer;
  v_next date;
BEGIN
  IF NEW.paid_at IS NULL OR OLD.paid_at IS NOT NULL THEN
    RETURN NEW;
  END IF;
  IF NEW.recurrence_type IS NULL OR NEW.recurrence_type = 'one_time' THEN
    RETURN NEW;
  END IF;

  -- Anti-duplicados: si ya hay un vencimiento pendiente más adelante de la
  -- misma cadena, no crear otro.
  IF EXISTS (
    SELECT 1 FROM public.payments
    WHERE patient_id = NEW.patient_id
      AND business_id = NEW.business_id
      AND recurrence_type = NEW.recurrence_type
      AND paid_at IS NULL
      AND status <> 'cancelled'
      AND due_date > NEW.due_date
  ) THEN
    RETURN NEW;
  END IF;

  v_base := (NEW.due_date AT TIME ZONE 'America/Montevideo')::date;
  IF NEW.recurrence_type = 'monthly' THEN
    v_month := (date_trunc('month', v_base) + interval '1 month')::date;
  ELSE
    v_month := (date_trunc('month', v_base) + interval '1 year')::date;
  END IF;

  v_days_in_month := EXTRACT(DAY FROM (v_month + interval '1 month - 1 day'))::integer;
  v_day := LEAST(COALESCE(NEW.anchor_day, EXTRACT(DAY FROM v_base)::integer), v_days_in_month);
  v_next := v_month + (v_day - 1);

  INSERT INTO public.payments (
    business_id, patient_id, amount, currency, due_date,
    status, recurrence_type, anchor_day, method, notes
  ) VALUES (
    NEW.business_id, NEW.patient_id, NEW.amount, NEW.currency,
    ((v_next::text || ' 12:00:00')::timestamp AT TIME ZONE 'America/Montevideo'),
    'pending', NEW.recurrence_type, NEW.anchor_day, NEW.method, NEW.notes
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_generate_next_recurring_payment ON public.payments;
CREATE TRIGGER trg_generate_next_recurring_payment
  AFTER UPDATE OF paid_at ON public.payments
  FOR EACH ROW
  EXECUTE FUNCTION public.generate_next_recurring_payment();
