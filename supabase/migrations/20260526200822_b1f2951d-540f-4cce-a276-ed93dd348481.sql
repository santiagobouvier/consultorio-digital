-- Step 7/7: Refactor get_available_slots to use owned_by_user_id + coordination_mode
CREATE OR REPLACE FUNCTION public.get_available_slots(
  p_business_id uuid,
  p_professional_id uuid,
  p_date_from date,
  p_date_to date,
  p_service_duration_minutes integer DEFAULT NULL::integer
)
RETURNS TABLE(
  slot_date date,
  slot_start_at timestamp with time zone,
  slot_end_at timestamp with time zone,
  available_space_ids uuid[],
  total_capacity integer,
  professional_id uuid
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
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
  v_mode text;
BEGIN
  SELECT timezone INTO v_tz FROM public.businesses WHERE id = p_business_id;
  IF v_tz IS NULL THEN v_tz := 'America/Montevideo'; END IF;

  v_mode := public.get_user_coordination_mode(p_professional_id, p_business_id);
  IF v_mode IS NULL THEN v_mode := 'shared'; END IF;

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
          WHERE s.business_id = p_business_id
            AND s.is_active = true
            AND (
              (v_mode = 'shared'      AND s.owned_by_user_id IS NULL)
              OR
              (v_mode = 'independent' AND s.owned_by_user_id = p_professional_id)
            )
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
$function$;