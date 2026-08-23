-- Eventos personales v2:
-- 1) Etiquetas 100% del usuario (sin presets): tabla personal_event_labels
--    (idempotente por si la migración anterior no se corrió).
-- 2) Repetición diaria además de semanal.
-- 3) get_available_starts entiende la repetición diaria.

-- ── Etiquetas custom (idéntico a 20260823170000, por las dudas) ──
CREATE TABLE IF NOT EXISTS public.personal_event_labels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL,
  professional_user_id uuid NOT NULL,
  name text NOT NULL,
  color text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT personal_event_labels_color_hex CHECK (color ~ '^#[0-9a-fA-F]{6}$'),
  CONSTRAINT personal_event_labels_name_len CHECK (char_length(name) BETWEEN 1 AND 40),
  CONSTRAINT personal_event_labels_unique_name UNIQUE (business_id, professional_user_id, name)
);

CREATE INDEX IF NOT EXISTS idx_personal_event_labels_owner
  ON public.personal_event_labels(business_id, professional_user_id);

ALTER TABLE public.personal_event_labels ENABLE ROW LEVEL SECURITY;

DROP TRIGGER IF EXISTS trg_personal_event_labels_updated_at ON public.personal_event_labels;
CREATE TRIGGER trg_personal_event_labels_updated_at
  BEFORE UPDATE ON public.personal_event_labels
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP POLICY IF EXISTS "pe_labels_members_select" ON public.personal_event_labels;
CREATE POLICY "pe_labels_members_select"
  ON public.personal_event_labels FOR SELECT
  USING (public.user_belongs_to_business(auth.uid(), business_id));

DROP POLICY IF EXISTS "pe_labels_own_insert" ON public.personal_event_labels;
CREATE POLICY "pe_labels_own_insert"
  ON public.personal_event_labels FOR INSERT
  WITH CHECK (professional_user_id = auth.uid() AND public.user_belongs_to_business(auth.uid(), business_id));

DROP POLICY IF EXISTS "pe_labels_own_update" ON public.personal_event_labels;
CREATE POLICY "pe_labels_own_update"
  ON public.personal_event_labels FOR UPDATE
  USING (professional_user_id = auth.uid())
  WITH CHECK (professional_user_id = auth.uid());

DROP POLICY IF EXISTS "pe_labels_own_delete" ON public.personal_event_labels;
CREATE POLICY "pe_labels_own_delete"
  ON public.personal_event_labels FOR DELETE
  USING (professional_user_id = auth.uid());

DROP POLICY IF EXISTS "pe_labels_super_admin_all" ON public.personal_event_labels;
CREATE POLICY "pe_labels_super_admin_all"
  ON public.personal_event_labels FOR ALL
  USING (public.is_super_admin(auth.uid()))
  WITH CHECK (public.is_super_admin(auth.uid()));

ALTER TABLE public.personal_events
  ADD COLUMN IF NOT EXISTS label_id uuid REFERENCES public.personal_event_labels(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_personal_events_label
  ON public.personal_events(label_id);

-- ── Repetición diaria ──
ALTER TABLE public.personal_events
  DROP CONSTRAINT IF EXISTS personal_events_recurrence_valid;
ALTER TABLE public.personal_events
  ADD CONSTRAINT personal_events_recurrence_valid
  CHECK (recurrence IN ('none', 'daily', 'weekly'));

-- ── get_available_starts: bloquea también repeticiones diarias ──
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

        -- Eventos personales: puntuales, diarios y semanales
        IF v_busy_end IS NULL THEN
          SELECT MAX((e.end_at AT TIME ZONE 'America/Montevideo')::time)
          INTO v_busy_end
          FROM public.personal_events e
          WHERE e.business_id = p_business_id
            AND (
              p_professional_user_id IS NULL
              OR e.professional_user_id = p_professional_user_id
            )
            AND (
              (
                e.recurrence = 'none'
                AND e.start_at < ((v_date + v_slot_end)::timestamp AT TIME ZONE 'America/Montevideo')
                AND e.end_at > ((v_date + v_start)::timestamp AT TIME ZONE 'America/Montevideo')
              )
              OR (
                e.recurrence IN ('daily', 'weekly')
                AND (
                  e.recurrence = 'daily'
                  OR EXTRACT(DOW FROM (e.start_at AT TIME ZONE 'America/Montevideo'))::integer = v_dow
                )
                AND v_date >= (e.start_at AT TIME ZONE 'America/Montevideo')::date
                AND (e.recurrence_until IS NULL OR v_date <= e.recurrence_until)
                AND (e.start_at AT TIME ZONE 'America/Montevideo')::time < v_slot_end
                AND (e.end_at AT TIME ZONE 'America/Montevideo')::time > v_start
              )
            );
        END IF;

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
