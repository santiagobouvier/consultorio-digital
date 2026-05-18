-- ============================================
-- 1. TABLAS NUEVAS
-- ============================================
CREATE TABLE public.spaces (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL,
  name text NOT NULL,
  type text NOT NULL DEFAULT 'physical' CHECK (type IN ('physical','virtual')),
  capacity integer NOT NULL DEFAULT 1 CHECK (capacity >= 1),
  color text,
  notes text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_spaces_business ON public.spaces(business_id);

CREATE TABLE public.professional_spaces (
  professional_id uuid NOT NULL,
  space_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (professional_id, space_id)
);
CREATE INDEX idx_prof_spaces_prof ON public.professional_spaces(professional_id);
CREATE INDEX idx_prof_spaces_space ON public.professional_spaces(space_id);

CREATE TABLE public.availability_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL,
  professional_id uuid NOT NULL,
  day_of_week integer NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  start_time time NOT NULL,
  end_time time NOT NULL,
  slot_duration_minutes integer NOT NULL DEFAULT 60 CHECK (slot_duration_minutes > 0),
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT valid_time_range CHECK (end_time > start_time)
);
CREATE INDEX idx_avail_rules_lookup ON public.availability_rules(business_id, professional_id, day_of_week, is_active);

CREATE TABLE public.availability_exceptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL,
  scope text NOT NULL CHECK (scope IN ('business','professional','space')),
  professional_id uuid,
  space_id uuid,
  start_at timestamptz NOT NULL,
  end_at timestamptz NOT NULL,
  reason text CHECK (reason IN ('vacation','holiday','maintenance','personal','other')),
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT valid_exception_range CHECK (end_at > start_at),
  CONSTRAINT valid_scope_fk CHECK (
    (scope = 'business'     AND professional_id IS NULL     AND space_id IS NULL) OR
    (scope = 'professional' AND professional_id IS NOT NULL AND space_id IS NULL) OR
    (scope = 'space'        AND space_id IS NOT NULL        AND professional_id IS NULL)
  )
);
CREATE INDEX idx_avail_exc_business_range ON public.availability_exceptions(business_id, start_at, end_at);
CREATE INDEX idx_avail_exc_prof ON public.availability_exceptions(professional_id) WHERE professional_id IS NOT NULL;
CREATE INDEX idx_avail_exc_space ON public.availability_exceptions(space_id) WHERE space_id IS NOT NULL;

-- ============================================
-- 2. APPOINTMENTS.space_id
-- ============================================
ALTER TABLE public.appointments ADD COLUMN IF NOT EXISTS space_id uuid;
CREATE INDEX IF NOT EXISTS idx_appointments_space ON public.appointments(space_id);
CREATE INDEX IF NOT EXISTS idx_appointments_prof_time ON public.appointments(professional_id, start_at, end_at);

-- ============================================
-- 3. TRIGGERS updated_at
-- ============================================
CREATE TRIGGER trg_spaces_updated BEFORE UPDATE ON public.spaces
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_avail_rules_updated BEFORE UPDATE ON public.availability_rules
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_avail_exc_updated BEFORE UPDATE ON public.availability_exceptions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================
-- 4. RLS
-- ============================================
ALTER TABLE public.spaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.professional_spaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.availability_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.availability_exceptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY spaces_business_all ON public.spaces FOR ALL
  USING (public.user_belongs_to_business(auth.uid(), business_id))
  WITH CHECK (public.user_belongs_to_business(auth.uid(), business_id));
CREATE POLICY spaces_patient_select ON public.spaces FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.patients p
                 WHERE p.business_id = spaces.business_id AND p.auth_user_id = auth.uid() AND p.is_active));
CREATE POLICY spaces_super_admin ON public.spaces FOR ALL
  USING (public.is_super_admin(auth.uid())) WITH CHECK (public.is_super_admin(auth.uid()));

CREATE POLICY prof_spaces_business_all ON public.professional_spaces FOR ALL
  USING (EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = professional_spaces.professional_id
      AND ur.business_id IS NOT NULL
      AND public.user_belongs_to_business(auth.uid(), ur.business_id)
  ) OR EXISTS (
    SELECT 1 FROM public.businesses b
    WHERE b.owner_user_id = professional_spaces.professional_id
      AND public.user_belongs_to_business(auth.uid(), b.id)
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = professional_spaces.professional_id
      AND ur.business_id IS NOT NULL
      AND public.user_belongs_to_business(auth.uid(), ur.business_id)
  ) OR EXISTS (
    SELECT 1 FROM public.businesses b
    WHERE b.owner_user_id = professional_spaces.professional_id
      AND public.user_belongs_to_business(auth.uid(), b.id)
  ));
