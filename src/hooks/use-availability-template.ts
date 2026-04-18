import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export type DayKey = "monday" | "tuesday" | "wednesday" | "thursday" | "friday" | "saturday" | "sunday";

export const DAY_LABELS: Record<DayKey, string> = {
  monday: "Lunes",
  tuesday: "Martes",
  wednesday: "Miércoles",
  thursday: "Jueves",
  friday: "Viernes",
  saturday: "Sábado",
  sunday: "Domingo",
};

export const DAY_KEYS: DayKey[] = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"];

export interface DayConfig {
  enabled: boolean;
  start1: string | null;
  end1: string | null;
  start2: string | null;
  end2: string | null;
}

export interface AvailabilityTemplate {
  id: string | null;
  business_id: string;
  professional_user_id: string;
  name: string;
  is_active: boolean;
  slot_duration_minutes: number;
  modality: string;
  default_price: number | null;
  days: Record<DayKey, DayConfig>;
}

const emptyDay = (): DayConfig => ({
  enabled: false,
  start1: null,
  end1: null,
  start2: null,
  end2: null,
});

const buildEmptyTemplate = (businessId: string, professionalUserId: string): AvailabilityTemplate => ({
  id: null,
  business_id: businessId,
  professional_user_id: professionalUserId,
  name: "Mi semana tipo",
  is_active: true,
  slot_duration_minutes: 60,
  modality: "Online",
  default_price: null,
  days: DAY_KEYS.reduce((acc, k) => ({ ...acc, [k]: emptyDay() }), {} as Record<DayKey, DayConfig>),
});

const rowToTemplate = (row: any): AvailabilityTemplate => ({
  id: row.id,
  business_id: row.business_id,
  professional_user_id: row.professional_user_id,
  name: row.name,
  is_active: row.is_active,
  slot_duration_minutes: row.slot_duration_minutes,
  modality: row.modality,
  default_price: row.default_price,
  days: {
    monday: { enabled: row.monday_enabled, start1: row.monday_start_1, end1: row.monday_end_1, start2: row.monday_start_2, end2: row.monday_end_2 },
    tuesday: { enabled: row.tuesday_enabled, start1: row.tuesday_start_1, end1: row.tuesday_end_1, start2: row.tuesday_start_2, end2: row.tuesday_end_2 },
    wednesday: { enabled: row.wednesday_enabled, start1: row.wednesday_start_1, end1: row.wednesday_end_1, start2: row.wednesday_start_2, end2: row.wednesday_end_2 },
    thursday: { enabled: row.thursday_enabled, start1: row.thursday_start_1, end1: row.thursday_end_1, start2: row.thursday_start_2, end2: row.thursday_end_2 },
    friday: { enabled: row.friday_enabled, start1: row.friday_start_1, end1: row.friday_end_1, start2: row.friday_start_2, end2: row.friday_end_2 },
    saturday: { enabled: row.saturday_enabled, start1: row.saturday_start_1, end1: row.saturday_end_1, start2: row.saturday_start_2, end2: row.saturday_end_2 },
    sunday: { enabled: row.sunday_enabled, start1: row.sunday_start_1, end1: row.sunday_end_1, start2: row.sunday_start_2, end2: row.sunday_end_2 },
  },
});

const templateToRow = (t: AvailabilityTemplate): any => ({
  business_id: t.business_id,
  professional_user_id: t.professional_user_id,
  name: t.name,
  is_active: t.is_active,
  slot_duration_minutes: t.slot_duration_minutes,
  modality: t.modality,
  default_price: t.default_price,
  monday_enabled: t.days.monday.enabled,
  monday_start_1: t.days.monday.start1, monday_end_1: t.days.monday.end1,
  monday_start_2: t.days.monday.start2, monday_end_2: t.days.monday.end2,
  tuesday_enabled: t.days.tuesday.enabled,
  tuesday_start_1: t.days.tuesday.start1, tuesday_end_1: t.days.tuesday.end1,
  tuesday_start_2: t.days.tuesday.start2, tuesday_end_2: t.days.tuesday.end2,
  wednesday_enabled: t.days.wednesday.enabled,
  wednesday_start_1: t.days.wednesday.start1, wednesday_end_1: t.days.wednesday.end1,
  wednesday_start_2: t.days.wednesday.start2, wednesday_end_2: t.days.wednesday.end2,
  thursday_enabled: t.days.thursday.enabled,
  thursday_start_1: t.days.thursday.start1, thursday_end_1: t.days.thursday.end1,
  thursday_start_2: t.days.thursday.start2, thursday_end_2: t.days.thursday.end2,
  friday_enabled: t.days.friday.enabled,
  friday_start_1: t.days.friday.start1, friday_end_1: t.days.friday.end1,
  friday_start_2: t.days.friday.start2, friday_end_2: t.days.friday.end2,
  saturday_enabled: t.days.saturday.enabled,
  saturday_start_1: t.days.saturday.start1, saturday_end_1: t.days.saturday.end1,
  saturday_start_2: t.days.saturday.start2, saturday_end_2: t.days.saturday.end2,
  sunday_enabled: t.days.sunday.enabled,
  sunday_start_1: t.days.sunday.start1, sunday_end_1: t.days.sunday.end1,
  sunday_start_2: t.days.sunday.start2, sunday_end_2: t.days.sunday.end2,
});

export const useAvailabilityTemplate = (businessId: string | null, professionalUserId: string | null) => {
  const [template, setTemplate] = useState<AvailabilityTemplate | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!businessId || !professionalUserId) return;
    setLoading(true);
    try {
      const { data, error } = await (supabase as any)
        .from("availability_templates")
        .select("*")
        .eq("business_id", businessId)
        .eq("professional_user_id", professionalUserId)
        .maybeSingle();
      if (error) throw error;
      setTemplate(data ? rowToTemplate(data) : buildEmptyTemplate(businessId, professionalUserId));
    } catch (e) {
      console.error("Error loading template:", e);
      setTemplate(buildEmptyTemplate(businessId, professionalUserId));
    } finally {
      setLoading(false);
    }
  }, [businessId, professionalUserId]);

  useEffect(() => {
    load();
  }, [load]);

  const save = useCallback(async (t: AvailabilityTemplate): Promise<AvailabilityTemplate | null> => {
    const row = templateToRow(t);
    if (t.id) {
      const { data, error } = await (supabase as any)
        .from("availability_templates")
        .update(row)
        .eq("id", t.id)
        .select()
        .single();
      if (error) throw error;
      const saved = rowToTemplate(data);
      setTemplate(saved);
      return saved;
    } else {
      const { data, error } = await (supabase as any)
        .from("availability_templates")
        .insert(row)
        .select()
        .single();
      if (error) throw error;
      const saved = rowToTemplate(data);
      setTemplate(saved);
      return saved;
    }
  }, []);

  return { template, setTemplate, loading, save, reload: load };
};
