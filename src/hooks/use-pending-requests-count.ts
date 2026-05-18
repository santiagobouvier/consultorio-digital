import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useBusinessId } from "@/hooks/use-business-id";

/**
 * Returns the sum of pending items for the active business:
 *  - appointment_requests with status='pending' (public booking flow)
 *  - appointments with status='pending' and source='patient_portal' (registered patient bookings)
 * Auto-refreshes via Supabase Realtime on both tables.
 */
export const usePendingRequestsCount = () => {
  const [count, setCount] = useState(0);
  const { businessId } = useBusinessId(false);

  const fetchCounts = async (id: string) => {
    const [{ count: reqCount }, { count: aptCount }] = await Promise.all([
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
    ]);
    return (reqCount ?? 0) + (aptCount ?? 0);
  };

  useEffect(() => {
    if (!businessId) {
      setCount(0);
      return;
    }
    let cancelled = false;

    fetchCounts(businessId).then((c) => {
      if (!cancelled) setCount(c);
    });

    return () => {
      cancelled = true;
    };
  }, [businessId]);

  useEffect(() => {
    if (!businessId) return;

    const refresh = async () => setCount(await fetchCounts(businessId));

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
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [businessId]);

  return count;
};
