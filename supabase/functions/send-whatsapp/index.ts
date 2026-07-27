// Envía mensajes de WhatsApp con la Cloud API oficial de Meta usando
// plantillas aprobadas (recordatorio_cita, aviso_pago).
//
// USO INTERNO SOLAMENTE: la llama el robot de recordatorios (y futuras
// funciones del sistema) con la service role key. Rechaza cualquier otra
// llamada para que nadie pueda mandar WhatsApps arbitrarios desde el número
// oficial.
//
// Secrets requeridos:
//   WHATSAPP_TOKEN            token permanente de la app de Meta
//   WHATSAPP_PHONE_NUMBER_ID  identificador del número (+598 91 064 193)

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const WHATSAPP_TOKEN = Deno.env.get("WHATSAPP_TOKEN");
const WHATSAPP_PHONE_NUMBER_ID = Deno.env.get("WHATSAPP_PHONE_NUMBER_ID");
const GRAPH_URL = "https://graph.facebook.com/v21.0";

// Igual que src/lib/whatsapp.ts: normaliza a formato internacional sin "+"
// asumiendo Uruguay (098 543 623 -> 59898543623).
function normalizePhone(phone: string): string | null {
  const cleaned = phone.replace(/\D/g, "");
  if (!cleaned) return null;
  if (cleaned.startsWith("0")) return "598" + cleaned.slice(1);
  if (!cleaned.startsWith("598") && cleaned.length <= 9) return "598" + cleaned;
  return cleaned;
}

// Meta rechaza parámetros vacíos o con saltos de línea/tabs.
function sanitizeParam(value: unknown): string {
  const text = String(value ?? "").replace(/\s+/g, " ").trim();
  return text || "—";
}

function json(status: number, body: Record<string, unknown>): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  // Solo llamadas internas del sistema (service role exacta).
  const auth = req.headers.get("authorization") || "";
  if (auth !== `Bearer ${SERVICE_ROLE}`) {
    return json(401, { ok: false, error: "unauthorized" });
  }

  if (!WHATSAPP_TOKEN || !WHATSAPP_PHONE_NUMBER_ID) {
    return json(500, { ok: false, error: "whatsapp_not_configured" });
  }

  try {
    const { to, template, params, languageCode } = await req.json();

    if (!to || typeof to !== "string" || !template || typeof template !== "string") {
      return json(400, { ok: false, error: "missing_to_or_template" });
    }

    const phone = normalizePhone(to);
    if (!phone || phone.length < 10) {
      return json(400, { ok: false, error: "invalid_phone" });
    }

    const bodyParams: string[] = Array.isArray(params) ? params.map(sanitizeParam) : [];

    const payload = {
      messaging_product: "whatsapp",
      to: phone,
      type: "template",
      template: {
        name: template,
        language: { code: typeof languageCode === "string" && languageCode ? languageCode : "es" },
        ...(bodyParams.length > 0
          ? {
              components: [
                {
                  type: "body",
                  parameters: bodyParams.map((text) => ({ type: "text", text })),
                },
              ],
            }
          : {}),
      },
    };

    const resp = await fetch(`${GRAPH_URL}/${WHATSAPP_PHONE_NUMBER_ID}/messages`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${WHATSAPP_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    const data = await resp.json().catch(() => ({}));

    if (!resp.ok) {
      console.error("WhatsApp send failed:", resp.status, JSON.stringify(data));
      return json(502, {
        ok: false,
        error: "meta_error",
        metaStatus: resp.status,
        metaError: data?.error?.message || null,
        metaCode: data?.error?.code || null,
      });
    }

    return json(200, { ok: true, messageId: data?.messages?.[0]?.id || null });
  } catch (e) {
    console.error("send-whatsapp error:", e);
    return json(500, { ok: false, error: String(e) });
  }
});
