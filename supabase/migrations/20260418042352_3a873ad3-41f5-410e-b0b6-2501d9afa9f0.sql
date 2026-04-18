-- 1. Tabla de plantillas semanales por profesional
CREATE TABLE public.availability_templates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  professional_user_id UUID NOT NULL,
  name TEXT NOT NULL DEFAULT 'Mi semana tipo',
  is_active BOOLEAN NOT NULL DEFAULT true,
  -- Configuración de slot
  slot_duration_minutes INTEGER NOT NULL DEFAULT 60,
  modality TEXT NOT NULL DEFAULT 'Online',
  default_price NUMERIC,
  -- Días: 0=Domingo, 1=Lunes ... 6=Sábado
  -- Para cada día: enabled + hasta 2 rangos (start1/end1, start2/end2 nullables)
  monday_enabled BOOLEAN NOT NULL DEFAULT false,
  monday_start_1 TIME, monday_end_1 TIME,
  monday_start_2 TIME, monday_end_2 TIME,
  tuesday_enabled BOOLEAN NOT NULL DEFAULT false,
  tuesday_start_1 TIME, tuesday_end_1 TIME,
  tuesday_start_2 TIME, tuesday_end_2 TIME,
  wednesday_enabled BOOLEAN NOT NULL DEFAULT false,
  wednesday_start_1 TIME, wednesday_end_1 TIME,
  wednesday_start_2 TIME, wednesday_end_2 TIME,
  thursday_enabled BOOLEAN NOT NULL DEFAULT false,
  thursday_start_1 TIME, thursday_end_1 TIME,
  thursday_start_2 TIME, thursday_end_2 TIME,
  friday_enabled BOOLEAN NOT NULL DEFAULT false,
  friday_start_1 TIME, friday_end_1 TIME,
  friday_start_2 TIME, friday_end_2 TIME,
  saturday_enabled BOOLEAN NOT NULL DEFAULT false,
  saturday_start_1 TIME, saturday_end_1 TIME,
  saturday_start_2 TIME, saturday_end_2 TIME,
  sunday_enabled BOOLEAN NOT NULL DEFAULT false,
  sunday_start_1 TIME, sunday_end_1 TIME,
  sunday_start_2 TIME, sunday_end_2 TIME,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(business_id, professional_user_id)
);

CREATE INDEX idx_avail_templates_business ON public.availability_templates(business_id);
CREATE INDEX idx_avail_templates_professional ON public.availability_templates(professional_user_id);

-- 2. Agregar professional_user_id y generated_from_template a availability_slots
ALTER TABLE public.availability_slots
  ADD COLUMN professional_user_id UUID,
  ADD COLUMN generated_from_template UUID REFERENCES public.availability_templates(id) ON DELETE SET NULL;

CREATE INDEX idx_avail_slots_professional ON public.availability_slots(professional_user_id);
CREATE INDEX idx_avail_slots_business_date ON public.availability_slots(business_id, date);

-- 3. RLS
ALTER TABLE public.availability_templates ENABLE ROW LEVEL SECURITY;

-- Profesional ve y edita su propia plantilla
CREATE POLICY "Professionals manage own template"
  ON public.availability_templates
  FOR ALL
  USING (professional_user_id = auth.uid())
  WITH CHECK (professional_user_id = auth.uid());

-- Dueño del consultorio gestiona todas las plantillas de su equipo
CREATE POLICY "Business owners manage team templates"
  ON public.availability_templates
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.businesses b
      WHERE b.id = availability_templates.business_id
        AND b.owner_user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.businesses b
      WHERE b.id = availability_templates.business_id
        AND b.owner_user_id = auth.uid()
    )
  );

-- Super admin
CREATE POLICY "Super admin manage templates"
  ON public.availability_templates
  FOR ALL
  USING (public.is_super_admin(auth.uid()))
  WITH CHECK (public.is_super_admin(auth.uid()));

