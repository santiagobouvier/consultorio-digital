-- La etiqueta de reservas cargaba lenta. Dos causas atacadas acá:
--
-- 1) El chequeo de "¿este horario está ocupado?" convertía las columnas
--    start_at/end_at con AT TIME ZONE en CADA fila y CADA candidato
--    (30 días × ~8 horarios = ~240 consultas no indexables). Ahora se
--    convierte EL CANDIDATO a timestamptz (una vez) y se compara contra
--    las columnas crudas: mismas cuentas (Uruguay es UTC-3 fijo), pero
--    la base puede usar índice.
-- 2) Índice nuevo (business_id, start_at) para ese rango.
-- 3) Cron "keep-warm": pinguea la función pública cada 4 minutos para que
--    el primer paciente del día no pague el arranque en frío.

DROP FUNCTION IF EXISTS public.get_available_starts(uuid, uuid, integer, date, date, boolean);

CREATE OR REPLACE FUNCTION public.get_available_starts(
  p_business_id uuid,
  p_professional_user_id uuid,
  p_duration_minutes integer,
  p_from date,
  p_to date,
  p_public boolean DEFAULT false
)
RETURNS TABLE(day date, start_time time, end_time time)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_now_local timestamp := (now() AT TIME ZONE 'America/Montevideo');
  v_today date := (now() AT TIME ZONE 'America/Montevideo')::date;
  v_date date;
  v_end_date date;
  v_dow integer;
  v_range RECORD;
  v_start time;
  v_slot_end time;
  v_busy_end time;
  v_dur interval;
  v_notice interval := interval '0 hours';
  v_max_date date := NULL;
BEGIN
  IF p_duration_minutes IS NULL OR p_duration_minutes < 10 OR p_duration_minutes > 480 THEN
    RAISE EXCEPTION 'Duración inválida';
  END IF;
  IF p_to < p_from OR p_to > p_from + 120 THEN
    RAISE EXCEPTION 'Rango de fechas inválido';
  END IF;

  IF p_public THEN
    SELECT make_interval(hours => COALESCE(b.min_booking_notice_hours, 24)),
           v_today + COALESCE(b.max_booking_horizon_days, 60)
    INTO v_notice, v_max_date
    FROM public.businesses b
    WHERE b.id = p_business_id;
  END IF;

  v_dur := (p_duration_minutes || ' minutes')::interval;
  v_date := GREATEST(p_from, v_today);
  v_end_date := CASE WHEN v_max_date IS NULL THEN p_to ELSE LEAST(p_to, v_max_date) END;

  WHILE v_date <= v_end_date LOOP
    v_dow := EXTRACT(DOW FROM v_date)::integer;

    FOR v_range IN
      WITH wins AS (
        SELECT r.start_time AS w_start, r.end_time AS w_end
        FROM public.availability_templates t,
             LATERAL public.get_template_day_ranges(t.id, v_dow) r
        WHERE t.business_id = p_business_id
          AND t.is_active = true
          AND (p_professional_user_id IS NULL OR t.professional_user_id = p_professional_user_id)
        UNION ALL
        SELECT s.start_time, s.end_time
        FROM public.availability_slots s
        WHERE s.business_id = p_business_id
          AND s.date = v_date
          AND s.status = 'available'
          AND s.generated_from_template IS NULL
          AND (
            p_professional_user_id IS NULL
            OR s.professional_user_id = p_professional_user_id
            OR s.professional_user_id IS NULL
          )
      ),
      marked AS (
        SELECT w_start, w_end,
               CASE
                 WHEN w_start > COALESCE(
                   MAX(w_end) OVER (ORDER BY w_start, w_end
                                    ROWS BETWEEN UNBOUNDED PRECEDING AND 1 PRECEDING),
                   '00:00'::time)
                 THEN 1 ELSE 0
               END AS brk
        FROM wins
      ),
      grouped AS (
        SELECT w_start, w_end, SUM(brk) OVER (ORDER BY w_start, w_end) AS grp
        FROM marked
      )
      SELECT MIN(w_start) AS w_start, MAX(w_end) AS w_end
      FROM grouped
      GROUP BY grp
      ORDER BY 1
    LOOP
      v_start := v_range.w_start;

      WHILE (v_start + v_dur)::time <= v_range.w_end
            AND (v_start + v_dur)::time > v_start
      LOOP
        v_slot_end := (v_start + v_dur)::time;

        IF (v_date + v_start)::timestamp <= v_now_local + v_notice THEN
          v_start := v_slot_end;
          CONTINUE;
        END IF;

        -- ¿Alguna cita ocupa [v_start, v_slot_end)? El candidato se convierte
        -- a timestamptz UNA vez; las columnas quedan crudas → usa índice.
        SELECT MAX((a.end_at AT TIME ZONE 'America/Montevideo'))::time
        INTO v_busy_end
        FROM public.appointments a
        WHERE a.business_id = p_business_id
          AND a.status NOT IN ('cancelled', 'cancelled_by_patient')
          AND (
            p_professional_user_id IS NULL
            OR a.professional_id = p_professional_user_id
            OR a.professional_id IS NULL
          )
          AND a.start_at < ((v_date + v_slot_end)::timestamp AT TIME ZONE 'America/Montevideo')
          AND a.end_at > ((v_date + v_start)::timestamp AT TIME ZONE 'America/Montevideo');

        IF v_busy_end IS NULL THEN
          day := v_date;
          start_time := v_start;
          end_time := v_slot_end;
          RETURN NEXT;
          v_start := v_slot_end;
        ELSIF v_busy_end > v_start THEN
          v_start := v_busy_end;
        ELSE
          v_start := v_slot_end;
        END IF;
      END LOOP;
    END LOOP;

    v_date := v_date + 1;
  END LOOP;
END;
$$;

REVOKE ALL ON FUNCTION public.get_available_starts(uuid, uuid, integer, date, date, boolean) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_available_starts(uuid, uuid, integer, date, date, boolean) FROM anon;
GRANT EXECUTE ON FUNCTION public.get_available_starts(uuid, uuid, integer, date, date, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_available_starts(uuid, uuid, integer, date, date, boolean) TO service_role;

-- Índice para el chequeo de ocupación (rango por consultorio + inicio)
CREATE INDEX IF NOT EXISTS idx_appointments_business_start
  ON public.appointments (business_id, start_at);

-- Keep-warm: ping cada 4 minutos a la función pública de horarios, para que
-- el primer paciente no pague el arranque en frío (responde 405 al GET, pero
-- el proceso queda despierto).
DO $$
BEGIN
  PERFORM cron.unschedule('keep-warm-public-starts');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

SELECT cron.schedule(
  'keep-warm-public-starts',
  '*/4 * * * *',
  $$
  SELECT net.http_get(
    url := 'https://sfvuuzpmsgepooeamkin.supabase.co/functions/v1/public-get-available-starts'
  )
  $$
);
