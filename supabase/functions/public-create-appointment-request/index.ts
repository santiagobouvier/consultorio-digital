import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.48.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const supabase = createClient(supabaseUrl, serviceRoleKey);

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405, headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { slug, name, email, phone, message, requestedDatetime } = body ?? {};

    if (!slug || !name || !email || !phone || !requestedDatetime) {
      return new Response(
        JSON.stringify({ error: "missing_fields" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const requested = new Date(requestedDatetime);
    if (Number.isNaN(requested.getTime()) || requested <= new Date()) {
      return new Response(
        JSON.stringify({ error: "invalid_datetime" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Find clinic owner by public slug
    const { data: business, error: businessError } = await supabase
      .from("businesses")
      .select("owner_user_id")
      .eq("public_slug", slug)
      .maybeSingle();

    if (businessError) {
      console.error("Error loading business in function:", businessError);
      return new Response(
        JSON.stringify({ error: "business_lookup_failed" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (!business) {
      return new Response(
        JSON.stringify({ error: "business_not_found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const { error: insertError } = await supabase
      .from("appointment_requests")
      .insert({
        clinic_user_id: business.owner_user_id,
        name,
        email,
        phone,
        message: message ?? null,
        requested_datetime: requested.toISOString(),
      });

    if (insertError) {
      console.error("Error inserting appointment request:", insertError);
      return new Response(
        JSON.stringify({ error: "insert_failed" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    return new Response(
      JSON.stringify({ success: true }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    console.error("Unexpected error in public-create-appointment-request:", error);
    return new Response(
      JSON.stringify({ error: "unexpected_error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
