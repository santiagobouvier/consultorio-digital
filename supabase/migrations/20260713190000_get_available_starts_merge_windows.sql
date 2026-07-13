-- Horarios 2.0 · Etapa 5: el motor fusiona ventanas solapadas.
--
-- Antes, si un horario suelto se solapaba con la semana tipo (o con otro
-- suelto), el mismo inicio podía aparecer dos veces en la lista. Ahora las
-- ventanas del día se fusionan (semana tipo + sueltos, solapados o pegados)
-- antes de calcular los inicios: cada horario aparece una sola vez y los
-- sueltos se pueden agregar sin pensar en combinaciones.

CREATE OR REPLACE FUNCTION public.get_available_starts(
  p_business_id uuid,
  p_professional_user_id uuid,
  p_duration_minutes integer,
  p_from date,
  p_to date
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
  v_dow integer;
  v_range RECORD;
  v_start time;
  v_slot_end time;
  v_busy_end time;
  v_dur interval;
BEGIN
  IF p_duration_minutes IS NULL OR p_duration_minutes < 10 OR p_duration_minutes > 480 THEN
    RAISE EXCEPTION 'Duración inválida';
  END IF;
  IF p_to < p_from OR p_to > p_from + 120 THEN
    RAISE EXCEPTION 'Rango de fechas inválido';
  END IF;

  v_dur := (p_duration_minutes || ' minutes')::interval;
  v_date := GREATEST(p_from, v_today);

  WHILE v_date <= p_to LOOP
    v_dow := EXTRACT(DOW FROM v_date)::integer;

    -- Ventanas del día (semana tipo + sueltos), FUSIONADAS: los rangos que se
    -- solapan o se tocan se unen en una sola ventana continua.
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
            AND (v_start + v_dur)::time > v_start  -- no cruzar medianoche
      LOOP
        v_slot_end := (v_start + v_dur)::time;

        -- Saltear horarios que ya pasaron (hoy)
        IF v_date = v_today AND (v_date + v_start)::timestamp <= v_now_local THEN
          v_start := v_slot_end;
          CONTINUE;
        END IF;

        -- ¿Alguna cita ocupa [v_start, v_slot_end)? Tomar la que termina más tarde.
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
          AND (a.start_at AT TIME ZONE 'America/Montevideo') < (v_date + v_slot_end)::timestamp
          AND (a.end_at AT TIME ZONE 'America/Montevideo') > (v_date + v_start)::timestamp;

        IF v_busy_end IS NULL THEN
          day := v_date;
          start_time := v_start;
          end_time := v_slot_end;
          RETURN NEXT;
          v_start := v_slot_end;
        ELSIF v_busy_end > v_start THEN
          -- Empaquetar: arrancar pegado al fin de la cita que estorba
          v_start := v_busy_end;
        ELSE
          -- Guardia anti-loop (citas que cruzan medianoche u otros bordes)
          v_start := v_slot_end;
        END IF;
      END LOOP;
    END LOOP;

    v_date := v_date + 1;
  END LOOP;
END;
$$;

REVOKE ALL ON FUNCTION public.get_available_starts(uuid, uuid, integer, date, date) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_available_starts(uuid, uuid, integer, date, date) FROM anon;
GRANT EXECUTE ON FUNCTION public.get_available_starts(uuid, uuid, integer, date, date) TO authenticated;
