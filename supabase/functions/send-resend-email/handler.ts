// Lógica de send-resend-email separada del runtime (sin Deno.env ni
// supabase-js) para poder probarla con proveedores simulados.
//
// Quién puede enviar:
//   1. El propio backend (otras edge functions, pg_net desde la base) con la
//      service role exacta en Authorization — igual que send-whatsapp.
//   2. Un profesional logueado (JWT de usuario): solo plantillas operativas,
//      solo para un consultorio al que pertenece (businessId obligatorio) y
//      solo a destinatarios que la base ya conoce como pacientes o
//      solicitantes de ese consultorio (el `to` del cliente se valida contra
//      datos del servidor, nunca se acepta solo).
// Todo lo demás (sin header, anon key, JWT ajeno, plantillas de invitación o
// activación desde el navegador, destinatarios ajenos) se rechaza antes de
// tocar Resend.

export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

export type EmailTemplate =
  | "appointment_confirmation"
  | "appointment_reminder"
  | "patient_invite"
  | "business_activation"
  | "raw";

export interface SendEmailRequest {
  to: string;
  template: EmailTemplate;
  businessId?: string;
  data: Record<string, any>;
}

export interface BrandingInfo {
  name: string;
  logoUrl: string | null;
  primaryColor: string; // hsl format like "176 100% 32%"
}

export interface HandlerDeps {
  serviceRoleKey: string;
  resendApiKey: string;
  fromEmail: string;
  /** Resuelve el JWT de un usuario a su id; null si no es un usuario válido (la anon key cae acá). */
  getUserIdFromToken: (token: string) => Promise<string | null>;
  /** Espejo de public.user_belongs_to_business (dueño, miembro o super admin). */
  userBelongsToBusiness: (userId: string, businessId: string) => Promise<boolean>;
  /**
   * ¿El email pertenece a alguien del consultorio según la base? Pacientes
   * (patients.email), solicitudes públicas (appointment_requests.email) y
   * contacto de citas (appointments.contact_email), sin distinguir mayúsculas.
   * Solo aplica a llamadas de usuario; el backend no pasa por acá.
   */
  recipientBelongsToBusiness: (businessId: string, email: string) => Promise<boolean>;
  getBranding: (businessId: string | undefined) => Promise<BrandingInfo>;
  /** fetch hacia Resend (inyectable para simular el proveedor). */
  fetch: typeof fetch;
}

