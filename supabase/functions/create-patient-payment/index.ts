import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUser = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await supabaseUser.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userId = claimsData.claims.sub as string;

    const body = await req.json();
    const businessId: string = body.business_id;
    const paymentIds: string[] = Array.isArray(body.payment_ids) ? body.payment_ids : [];

    if (!businessId || typeof businessId !== "string") {
      return new Response(JSON.stringify({ error: "Missing business_id" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (paymentIds.length === 0 || !paymentIds.every((id) => typeof id === "string")) {
      return new Response(JSON.stringify({ error: "Missing payment_ids" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Verify patient (auth_user_id) belongs to business
    const { data: patient } = await supabase
      .from("patients")
      .select("id, full_name")
      .eq("business_id", businessId)
      .eq("auth_user_id", userId)
      .eq("is_active", true)
      .maybeSingle();

    if (!patient) {
      return new Response(JSON.stringify({ error: "Patient not found for this business" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch payments — must all belong to this patient + business, not paid/cancelled
    const { data: payments, error: payErr } = await supabase
      .from("payments")
      .select("id, amount, currency, status, notes, appointment_id, due_date, mp_preference_id, updated_at")
      .in("id", paymentIds)
      .eq("business_id", businessId)
      .eq("patient_id", patient.id);

    if (payErr || !payments || payments.length !== paymentIds.length) {
      return new Response(JSON.stringify({ error: "Some payments not found or not authorized" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const invalid = payments.find((p) => p.status === "paid" || p.status === "cancelled");
    if (invalid) {
      return new Response(JSON.stringify({ error: "Some payments are not payable" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Anti-doble-cobro: rechazar si algún pago ya tiene preferencia MP pendiente reciente (<10 min)
    const tenMinAgo = Date.now() - 10 * 60 * 1000;
    const inFlight = payments.find(
      (p) => p.mp_preference_id && p.status === "pending" &&
        p.updated_at && new Date(p.updated_at).getTime() > tenMinAgo,
    );
    if (inFlight) {
      return new Response(JSON.stringify({
        error: "Ya tenés un pago en curso para esta sesión. Esperá a que se confirme o cancele antes de intentar de nuevo.",
      }), {
        status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const totalAmount = payments.reduce((s, p) => s + Number(p.amount), 0);
    if (totalAmount <= 0) {
      return new Response(JSON.stringify({ error: "Invalid total amount" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Read MP token from clinic policy
    const { data: policy } = await supabase
      .from("payment_policies")
      .select("mp_access_token")
      .eq("business_id", businessId)
      .maybeSingle();

    if (!policy?.mp_access_token) {
      return new Response(JSON.stringify({ error: "Online payments not configured for this clinic" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: business } = await supabase
      .from("businesses")
      .select("public_slug, name")
      .eq("id", businessId)
      .single();
    const slug = business?.public_slug || "";
    const clinicName = business?.name || "Consultorio";

    const title = payments.length === 1
      ? (payments[0].notes || `Pago — ${clinicName}`)
      : `Pago de ${payments.length} cuotas — ${clinicName}`;

    const externalReference = JSON.stringify({
      type: "payment_batch",
      payment_ids: paymentIds,
      business_id: businessId,
      patient_id: patient.id,
    });

    const backBase = `https://consultoriodigital.app/portal/${slug}`;
    const successUrl = `${backBase}?payment=success&batch=1`;

    const mpResponse = await fetch("https://api.mercadopago.com/checkout/preferences", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${policy.mp_access_token}`,
      },
      body: JSON.stringify({
        items: [{
          title,
          quantity: 1,
          unit_price: totalAmount,
          currency_id: payments[0].currency || "UYU",
        }],
        back_urls: {
          success: successUrl,
          failure: `${backBase}?payment=failure`,
          pending: `${backBase}?payment=pending`,
        },
        auto_return: "approved",
        external_reference: externalReference,
        notification_url: `${supabaseUrl}/functions/v1/mercadopago-webhook`,
      }),
    });

    if (!mpResponse.ok) {
      const errBody = await mpResponse.text();
      console.error("MP preference creation failed:", mpResponse.status, errBody);
      return new Response(JSON.stringify({ error: "Failed to create payment" }), {
        status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const mpPref = await mpResponse.json();

    // Tag all payments with the preference id + method
    await supabase
      .from("payments")
      .update({ mp_preference_id: mpPref.id, method: "mercadopago" })
      .in("id", paymentIds);

    return new Response(JSON.stringify({
      init_point: mpPref.init_point,
      preference_id: mpPref.id,
      amount: totalAmount,
      payment_count: payments.length,
    }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("create-patient-payment error:", error);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});