import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Validate JWT
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUser = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await supabaseUser.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userId = claimsData.claims.sub as string;

    // Parse body
    const body = await req.json();
    const appointmentId = body.appointment_id;
    const businessId = body.business_id;

    if (!appointmentId || typeof appointmentId !== "string") {
      return new Response(JSON.stringify({ error: "Missing appointment_id" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!businessId || typeof businessId !== "string") {
      return new Response(JSON.stringify({ error: "Missing business_id" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Check existing payment for this appointment
    const { data: existingPayment } = await supabase
      .from("payments")
      .select("id, status, mp_preference_id, updated_at")
      .eq("appointment_id", appointmentId)
      .in("status", ["paid", "pending"])
      .order("created_at", { ascending: false })
      .maybeSingle();

    if (existingPayment?.status === "paid") {
      return new Response(JSON.stringify({ error: "Este turno ya fue pagado" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Anti-doble-cobro: rechazar si ya hay preferencia MP pendiente reciente (<10 min)
    if (existingPayment?.status === "pending" && existingPayment.mp_preference_id && existingPayment.updated_at) {
      const tenMinAgo = Date.now() - 10 * 60 * 1000;
      if (new Date(existingPayment.updated_at).getTime() > tenMinAgo) {
        return new Response(JSON.stringify({
          error: "Ya tenés un pago en curso para esta sesión. Esperá a que se confirme o cancele antes de intentar de nuevo.",
        }), {
          status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // Get appointment
    const { data: appointment, error: apptErr } = await supabase
      .from("appointments")
      .select("id, business_id, patient_id, start_at, status, session_price")
      .eq("id", appointmentId)
      .eq("business_id", businessId)
      .single();

    if (apptErr || !appointment) {
      return new Response(JSON.stringify({ error: "Appointment not found" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verify patient owns this appointment
    const { data: patient } = await supabase
      .from("patients")
      .select("id, full_name, payment_policy_override")
      .eq("id", appointment.patient_id)
      .eq("auth_user_id", userId)
      .single();

    if (!patient) {
      return new Response(JSON.stringify({ error: "Not authorized for this appointment" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get payment policy
    const { data: policy } = await supabase
      .from("payment_policies")
      .select("*")
      .eq("business_id", businessId)
      .maybeSingle();

    if (!policy || !policy.mp_access_token) {
      return new Response(JSON.stringify({ error: "Online payments not configured for this clinic" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Determine effective policy type
    let effectivePolicy = policy.policy_type;
    const override = patient.payment_policy_override;
    if (override && override !== "inherit") {
      effectivePolicy = override;
    }

    if (effectivePolicy === "none") {
      return new Response(JSON.stringify({ error: "No online payment required for this appointment" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Calculate amount: el precio de la CITA (tipo de sesión elegido) manda;
    // el de la política queda como respaldo para citas sin precio propio.
    const apptPrice = Number(appointment.session_price);
    const sessionPrice = apptPrice > 0 ? apptPrice : (policy.session_price || 0);
    if (sessionPrice <= 0) {
      return new Response(JSON.stringify({ error: "Session price not configured" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let amount = sessionPrice;
    if (policy.deposit_percentage !== null && policy.deposit_percentage < 100) {
      amount = Math.round(sessionPrice * policy.deposit_percentage / 100);
    }

    // Get business slug for back_url
    const { data: business } = await supabase
      .from("businesses")
      .select("public_slug, name")
      .eq("id", businessId)
      .single();

    const slug = business?.public_slug || "";
    const clinicName = business?.name || "Consultorio";

    // Format date for description
    const apptDate = new Date(appointment.start_at);
    const dateStr = apptDate.toLocaleDateString("es-UY", {
      day: "numeric", month: "long", year: "numeric",
      timeZone: "America/Montevideo",
    });
    const timeStr = apptDate.toLocaleTimeString("es-UY", {
      hour: "2-digit", minute: "2-digit",
      timeZone: "America/Montevideo",
    });

    const isDeposit = policy.deposit_percentage !== null && policy.deposit_percentage < 100;
    const title = isDeposit
      ? `Seña sesión ${dateStr} ${timeStr} - ${clinicName}`
      : `Sesión ${dateStr} ${timeStr} - ${clinicName}`;

    // Build external_reference with appointment info
    const externalReference = JSON.stringify({
      type: "session_payment",
      appointment_id: appointmentId,
      business_id: businessId,
      patient_id: patient.id,
    });

    const backUrl = `https://consultoriodigital.app/portal/${slug}?payment=success&appointment_id=${appointmentId}`;

    // Create MP preference using the clinic's access token
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
          unit_price: amount,
          currency_id: "UYU",
        }],
        back_urls: {
          success: backUrl,
          failure: `https://consultoriodigital.app/portal/${slug}?payment=failure`,
          pending: `https://consultoriodigital.app/portal/${slug}?payment=pending`,
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

    // Create or update payment record
    if (existingPayment?.status === "pending") {
      const { error: updErr } = await supabase
        .from("payments")
        .update({
          mp_preference_id: mpPref.id,
          amount,
          notes: title,
          method: "mercadopago",
        })
        .eq("id", existingPayment.id);
      if (updErr) console.error("Failed to update payment record:", updErr);
    } else {
      const { error: payErr } = await supabase
        .from("payments")
        .insert({
          business_id: businessId,
          patient_id: patient.id,
          appointment_id: appointmentId,
          amount,
          currency: "UYU",
          due_date: appointment.start_at,
          status: "pending",
          method: "mercadopago",
          notes: title,
          mp_preference_id: mpPref.id,
        });
      if (payErr) console.error("Failed to create payment record:", payErr);
    }

    // Update appointment payment_status
    await supabase
      .from("appointments")
      .update({ payment_status: "pendiente" })
      .eq("id", appointmentId);

    return new Response(JSON.stringify({
      init_point: mpPref.init_point,
      preference_id: mpPref.id,
      amount,
      is_deposit: isDeposit,
      deposit_percentage: policy.deposit_percentage,
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("create-session-payment error:", error);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});