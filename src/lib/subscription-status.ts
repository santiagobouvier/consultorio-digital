export type SubscriptionStatus = "trial" | "active" | "past_due" | "cancelled" | "expired" | "none" | "pending";

export interface SubscriptionStatusRecord {
  status: string | null;
  trial_ends_at?: string | null;
  current_period_end?: string | null;
  created_at?: string | null;
}

const resolveSingleSubscriptionStatus = (
  subscription: SubscriptionStatusRecord | null | undefined,
): SubscriptionStatus => {
  if (!subscription?.status) return "none";

  if (subscription.status === "active") return "active";
  if (subscription.status === "trial") return hasActiveTrial(subscription) ? "trial" : "expired";

  if (
    subscription.status === "pending"
    || subscription.status === "past_due"
    || subscription.status === "cancelled"
    || subscription.status === "expired"
  ) {
    return subscription.status;
  }

  return "none";
};

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
  subscriptions: SubscriptionStatusRecord[] | SubscriptionStatusRecord | null | undefined,
): SubscriptionStatus => {
  if (!Array.isArray(subscriptions)) {
    return resolveSingleSubscriptionStatus(subscriptions);
  }

  const list = (subscriptions ?? []).filter(Boolean);
  if (!list.length) return "none";

  const now = new Date();
  const latest = list[0];

  if (latest.status === "active") return "active";
  if (latest.status === "trial") return hasActiveTrial(latest, now) ? "trial" : "expired";

  if (latest.status === "pending") {
    const fallback = list.slice(1).find((subscription) => subscription.status === "active");

    if (fallback?.status === "active") return "active";
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