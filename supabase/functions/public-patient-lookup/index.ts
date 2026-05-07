import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { email } = await req.json();

    if (!email || typeof email !== "string") {
      return new Response(
        JSON.stringify({ error: "Email requerido" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const trimmed = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      return new Response(
        JSON.stringify({ error: "Email inválido" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Find patients by email
    const { data: patients, error } = await supabase
      .from("patients")
      .select("business_id")
      .eq("email", trimmed)
      .eq("is_active", true);

    if (error) {
      console.error("Error querying patients:", error);
      return new Response(
        JSON.stringify({ error: "Error interno" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!patients || patients.length === 0) {
      return new Response(
        JSON.stringify({ clinics: [] }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get unique business IDs
    const businessIds = [...new Set(patients.map((p) => p.business_id))];

    // Fetch only public-safe business info
    const { data: businesses, error: bizError } = await supabase
      .from("businesses")
      .select("public_slug, name, specialty, portal_logo_url, portal_clinic_display_name")
      .in("id", businessIds)
      .eq("is_active", true);

    if (bizError) {
      console.error("Error querying businesses:", bizError);
      return new Response(
        JSON.stringify({ error: "Error interno" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const clinics = (businesses || []).map((b) => ({
      slug: b.public_slug,
      name: b.portal_clinic_display_name || b.name,
      specialty: b.specialty,
      logo_url: b.portal_logo_url,
    }));

    return new Response(
      JSON.stringify({ clinics }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("Unexpected error:", err);
    return new Response(
      JSON.stringify({ error: "Error interno del servidor" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});