// Processes scheduled_reminders rows that are due and should auto-send.
// Canales: email (Resend) y whatsapp (Cloud API de Meta con la plantilla
// aprobada "recordatorio_cita"). Triggered every 5 minutes via pg_cron.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const WHATSAPP_TEMPLATE = "recordatorio_cita";
const WHATSAPP_LANG = "es";

interface BusinessContext {
  profName: string;
  contactPhone: string | null;
  timezone: string;
}

function firstName(full: string | null | undefined): string {
  return (full || "").trim().split(/\s+/)[0] || "Paciente";
}

// "098543623" -> "+598 98543623" (legible y tocable dentro de WhatsApp)
function displayPhone(raw: string): string {
  const cleaned = raw.replace(/\D/g, "");
  let normalized = cleaned;
  if (cleaned.startsWith("0")) normalized = "598" + cleaned.slice(1);
  else if (!cleaned.startsWith("598") && cleaned.length <= 9) normalized = "598" + cleaned;
  if (normalized.startsWith("598")) return `+598 ${normalized.slice(3)}`;
  return `+${normalized}`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE);
  const startedAt = new Date().toISOString();
  const summary = { processed: 0, sent: 0, failed: 0, skipped: 0 };

  try {
    // Fetch due, scheduled, auto-send reminders (limit batch to be safe)
    const { data: due, error } = await supabase
      .from("scheduled_reminders")
      .select(`
        id, business_id, patient_id, appointment_id, scheduled_for, message, channel, status, auto_send,
        patients!fk_patient ( email, full_name, whatsapp_phone ),
        appointments ( start_at )
      `)
      .eq("status", "scheduled")
      .in("channel", ["email", "whatsapp"])
      .eq("auto_send", true)
      .lte("scheduled_for", new Date().toISOString())
      .limit(50);

    if (error) throw error;

    summary.processed = due?.length || 0;

    // Contexto por negocio (solo para los whatsapp): nombre visible del
    // consultorio y número de contacto del profesional.
    const bizContext = new Map<string, BusinessContext>();
    const waRows = (due || []).filter((r) => r.channel === "whatsapp");
    if (waRows.length > 0) {
      const bizIds = [...new Set(waRows.map((r) => r.business_id))];
      const { data: businesses } = await supabase
        .from("businesses")
        .select("id, name, portal_clinic_display_name, dashboard_display_name, timezone, owner_user_id")
        .in("id", bizIds);
      const ownerIds = (businesses || []).map((b) => b.owner_user_id);
      const { data: settings } = ownerIds.length
        ? await supabase
            .from("clinic_settings")
            .select("user_id, whatsapp_contact_phone")
            .in("user_id", ownerIds)
        : { data: [] as { user_id: string; whatsapp_contact_phone: string | null }[] };
      const contactByOwner = new Map(
        (settings || []).map((s) => [s.user_id, s.whatsapp_contact_phone]),
      );
      for (const b of businesses || []) {
        bizContext.set(b.id, {
          profName: b.portal_clinic_display_name || b.dashboard_display_name || b.name,
          contactPhone: contactByOwner.get(b.owner_user_id) ?? null,
          timezone: b.timezone || "America/Montevideo",
        });
      }
    }

    for (const r of due || []) {
      const patient = (r as any).patients as {
        email: string | null;
        full_name: string | null;
        whatsapp_phone: string | null;
      } | null;

      const markFailed = async () => {
        await supabase
          .from("scheduled_reminders")
          .update({ status: "failed" })
          .eq("id", r.id);
      };

      if (r.channel === "email") {
        const recipient = patient?.email;
        if (!recipient) {
          await markFailed();
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

          const resp = await fetch(`${SUPABASE_URL}/functions/v1/send-resend-email`, {
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

          if (!resp.ok) {
            const errBody = await resp.text();
            console.error(`Reminder ${r.id} send failed:`, resp.status, errBody);
            await markFailed();
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
          await markFailed();
          summary.failed++;
        }
        continue;
      }

      // ── Canal whatsapp: plantilla recordatorio_cita ──
      const ctx = bizContext.get(r.business_id);
      const startAt = (r as any).appointments?.start_at as string | undefined;
      const patientPhone = patient?.whatsapp_phone;

      if (!patientPhone || !ctx?.contactPhone || !startAt) {
        // Falta el teléfono del paciente, el número de contacto del
        // profesional o la cita: no hay forma de armar la plantilla.
        await markFailed();
        summary.skipped++;
        continue;
      }

      try {
        await supabase
          .from("scheduled_reminders")
          .update({ status: "sending" as any })
          .eq("id", r.id)
          .eq("status", "scheduled");

        const when = new Date(startAt);
        const dateEs = new Intl.DateTimeFormat("es-UY", {
          weekday: "long",
          day: "numeric",
          month: "long",
          timeZone: ctx.timezone,
        }).format(when);
        const timeEs = new Intl.DateTimeFormat("es-UY", {
          hour: "2-digit",
          minute: "2-digit",
          hour12: false,
          timeZone: ctx.timezone,
        }).format(when);

        const resp = await fetch(`${SUPABASE_URL}/functions/v1/send-whatsapp`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${SERVICE_ROLE}`,
          },
          body: JSON.stringify({
            to: patientPhone,
            template: WHATSAPP_TEMPLATE,
            languageCode: WHATSAPP_LANG,
            params: [
              firstName(patient?.full_name),
              ctx.profName,
              dateEs,
              timeEs,
              displayPhone(ctx.contactPhone),
            ],
          }),
        });

        if (!resp.ok) {
          const errBody = await resp.text();
          console.error(`WhatsApp reminder ${r.id} send failed:`, resp.status, errBody);
          await markFailed();
          summary.failed++;
        } else {
          await supabase
            .from("scheduled_reminders")
            .update({ status: "sent" })
            .eq("id", r.id);
          summary.sent++;
        }
      } catch (e) {
        console.error(`WhatsApp reminder ${r.id} error:`, e);
        await markFailed();
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