-- 4. Trigger updated_at
CREATE TRIGGER update_avail_templates_updated_at
  BEFORE UPDATE ON public.availability_templates
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- 5. Función auxiliar: obtener rangos de un día de la plantilla
CREATE OR REPLACE FUNCTION public.get_template_day_ranges(
  p_template_id UUID,
  p_dow INTEGER  -- 0=Sun..6=Sat
)
RETURNS TABLE(start_time TIME, end_time TIME)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  t public.availability_templates%ROWTYPE;
BEGIN
  SELECT * INTO t FROM public.availability_templates WHERE id = p_template_id;
  IF NOT FOUND THEN RETURN; END IF;

  IF p_dow = 1 AND t.monday_enabled THEN
    IF t.monday_start_1 IS NOT NULL AND t.monday_end_1 IS NOT NULL THEN RETURN QUERY SELECT t.monday_start_1, t.monday_end_1; END IF;
    IF t.monday_start_2 IS NOT NULL AND t.monday_end_2 IS NOT NULL THEN RETURN QUERY SELECT t.monday_start_2, t.monday_end_2; END IF;
  ELSIF p_dow = 2 AND t.tuesday_enabled THEN
    IF t.tuesday_start_1 IS NOT NULL AND t.tuesday_end_1 IS NOT NULL THEN RETURN QUERY SELECT t.tuesday_start_1, t.tuesday_end_1; END IF;
    IF t.tuesday_start_2 IS NOT NULL AND t.tuesday_end_2 IS NOT NULL THEN RETURN QUERY SELECT t.tuesday_start_2, t.tuesday_end_2; END IF;
  ELSIF p_dow = 3 AND t.wednesday_enabled THEN
    IF t.wednesday_start_1 IS NOT NULL AND t.wednesday_end_1 IS NOT NULL THEN RETURN QUERY SELECT t.wednesday_start_1, t.wednesday_end_1; END IF;
    IF t.wednesday_start_2 IS NOT NULL AND t.wednesday_end_2 IS NOT NULL THEN RETURN QUERY SELECT t.wednesday_start_2, t.wednesday_end_2; END IF;
  ELSIF p_dow = 4 AND t.thursday_enabled THEN
    IF t.thursday_start_1 IS NOT NULL AND t.thursday_end_1 IS NOT NULL THEN RETURN QUERY SELECT t.thursday_start_1, t.thursday_end_1; END IF;
    IF t.thursday_start_2 IS NOT NULL AND t.thursday_end_2 IS NOT NULL THEN RETURN QUERY SELECT t.thursday_start_2, t.thursday_end_2; END IF;
  ELSIF p_dow = 5 AND t.friday_enabled THEN
    IF t.friday_start_1 IS NOT NULL AND t.friday_end_1 IS NOT NULL THEN RETURN QUERY SELECT t.friday_start_1, t.friday_end_1; END IF;
    IF t.friday_start_2 IS NOT NULL AND t.friday_end_2 IS NOT NULL THEN RETURN QUERY SELECT t.friday_start_2, t.friday_end_2; END IF;
  ELSIF p_dow = 6 AND t.saturday_enabled THEN
    IF t.saturday_start_1 IS NOT NULL AND t.saturday_end_1 IS NOT NULL THEN RETURN QUERY SELECT t.saturday_start_1, t.saturday_end_1; END IF;
    IF t.saturday_start_2 IS NOT NULL AND t.saturday_end_2 IS NOT NULL THEN RETURN QUERY SELECT t.saturday_start_2, t.saturday_end_2; END IF;
  ELSIF p_dow = 0 AND t.sunday_enabled THEN
    IF t.sunday_start_1 IS NOT NULL AND t.sunday_end_1 IS NOT NULL THEN RETURN QUERY SELECT t.sunday_start_1, t.sunday_end_1; END IF;
    IF t.sunday_start_2 IS NOT NULL AND t.sunday_end_2 IS NOT NULL THEN RETURN QUERY SELECT t.sunday_start_2, t.sunday_end_2; END IF;
  END IF;
END;
$$;

