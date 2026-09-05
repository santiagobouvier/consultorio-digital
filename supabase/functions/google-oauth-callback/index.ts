import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Paso 2 del "Conectar Google Calendar": Google redirige acá con el código.
// Se canjea por el refresh_token, se guarda la cuenta y se REDIRIGE de vuelta
// a la agenda de la app con ?google=conectado — la app abre el modal de
// "Mi calendario" y muestra el estado. Nada de páginas intermedias.

const APP_URL = "https://consultoriodigital.app";

const backToApp = (params: Record<string, string>) => {
  const qs = new URLSearchParams(params).toString();
  return new Response(null, {
    status: 302,
    headers: { Location: `${APP_URL}/agenda?${qs}` },
  });
};

Deno.serve(async (req) => {
  if (req.method !== "GET") return new Response("Method not allowed", { status: 405 });

  try {
    const url = new URL(req.url);
    const code = url.searchParams.get("code");
    const state = url.searchParams.get("state");
    if (!code || !state) {
      return backToApp({ google: "error", motivo: "cancelado" });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const admin = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    // El state ata este callback al profesional que inició (y expira a los 15 min)
    const { data: stateRow } = await admin
      .from("google_oauth_states")
      .select("state, professional_user_id, business_id, created_at")
      .eq("state", state)
      .maybeSingle();
    if (!stateRow || Date.now() - new Date(stateRow.created_at).getTime() > 15 * 60 * 1000) {
      return backToApp({ google: "error", motivo: "vencido" });
    }
    await admin.from("google_oauth_states").delete().eq("state", state);

    // Canje del código por tokens
    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: Deno.env.get("GOOGLE_OAUTH_CLIENT_ID")!,
        client_secret: Deno.env.get("GOOGLE_OAUTH_CLIENT_SECRET")!,
        redirect_uri: `${supabaseUrl}/functions/v1/google-oauth-callback`,
        grant_type: "authorization_code",
      }),
    });
    const tokens = await tokenRes.json();
    if (!tokenRes.ok || !tokens.refresh_token) {
      console.error("token exchange failed:", tokens);
      return backToApp({ google: "error", motivo: "permiso" });
    }

    // Email de la cuenta, del id_token (viene directo de Google por TLS)
    let email: string | null = null;
    try {
      const payload = JSON.parse(atob(String(tokens.id_token).split(".")[1].replace(/-/g, "+").replace(/_/g, "/")));
      email = payload?.email ?? null;
    } catch {
      email = null;
    }

    const { error } = await admin.from("google_calendar_accounts").upsert(
      {
        professional_user_id: stateRow.professional_user_id,
        business_id: stateRow.business_id,
        google_email: email,
        refresh_token: tokens.refresh_token,
        sync_enabled: true,
      },
      { onConflict: "professional_user_id" }
    );
    if (error) throw error;

    return backToApp(email ? { google: "conectado", email } : { google: "conectado" });
  } catch (e) {
    console.error("google-oauth-callback error:", e);
    return backToApp({ google: "error", motivo: "error" });
  }
});
