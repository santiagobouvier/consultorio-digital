import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.49.4";

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
    const mercadoPagoToken = Deno.env.get("MERCADOPAGO_ACCESS_TOKEN");

    if (!mercadoPagoToken) {
      throw new Error("MERCADOPAGO_ACCESS_TOKEN not configured");
    }

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

    // Get user's business
    const { data: business } = await supabaseAdmin
      .from("businesses")
      .select("id")
      .eq("owner_user_id", user.id)
      .maybeSingle();

    if (!business) {
      return new Response(JSON.stringify({ error: "No business found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get latest subscription
    const { data: sub } = await supabaseAdmin
      .from("subscriptions")
      .select("*")
      .eq("business_id", business.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!sub) {
      return new Response(JSON.stringify({ error: "No subscription found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Cancel on Mercado Pago if preapproval exists
    if (sub.mercadopago_preapproval_id) {
      const mpResponse = await fetch(
        `https://api.mercadopago.com/preapproval/${sub.mercadopago_preapproval_id}`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${mercadoPagoToken}`,
          },
          body: JSON.stringify({ status: "cancelled" }),
        }
      );

      if (!mpResponse.ok) {
        const mpError = await mpResponse.json();
        console.error("MP cancel error:", JSON.stringify(mpError));
        // Continue with local cancel even if MP fails
      }
    }

    // Update subscription in DB
    await supabaseAdmin
      .from("subscriptions")
      .update({
        status: "cancelled",
        cancelled_at: new Date().toISOString(),
      })
      .eq("id", sub.id);

    return new Response(
      JSON.stringify({ success: true, message: "Subscription cancelled" }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Error cancelling subscription:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Internal server error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
