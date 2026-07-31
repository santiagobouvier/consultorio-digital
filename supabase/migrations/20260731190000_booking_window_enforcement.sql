-- Ventana de reservas (Etapa 2): el motor de horarios aplica la ventana
-- del consultorio cuando el pedido viene del público (web pública o portal
-- del paciente), y la reserva doble queda cerrada EN LA BASE.
--
-- p_public = false (default): panel del profesional, sin restricción — el
-- profesional agenda cuando quiere. p_public = true: se filtran los inicios
-- dentro de min_booking_notice_hours y más allá de max_booking_horizon_days.
-- Como public-book-appointment revalida contra esta misma función al
-- confirmar, la validación de la ventana corre contra now() del servidor
-- también en la confirmación tardía (página abierta hace media hora).

DROP FUNCTION IF EXISTS public.get_available_starts(uuid, uuid, integer, date, date);

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
  -- Ventana pública: 0/NULL para el panel del profesional
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

        -- Saltear horarios que ya pasaron o que caen dentro de la ventana de
        -- anticipación mínima (v_notice = 0 para el panel del profesional).
        -- Todo en hora local del servidor: nunca la hora del navegador.
        IF (v_date + v_start)::timestamp <= v_now_local + v_notice THEN
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

REVOKE ALL ON FUNCTION public.get_available_starts(uuid, uuid, integer, date, date, boolean) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_available_starts(uuid, uuid, integer, date, date, boolean) FROM anon;
GRANT EXECUTE ON FUNCTION public.get_available_starts(uuid, uuid, integer, date, date, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_available_starts(uuid, uuid, integer, date, date, boolean) TO service_role;

-- ── Reserva doble: cerrada en la base, no en el código ──
-- Dos confirmaciones del mismo inicio con segundos de diferencia: la segunda
-- explota con unique_violation y la edge function devuelve "horario tomado".
-- (Si este índice falla al crearse, hay citas activas duplicadas viejas:
--  detectarlas con el SELECT comentado y resolverlas a mano.)
--
-- SELECT professional_id, start_at, count(*) FROM public.appointments
-- WHERE status NOT IN ('cancelled','cancelled_by_patient') AND professional_id IS NOT NULL
-- GROUP BY 1, 2 HAVING count(*) > 1;

CREATE UNIQUE INDEX IF NOT EXISTS uniq_appointments_professional_start_active
ON public.appointments (professional_id, start_at)
WHERE status NOT IN ('cancelled', 'cancelled_by_patient') AND professional_id IS NOT NULL;
