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

// Plantillas aprobadas en Meta, según el tipo de aviso
const WHATSAPP_TEMPLATE_BY_TYPE: Record<string, string> = {
  // Al paciente
  reminder: "recordatorio_cita",
  confirmation: "confirmacion_cita",
  reschedule: "reprogramacion_cita",
  cancellation: "cancelacion_sesion",
  // Al profesional (recipient_phone + wa_params vienen de la base)
  pro_new_booking: "nueva_reserva_pro",
  pro_cancellation: "cancelacion_pro",
  pro_reschedule: "reprogramacion_pro",
};
const WHATSAPP_LANG = "es";

// Límite de WhatsApps automáticos por mes según plan (espejo de
// src/lib/plan-definitions.ts). null = sin límite. Al llegar al tope, el
// aviso whatsapp se cancela pero el de email sale igual.
const WHATSAPP_MONTHLY_LIMITS: Record<string, number | null> = {
  emprendedor: 250,
  esencial: 700,
  profesional: 1500,
  consultorio: 3000,
  personalizado: null,
};

// Códigos de plan viejos (espejo de LEGACY_PLAN_MAP)
const LEGACY_PLAN_MAP: Record<string, string> = {
  starter: "emprendedor",
  individual: "esencial",
  inicial: "esencial",
  professional: "profesional",
  advanced: "consultorio",
  equipo: "consultorio",
  enterprise: "personalizado",
  clinica: "personalizado",
  custom: "personalizado",
};

function whatsappLimitFor(planCode: string | null | undefined): number | null {
  const normalized = LEGACY_PLAN_MAP[planCode || ""] || planCode || "emprendedor";
  return WHATSAPP_MONTHLY_LIMITS[normalized] ?? WHATSAPP_MONTHLY_LIMITS.emprendedor;
}

interface BusinessContext {
  profName: string;
  contactPhone: string | null;
  timezone: string;
  waLimit: number | null;
  waUsedThisMonth: number;
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
        id, business_id, patient_id, appointment_id, scheduled_for, message, channel, type, status, auto_send, recipient_phone, wa_params,
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
        .select("id, name, portal_clinic_display_name, dashboard_display_name, timezone, owner_user_id, plan_code")
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

      // Uso del mes: WhatsApps ya enviados este mes por negocio (para el límite del plan)
      const monthStart = new Date();
      monthStart.setUTCDate(1);
      monthStart.setUTCHours(0, 0, 0, 0);

      for (const b of businesses || []) {
        const { count } = await supabase
          .from("scheduled_reminders")
          .select("id", { count: "exact", head: true })
          .eq("business_id", b.id)
          .eq("channel", "whatsapp")
          .eq("status", "sent")
          .gte("scheduled_for", monthStart.toISOString());

        bizContext.set(b.id, {
          profName: b.portal_clinic_display_name || b.dashboard_display_name || b.name,
          contactPhone: contactByOwner.get(b.owner_user_id) ?? null,
          timezone: b.timezone || "America/Montevideo",
          waLimit: whatsappLimitFor(b.plan_code),
          waUsedThisMonth: count ?? 0,
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

      // ── Canal whatsapp: plantilla según el tipo de aviso ──
      const ctx = bizContext.get(r.business_id);
      const startAt = (r as any).appointments?.start_at as string | undefined;
      // Avisos al profesional: destino y parámetros ya vienen armados de la base.
      const preParams = Array.isArray((r as any).wa_params) ? ((r as any).wa_params as string[]) : null;
      const recipient = ((r as any).recipient_phone as string | null) || patient?.whatsapp_phone;

      if (!ctx || !recipient || (!preParams && (!ctx.contactPhone || !startAt))) {
        // Falta el destinatario, el número de contacto del profesional o la
        // cita: no hay forma de armar la plantilla.
        await markFailed();
        summary.skipped++;
        continue;
      }

      // Límite mensual del plan: al alcanzarlo, este aviso whatsapp se
      // cancela (el de email de la misma cita sale igual, sin límite).
      if (ctx.waLimit !== null && ctx.waUsedThisMonth >= ctx.waLimit) {
        await supabase
          .from("scheduled_reminders")
          .update({ status: "cancelled" })
          .eq("id", r.id);
        summary.skipped++;
        continue;
      }

      try {
        await supabase
          .from("scheduled_reminders")
          .update({ status: "sending" as any })
          .eq("id", r.id)
          .eq("status", "scheduled");

        // Parámetros: pre-armados (avisos al profesional) o construidos acá
        // (avisos al paciente: nombre, consultorio, fecha larga, hora, contacto)
        let params: string[];
        if (preParams) {
          params = preParams;
        } else {
          const when = new Date(startAt!);
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
          params = [
            firstName(patient?.full_name),
            ctx.profName,
            dateEs,
            timeEs,
            displayPhone(ctx.contactPhone!),
          ];
        }

        const resp = await fetch(`${SUPABASE_URL}/functions/v1/send-whatsapp`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${SERVICE_ROLE}`,
          },
          body: JSON.stringify({
            to: recipient,
            template: WHATSAPP_TEMPLATE_BY_TYPE[(r as any).type] || WHATSAPP_TEMPLATE_BY_TYPE.reminder,
            languageCode: WHATSAPP_LANG,
            params,
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
          ctx.waUsedThisMonth++;
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
