-- Auto-relleno de agenda: mantiene siempre ~60 días de horarios generados a
-- partir de cada plantilla (semana tipo) activa, para que la agenda pública
-- nunca quede vacía por vencimiento del rango generado a mano.
--
-- Misma lógica de generación que generate_slots_from_template con estrategia
-- 'skip' (no duplica; los turnos existentes —reservados o no— no se tocan),
-- pero sin el chequeo de auth.uid() porque la ejecuta pg_cron (sin sesión).
-- Se revoca EXECUTE a los roles de la app: solo el sistema puede llamarla.
--
-- Programación (se hace una vez en el SQL editor, como los demás crons):
--   SELECT cron.schedule('refill-template-slots-daily', '0 6 * * *',
--     $$SELECT public.refill_template_slots(60);$$);

CREATE OR REPLACE FUNCTION public.refill_template_slots(p_days_ahead integer DEFAULT 60)
RETURNS TABLE(template_id uuid, created integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  t RECORD;
  v_date DATE;
  v_dow INTEGER;
  v_range RECORD;
  v_slot_start TIME;
  v_slot_end TIME;
  v_existing UUID;
  v_created INTEGER;
BEGIN
  FOR t IN
    SELECT * FROM public.availability_templates WHERE is_active = true
  LOOP
    v_created := 0;
    v_date := CURRENT_DATE;

    WHILE v_date <= CURRENT_DATE + p_days_ahead LOOP
      v_dow := EXTRACT(DOW FROM v_date)::INTEGER;

      FOR v_range IN SELECT * FROM public.get_template_day_ranges(t.id, v_dow) LOOP
        v_slot_start := v_range.start_time;
        WHILE (v_slot_start + (t.slot_duration_minutes || ' minutes')::INTERVAL)::TIME <= v_range.end_time LOOP
          v_slot_end := (v_slot_start + (t.slot_duration_minutes || ' minutes')::INTERVAL)::TIME;

          SELECT s.id INTO v_existing
          FROM public.availability_slots s
          WHERE s.business_id = t.business_id
            AND s.date = v_date
            AND s.start_time = v_slot_start
            AND (s.professional_user_id = t.professional_user_id OR s.professional_user_id IS NULL)
          LIMIT 1;

          IF v_existing IS NULL THEN
            INSERT INTO public.availability_slots(
              business_id, professional_user_id, date, start_time, end_time,
              modality, price, status, generated_from_template
            ) VALUES (
              t.business_id, t.professional_user_id, v_date, v_slot_start, v_slot_end,
              t.modality, t.default_price, 'available', t.id
            );
            v_created := v_created + 1;
          END IF;

          v_slot_start := v_slot_end;
        END LOOP;
      END LOOP;

      v_date := v_date + 1;
    END LOOP;

    template_id := t.id;
    created := v_created;
    RETURN NEXT;
  END LOOP;
END;
$$;

REVOKE ALL ON FUNCTION public.refill_template_slots(integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.refill_template_slots(integer) FROM anon;
REVOKE ALL ON FUNCTION public.refill_template_slots(integer) FROM authenticated;
