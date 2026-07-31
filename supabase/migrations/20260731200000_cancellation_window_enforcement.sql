-- Ventana de reservas (Etapa 3): la cancelación tardía del paciente se
-- bloquea EN LA BASE, no solo ocultando el botón. Hasta ahora el portal
-- avisaba que era tarde pero dejaba cancelar igual.
--
-- Regla: si quien cancela es el PROPIO paciente (auth.uid() coincide con su
-- ficha) y falta menos de cancellation_hours_notice para la sesión, la
-- actualización a cancelled_by_patient se rechaza. El profesional cancela
-- cuando quiere (usa status 'cancelled' y además no matchea como paciente).

CREATE OR REPLACE FUNCTION public.enforce_patient_cancellation_window()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_hours integer;
  v_is_patient boolean;
BEGIN
  IF NEW.status = 'cancelled_by_patient'
     AND OLD.status IS DISTINCT FROM 'cancelled_by_patient' THEN
    SELECT EXISTS (
      SELECT 1 FROM public.patients p
      WHERE p.id = OLD.patient_id
        AND p.auth_user_id = auth.uid()
    ) INTO v_is_patient;

    IF v_is_patient THEN
      SELECT COALESCE(b.cancellation_hours_notice, 24)
      INTO v_hours
      FROM public.businesses b
      WHERE b.id = OLD.business_id;

      -- Comparación en UTC contra now() del servidor, nunca la hora del cliente
      IF OLD.start_at <= now() + make_interval(hours => v_hours) THEN
        RAISE EXCEPTION 'cancellation_window_closed'
          USING HINT = 'Para cancelar con poca anticipación, contactá directamente al profesional.';
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_patient_cancellation_window ON public.appointments;
CREATE TRIGGER trg_patient_cancellation_window
  BEFORE UPDATE ON public.appointments
  FOR EACH ROW EXECUTE FUNCTION public.enforce_patient_cancellation_window();
