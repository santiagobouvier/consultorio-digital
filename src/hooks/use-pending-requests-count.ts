import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useBusinessId } from "@/hooks/use-business-id";

// Clave compartida: cualquier pantalla que resuelva una solicitud puede
// invalidarla para que el badge del sidebar se actualice al instante.
export const PENDING_REQUESTS_COUNT_KEY = "pending-requests-count";

/**
 * Returns the sum of pending items for the active business:
 *  - appointment_requests with status='pending' (public booking flow)
 *  - appointments with status='pending' and source='patient_portal' (registered patient bookings)
 *  - appointment_reschedule_requests with status='pending' whose original
 *    appointment still exists (mismo criterio que la página de Solicitudes,
 *    que descarta reprogramaciones huérfanas)
 * Auto-refreshes via Supabase Realtime on the three tables, and instantly
 * when a screen invalidates PENDING_REQUESTS_COUNT_KEY after resolving one.
 */
const fetchCounts = async (id: string) => {
  const [{ count: reqCount }, { count: aptCount }, { count: rescheduleCount }] = await Promise.all([
    supabase
      .from("appointment_requests")
      .select("id", { count: "exact", head: true })
      .eq("business_id", id)
      .eq("status", "pending"),
    supabase
      .from("appointments")
      .select("id", { count: "exact", head: true })
      .eq("business_id", id)
      .eq("status", "pending")
      .eq("source", "patient_portal"),
    supabase
      .from("appointment_reschedule_requests")
      .select("id, appointments:original_appointment_id!inner(id)", { count: "exact", head: true })
      .eq("business_id", id)
      .eq("status", "pending"),
  ]);
  return (reqCount ?? 0) + (aptCount ?? 0) + (rescheduleCount ?? 0);
};

export const usePendingRequestsCount = () => {
  const { businessId } = useBusinessId(false);
  const queryClient = useQueryClient();

  const { data: count = 0 } = useQuery({
    queryKey: [PENDING_REQUESTS_COUNT_KEY, businessId],
    queryFn: () => fetchCounts(businessId!),
    enabled: !!businessId,
    staleTime: 15_000,
    refetchOnWindowFocus: true,
  });

  useEffect(() => {
    if (!businessId) return;

    const refresh = () =>
      queryClient.invalidateQueries({ queryKey: [PENDING_REQUESTS_COUNT_KEY, businessId] });

    const channel = supabase
      .channel(`pending-items-${businessId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "appointment_requests", filter: `business_id=eq.${businessId}` },
        refresh
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "appointments", filter: `business_id=eq.${businessId}` },
        refresh
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "appointment_reschedule_requests", filter: `business_id=eq.${businessId}` },
        refresh
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [businessId, queryClient]);

  return count;
};
