// Generic email sender via Resend API
// Templates: appointment_confirmation, appointment_reminder, patient_invite
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Sender: usa RESEND_FROM_EMAIL si está configurado (ej: "Consultorio Digital
// <noreply@consultoriodigital.app>" una vez verificado el dominio en Resend).
// Mientras el dominio no esté verificado, Resend responde 403; el fallback
// onboarding@resend.dev solo entrega al email dueño de la cuenta Resend.
const FROM_EMAIL =
  Deno.env.get("RESEND_FROM_EMAIL") || "Consultorio Digital <onboarding@resend.dev>";
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

interface SendEmailRequest {
  to: string;
  template: "appointment_confirmation" | "appointment_reminder" | "patient_invite" | "raw";
  businessId?: string;
  data: Record<string, any>;
}

function escapeHtml(s: string): string {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

interface BrandingInfo {
  name: string;
  logoUrl: string | null;
  primaryColor: string; // hsl format like "176 100% 32%"
}

async function getBranding(businessId: string | undefined): Promise<BrandingInfo> {
  const fallback: BrandingInfo = {
    name: "Consultorio Digital",
    logoUrl: null,
    primaryColor: "176 100% 32%",
  };
  if (!businessId) return fallback;
  try {
    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE);
    const { data } = await supabase
      .from("businesses")
      .select("name, dashboard_display_name, portal_clinic_display_name, dashboard_logo_url, portal_logo_url, dashboard_primary_color, portal_primary_color")
      .eq("id", businessId)
      .maybeSingle();
    if (!data) return fallback;
    return {
      name: data.portal_clinic_display_name || data.dashboard_display_name || data.name || fallback.name,
      logoUrl: data.portal_logo_url || data.dashboard_logo_url || null,
      primaryColor: data.portal_primary_color || data.dashboard_primary_color || fallback.primaryColor,
    };
  } catch (e) {
    console.error("Error loading branding:", e);
    return fallback;
  }
}

function shell(branding: BrandingInfo, bodyHtml: string): string {
  const logoBlock = branding.logoUrl
    ? `<img src="${escapeHtml(branding.logoUrl)}" alt="${escapeHtml(branding.name)}" style="max-height:48px;max-width:180px;display:block;margin:0 auto 12px" />`
    : "";
  const accent = `hsl(${branding.primaryColor})`;
  return `<!doctype html>
<html lang="es">
<head><meta charset="utf-8" /><meta name="viewport" content="width=device-width,initial-scale=1" /></head>
<body style="margin:0;padding:0;background:#f4f6f8;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#111;">
  <div style="max-width:560px;margin:0 auto;padding:24px 16px;">
    <div style="background:#ffffff;border-radius:14px;padding:28px;border:1px solid #e6e8eb;">
      <div style="text-align:center;margin-bottom:16px;">
        ${logoBlock}
        <div style="font-weight:700;color:${accent};font-size:14px;letter-spacing:.3px;">${escapeHtml(branding.name)}</div>
      </div>
      ${bodyHtml}
    </div>
    <p style="text-align:center;color:#8a8f98;font-size:11px;margin:18px 0 0;">
      Este es un mensaje automático de ${escapeHtml(branding.name)}. No respondas a este correo.
    </p>
  </div>
</body>
</html>`;
}

function btn(label: string, url: string, color: string): string {
  return `<div style="text-align:center;margin:22px 0;">
    <a href="${escapeHtml(url)}" style="display:inline-block;background:${color};color:#ffffff;text-decoration:none;padding:12px 22px;border-radius:10px;font-weight:600;font-size:14px;">
      ${escapeHtml(label)}
    </a>
  </div>`;
}

function tplAppointmentConfirmation(branding: BrandingInfo, d: any): { subject: string; html: string } {
  const accent = `hsl(${branding.primaryColor})`;
  const modality = d.modality === "online" ? "Online" : "Presencial";
  const locBlock = d.location
    ? `<p style="margin:6px 0;color:#374151;"><strong>${d.modality === "online" ? "Link" : "Dirección"}:</strong> ${escapeHtml(d.location)}</p>`
    : "";
  const body = `
    <h1 style="font-size:20px;margin:0 0 12px;">Hola ${escapeHtml(d.patientName || "")},</h1>
    <p style="color:#374151;line-height:1.55;margin:0 0 14px;">Tu cita fue agendada correctamente. Estos son los detalles:</p>
    <div style="background:#f8fafc;border:1px solid #e6e8eb;border-radius:10px;padding:14px 16px;margin:16px 0;">
      <p style="margin:6px 0;color:#374151;"><strong>Fecha:</strong> ${escapeHtml(d.date)}</p>
      <p style="margin:6px 0;color:#374151;"><strong>Hora:</strong> ${escapeHtml(d.time)}</p>
      <p style="margin:6px 0;color:#374151;"><strong>Modalidad:</strong> ${escapeHtml(modality)}</p>
      ${locBlock}
    </div>
    <p style="color:#374151;line-height:1.55;margin:0 0 6px;">Si necesitás reprogramar o cancelar, contactá directamente al consultorio.</p>
    <p style="color:#6b7280;font-size:13px;margin-top:18px;">¡Te esperamos!</p>
  `;
  return { subject: `Confirmación de cita — ${branding.name}`, html: shell(branding, body) };
}

function tplAppointmentReminder(branding: BrandingInfo, d: any): { subject: string; html: string } {
  const body = `
    <h1 style="font-size:20px;margin:0 0 12px;">Recordatorio de cita</h1>
    <p style="color:#374151;line-height:1.6;margin:0 0 14px;white-space:pre-line;">${escapeHtml(d.message || "")}</p>
    <p style="color:#6b7280;font-size:13px;margin-top:18px;">Si tenés cualquier inconveniente, contactá al consultorio.</p>
  `;
  return { subject: `Recordatorio de tu cita — ${branding.name}`, html: shell(branding, body) };
}

function tplPatientInvite(branding: BrandingInfo, d: any): { subject: string; html: string } {
  const accent = `hsl(${branding.primaryColor})`;
  const body = `
    <h1 style="font-size:20px;margin:0 0 12px;">Hola ${escapeHtml(d.patientName || "")},</h1>
    <p style="color:#374151;line-height:1.55;margin:0 0 14px;">
      ${escapeHtml(branding.name)} te invita a acceder al portal del paciente, donde vas a poder ver tus citas, pagos y reservar nuevos turnos.
    </p>
    ${btn("Activar mi cuenta", d.inviteUrl, accent)}
    <p style="color:#6b7280;font-size:12px;line-height:1.5;margin:14px 0 0;">
      Este enlace vence en 7 días. Si el botón no funciona, copiá y pegá esta URL en tu navegador:<br />
      <span style="color:#374151;word-break:break-all;">${escapeHtml(d.inviteUrl)}</span>
    </p>
  `;
  return { subject: `Invitación al portal — ${branding.name}`, html: shell(branding, body) };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    if (!RESEND_API_KEY) {
      return new Response(JSON.stringify({ error: "RESEND_API_KEY not configured" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = (await req.json()) as SendEmailRequest;
    const { to, template, businessId, data } = body;

    if (!to || !template) {
      return new Response(JSON.stringify({ error: "Missing 'to' or 'template'" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const branding = await getBranding(businessId);

    let subject = "";
    let html = "";

    if (template === "appointment_confirmation") {
      ({ subject, html } = tplAppointmentConfirmation(branding, data || {}));
    } else if (template === "appointment_reminder") {
      ({ subject, html } = tplAppointmentReminder(branding, data || {}));
    } else if (template === "patient_invite") {
      ({ subject, html } = tplPatientInvite(branding, data || {}));
    } else if (template === "raw") {
      subject = data?.subject || `Mensaje — ${branding.name}`;
      html = shell(branding, `<p style="color:#374151;line-height:1.6;white-space:pre-line;">${escapeHtml(data?.message || "")}</p>`);
    } else {
      return new Response(JSON.stringify({ error: "Unknown template" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const resp = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: FROM_EMAIL,
        to: [to],
        subject,
        html,
      }),
    });

    const respJson = await resp.json().catch(() => ({}));

    if (!resp.ok) {
      console.error("Resend error:", resp.status, respJson);
      return new Response(JSON.stringify({ error: "Resend API error", details: respJson }), {
        status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ success: true, id: respJson?.id }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("send-resend-email error:", e);
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
