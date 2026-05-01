export type SubscriptionStatus = "trial" | "active" | "past_due" | "cancelled" | "expired" | "none" | "pending";

export interface SubscriptionStatusRecord {
  status: string | null;
  trial_ends_at?: string | null;
  current_period_end?: string | null;
  created_at?: string | null;
}

export const hasActiveTrial = (
  subscription: SubscriptionStatusRecord | null | undefined,
  now = new Date(),
) => {
  if (!subscription || subscription.status !== "trial" || !subscription.trial_ends_at) {
    return false;
  }

  return new Date(subscription.trial_ends_at).getTime() > now.getTime();
};

export const resolveSubscriptionStatus = (
  subscriptions: SubscriptionStatusRecord[] | null | undefined,
): SubscriptionStatus => {
  const list = (subscriptions ?? []).filter(Boolean);
  if (!list.length) return "none";

  const now = new Date();
  const latest = list[0];

  if (latest.status === "active") return "active";
  if (latest.status === "trial") return hasActiveTrial(latest, now) ? "trial" : "expired";

  if (latest.status === "pending") {
    const fallback = list.slice(1).find((subscription) => {
      return subscription.status === "active" || hasActiveTrial(subscription, now);
    });

    if (fallback?.status === "active") return "active";
    if (fallback && hasActiveTrial(fallback, now)) return "trial";
    return "pending";
  }

  if (
    latest.status === "past_due"
    || latest.status === "cancelled"
    || latest.status === "expired"
  ) {
    return latest.status;
  }

  return "none";
};

export const isSubscriptionAccessible = (status: SubscriptionStatus) => {
  return status === "active" || status === "trial";
};