CREATE POLICY prof_spaces_patient_select ON public.professional_spaces FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.patients p
    WHERE p.auth_user_id = auth.uid() AND p.is_active
      AND (
        EXISTS (SELECT 1 FROM public.user_roles ur
                WHERE ur.user_id = professional_spaces.professional_id AND ur.business_id = p.business_id)
        OR EXISTS (SELECT 1 FROM public.businesses b
                   WHERE b.owner_user_id = professional_spaces.professional_id AND b.id = p.business_id)
      )
  ));
CREATE POLICY prof_spaces_super_admin ON public.professional_spaces FOR ALL
  USING (public.is_super_admin(auth.uid())) WITH CHECK (public.is_super_admin(auth.uid()));

CREATE POLICY avail_rules_business_all ON public.availability_rules FOR ALL
  USING (public.user_belongs_to_business(auth.uid(), business_id))
  WITH CHECK (public.user_belongs_to_business(auth.uid(), business_id));
CREATE POLICY avail_rules_patient_select ON public.availability_rules FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.patients p
                 WHERE p.business_id = availability_rules.business_id AND p.auth_user_id = auth.uid() AND p.is_active));
CREATE POLICY avail_rules_super_admin ON public.availability_rules FOR ALL
  USING (public.is_super_admin(auth.uid())) WITH CHECK (public.is_super_admin(auth.uid()));

CREATE POLICY avail_exc_business_all ON public.availability_exceptions FOR ALL
  USING (public.user_belongs_to_business(auth.uid(), business_id))
  WITH CHECK (public.user_belongs_to_business(auth.uid(), business_id));
CREATE POLICY avail_exc_patient_select ON public.availability_exceptions FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.patients p
                 WHERE p.business_id = availability_exceptions.business_id AND p.auth_user_id = auth.uid() AND p.is_active));
CREATE POLICY avail_exc_super_admin ON public.availability_exceptions FOR ALL
  USING (public.is_super_admin(auth.uid())) WITH CHECK (public.is_super_admin(auth.uid()));

