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

/** Un bloque horario del día: "HH:MM" – "HH:MM". */
export interface TimeBlock {
  start: string;
  end: string;
}

export interface DayConfig {
  /** Bloques en los que se atiende (pueden ser varios, con huecos libres). */
  blocks: TimeBlock[];
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

export const toMinutes = (hhmm: string): number => {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
};

export const toHHMM = (mins: number): string =>
  `${String(Math.floor(mins / 60)).padStart(2, "0")}:${String(mins % 60).padStart(2, "0")}`;

/** Une bloques solapados o pegados y los devuelve ordenados. */
export const mergeBlocks = (blocks: TimeBlock[]): TimeBlock[] => {
  const sorted = blocks
    .filter((b) => b.start && b.end && toMinutes(b.end) > toMinutes(b.start))
    .slice()
    .sort((a, b) => toMinutes(a.start) - toMinutes(b.start));
  const out: TimeBlock[] = [];
  for (const b of sorted) {
    const last = out[out.length - 1];
    if (last && toMinutes(b.start) <= toMinutes(last.end)) {
      if (toMinutes(b.end) > toMinutes(last.end)) last.end = b.end;
    } else {
      out.push({ ...b });
    }
  }
  return out;
};

const emptyDay = (): DayConfig => ({ blocks: [] });

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

const HHMM_RE = /^\d{2}:\d{2}$/;

/** Normaliza "HH:MM:SS" (formato de columnas time) a "HH:MM". */
const clean = (t: string | null): string | null => {
  if (!t) return null;
  const short = t.slice(0, 5);
  return HHMM_RE.test(short) ? short : null;
};

const dayFromRow = (row: any, key: DayKey): DayConfig => {
  // Camino nuevo: day_blocks jsonb con N bloques por día
  const jb = row.day_blocks?.[key];
  if (Array.isArray(jb)) {
    const blocks: TimeBlock[] = [];
    for (const b of jb) {
      const start = clean(Array.isArray(b) ? b[0] : null);
      const end = clean(Array.isArray(b) ? b[1] : null);
      if (start && end && toMinutes(end) > toMinutes(start)) blocks.push({ start, end });
    }
    return { blocks: mergeBlocks(blocks) };
  }
  // Camino clásico: enabled + 2 rangos en columnas
  if (!row[`${key}_enabled`]) return emptyDay();
  const blocks: TimeBlock[] = [];
  const s1 = clean(row[`${key}_start_1`]);
  const e1 = clean(row[`${key}_end_1`]);
  const s2 = clean(row[`${key}_start_2`]);
  const e2 = clean(row[`${key}_end_2`]);
  if (s1 && e1 && toMinutes(e1) > toMinutes(s1)) blocks.push({ start: s1, end: e1 });
  if (s2 && e2 && toMinutes(e2) > toMinutes(s2)) blocks.push({ start: s2, end: e2 });
  return { blocks: mergeBlocks(blocks) };
};

const rowToTemplate = (row: any): AvailabilityTemplate => ({
  id: row.id,
  business_id: row.business_id,
  professional_user_id: row.professional_user_id,
  name: row.name,
  is_active: row.is_active,
  slot_duration_minutes: row.slot_duration_minutes,
  modality: row.modality,
  default_price: row.default_price,
  days: DAY_KEYS.reduce(
    (acc, k) => ({ ...acc, [k]: dayFromRow(row, k) }),
    {} as Record<DayKey, DayConfig>
  ),
});

const templateToRow = (t: AvailabilityTemplate, includeDayBlocks: boolean): any => {
  const row: any = {
    business_id: t.business_id,
    professional_user_id: t.professional_user_id,
    name: t.name,
    is_active: t.is_active,
    slot_duration_minutes: t.slot_duration_minutes,
    modality: t.modality,
    default_price: t.default_price,
  };
  const dayBlocks: Record<string, [string, string][]> = {};
  for (const key of DAY_KEYS) {
    const merged = mergeBlocks(t.days[key].blocks);
    dayBlocks[key] = merged.map((b) => [b.start, b.end]);
    // Columnas clásicas: los primeros 2 bloques (compatibilidad con bases
    // donde la migración de day_blocks todavía no corrió).
    row[`${key}_enabled`] = merged.length > 0;
    row[`${key}_start_1`] = merged[0]?.start ?? null;
    row[`${key}_end_1`] = merged[0]?.end ?? null;
    row[`${key}_start_2`] = merged[1]?.start ?? null;
    row[`${key}_end_2`] = merged[1]?.end ?? null;
  }
  if (includeDayBlocks) row.day_blocks = dayBlocks;
  return row;
};

/** ¿Algún día tiene más de 2 bloques? (la base vieja solo guarda 2) */
export const hasLooseBlocks = (t: AvailabilityTemplate): boolean =>
  DAY_KEYS.some((k) => mergeBlocks(t.days[k].blocks).length > 2);

const isMissingColumn = (e: any): boolean => {
  const msg = `${e?.message ?? ""} ${e?.code ?? ""}`;
  return msg.includes("day_blocks") || e?.code === "42703" || e?.code === "PGRST204";
};

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

  const persist = useCallback(async (t: AvailabilityTemplate, includeDayBlocks: boolean) => {
    const row = templateToRow(t, includeDayBlocks);
    if (t.id) {
      const { data, error } = await (supabase as any)
        .from("availability_templates")
        .update(row)
        .eq("id", t.id)
        .select()
        .single();
      if (error) throw error;
      return data;
    }
    const { data, error } = await (supabase as any)
      .from("availability_templates")
      .insert(row)
      .select()
      .single();
    if (error) throw error;
    return data;
  }, []);

  const save = useCallback(async (t: AvailabilityTemplate): Promise<AvailabilityTemplate | null> => {
    let data: any;
    try {
      data = await persist(t, true);
    } catch (e: any) {
      // Base sin la columna day_blocks (migración pendiente): guardar en el
      // formato clásico igual — se pierden solo los bloques 3+ de cada día.
      if (!isMissingColumn(e)) throw e;
      data = await persist(t, false);
    }
    const saved = rowToTemplate(data);
    setTemplate(saved);
    return saved;
  }, [persist]);

  return { template, setTemplate, loading, save, reload: load };
};