-- 6. Preview: cuenta slots a generar y conflictos
CREATE OR REPLACE FUNCTION public.preview_template_generation(
  p_template_id UUID,
  p_from_date DATE,
  p_to_date DATE
)
RETURNS TABLE(
  total_slots INTEGER,
  conflicts INTEGER,
  days_with_slots INTEGER
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  t public.availability_templates%ROWTYPE;
  v_date DATE;
  v_dow INTEGER;
  v_range RECORD;
  v_slot_start TIME;
  v_slot_end TIME;
  v_total INTEGER := 0;
  v_conflicts INTEGER := 0;
  v_days INTEGER := 0;
  v_day_had_slot BOOLEAN;
BEGIN
  SELECT * INTO t FROM public.availability_templates WHERE id = p_template_id;
  IF NOT FOUND THEN RETURN QUERY SELECT 0, 0, 0; RETURN; END IF;

  v_date := p_from_date;
  WHILE v_date <= p_to_date LOOP
    v_dow := EXTRACT(DOW FROM v_date)::INTEGER;
    v_day_had_slot := false;

    FOR v_range IN SELECT * FROM public.get_template_day_ranges(p_template_id, v_dow) LOOP
      v_slot_start := v_range.start_time;
      WHILE (v_slot_start + (t.slot_duration_minutes || ' minutes')::INTERVAL)::TIME <= v_range.end_time LOOP
        v_slot_end := (v_slot_start + (t.slot_duration_minutes || ' minutes')::INTERVAL)::TIME;
        v_total := v_total + 1;
        v_day_had_slot := true;

        IF EXISTS (
          SELECT 1 FROM public.availability_slots s
          WHERE s.business_id = t.business_id
            AND s.date = v_date
            AND s.start_time = v_slot_start
            AND (s.professional_user_id = t.professional_user_id OR s.professional_user_id IS NULL)
        ) THEN
          v_conflicts := v_conflicts + 1;
        END IF;

        v_slot_start := v_slot_end;
      END LOOP;
    END LOOP;

    IF v_day_had_slot THEN v_days := v_days + 1; END IF;
    v_date := v_date + 1;
  END LOOP;

  RETURN QUERY SELECT v_total, v_conflicts, v_days;
END;
$$;

-- 7. Generación efectiva
CREATE OR REPLACE FUNCTION public.generate_slots_from_template(
  p_template_id UUID,
  p_from_date DATE,
  p_to_date DATE,
  p_conflict_strategy TEXT DEFAULT 'skip'  -- 'skip' | 'replace'
)
RETURNS TABLE(
  created INTEGER,
  skipped INTEGER,
  replaced INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  t public.availability_templates%ROWTYPE;
  v_date DATE;
  v_dow INTEGER;
  v_range RECORD;
  v_slot_start TIME;
  v_slot_end TIME;
  v_existing UUID;
  v_existing_status TEXT;
  v_created INTEGER := 0;
  v_skipped INTEGER := 0;
  v_replaced INTEGER := 0;
BEGIN
  SELECT * INTO t FROM public.availability_templates WHERE id = p_template_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Plantilla no encontrada';
  END IF;

  -- Verificar permisos: profesional dueño de la plantilla o dueño del business
  IF NOT (
    t.professional_user_id = auth.uid()
    OR EXISTS (SELECT 1 FROM public.businesses b WHERE b.id = t.business_id AND b.owner_user_id = auth.uid())
    OR public.is_super_admin(auth.uid())
  ) THEN
    RAISE EXCEPTION 'Sin permisos para generar horarios de esta plantilla';
  END IF;

  v_date := p_from_date;
  WHILE v_date <= p_to_date LOOP
    v_dow := EXTRACT(DOW FROM v_date)::INTEGER;

    FOR v_range IN SELECT * FROM public.get_template_day_ranges(p_template_id, v_dow) LOOP
      v_slot_start := v_range.start_time;
      WHILE (v_slot_start + (t.slot_duration_minutes || ' minutes')::INTERVAL)::TIME <= v_range.end_time LOOP
        v_slot_end := (v_slot_start + (t.slot_duration_minutes || ' minutes')::INTERVAL)::TIME;

        SELECT id, status INTO v_existing, v_existing_status
        FROM public.availability_slots
        WHERE business_id = t.business_id
          AND date = v_date
          AND start_time = v_slot_start
          AND (professional_user_id = t.professional_user_id OR professional_user_id IS NULL)
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
        ELSIF p_conflict_strategy = 'replace' AND v_existing_status = 'available' THEN
          UPDATE public.availability_slots
          SET end_time = v_slot_end,
              modality = t.modality,
              price = t.default_price,
              professional_user_id = t.professional_user_id,
              generated_from_template = t.id,
              updated_at = now()
          WHERE id = v_existing;
          v_replaced := v_replaced + 1;
        ELSE
          v_skipped := v_skipped + 1;
        END IF;

        v_slot_start := v_slot_end;
        v_existing := NULL;
        v_existing_status := NULL;
      END LOOP;
    END LOOP;

    v_date := v_date + 1;
  END LOOP;

  RETURN QUERY SELECT v_created, v_skipped, v_replaced;
END;
$$;