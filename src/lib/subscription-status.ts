export type SubscriptionStatus = "trial" | "active" | "past_due" | "cancelled" | "expired" | "none" | "pending";

export interface SubscriptionStatusRecord {
  status: string | null;
  trial_ends_at?: string | null;
  current_period_end?: string | null;
  created_at?: string | null;
}

// Días de gracia después de current_period_end antes de considerar vencida
// una suscripción "active". Cubre demoras del webhook de Mercado Pago en
// renovaciones legítimas; para cuentas activadas a mano (sin débito), hace
// que el acceso venza de verdad cuando pasa la fecha que puso el admin.
const ACTIVE_GRACE_DAYS = 5;

const isActiveStillValid = (subscription: SubscriptionStatusRecord, now = new Date()) => {
  if (!subscription.current_period_end) return true;
  const graceEnd =
    new Date(subscription.current_period_end).getTime() + ACTIVE_GRACE_DAYS * 24 * 60 * 60 * 1000;
  return graceEnd > now.getTime();
};

const resolveSingleSubscriptionStatus = (
  subscription: SubscriptionStatusRecord | null | undefined,
): SubscriptionStatus => {
  if (!subscription?.status) return "none";

  if (subscription.status === "active") {
    return isActiveStillValid(subscription) ? "active" : "expired";
  }
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

  if (latest.status === "active") return isActiveStillValid(latest, now) ? "active" : "expired";
  if (latest.status === "trial") return hasActiveTrial(latest, now) ? "trial" : "expired";

  if (latest.status === "pending") {
    const fallback = list.slice(1).find(
      (subscription) => subscription.status === "active" && isActiveStillValid(subscription, now),
    );

    if (fallback) return "active";
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