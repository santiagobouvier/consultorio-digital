-- Bloques de sesiones libres por día en la semana tipo.
-- La UI nueva pinta "fichas" de sesión; acá se guardan como una lista de
-- bloques por día (day_blocks jsonb). El motor de disponibilidad los lee a
-- través de get_template_day_ranges, así que get_available_starts no cambia.
--
-- Formato: {"monday": [["09:00","13:00"], ["15:00","16:00"]], ...}
-- Si day_blocks es NULL se usan las columnas clásicas (2 rangos por día).

ALTER TABLE public.availability_templates
  ADD COLUMN IF NOT EXISTS day_blocks jsonb;

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
  v_key text;
  v_blocks jsonb;
  v_b jsonb;
  v_start time;
  v_end time;
BEGIN
  SELECT * INTO t FROM public.availability_templates WHERE id = p_template_id;
  IF NOT FOUND THEN RETURN; END IF;

  -- Camino nuevo: bloques libres por día (N rangos)
  IF t.day_blocks IS NOT NULL THEN
    v_key := CASE p_dow
      WHEN 0 THEN 'sunday'
      WHEN 1 THEN 'monday'
      WHEN 2 THEN 'tuesday'
      WHEN 3 THEN 'wednesday'
      WHEN 4 THEN 'thursday'
      WHEN 5 THEN 'friday'
      WHEN 6 THEN 'saturday'
    END;
    v_blocks := t.day_blocks -> v_key;
    IF v_blocks IS NULL OR jsonb_typeof(v_blocks) <> 'array' THEN RETURN; END IF;
    FOR v_b IN SELECT * FROM jsonb_array_elements(v_blocks) LOOP
      BEGIN
        v_start := (v_b ->> 0)::time;
        v_end := (v_b ->> 1)::time;
      EXCEPTION WHEN others THEN
        v_start := NULL;
        v_end := NULL;
      END;
      IF v_start IS NOT NULL AND v_end IS NOT NULL AND v_end > v_start THEN
        start_time := v_start;
        end_time := v_end;
        RETURN NEXT;
      END IF;
    END LOOP;
    RETURN;
  END IF;

  -- Camino clásico: 2 rangos por día en columnas
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
