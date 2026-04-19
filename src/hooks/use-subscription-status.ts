import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export type SubscriptionStatus = "trial" | "active" | "past_due" | "cancelled" | "expired" | "none";

interface UseSubscriptionStatusResult {
  status: SubscriptionStatus;
  loading: boolean;
  trialDaysLeft: number | null;
  isSuperAdmin: boolean;
}

export const useSubscriptionStatus = (businessId: string | null): UseSubscriptionStatusResult => {
  const { user, isSuperAdmin, isReady: authReady } = useAuth();
  const [status, setStatus] = useState<SubscriptionStatus>("none");
  const [loading, setLoading] = useState(true);
  const [trialDaysLeft, setTrialDaysLeft] = useState<number | null>(null);

  useEffect(() => {
    if (!authReady) return;
    let cancelled = false;

    const check = async () => {
      try {
        if (!user) {
          setLoading(false);
          return;
        }

        if (isSuperAdmin) {
          setStatus("active");
          setLoading(false);
          return;
        }

        if (!businessId) {
          setStatus("none");
          setLoading(false);
          return;
        }

        const { data: business } = await supabase
          .from("businesses")
          .select("is_demo")
          .eq("id", businessId)
          .maybeSingle();

        if (cancelled) return;

        if (business?.is_demo) {
          setStatus("active");
          setLoading(false);
          return;
        }

        const { data: sub } = await supabase
          .from("subscriptions")
          .select("*")
          .eq("business_id", businessId)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (cancelled) return;

        if (!sub) {
          setStatus("none");
          setLoading(false);
          return;
        }

        const now = new Date();

        if (sub.status === "trial" && sub.trial_ends_at) {
          const trialEnd = new Date(sub.trial_ends_at);
          if (now < trialEnd) {
            const daysLeft = Math.ceil((trialEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
            setTrialDaysLeft(daysLeft);
            setStatus("trial");
          } else {
            setStatus("expired");
          }
        } else {
          setStatus(sub.status as SubscriptionStatus);
        }
      } catch (err) {
        console.error("Error checking subscription:", err);
        if (!cancelled) setStatus("none");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    check();
    return () => { cancelled = true; };
  }, [businessId, user, isSuperAdmin, authReady]);

  return { status, loading, trialDaysLeft, isSuperAdmin };
};
