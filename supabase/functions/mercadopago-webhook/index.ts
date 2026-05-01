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
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const mercadoPagoToken = Deno.env.get("MERCADOPAGO_ACCESS_TOKEN")!;

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const body = await req.json();
    console.log("Webhook received:", JSON.stringify(body));

    const { type, data } = body;

    // Mercado Pago sends different notification types
    // For subscriptions (preapproval): type = "subscription_preapproval"
    // For payments: type = "payment"
    
    if (type === "subscription_preapproval" && data?.id) {
      // Fetch preapproval details from MP
      const mpResponse = await fetch(`https://api.mercadopago.com/preapproval/${data.id}`, {
        headers: { Authorization: `Bearer ${mercadoPagoToken}` },
      });

      if (!mpResponse.ok) {
        console.error("Failed to fetch preapproval:", mpResponse.status);
        return new Response("OK", { status: 200, headers: corsHeaders });
      }

      const preapproval = await mpResponse.json();
      console.log("Preapproval status:", preapproval.status);

      // Map MP status to our status
      let newStatus: string;
      switch (preapproval.status) {
        case "authorized":
          newStatus = "active";
          break;
        case "paused":
        case "pending":
          newStatus = "pending";
          break;
        case "cancelled":
          newStatus = "cancelled";
          break;
        default:
          newStatus = "pending";
      }

      // Find subscription by MP preapproval id
      const { data: subscription, error: findError } = await supabase
        .from("subscriptions")
        .select("id, business_id, status, plan_code, billing_period")
        .eq("mercadopago_preapproval_id", data.id)
        .maybeSingle();

      if (findError || !subscription) {
        console.error("Subscription not found for preapproval:", data.id);
        return new Response("OK", { status: 200, headers: corsHeaders });
      }

      // Update subscription status
      const updateData: Record<string, unknown> = {
        status: newStatus,
        cancelled_at: newStatus === "cancelled" ? new Date().toISOString() : null,
      };

      if (newStatus === "active" && preapproval.next_payment_date) {
        updateData.current_period_end = preapproval.next_payment_date;
        updateData.current_period_start = new Date().toISOString();
      }

      await supabase
        .from("subscriptions")
        .update(updateData)
        .eq("id", subscription.id);

      // Update business active status
      if (newStatus === "cancelled" || newStatus === "expired" || newStatus === "pending") {
        await supabase
          .from("businesses")
          .update({ is_active: false })
          .eq("id", subscription.business_id);
      } else if (newStatus === "active") {
        await supabase
          .from("businesses")
          .update({
            is_active: true,
            plan_code: subscription.plan_code,
            billing_period: subscription.billing_period,
            plan_started_at: new Date().toISOString(),
          })
          .eq("id", subscription.business_id);
      }

      console.log(`Subscription ${subscription.id} updated to ${newStatus}`);
    }

    if (type === "payment" && data?.id) {
      // Fetch payment details
      const mpResponse = await fetch(`https://api.mercadopago.com/v1/payments/${data.id}`, {
        headers: { Authorization: `Bearer ${mercadoPagoToken}` },
      });

      if (!mpResponse.ok) {
        console.error("Failed to fetch payment:", mpResponse.status);
        return new Response("OK", { status: 200, headers: corsHeaders });
      }

      const payment = await mpResponse.json();
      
      // If payment is approved and has preapproval_id, update subscription
      if (payment.status === "approved" && payment.metadata?.preapproval_id) {
        const { data: subscription } = await supabase
          .from("subscriptions")
          .select("id, business_id, plan_code, billing_period")
          .eq("mercadopago_preapproval_id", payment.metadata.preapproval_id)
          .maybeSingle();

        if (subscription) {
          await supabase
            .from("subscriptions")
            .update({
              status: "active",
              current_period_start: new Date().toISOString(),
              cancelled_at: null,
            })
            .eq("id", subscription.id);

          await supabase
            .from("businesses")
            .update({
              is_active: true,
              plan_code: subscription.plan_code,
              billing_period: subscription.billing_period,
              plan_started_at: new Date().toISOString(),
            })
            .eq("id", subscription.business_id);
        }
      }
    }

    // Always return 200 to acknowledge receipt
    return new Response("OK", { status: 200, headers: corsHeaders });
  } catch (error) {
    console.error("Webhook error:", error);
    // Still return 200 to prevent MP from retrying
    return new Response("OK", { status: 200, headers: corsHeaders });
  }
});
