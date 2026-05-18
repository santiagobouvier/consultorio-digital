WITH days AS (
  SELECT * FROM (VALUES
    (1, 'monday'), (2, 'tuesday'), (3, 'wednesday'), (4, 'thursday'),
    (5, 'friday'), (6, 'saturday'), (0, 'sunday')
  ) AS d(dow, dname)
),
expanded AS (
  -- Rango 1
  SELECT t.business_id, t.professional_user_id AS prof_id, 1 AS dow, t.monday_start_1 AS st, t.monday_end_1 AS et, t.slot_duration_minutes AS dur
    FROM availability_templates t WHERE t.is_active AND t.monday_enabled AND t.monday_start_1 IS NOT NULL AND t.monday_end_1 IS NOT NULL
  UNION ALL
  SELECT t.business_id, t.professional_user_id, 1, t.monday_start_2, t.monday_end_2, t.slot_duration_minutes
    FROM availability_templates t WHERE t.is_active AND t.monday_enabled AND t.monday_start_2 IS NOT NULL AND t.monday_end_2 IS NOT NULL
  UNION ALL
  SELECT t.business_id, t.professional_user_id, 2, t.tuesday_start_1, t.tuesday_end_1, t.slot_duration_minutes
    FROM availability_templates t WHERE t.is_active AND t.tuesday_enabled AND t.tuesday_start_1 IS NOT NULL AND t.tuesday_end_1 IS NOT NULL
  UNION ALL
  SELECT t.business_id, t.professional_user_id, 2, t.tuesday_start_2, t.tuesday_end_2, t.slot_duration_minutes
    FROM availability_templates t WHERE t.is_active AND t.tuesday_enabled AND t.tuesday_start_2 IS NOT NULL AND t.tuesday_end_2 IS NOT NULL
  UNION ALL
  SELECT t.business_id, t.professional_user_id, 3, t.wednesday_start_1, t.wednesday_end_1, t.slot_duration_minutes
    FROM availability_templates t WHERE t.is_active AND t.wednesday_enabled AND t.wednesday_start_1 IS NOT NULL AND t.wednesday_end_1 IS NOT NULL
  UNION ALL
  SELECT t.business_id, t.professional_user_id, 3, t.wednesday_start_2, t.wednesday_end_2, t.slot_duration_minutes
    FROM availability_templates t WHERE t.is_active AND t.wednesday_enabled AND t.wednesday_start_2 IS NOT NULL AND t.wednesday_end_2 IS NOT NULL
  UNION ALL
  SELECT t.business_id, t.professional_user_id, 4, t.thursday_start_1, t.thursday_end_1, t.slot_duration_minutes
    FROM availability_templates t WHERE t.is_active AND t.thursday_enabled AND t.thursday_start_1 IS NOT NULL AND t.thursday_end_1 IS NOT NULL
  UNION ALL
  SELECT t.business_id, t.professional_user_id, 4, t.thursday_start_2, t.thursday_end_2, t.slot_duration_minutes
    FROM availability_templates t WHERE t.is_active AND t.thursday_enabled AND t.thursday_start_2 IS NOT NULL AND t.thursday_end_2 IS NOT NULL
  UNION ALL
  SELECT t.business_id, t.professional_user_id, 5, t.friday_start_1, t.friday_end_1, t.slot_duration_minutes
    FROM availability_templates t WHERE t.is_active AND t.friday_enabled AND t.friday_start_1 IS NOT NULL AND t.friday_end_1 IS NOT NULL
  UNION ALL
  SELECT t.business_id, t.professional_user_id, 5, t.friday_start_2, t.friday_end_2, t.slot_duration_minutes
    FROM availability_templates t WHERE t.is_active AND t.friday_enabled AND t.friday_start_2 IS NOT NULL AND t.friday_end_2 IS NOT NULL
  UNION ALL
  SELECT t.business_id, t.professional_user_id, 6, t.saturday_start_1, t.saturday_end_1, t.slot_duration_minutes
    FROM availability_templates t WHERE t.is_active AND t.saturday_enabled AND t.saturday_start_1 IS NOT NULL AND t.saturday_end_1 IS NOT NULL
  UNION ALL
  SELECT t.business_id, t.professional_user_id, 6, t.saturday_start_2, t.saturday_end_2, t.slot_duration_minutes
    FROM availability_templates t WHERE t.is_active AND t.saturday_enabled AND t.saturday_start_2 IS NOT NULL AND t.saturday_end_2 IS NOT NULL
  UNION ALL
  SELECT t.business_id, t.professional_user_id, 0, t.sunday_start_1, t.sunday_end_1, t.slot_duration_minutes
    FROM availability_templates t WHERE t.is_active AND t.sunday_enabled AND t.sunday_start_1 IS NOT NULL AND t.sunday_end_1 IS NOT NULL
  UNION ALL
  SELECT t.business_id, t.professional_user_id, 0, t.sunday_start_2, t.sunday_end_2, t.slot_duration_minutes
    FROM availability_templates t WHERE t.is_active AND t.sunday_enabled AND t.sunday_start_2 IS NOT NULL AND t.sunday_end_2 IS NOT NULL
)
INSERT INTO public.availability_rules (business_id, professional_id, day_of_week, start_time, end_time, slot_duration_minutes)
SELECT business_id, prof_id, dow, st, et, COALESCE(dur, 60)
FROM expanded
WHERE et > st
  AND NOT EXISTS (
    SELECT 1 FROM public.availability_rules r
    WHERE r.business_id = expanded.business_id
      AND r.professional_id = expanded.prof_id
      AND r.day_of_week = expanded.dow
      AND r.start_time = expanded.st
      AND r.end_time = expanded.et
  );