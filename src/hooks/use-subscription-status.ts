import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

export type SubscriptionStatus = "trial" | "active" | "past_due" | "cancelled" | "expired" | "none";

interface UseSubscriptionStatusResult {
  status: SubscriptionStatus;
  loading: boolean;
  trialDaysLeft: number | null;
  isSuperAdmin: boolean;
}

export const useSubscriptionStatus = (businessId: string | null): UseSubscriptionStatusResult => {
  const [status, setStatus] = useState<SubscriptionStatus>("none");
  const [loading, setLoading] = useState(true);
  const [trialDaysLeft, setTrialDaysLeft] = useState<number | null>(null);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const check = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (cancelled) return;
        if (!user) { setLoading(false); return; }

        // Super admins bypass subscription checks — check FIRST,
        // even if businessId is null (super admin may not own a business)
        const { data: adminRole } = await supabase
          .from("user_roles")
          .select("id")
          .eq("user_id", user.id)
          .eq("role", "super_admin")
          .maybeSingle();
        if (cancelled) return;

        if (adminRole) {
          setIsSuperAdmin(true);
          setStatus("active");
          setLoading(false);
          return;
        }

        // No super admin AND no business → nothing to check (onboarding)
        if (!businessId) {
          setStatus("none");
          setLoading(false);
          return;
        }

        // Check if business is a demo
        const { data: business } = await supabase
          .from("businesses")
          .select("is_demo")
          .eq("id", businessId)
          .maybeSingle();

        if (business?.is_demo) {
          setStatus("active");
          setLoading(false);
          return;
        }

        // Get latest subscription
        const { data: sub } = await supabase
          .from("subscriptions")
          .select("*")
          .eq("business_id", businessId)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (!sub) {
          setStatus("none");
          setLoading(false);
          return;
        }

        const now = new Date();

        // Check trial
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
  }, [businessId]);

  return { status, loading, trialDaysLeft, isSuperAdmin };
};
