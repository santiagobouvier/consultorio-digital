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
    // Validate JWT
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userId = claimsData.claims.sub as string;

    // Parse body
    const { code, business_id } = await req.json();

    if (!code || typeof code !== "string") {
      return new Response(JSON.stringify({ error: "Missing 'code' parameter" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!business_id || typeof business_id !== "string") {
      return new Response(JSON.stringify({ error: "Missing 'business_id' parameter" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verify user belongs to this business
    const { data: business, error: bizError } = await supabase
      .from("businesses")
      .select("id, owner_user_id")
      .eq("id", business_id)
      .single();

    if (bizError || !business) {
      return new Response(JSON.stringify({ error: "Business not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (business.owner_user_id !== userId) {
      return new Response(JSON.stringify({ error: "Only the business owner can connect Mercado Pago" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Exchange OAuth code for tokens with Mercado Pago
    const mpAppId = Deno.env.get("MERCADOPAGO_APP_ID");
    const mpClientSecret = Deno.env.get("MERCADOPAGO_CLIENT_SECRET");

    if (!mpAppId || !mpClientSecret) {
      return new Response(JSON.stringify({ error: "Mercado Pago OAuth not configured on server" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const mpResponse = await fetch("https://api.mercadopago.com/oauth/token", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        client_id: mpAppId,
        client_secret: mpClientSecret,
        code,
        grant_type: "authorization_code",
        redirect_uri: "https://consultoriodigital.app/billing?mp_connected=true",
      }),
    });

    if (!mpResponse.ok) {
      const errBody = await mpResponse.text();
      console.error("MP OAuth exchange failed:", mpResponse.status, errBody);
      return new Response(JSON.stringify({ error: "Failed to exchange code with Mercado Pago" }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const mpData = await mpResponse.json();
    const accessToken = mpData.access_token;
    const publicKey = mpData.public_key;

    if (!accessToken) {
      return new Response(JSON.stringify({ error: "No access_token received from Mercado Pago" }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Upsert payment_policies with the MP credentials (use service role for writing tokens)
    const supabaseService = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const { error: upsertError } = await supabaseService
      .from("payment_policies")
      .upsert(
        {
          business_id,
          mp_access_token: accessToken,
          mp_public_key: publicKey || null,
        },
        { onConflict: "business_id" }
      );

    if (upsertError) {
      console.error("Failed to save MP tokens:", upsertError);
      return new Response(JSON.stringify({ error: "Failed to save credentials" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("connect-mercadopago error:", error);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});