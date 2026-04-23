import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useBusinessId } from "@/hooks/use-business-id";

/**
 * Returns the count of pending appointment_requests for the active business.
 * Auto-refreshes via Supabase Realtime when new requests arrive or status changes.
 */
export const usePendingRequestsCount = () => {
  const [count, setCount] = useState(0);
  const { businessId } = useBusinessId(false);

  useEffect(() => {
    if (!businessId) {
      setCount(0);
      return;
    }
    let cancelled = false;

    const fetchCount = async () => {
      const { count: c } = await supabase
        .from("appointment_requests")
        .select("id", { count: "exact", head: true })
        .eq("business_id", businessId)
        .eq("status", "pending");
      if (!cancelled) setCount(c ?? 0);
    };

    fetchCount();

    return () => {
      cancelled = true;
    };
  }, [businessId]);

  useEffect(() => {
    if (!businessId) return;

    const channel = supabase
      .channel(`appointment-requests-${businessId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "appointment_requests",
          filter: `business_id=eq.${businessId}`,
        },
        async () => {
          const { count: c } = await supabase
            .from("appointment_requests")
            .select("id", { count: "exact", head: true })
            .eq("business_id", businessId)
            .eq("status", "pending");
          setCount(c ?? 0);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [businessId]);

  return count;
};
