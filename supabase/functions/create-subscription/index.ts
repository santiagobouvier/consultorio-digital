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
    let existingSubscription: {
      id: string;
      status: string;
      plan_code: string;
      billing_period: string;
      amount: number;
      trial_ends_at: string | null;
      current_period_start: string | null;
      current_period_end: string | null;
      mercadopago_preapproval_id: string | null;
    } | null = null;

    if (existingBusiness) {
      businessId = existingBusiness.id;

      const { data: currentSubscription, error: existingSubscriptionError } = await supabaseAdmin
        .from("subscriptions")
        .select("id, status, plan_code, billing_period, amount, trial_ends_at, current_period_start, current_period_end, mercadopago_preapproval_id")
        .eq("business_id", businessId)
        .maybeSingle();

      if (existingSubscriptionError) throw existingSubscriptionError;
      existingSubscription = currentSubscription;
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

      const { data: createdSubscription, error: createdSubscriptionError } = await supabaseAdmin
        .from("subscriptions")
        .select("id, status, plan_code, billing_period, amount, trial_ends_at, current_period_start, current_period_end, mercadopago_preapproval_id")
        .eq("business_id", businessId)
        .maybeSingle();

      if (createdSubscriptionError) throw createdSubscriptionError;
      existingSubscription = createdSubscription;
    }

    if (existingSubscription?.mercadopago_preapproval_id) {
      const cancelResponse = await fetch(
        `https://api.mercadopago.com/preapproval/${existingSubscription.mercadopago_preapproval_id}`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${mercadoPagoToken}`,
          },
          body: JSON.stringify({ status: "cancelled" }),
        }
      );

      if (!cancelResponse.ok) {
        const cancelError = await cancelResponse.json();
        console.error("Mercado Pago cancel error:", JSON.stringify(cancelError));
        // If already cancelled, that's fine — continue
        if (cancelResponse.status !== 400) {
          throw new Error("No se pudo reemplazar la suscripción anterior en Mercado Pago");
        }
      }
    }

    // Create Mercado Pago preapproval (subscription)
    const trialEndDate = new Date();
    trialEndDate.setDate(trialEndDate.getDate() + 30);

    // FIX: Para anual, MP cobra el precio mensual equivalente cada 12 meses.
    // Para mensual, cobra el precio mensual cada 1 mes.
    // `amount` ya es el precio correcto por período (priceAnnual o priceMonthly).
    const mpFrequency = period === "annual" ? 12 : 1;
    const mpFrequencyType = "months";
    // Para anual: cobrar el monto mensual * 12 en un solo pago cada 12 meses
    const mpTransactionAmount = period === "annual" ? amount * 12 : amount;

    const preapprovalBody = {
      reason: `Tu Consultorio Digital - Plan ${plan_code.charAt(0).toUpperCase() + plan_code.slice(1)} (${period === "annual" ? "Anual" : "Mensual"})`,
      auto_recurring: {
        frequency: mpFrequency,
        frequency_type: mpFrequencyType,
        transaction_amount: mpTransactionAmount,
        currency_id: "UYU",
        free_trial: {
          frequency: 30,
          frequency_type: "days",
        },
      },
      payer_email: user.email,
      external_reference: JSON.stringify({
        business_id: businessId,
        plan_code,
        billing_period: period,
        amount,
      }),
      back_url: `${req.headers.get("origin") || "https://consultoriodigital.app"}/activating?subscription=success`,
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

    const hasAccessibleTrial = existingSubscription?.status === "trial"
      && !!existingSubscription.trial_ends_at
      && new Date(existingSubscription.trial_ends_at).getTime() > Date.now();

    const preserveCurrentAccess = existingSubscription?.status === "active" || hasAccessibleTrial;

    const nextStatus = preserveCurrentAccess
      ? existingSubscription?.status || "pending"
      : "pending";

    const subscriptionPayload = {
      business_id: businessId,
      plan_code: preserveCurrentAccess
        ? existingSubscription?.plan_code || plan_code
        : plan_code,
      status: nextStatus,
      billing_period: preserveCurrentAccess
        ? existingSubscription?.billing_period || period
        : period,
      amount: preserveCurrentAccess
        ? existingSubscription?.amount || amount
        : amount,
      currency: "UYU",
      mercadopago_preapproval_id: mpData.id,
      mercadopago_payer_id: mpData.payer_id?.toString() || null,
      trial_ends_at: hasAccessibleTrial
        ? existingSubscription?.trial_ends_at || trialEndDate.toISOString()
        : trialEndDate.toISOString(),
      current_period_start: existingSubscription?.status === "active"
        ? existingSubscription.current_period_start || new Date().toISOString()
        : new Date().toISOString(),
      current_period_end: existingSubscription?.status === "active"
        ? existingSubscription.current_period_end || trialEndDate.toISOString()
        : trialEndDate.toISOString(),
      cancelled_at: null,
    };

    const { error: subError } = existingSubscription?.id
      ? await supabaseAdmin
          .from("subscriptions")
          .update(subscriptionPayload)
          .eq("id", existingSubscription.id)
      : await supabaseAdmin
          .from("subscriptions")
          .insert(subscriptionPayload);

    if (subError) throw subError;

    return new Response(
      JSON.stringify({
        success: true,
        checkout_url: mpData.init_point,
        business_id: businessId,
        subscription_status: "pending",
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
