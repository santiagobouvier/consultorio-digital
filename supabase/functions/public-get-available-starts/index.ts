import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.48.0";

// Horarios 2.0: inicios disponibles para la reserva pública (sin login).
// El visitante elige un tipo de sesión (service) y esta función devuelve los
// comienzos que caben según su duración, calculados por get_available_starts.
// Privacidad: solo fecha/horas + datos del servicio. Nada de pacientes.

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
    const { slug, serviceId, days } = await req.json().catch(() => ({}));
    if (!slug || typeof slug !== "string") {
      return new Response(
        JSON.stringify({ error: "missing_params" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Negocio por slug público (fallback: subdominio propio)
    let business: { id: string } | null = null;
    const bySlug = await supabase.from("businesses").select("id").eq("public_slug", slug).maybeSingle();
    business = bySlug.data;
    if (!business) {
      const bySub = await supabase.from("businesses").select("id").eq("custom_subdomain", slug).maybeSingle();
      business = bySub.data;
    }
    if (!business) {
      return new Response(
        JSON.stringify({ error: "business_not_found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Sin serviceId: devolver el menú de tipos de sesión activos (para que la
    // página de reserva arme el paso "elegí tu tipo de sesión").
    if (!serviceId || typeof serviceId !== "string") {
      const { data: services } = await supabase
        .from("services")
        .select("id, name, duration_minutes, mode, suggested_price")
        .eq("business_id", business.id)
        .eq("is_active", true)
        .order("duration_minutes", { ascending: true });
      return new Response(
        JSON.stringify({ services: services ?? [] }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Servicio: debe pertenecer al negocio y estar activo
    const { data: service } = await supabase
      .from("services")
      .select("id, name, duration_minutes, mode, suggested_price")
      .eq("id", serviceId)
      .eq("business_id", business.id)
      .eq("is_active", true)
      .maybeSingle();

    if (!service) {
      return new Response(
        JSON.stringify({ error: "service_not_found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const horizon = Math.min(Math.max(Number(days) || 30, 1), 60);
    const from = new Date().toISOString().slice(0, 10);
    const toDate = new Date();
    toDate.setDate(toDate.getDate() + horizon);

    const { data: starts, error } = await supabase.rpc("get_available_starts", {
      p_business_id: business.id,
      p_professional_user_id: null,
      p_duration_minutes: service.duration_minutes,
      p_from: from,
      p_to: toDate.toISOString().slice(0, 10),
    });

    if (error) throw error;

    return new Response(
      JSON.stringify({ service, starts: (starts ?? []).slice(0, 300) }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    console.error("public-get-available-starts error:", error);
    return new Response(
      JSON.stringify({ error: "unexpected_error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
