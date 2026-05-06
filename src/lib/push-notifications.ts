import { supabase } from "@/integrations/supabase/client";

/**
 * Fire-and-forget push notification to a user.
 * Silently catches errors so it never breaks the calling flow.
 */
export async function sendPushNotification(params: {
  user_id: string;
  title: string;
  body: string;
  url?: string;
}) {
  try {
    await supabase.functions.invoke("send-push-notification", {
      body: params,
    });
  } catch (err) {
    console.warn("[push] Failed to send notification:", err);
  }
}

/**
 * Send a push notification to a patient by their patient record id.
 * Looks up auth_user_id first; skips silently if patient has no linked auth user.
 */
export async function notifyPatient(params: {
  patientId: string;
  title: string;
  body: string;
  url?: string;
}) {
  try {
    const { data } = await supabase
      .from("patients")
      .select("auth_user_id")
      .eq("id", params.patientId)
      .maybeSingle();

    if (!data?.auth_user_id) return;

    await sendPushNotification({
      user_id: data.auth_user_id,
      title: params.title,
      body: params.body,
      url: params.url,
    });
  } catch (err) {
    console.warn("[push] Failed to notify patient:", err);
  }
}

/**
 * Send a push notification to the business owner.
 */
export async function notifyBusinessOwner(params: {
  businessId: string;
  title: string;
  body: string;
  url?: string;
}) {
  try {
    const { data } = await supabase
      .from("businesses")
      .select("owner_user_id")
      .eq("id", params.businessId)
      .maybeSingle();

    if (!data?.owner_user_id) return;

    await sendPushNotification({
      user_id: data.owner_user_id,
      title: params.title,
      body: params.body,
      url: params.url,
    });
  } catch (err) {
    console.warn("[push] Failed to notify business owner:", err);
  }
}