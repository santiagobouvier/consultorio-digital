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