-- ============================================
-- 5. RPC get_available_slots
-- ============================================
CREATE OR REPLACE FUNCTION public.get_available_slots(
  p_business_id uuid,
  p_professional_id uuid,
  p_date_from date,
  p_date_to date,
  p_service_duration_minutes integer DEFAULT NULL
)
RETURNS TABLE (
  slot_date date,
  slot_start_at timestamptz,
  slot_end_at timestamptz,
  available_space_ids uuid[],
  total_capacity integer,
  professional_id uuid
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_tz text;
  v_date date;
  v_dow int;
  v_rule record;
  v_dur int;
  v_slot_start_local timestamp;
  v_slot_end_local timestamp;
  v_slot_start timestamptz;
  v_slot_end timestamptz;
  v_blocked boolean;
  v_free_spaces uuid[];
BEGIN
  SELECT timezone INTO v_tz FROM public.businesses WHERE id = p_business_id;
  IF v_tz IS NULL THEN v_tz := 'America/Montevideo'; END IF;

  v_date := p_date_from;
  WHILE v_date <= p_date_to LOOP
    v_dow := EXTRACT(DOW FROM v_date)::int;

    FOR v_rule IN
      SELECT * FROM public.availability_rules
      WHERE business_id = p_business_id
        AND availability_rules.professional_id = p_professional_id
        AND day_of_week = v_dow
        AND is_active = true
    LOOP
      v_dur := COALESCE(p_service_duration_minutes, v_rule.slot_duration_minutes);
      v_slot_start_local := (v_date::text || ' ' || v_rule.start_time::text)::timestamp;

      WHILE (v_slot_start_local + (v_dur || ' minutes')::interval)::time <= v_rule.end_time
            AND (v_slot_start_local + (v_dur || ' minutes')::interval)::date = v_date LOOP
        v_slot_end_local := v_slot_start_local + (v_dur || ' minutes')::interval;
        v_slot_start := v_slot_start_local AT TIME ZONE v_tz;
        v_slot_end   := v_slot_end_local   AT TIME ZONE v_tz;

        SELECT EXISTS (
          SELECT 1 FROM public.availability_exceptions e
          WHERE e.business_id = p_business_id
            AND e.start_at < v_slot_end AND e.end_at > v_slot_start
            AND (
              e.scope = 'business'
              OR (e.scope = 'professional' AND e.professional_id = p_professional_id)
            )
        ) INTO v_blocked;

        IF NOT v_blocked THEN
          SELECT EXISTS (
            SELECT 1 FROM public.appointments a
            WHERE a.business_id = p_business_id
              AND a.professional_id = p_professional_id
              AND a.status IN ('scheduled','pending','confirmed','reschedule_requested')
              AND a.start_at < v_slot_end AND a.end_at > v_slot_start
          ) INTO v_blocked;
        END IF;

        IF NOT v_blocked THEN
          SELECT COALESCE(array_agg(s.id), ARRAY[]::uuid[])
          INTO v_free_spaces
          FROM public.spaces s
          JOIN public.professional_spaces ps
            ON ps.space_id = s.id AND ps.professional_id = p_professional_id
          WHERE s.business_id = p_business_id
            AND s.is_active = true
            AND NOT EXISTS (
              SELECT 1 FROM public.availability_exceptions e
              WHERE e.scope = 'space' AND e.space_id = s.id
                AND e.start_at < v_slot_end AND e.end_at > v_slot_start
            )
            AND NOT EXISTS (
              SELECT 1 FROM public.appointments a
              WHERE a.space_id = s.id
                AND a.status IN ('scheduled','pending','confirmed','reschedule_requested')
                AND a.start_at < v_slot_end AND a.end_at > v_slot_start
            );

          IF v_free_spaces IS NOT NULL AND array_length(v_free_spaces, 1) > 0 THEN
            slot_date := v_date;
            slot_start_at := v_slot_start;
            slot_end_at := v_slot_end;
            available_space_ids := v_free_spaces;
            total_capacity := array_length(v_free_spaces, 1);
            professional_id := p_professional_id;
            RETURN NEXT;
          END IF;
        END IF;

        v_slot_start_local := v_slot_end_local;
      END LOOP;
    END LOOP;

    v_date := v_date + 1;
  END LOOP;
END;
$$;

-- ============================================
-- 6. MIGRACIÓN DE DATOS
-- ============================================
INSERT INTO public.spaces (business_id, name, type)
SELECT b.id, 'Consultorio', 'physical' FROM public.businesses b
WHERE NOT EXISTS (SELECT 1 FROM public.spaces s WHERE s.business_id = b.id AND s.type = 'physical');

INSERT INTO public.spaces (business_id, name, type)
SELECT b.id, 'Online', 'virtual' FROM public.businesses b
WHERE NOT EXISTS (SELECT 1 FROM public.spaces s WHERE s.business_id = b.id AND s.type = 'virtual');

WITH profs AS (
  SELECT b.id AS business_id, b.owner_user_id AS prof_id
  FROM public.businesses b WHERE b.owner_user_id IS NOT NULL
  UNION
  SELECT ur.business_id, ur.user_id
  FROM public.user_roles ur
  WHERE ur.role IN ('owner','professional') AND ur.business_id IS NOT NULL
)
INSERT INTO public.professional_spaces (professional_id, space_id)
SELECT DISTINCT p.prof_id, s.id
FROM profs p
JOIN public.spaces s ON s.business_id = p.business_id
ON CONFLICT DO NOTHING;

INSERT INTO public.availability_rules (business_id, professional_id, day_of_week, start_time, end_time, slot_duration_minutes)
SELECT
  s.business_id,
  COALESCE(s.professional_user_id, b.owner_user_id) AS prof_id,
  EXTRACT(DOW FROM s.date)::int AS dow,
  s.start_time,
  s.end_time,
  GREATEST(1, (EXTRACT(EPOCH FROM (s.end_time - s.start_time))/60)::int) AS dur
FROM public.availability_slots s
JOIN public.businesses b ON b.id = s.business_id
WHERE s.status = 'available'
  AND COALESCE(s.professional_user_id, b.owner_user_id) IS NOT NULL
GROUP BY s.business_id, COALESCE(s.professional_user_id, b.owner_user_id),
         EXTRACT(DOW FROM s.date), s.start_time, s.end_time;

UPDATE public.appointments a
SET space_id = s.id
FROM public.spaces s
WHERE s.business_id = a.business_id
  AND a.space_id IS NULL
  AND (
    (a.modality IN ('online','virtual') AND s.type = 'virtual') OR
    (COALESCE(a.modality, 'in_person') NOT IN ('online','virtual') AND s.type = 'physical')
  );

COMMENT ON TABLE public.availability_slots IS 'DEPRECATED desde Fase 1. Reemplazada por availability_rules + get_available_slots. Se elimina en Fase 3.';