// Plantillas que un profesional logueado puede disparar desde la app. Las de
// invitación/activación llevan links de acceso y solo las arma el backend.
const USER_TEMPLATES: ReadonlySet<string> = new Set([
  "raw",
  "appointment_confirmation",
  "appointment_reminder",
]);

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const DEFAULT_BRANDING: BrandingInfo = {
  name: "Consultorio Digital",
  logoUrl: null,
  primaryColor: "176 100% 32%",
};

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function escapeHtml(s: string): string {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// Comparación en tiempo constante: el secreto no debe filtrarse por timing.
function secretEquals(a: string, b: string): boolean {
  if (!a || !b) return false;
  const ea = new TextEncoder().encode(a);
  const eb = new TextEncoder().encode(b);
  let diff = ea.length ^ eb.length;
  const n = Math.max(ea.length, eb.length);
  for (let i = 0; i < n; i++) diff |= (ea[i] ?? 0) ^ (eb[i] ?? 0);
  return diff === 0;
}

function bearerToken(req: Request): string {
  const auth = req.headers.get("authorization") ?? "";
  const m = /^Bearer\s+(.+)$/i.exec(auth.trim());
  return m ? m[1].trim() : "";
}

type Caller = { kind: "service" } | { kind: "user"; userId: string };

async function authenticate(req: Request, deps: HandlerDeps): Promise<Caller | null> {
  const token = bearerToken(req);
  if (!token) return null;
  if (secretEquals(token, deps.serviceRoleKey)) return { kind: "service" };
  try {
    const userId = await deps.getUserIdFromToken(token);
    return userId ? { kind: "user", userId } : null;
  } catch {
    return null;
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

// "Agregar a mi calendario" del paciente: link de plantilla de Google Calendar
// y un .ics adjunto (para iPhone/Mac/Outlook). Hora local de Uruguay, sin
// permisos ni OAuth. Requiere isoDate (YYYY-MM-DD), time y endTime (HH:MM).
const icsCompact = (isoDate: string, hm: string) =>
  `${isoDate.replace(/-/g, "")}T${String(hm).slice(0, 5).replace(":", "")}00`;

function buildCalendarBits(branding: BrandingInfo, d: any):
  | { gUrl: string; attachment: { filename: string; content: string } }
  | null {
  if (!d?.isoDate || !d?.time || !d?.endTime) return null;
  const title = `${d.serviceName ? `${d.serviceName} — ` : ""}${branding.name}`;
  const gUrl =
    `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(title)}` +
    `&dates=${icsCompact(d.isoDate, d.time)}/${icsCompact(d.isoDate, d.endTime)}&ctz=America/Montevideo`;
  const ics = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Consultorio Digital//Reserva//ES",
    "BEGIN:VEVENT",
    `UID:${crypto.randomUUID()}@consultoriodigital.app`,
    `DTSTART:${icsCompact(d.isoDate, d.time)}`,
    `DTEND:${icsCompact(d.isoDate, d.endTime)}`,
    `SUMMARY:${title.replace(/([,;\\])/g, "\\$1")}`,
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n");
  const bytes = new TextEncoder().encode(ics);
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return { gUrl, attachment: { filename: "cita.ics", content: btoa(bin) } };
}

function tplAppointmentConfirmation(
  branding: BrandingInfo,
  d: any,
): { subject: string; html: string; attachments?: { filename: string; content: string }[] } {
  const accent = `hsl(${branding.primaryColor})`;
  const modality = d.modality === "online" ? "Online" : "Presencial";
  const locBlock = d.location
    ? `<p style="margin:6px 0;color:#374151;"><strong>${d.modality === "online" ? "Link" : "Dirección"}:</strong> ${escapeHtml(d.location)}</p>`
    : "";
  const cal = buildCalendarBits(branding, d);
  const calBlock = cal
    ? `
    ${btn("Agregar a mi Google Calendar", cal.gUrl, accent)}
    <p style="color:#6b7280;font-size:12.5px;line-height:1.5;margin:10px 0 0;">
      ¿Usás iPhone u otro calendario? Abrí el archivo adjunto <strong>cita.ics</strong> y la cita se guarda sola.
    </p>`
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
    ${calBlock}
    <p style="color:#374151;line-height:1.55;margin:16px 0 6px;">Si necesitás reprogramar o cancelar, contactá directamente al consultorio.</p>
    <p style="color:#6b7280;font-size:13px;margin-top:18px;">¡Te esperamos!</p>
  `;
  return {
    subject: `Confirmación de cita — ${branding.name}`,
    html: shell(branding, body),
    attachments: cal ? [cal.attachment] : undefined,
  };
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

// Invitación para que un profesional active su consultorio (la manda el
// admin desde el panel). Botón grande y protagonista: es el primer contacto
// del cliente con la marca, tiene que verse impecable.
function tplBusinessActivation(branding: BrandingInfo, d: any): { subject: string; html: string } {
  const accent = `hsl(${branding.primaryColor})`;
  const url = String(d.activationUrl || "");
  const body = `
    <h1 style="font-size:22px;margin:0 0 6px;text-align:center;">¡Tu consultorio te está esperando! 🎉</h1>
    <p style="color:#374151;line-height:1.6;margin:0 0 18px;text-align:center;">
      Te damos la bienvenida a <strong>Consultorio Digital</strong>. Activá tu cuenta,
      definí tu contraseña y dejá tu consultorio funcionando en minutos.
    </p>
    ${btn("Activar mi consultorio", url, accent)}
    <div style="background:#f8fafc;border:1px solid #e6e8eb;border-radius:10px;padding:14px 18px;margin:20px 0;">
      <p style="margin:0 0 8px;color:#111;font-weight:600;font-size:13px;">Lo que vas a tener desde hoy:</p>
      <p style="margin:5px 0;color:#374151;font-size:13px;">✓ Agenda online y reservas desde tu propia página</p>
      <p style="margin:5px 0;color:#374151;font-size:13px;">✓ Recordatorios automáticos por WhatsApp para tus pacientes</p>
      <p style="margin:5px 0;color:#374151;font-size:13px;">✓ Portal del paciente, pagos y ficha clínica en un solo lugar</p>
    </div>
    <p style="color:#6b7280;font-size:12px;line-height:1.5;margin:14px 0 0;">
      El enlace es personal y vence en 7 días. Si el botón no funciona, copiá y pegá esta URL en tu navegador:<br />
      <a href="${escapeHtml(url)}" style="color:#374151;word-break:break-all;">${escapeHtml(url)}</a>
    </p>
    <p style="color:#6b7280;font-size:12px;margin:10px 0 0;">Si no esperabas este correo, podés ignorarlo.</p>
  `;
  return { subject: "Activá tu consultorio — te toma 2 minutos 🚀", html: shell(branding, body) };
}

export function createHandler(deps: HandlerDeps): (req: Request) => Promise<Response> {
  return async (req: Request): Promise<Response> => {
    if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

    try {
      // Autorización antes de leer nada: sin credencial válida no se procesa
      // el cuerpo ni se toca Resend.
      const caller = await authenticate(req, deps);
      if (!caller) return json({ error: "unauthorized" }, 401);

      if (!deps.resendApiKey) {
        return json({ error: "RESEND_API_KEY not configured" }, 500);
      }

      const body = (await req.json()) as SendEmailRequest;
      const { to, template, businessId, data } = body;

      if (!to || !template) {
        return json({ error: "Missing 'to' or 'template'" }, 400);
      }

      if (caller.kind === "user") {
        if (!USER_TEMPLATES.has(template)) {
          return json({ error: "forbidden_template" }, 403);
        }
        if (typeof businessId !== "string" || !UUID_RE.test(businessId)) {
          return json({ error: "business_required" }, 403);
        }
        const member = await deps.userBelongsToBusiness(caller.userId, businessId);
        if (!member) return json({ error: "forbidden" }, 403);
      }

      // Resend rechaza destinatarios con caracteres no ASCII. Limpiamos espacios
      // raros / invisibles y convertimos el dominio a punycode (IDN). Si el
      // usuario (parte antes de @) sigue teniendo acentos, avisamos claro.
      const cleaned = to
        .replace(/[\u200B-\u200D\uFEFF\u00A0]/g, "")
        .trim()
        .replace(/^mailto:/i, "");
      const atIndex = cleaned.lastIndexOf("@");
      if (atIndex < 1) {
        return json({ error: "Email inválido", details: { to } }, 400);
      }
      const localPart = cleaned.slice(0, atIndex);
      let domainPart = cleaned.slice(atIndex + 1).toLowerCase();
      try {
        domainPart = new URL(`https://${domainPart}`).hostname; // IDN -> punycode
      } catch {
        // se valida abajo
      }
      const recipient = `${localPart}@${domainPart}`;
      if (/[^\x20-\x7E]/.test(recipient)) {
        return json(
          {
            error: "El email del destinatario tiene caracteres no válidos (acentos o símbolos). Corregilo y volvé a intentar.",
            details: { to },
          },
          400,
        );
      }

      // Destinatario: un profesional solo escribe a gente de su consultorio.
      // Se decide con lo que hay en la base, no con lo que mandó el cliente;
      // ante cualquier error de consulta se niega (fail closed).
      if (caller.kind === "user") {
        let allowed = false;
        try {
          allowed = await deps.recipientBelongsToBusiness(businessId as string, recipient);
        } catch (e) {
          console.error("recipientBelongsToBusiness failed:", e);
        }
        if (!allowed) return json({ error: "recipient_not_allowed" }, 403);
      }

      const branding = await deps.getBranding(businessId);

      let subject = "";
      let html = "";
      let attachments: { filename: string; content: string }[] | undefined;

      if (template === "appointment_confirmation") {
        ({ subject, html, attachments } = tplAppointmentConfirmation(branding, data || {}));
      } else if (template === "appointment_reminder") {
        ({ subject, html } = tplAppointmentReminder(branding, data || {}));
      } else if (template === "patient_invite") {
        ({ subject, html } = tplPatientInvite(branding, data || {}));
      } else if (template === "business_activation") {
        ({ subject, html } = tplBusinessActivation(branding, data || {}));
      } else if (template === "raw") {
        subject = data?.subject || `Mensaje — ${branding.name}`;
        html = shell(branding, `<p style="color:#374151;line-height:1.6;white-space:pre-line;">${escapeHtml(data?.message || "")}</p>`);
      } else {
        return json({ error: "Unknown template" }, 400);
      }

      const resp = await deps.fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${deps.resendApiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: deps.fromEmail,
          to: [recipient],
          subject,
          html,
          ...(attachments ? { attachments } : {}),
        }),
      });

      const respJson = await resp.json().catch(() => ({}));

      if (!resp.ok) {
        console.error("Resend error:", resp.status, respJson);
        return json({ error: "Resend API error", details: respJson }, 502);
      }

      return json({ success: true, id: respJson?.id }, 200);
    } catch (e) {
      console.error("send-resend-email error:", e);
      return json({ error: String(e) }, 500);
    }
  };
}
