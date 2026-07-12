import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.48.0";

// Public availability for the booking page (no login).
// Privacy: returns ONLY the minimum needed to pick a slot — date, times,
// modality and price of AVAILABLE future slots. No patient data, no notes,
// no professional identifiers. The rest of the agenda stays private.

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
    const { slug } = await req.json().catch(() => ({}));
    if (!slug || typeof slug !== "string") {
      return new Response(
        JSON.stringify({ error: "missing_slug" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Resolve business by public slug (fallback: custom subdomain)
    let business: { id: string } | null = null;
    const bySlug = await supabase
      .from("businesses")
      .select("id")
      .eq("public_slug", slug)
      .maybeSingle();
    business = bySlug.data;

    if (!business) {
      const bySubdomain = await supabase
        .from("businesses")
        .select("id")
        .eq("custom_subdomain", slug)
        .maybeSingle();
      business = bySubdomain.data;
    }

    if (!business) {
      return new Response(
        JSON.stringify({ error: "business_not_found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Available future slots, next 60 days, minimal fields only
    const today = new Date().toISOString().slice(0, 10);
    const future = new Date();
    future.setDate(future.getDate() + 60);
    const futureStr = future.toISOString().slice(0, 10);

    const { data: slots, error } = await supabase
      .from("availability_slots")
      .select("id, date, start_time, end_time, modality, price")
      .eq("business_id", business.id)
      .eq("status", "available")
      .gte("date", today)
      .lte("date", futureStr)
      .order("date", { ascending: true })
      .order("start_time", { ascending: true })
      .limit(50);

    if (error) throw error;

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
