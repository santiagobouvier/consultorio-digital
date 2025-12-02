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
    const { slug } = body ?? {};

    if (!slug || typeof slug !== "string") {
      return new Response(
        JSON.stringify({ error: "missing_or_invalid_slug" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Find business by public slug
    const { data: business, error: businessError } = await supabase
      .from("businesses")
      .select("id")
      .eq("public_slug", slug)
      .maybeSingle();

    if (businessError) {
      console.error("Error loading business in public-get-availability-slots:", businessError);
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

    // Get available future slots for this business
    const today = new Date();
    const todayStr = today.toISOString().slice(0, 10); // yyyy-mm-dd

    const { data: slots, error: slotsError } = await supabase
      .from("availability_slots")
      .select("id, date, start_time, end_time, modality, price")
      .eq("business_id", business.id)
      .eq("status", "available")
      .gte("date", todayStr)
      .order("date", { ascending: true })
      .order("start_time", { ascending: true });

    if (slotsError) {
      console.error("Error loading slots in public-get-availability-slots:", slotsError);
      return new Response(
        JSON.stringify({ error: "slots_lookup_failed" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    return new Response(
      JSON.stringify({ slots: slots ?? [] }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    console.error("Unexpected error in public-get-availability-slots:", error);
    return new Response(
      JSON.stringify({ error: "unexpected_error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
