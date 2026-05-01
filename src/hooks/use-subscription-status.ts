import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import {
  hasActiveTrial,
  resolveSubscriptionStatus,
  type SubscriptionStatus,
} from "@/lib/subscription-status";

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

        const { data: subscriptions } = await supabase
          .from("subscriptions")
          .select("status, trial_ends_at, current_period_end, created_at")
          .eq("business_id", businessId)
          .order("created_at", { ascending: false })
          .limit(5);

        if (cancelled) return;

        const resolvedStatus = resolveSubscriptionStatus(subscriptions);

        if (resolvedStatus === "none") {
          setTrialDaysLeft(null);
          setStatus("none");
          setLoading(false);
          return;
        }

        const activeTrial = subscriptions?.find((subscription) => hasActiveTrial(subscription));

        if (resolvedStatus === "trial" && activeTrial?.trial_ends_at) {
          const now = new Date();
          const trialEnd = new Date(activeTrial.trial_ends_at);
          const daysLeft = Math.ceil((trialEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
          setTrialDaysLeft(daysLeft);
        } else {
          setTrialDaysLeft(null);
        }

        setStatus(resolvedStatus);
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
