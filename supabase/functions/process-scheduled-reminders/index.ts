// Processes scheduled_reminders rows that are due and should auto-send.
// Routes by channel: "email" via send-resend-email, "whatsapp" via send-whatsapp.
// Triggered every 5 minutes via pg_cron.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE);
  const startedAt = new Date().toISOString();
  const summary = { processed: 0, sent: 0, failed: 0, skipped: 0 };

  try {
    // Fetch due, scheduled, auto-send reminders (email + whatsapp). Limit batch to be safe.
    const { data: due, error } = await supabase
      .from("scheduled_reminders")
      .select(`
        id, business_id, patient_id, appointment_id, scheduled_for, message, channel, status, auto_send,
        patients!fk_patient ( email, full_name, whatsapp_phone )
      `)
      .eq("status", "scheduled")
      .in("channel", ["email", "whatsapp"])
      .eq("auto_send", true)
      .lte("scheduled_for", new Date().toISOString())
      .limit(50);

    if (error) throw error;

    summary.processed = due?.length || 0;

    for (const r of due || []) {
      const patient = (r as any).patients as
        | { email: string | null; full_name: string | null; whatsapp_phone: string | null }
        | null;
      const channel = (r as any).channel as string;
      const recipient = channel === "whatsapp" ? patient?.whatsapp_phone : patient?.email;

      if (!recipient) {
        await supabase
          .from("scheduled_reminders")
          .update({ status: "failed" })
          .eq("id", r.id);
        summary.skipped++;
        continue;
      }

      try {
        // Mark as sending to avoid double send if cron overlaps
        await supabase
          .from("scheduled_reminders")
          .update({ status: "sending" as any })
          .eq("id", r.id)
          .eq("status", "scheduled");

        const resp = channel === "whatsapp"
          ? await fetch(`${SUPABASE_URL}/functions/v1/send-whatsapp`, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${SERVICE_ROLE}`,
              },
              body: JSON.stringify({ to: recipient, message: r.message }),
            })
          : await fetch(`${SUPABASE_URL}/functions/v1/send-resend-email`, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${SERVICE_ROLE}`,
              },
              body: JSON.stringify({
                to: recipient,
                template: "appointment_reminder",
                businessId: r.business_id,
                data: {
                  patientName: patient?.full_name || "",
                  message: r.message,
                },
              }),
            });

        if (resp.status === 503 && channel === "whatsapp") {
          // Twilio not configured yet → leave it scheduled and retry next run.
          await supabase
            .from("scheduled_reminders")
            .update({ status: "scheduled" })
            .eq("id", r.id);
          summary.skipped++;
          continue;
        }

        if (!resp.ok) {
          const errBody = await resp.text();
          console.error(`Reminder ${r.id} (${channel}) send failed:`, resp.status, errBody);
          await supabase
            .from("scheduled_reminders")
            .update({ status: "failed" })
            .eq("id", r.id);
          summary.failed++;
        } else {
          await supabase
            .from("scheduled_reminders")
            .update({ status: "sent" })
            .eq("id", r.id);
          summary.sent++;
        }
      } catch (e) {
        console.error(`Reminder ${r.id} error:`, e);
        await supabase
          .from("scheduled_reminders")
          .update({ status: "failed" })
          .eq("id", r.id);
        summary.failed++;
      }
    }

    return new Response(JSON.stringify({ ok: true, startedAt, ...summary }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("process-scheduled-reminders error:", e);
    return new Response(JSON.stringify({ ok: false, error: String(e), ...summary }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
