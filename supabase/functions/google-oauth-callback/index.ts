import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Paso 2 del "Continuar con Google": Google redirige acá con el código.
// Se canjea por el refresh_token, se guarda la cuenta y se muestra una
// página de "¡Listo!" que avisa a la app (postMessage) y se cierra sola.

const htmlPage = (title: string, message: string, ok: boolean) =>
  new Response(
    `<!doctype html><html lang="es"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${title}</title>
<style>
  body{font-family:system-ui,-apple-system,sans-serif;background:#0d1413;color:#e8f0ef;
    display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;padding:24px;text-align:center}
  .card{max-width:380px;background:#141d1c;border:1px solid #223231;border-radius:20px;padding:32px 24px}
  .emoji{font-size:44px}
  h1{font-size:20px;margin:14px 0 8px}
  p{font-size:14px;line-height:1.5;color:#9fb3b0;margin:0}
  a{display:inline-block;margin-top:20px;background:#00b5b5;color:#04211f;font-weight:700;
    text-decoration:none;padding:12px 22px;border-radius:12px;font-size:15px}
</style></head><body>
<div class="card">
  <div class="emoji">${ok ? "🎉" : "😕"}</div>
  <h1>${title}</h1>
  <p>${message}</p>
  <a href="https://consultoriodigital.app/agenda">Volver a la agenda</a>
</div>
<script>
  try { window.opener && window.opener.postMessage("${ok ? "google-calendar-connected" : "google-calendar-error"}", "*"); } catch (e) {}
  ${ok ? "setTimeout(function(){ try { window.close(); } catch(e) {} }, 2500);" : ""}
</script>
</body></html>`,
    { status: 200, headers: { "Content-Type": "text/html; charset=utf-8" } }
  );

Deno.serve(async (req) => {
  if (req.method !== "GET") return new Response("Method not allowed", { status: 405 });

  try {
    const url = new URL(req.url);
    const code = url.searchParams.get("code");
    const state = url.searchParams.get("state");
    if (!code || !state) {
      return htmlPage("Conexión cancelada", "No se completó el permiso de Google. Podés intentarlo de nuevo desde la agenda.", false);
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
      return htmlPage("El enlace venció", "Volvé a la agenda y tocá 'Continuar con Google' de nuevo.", false);
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
      return htmlPage(
        "No se pudo conectar",
        "Google no entregó el permiso completo. Probá de nuevo (si ya habías conectado antes, desconectá primero desde la agenda).",
        false
      );
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

    return htmlPage(
      "¡Google Calendar conectado!",
      `Tus citas se van a sincronizar al instante${email ? ` con ${email}` : ""}. Ya podés cerrar esta pestaña.`,
      true
    );
  } catch (e) {
    console.error("google-oauth-callback error:", e);
    return htmlPage("Algo salió mal", "Probá de nuevo desde la agenda. Si sigue fallando, avisanos.", false);
  }
});
