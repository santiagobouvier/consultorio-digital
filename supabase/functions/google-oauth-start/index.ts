import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Paso 1 del "Continuar con Google": genera la URL de consentimiento.
// El state es una fila en google_oauth_states que ata el callback al
// profesional que inició la conexión (el callback llega sin sesión).

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const clientId = Deno.env.get("GOOGLE_OAUTH_CLIENT_ID");
    if (!clientId) return json({ error: "Falta configurar GOOGLE_OAUTH_CLIENT_ID" }, 500);

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "No authorization header" }, 401);
    const userClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: authError } = await userClient.auth.getUser();
    if (authError || !user) return json({ error: "Unauthorized" }, 401);

    const body = await req.json().catch(() => ({}));
    const admin = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: stateRow, error } = await admin
      .from("google_oauth_states")
      .insert({ professional_user_id: user.id, business_id: body?.businessId ?? null })
      .select("state")
      .single();
    if (error) throw error;

    const redirectUri = `${supabaseUrl}/functions/v1/google-oauth-callback`;
    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: "code",
      scope: "https://www.googleapis.com/auth/calendar.events openid email",
      access_type: "offline",
      prompt: "consent",
      state: stateRow.state,
    });
    return json({ url: `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}` });
  } catch (e) {
    console.error("google-oauth-start error:", e);
    return json({ error: (e as Error)?.message ?? "Error interno" }, 500);
  }
});
