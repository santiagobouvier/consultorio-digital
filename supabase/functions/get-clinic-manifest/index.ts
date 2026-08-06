import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.48.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const slug = url.searchParams.get("slug");

    if (!slug) {
      return new Response(JSON.stringify({ error: "slug is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { data: business, error } = await supabase
      .from("businesses")
      .select("name, portal_clinic_display_name, portal_logo_url, portal_primary_color, specialty, public_slug")
      .eq("public_slug", slug)
      .limit(1)
      .maybeSingle();

    if (error || !business) {
      return new Response(JSON.stringify({ error: "Clinic not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const displayName = business.portal_clinic_display_name || business.name || "Consultorio";
    const logoUrl = business.portal_logo_url || "";
    
    // Convert HSL string like "176 100% 32%" to hex for theme_color
    const hslParts = (business.portal_primary_color || "176 100% 32%").split(" ");
    const h = parseFloat(hslParts[0] || "176");
    const s = parseFloat((hslParts[1] || "100%").replace("%", "")) / 100;
    const l = parseFloat((hslParts[2] || "32%").replace("%", "")) / 100;
    
    // HSL to hex conversion
    const hslToHex = (h: number, s: number, l: number): string => {
      const a = s * Math.min(l, 1 - l);
      const f = (n: number) => {
        const k = (n + h / 30) % 12;
        const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
        return Math.round(255 * color).toString(16).padStart(2, "0");
      };
      return `#${f(0)}${f(8)}${f(4)}`;
    };

    const themeColor = hslToHex(h, s, l);

    // Origen de la app (el sitio donde vive el portal). El manifest se sirve
    // desde el dominio de Supabase, así que TODAS las URLs deben ser absolutas:
    // los navegadores resuelven start_url/scope contra la URL del manifest y,
    // si quedan relativas, la app instalada apunta al dominio equivocado.
    const appOrigin = url.searchParams.get("origin") || "https://consultoriodigital.app";

    // Build icons array - use logo if available, fallback to generic
    const icons: Array<{ src: string; sizes: string; type: string; purpose?: string }> = [];

    if (logoUrl) {
      icons.push(
        { src: logoUrl, sizes: "192x192", type: "image/png", purpose: "any maskable" },
        { src: logoUrl, sizes: "512x512", type: "image/png", purpose: "any maskable" }
      );
    } else {
      // Fallback to default app icons
      icons.push(
        { src: `${appOrigin}/app-icon-192.png`, sizes: "192x192", type: "image/png" },
        { src: `${appOrigin}/app-icon-512.png`, sizes: "512x512", type: "image/png" }
      );
    }

    // area=dashboard → app del PROFESIONAL: misma marca del consultorio pero
    // arranca en su panel. id propio por consultorio para que en un mismo
    // celular convivan apps de consultorios distintos sin pisarse.
    const isDashboard = url.searchParams.get("area") === "dashboard";

    const manifest = {
      id: isDashboard ? `${appOrigin}/app/${slug}` : `${appOrigin}/portal/${slug}`,
      name: displayName,
      short_name: displayName.length > 12 ? displayName.substring(0, 12) : displayName,
      description: business.specialty ? `${displayName} — ${business.specialty}` : displayName,
      lang: "es",
      start_url: isDashboard ? `${appOrigin}/dashboard` : `${appOrigin}/portal/${slug}`,
      scope: isDashboard ? `${appOrigin}/` : `${appOrigin}/portal/${slug}`,
      display: "standalone",
      orientation: "any",
      // Fondo del splash de arranque: SIEMPRE oscuro (regla de la casa:
      // ninguna pantalla de carga blanca), a juego con el splash del index.
      background_color: "#242e2e",
      theme_color: themeColor,
      icons,
    };

    return new Response(JSON.stringify(manifest), {
      headers: {
        ...corsHeaders,
        "Content-Type": "application/manifest+json",
        "Cache-Control": "public, max-age=3600",
      },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: "Internal error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
