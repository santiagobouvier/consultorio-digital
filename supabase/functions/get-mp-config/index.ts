import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const appId = Deno.env.get("MERCADOPAGO_APP_ID");
  if (!appId) {
    return new Response(JSON.stringify({ error: "MERCADOPAGO_APP_ID not configured" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  return new Response(JSON.stringify({ app_id: appId }), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});