import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const PLAN_PRICES: Record<string, { monthly: number; annual: number }> = {
  emprendedor: { monthly: 1690, annual: 1290 },
  esencial: { monthly: 3490, annual: 2790 },
  profesional: { monthly: 5990, annual: 4790 },
  consultorio: { monthly: 10990, annual: 8790 },
  // Legacy codes mapped
  starter: { monthly: 1690, annual: 1290 },
  individual: { monthly: 3490, annual: 2790 },
  inicial: { monthly: 3490, annual: 2790 },
  professional: { monthly: 5990, annual: 4790 },
  advanced: { monthly: 10990, annual: 8790 },
  equipo: { monthly: 10990, annual: 8790 },
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const mercadoPagoToken = Deno.env.get("MERCADOPAGO_ACCESS_TOKEN");

    if (!mercadoPagoToken) {
      throw new Error("MERCADOPAGO_ACCESS_TOKEN not configured");
    }

    // Verify user auth
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "No authorization header" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUser = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: userError } = await supabaseUser.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Invalid user" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    const body = await req.json();
    const { plan_code, billing_period, business_name, public_slug, specialty, contact_email } = body;

    if (!plan_code || !PLAN_PRICES[plan_code]) {
      return new Response(JSON.stringify({ error: "Invalid plan_code" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const period = billing_period === "annual" ? "annual" : "monthly";
    const amount = PLAN_PRICES[plan_code][period];

    // Check if user already has a business
    const { data: existingBusiness } = await supabaseAdmin
      .from("businesses")
      .select("id")
      .eq("owner_user_id", user.id)
      .maybeSingle();

    let businessId: string;

    if (existingBusiness) {
      businessId = existingBusiness.id;
      // Update plan
      await supabaseAdmin
        .from("businesses")
        .update({ plan_code, billing_period: period })
        .eq("id", businessId);
    } else {
      // Create business
      const slug = public_slug || `consultorio-${Date.now()}`;
      const { data: newBusiness, error: bizError } = await supabaseAdmin
        .from("businesses")
        .insert({
          owner_user_id: user.id,
          name: business_name || "Mi Consultorio",
          public_slug: slug,
          contact_email: contact_email || user.email || "",
          specialty: specialty || null,
          plan_code,
          billing_period: period,
          plan_started_at: new Date().toISOString(),
        })
        .select("id")
        .single();

      if (bizError) throw bizError;
      businessId = newBusiness.id;

      // Assign owner role
      await supabaseAdmin
        .from("user_roles")
        .insert({
          user_id: user.id,
          business_id: businessId,
          role: "owner",
        });
    }

    // Create Mercado Pago preapproval (subscription)
    const trialEndDate = new Date();
    trialEndDate.setDate(trialEndDate.getDate() + 7);

    const mpFrequency = period === "annual" ? 12 : 1;
    const mpFrequencyType = "months";

    const preapprovalBody = {
      reason: `Tu Consultorio Digital - Plan ${plan_code.charAt(0).toUpperCase() + plan_code.slice(1)} (${period === "annual" ? "Anual" : "Mensual"})`,
      auto_recurring: {
        frequency: mpFrequency,
        frequency_type: mpFrequencyType,
        transaction_amount: period === "annual" ? amount * 12 : amount,
        currency_id: "UYU",
        free_trial: {
          frequency: 7,
          frequency_type: "days",
        },
      },
      payer_email: user.email,
      back_url: `${req.headers.get("origin") || "https://agenda-psicologia.lovable.app"}/billing?subscription=success`,
      status: "pending",
    };

    const mpResponse = await fetch("https://api.mercadopago.com/preapproval", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${mercadoPagoToken}`,
      },
      body: JSON.stringify(preapprovalBody),
    });

    const mpData = await mpResponse.json();

    if (!mpResponse.ok) {
      console.error("Mercado Pago error:", JSON.stringify(mpData));
      throw new Error(`Mercado Pago error: ${mpData.message || mpResponse.status}`);
    }

    // Save subscription in DB
    const { error: subError } = await supabaseAdmin
      .from("subscriptions")
      .insert({
        business_id: businessId,
        plan_code,
        status: "trial",
        billing_period: period,
        amount,
        currency: "UYU",
        mercadopago_preapproval_id: mpData.id,
        mercadopago_payer_id: mpData.payer_id?.toString() || null,
        trial_ends_at: trialEndDate.toISOString(),
        current_period_start: new Date().toISOString(),
        current_period_end: trialEndDate.toISOString(),
      });

    if (subError) throw subError;

    return new Response(
      JSON.stringify({
        success: true,
        checkout_url: mpData.init_point,
        business_id: businessId,
        subscription_status: "trial",
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Error creating subscription:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Internal server error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
