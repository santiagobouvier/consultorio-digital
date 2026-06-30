// Sends a WhatsApp message via Twilio.
//
// Two modes, auto-detected from secrets:
//  - Sandbox / freeform: sends `message` as the body. Works only with numbers
//    that joined your Twilio sandbox, OR inside a 24h customer-service window.
//    Use this to TEST today without waiting for Meta template approval.
//  - Production / template: if TWILIO_CONTENT_SID is set, sends an approved
//    WhatsApp template. The full reminder text is passed as variable {{1}};
//    design your approved template body as "{{1}}" (or richer, mapping {{1}}).
//
// Required secrets:
//   TWILIO_ACCOUNT_SID   - from the Twilio console
//   TWILIO_AUTH_TOKEN    - from the Twilio console
//   TWILIO_WHATSAPP_FROM - e.g. "+14155238886" (sandbox) or your approved number
// Optional secrets:
//   TWILIO_CONTENT_SID   - approved template Content SID (HX...). Enables prod mode.
//   DEFAULT_COUNTRY_CODE - digits only, default "598" (Uruguay), used to complete
//                          local phone numbers stored without a country code.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const ACCOUNT_SID = Deno.env.get("TWILIO_ACCOUNT_SID");
const AUTH_TOKEN = Deno.env.get("TWILIO_AUTH_TOKEN");
const WHATSAPP_FROM = Deno.env.get("TWILIO_WHATSAPP_FROM");
const CONTENT_SID = Deno.env.get("TWILIO_CONTENT_SID");
const DEFAULT_COUNTRY_CODE = (Deno.env.get("DEFAULT_COUNTRY_CODE") || "598").replace(/\D/g, "");

interface SendWhatsAppRequest {
  to: string;
  message: string;
}

/** Convert a stored phone into E.164 digits (no leading +), best-effort. */
function toE164Digits(raw: string): string | null {
  let d = (raw || "").replace(/\D/g, "");
  if (!d) return null;
  // Already includes the default country code.
  if (d.startsWith(DEFAULT_COUNTRY_CODE)) return d;
  // Local number written with a trunk leading zero (e.g. 09x...).
  if (d.startsWith("0")) d = d.slice(1);
  // Numbers long enough to already carry some country code are left as-is.
  if (d.length >= 11) return d;
  // Otherwise assume it's a local number and prepend the default country code.
  return DEFAULT_COUNTRY_CODE + d;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  // Not configured yet → 503 so callers (the cron) can leave the reminder
  // pending and retry once Twilio secrets are set, instead of marking it failed.
  if (!ACCOUNT_SID || !AUTH_TOKEN || !WHATSAPP_FROM) {
    return new Response(
      JSON.stringify({ error: "Twilio not configured", configured: false }),
      { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  try {
    const { to, message } = (await req.json()) as SendWhatsAppRequest;

    if (!to || !message) {
      return new Response(JSON.stringify({ error: "Missing 'to' or 'message'" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const digits = toE164Digits(to);
    if (!digits) {
      return new Response(JSON.stringify({ error: "Invalid phone number" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const fromDigits = WHATSAPP_FROM.replace(/[^\d+]/g, "");
    const form = new URLSearchParams();
    form.set("From", `whatsapp:${fromDigits.startsWith("+") ? fromDigits : "+" + fromDigits}`);
    form.set("To", `whatsapp:+${digits}`);

    if (CONTENT_SID) {
      // Production: approved template. Full reminder text goes in variable {{1}}.
      form.set("ContentSid", CONTENT_SID);
      form.set("ContentVariables", JSON.stringify({ "1": message }));
    } else {
      // Sandbox / freeform.
      form.set("Body", message);
    }

    const auth = btoa(`${ACCOUNT_SID}:${AUTH_TOKEN}`);
    const resp = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${ACCOUNT_SID}/Messages.json`,
      {
        method: "POST",
        headers: {
          "Authorization": `Basic ${auth}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: form.toString(),
      },
    );

    const respJson = await resp.json().catch(() => ({}));

    if (!resp.ok) {
      console.error("Twilio error:", resp.status, respJson);
      return new Response(
        JSON.stringify({ error: "Twilio API error", details: respJson }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    return new Response(
      JSON.stringify({ success: true, sid: respJson?.sid, status: respJson?.status }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("send-whatsapp error:", e);
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
