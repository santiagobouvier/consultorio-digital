import { useQuery } from "@tanstack/react-query";
import { format, startOfWeek, addDays } from "date-fns";
import { supabase } from "@/integrations/supabase/client";

/** Un cupo libre que la reserva online está ofreciendo. */
export interface FreeSlot {
  day: string; // yyyy-MM-dd
  start: string; // HH:mm
  end: string; // HH:mm
  /** Se liberó por una cancelación de hoy → oportunidad de rellenarlo. */
  freed?: boolean;
}

/** Duración del cupo: "cada sesión dura X" de la semana tipo activa. */
const fetchSlotDuration = async (businessId: string): Promise<number> => {
  const { data } = await (supabase as any)
    .from("availability_templates")
    .select("slot_duration_minutes")
    .eq("business_id", businessId)
    .eq("is_active", true)
    .limit(1)
    .maybeSingle();
  return data?.slot_duration_minutes || 60;
};

const fetchFreeSlots = async (businessId: string, from: string, to: string): Promise<FreeSlot[]> => {
  const dur = await fetchSlotDuration(businessId);
  const { data, error } = await (supabase as any).rpc("get_available_starts", {
    p_business_id: businessId,
    p_professional_user_id: null,
    p_duration_minutes: dur,
    p_from: from,
    p_to: to,
    p_public: false,
  });
  if (error) throw error;
  return (data ?? []).map((r: any) => ({
    day: String(r.day),
    start: String(r.start_time).slice(0, 5),
    end: String(r.end_time).slice(0, 5),
  }));
};

/**
 * Cupos libres del día que se está mirando. El prefijo "appointments" en la
 * key hace que la invalidación central de citas también refresque los cupos.
 */
export const useDayFreeSlots = (businessId: string | null, date: Date, enabled = true) => {
  const dayStr = format(date, "yyyy-MM-dd");
  return useQuery({
    queryKey: ["appointments", businessId, "free-slots", dayStr],
    enabled: !!businessId && enabled,
    staleTime: 60_000,
    queryFn: () => fetchFreeSlots(businessId!, dayStr, dayStr),
  });
};

export interface WeekSlotSummary {
  free: number;
  booked: number;
}

/**
 * Resumen de control de la semana del día visible: cuántos cupos siguen
 * libres (desde hoy) y cuántas sesiones ya hay reservadas.
 */
export const useWeekSlotSummary = (businessId: string | null, date: Date, enabled = true) => {
  const weekStart = startOfWeek(date, { weekStartsOn: 1 });
  const from = format(weekStart, "yyyy-MM-dd");
  const to = format(addDays(weekStart, 6), "yyyy-MM-dd");
  return useQuery({
    queryKey: ["appointments", businessId, "free-week", from],
    enabled: !!businessId && enabled,
    staleTime: 120_000,
    queryFn: async (): Promise<WeekSlotSummary> => {
      const [slots, bookedRes] = await Promise.all([
        fetchFreeSlots(businessId!, from, to),
        supabase
          .from("appointments")
          .select("*", { count: "exact", head: true })
          .eq("business_id", businessId!)
          .gte("start_at", weekStart.toISOString())
          .lt("start_at", addDays(weekStart, 7).toISOString())
          .not("status", "in", '("cancelled","cancelled_by_patient","no_show")'),
      ]);
      return { free: slots.length, booked: bookedRes.count || 0 };
    },
  });
};
