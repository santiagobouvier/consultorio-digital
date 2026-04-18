import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

/**
 * Returns the count of pending appointment_requests for the current clinic user.
 * Auto-refreshes via Supabase Realtime when new requests arrive or status changes.
 */
export const usePendingRequestsCount = () => {
  const [count, setCount] = useState(0);
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || cancelled) return;
      setUserId(user.id);
      await fetchCount(user.id);
    };

    const fetchCount = async (uid: string) => {
      const { count: c } = await supabase
        .from("appointment_requests")
        .select("id", { count: "exact", head: true })
        .eq("clinic_user_id", uid)
        .eq("status", "pending");
      if (!cancelled) setCount(c ?? 0);
    };

    init();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!userId) return;

    const channel = supabase
      .channel(`appointment-requests-${userId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "appointment_requests",
          filter: `clinic_user_id=eq.${userId}`,
        },
        async () => {
          const { count: c } = await supabase
            .from("appointment_requests")
            .select("id", { count: "exact", head: true })
            .eq("clinic_user_id", userId)
            .eq("status", "pending");
          setCount(c ?? 0);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId]);

  return count;
};
