import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Sincronización instantánea con Google Calendar (vía OAuth).
//
// POST { action: "status" }          → { connected, email }
// POST { action: "disconnect" }      → revoca el permiso y borra la cuenta
// POST { action: "sync" }            → empuja a Google las citas nuevas /
//                                      cambiadas / canceladas (idempotente)
// POST { action: "busy", from, to }  → eventos del Google del profesional en
//                                      ese rango (para choques y la grilla),
//                                      salteando los que creamos nosotros.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const ACTIVE_EXCLUDED = ["cancelled", "cancelled_by_patient"];
const SYNC_DAYS_BACK = 1;
const SYNC_DAYS_FORWARD = 120;
const MAX_PUSH_PER_RUN = 50;

const getAccessToken = async (refreshToken: string): Promise<string | null> => {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: Deno.env.get("GOOGLE_OAUTH_CLIENT_ID")!,
      client_secret: Deno.env.get("GOOGLE_OAUTH_CLIENT_SECRET")!,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });
  const data = await res.json();
  if (!res.ok) {
    console.error("refresh token failed:", data);
    return null;
  }
  return data.access_token ?? null;
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const admin = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "No authorization header" }, 401);
    const userClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: authError } = await userClient.auth.getUser();
    if (authError || !user) return json({ error: "Unauthorized" }, 401);

    const body = await req.json().catch(() => ({}));
    const action = body?.action;

    const { data: account } = await admin
      .from("google_calendar_accounts")
      .select("id, business_id, google_email, refresh_token, calendar_id, sync_enabled")
      .eq("professional_user_id", user.id)
      .maybeSingle();

    if (action === "status") {
      return json({ connected: !!account, email: account?.google_email ?? null });
    }

    if (action === "disconnect") {
      if (account) {
        // Revocar el permiso en Google (best effort) y borrar la cuenta
        try {
          await fetch(
            `https://oauth2.googleapis.com/revoke?token=${encodeURIComponent(account.refresh_token)}`,
            { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" } }
          );
        } catch { /* best effort */ }
        await admin.from("google_calendar_accounts").delete().eq("id", account.id);
      }
      return json({ ok: true });
    }

    if (!account) return json({ connected: false, busy: [], pushed: 0 });
    const accessToken = await getAccessToken(account.refresh_token);
    if (!accessToken) {
      // El permiso fue revocado desde Google: se limpia la cuenta
      await admin.from("google_calendar_accounts").delete().eq("id", account.id);
      return json({ connected: false, busy: [], pushed: 0 });
    }
    const calId = encodeURIComponent(account.calendar_id || "primary");
    const gHeaders = {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    };

    if (action === "busy") {
      const from = new Date(String(body?.from ?? ""));
      const to = new Date(String(body?.to ?? ""));
      if (isNaN(from.getTime()) || isNaN(to.getTime()) || to <= from) {
        return json({ error: "Rango inválido" }, 400);
      }
      const params = new URLSearchParams({
        timeMin: from.toISOString(),
        timeMax: to.toISOString(),
        singleEvents: "true",
        orderBy: "startTime",
        maxResults: "100",
      });
      const res = await fetch(
        `https://www.googleapis.com/calendar/v3/calendars/${calId}/events?${params.toString()}`,
        { headers: gHeaders }
      );
      const data = await res.json();
      if (!res.ok) return json({ busy: [], connected: true });
      const busy = (data.items ?? [])
        // Los eventos que creamos NOSOTROS no son "choques": son las citas
        .filter((e: any) => !e?.extendedProperties?.private?.cd_appointment_id)
        .filter((e: any) => e?.start?.dateTime && e?.end?.dateTime && e?.status !== "cancelled")
        .map((e: any) => ({
          start: e.start.dateTime,
          end: e.end.dateTime,
          title: e.summary || "Evento",
          calendar: "Google",
        }));
      return json({ busy, connected: true });
    }

    if (action === "sync") {
      if (!account.sync_enabled) return json({ pushed: 0, connected: true });
      const from = new Date();
      from.setDate(from.getDate() - SYNC_DAYS_BACK);
      const to = new Date();
      to.setDate(to.getDate() + SYNC_DAYS_FORWARD);

      // Citas del profesional (o sin asignar) que cambiaron desde el último push
      const { data: apts } = await admin
        .from("appointments")
        .select("id, start_at, end_at, status, updated_at, google_event_id, google_synced_at, patients (full_name), services (name)")
        .eq("business_id", account.business_id)
        .or(`professional_id.eq.${user.id},professional_id.is.null`)
        .gte("start_at", from.toISOString())
        .lte("start_at", to.toISOString());

      const pending = (apts ?? []).filter((a: any) => {
        const changed = !a.google_synced_at ||
          (a.updated_at && new Date(a.updated_at) > new Date(a.google_synced_at));
        const isCancelled = ACTIVE_EXCLUDED.includes(a.status);
        if (isCancelled) return !!a.google_event_id; // solo si hay algo que borrar allá
        return changed;
      }).slice(0, MAX_PUSH_PER_RUN);

      let pushed = 0;
      for (const a of pending) {
        const isCancelled = ACTIVE_EXCLUDED.includes(a.status);
        try {
          if (isCancelled) {
            await fetch(
              `https://www.googleapis.com/calendar/v3/calendars/${calId}/events/${encodeURIComponent(a.google_event_id)}`,
              { method: "DELETE", headers: gHeaders }
            );
            await admin
              .from("appointments")
              .update({ google_event_id: null, google_synced_at: new Date().toISOString() })
              .eq("id", a.id);
            pushed++;
            continue;
          }

          const patientName = (a as any).patients?.full_name || "Paciente";
          const serviceName = (a as any).services?.name;
          const event = {
            summary: serviceName ? `${patientName} · ${serviceName}` : patientName,
            description: "Cita agendada en Consultorio Digital",
            start: { dateTime: new Date(a.start_at).toISOString() },
            end: { dateTime: new Date(a.end_at).toISOString() },
            extendedProperties: { private: { cd_appointment_id: a.id } },
          };

          let eventId = a.google_event_id as string | null;
          if (eventId) {
            const res = await fetch(
              `https://www.googleapis.com/calendar/v3/calendars/${calId}/events/${encodeURIComponent(eventId)}`,
              { method: "PATCH", headers: gHeaders, body: JSON.stringify(event) }
            );
            if (res.status === 404 || res.status === 410) eventId = null; // lo borraron allá: recrear
            else if (!res.ok) continue;
          }
          if (!eventId) {
            const res = await fetch(
              `https://www.googleapis.com/calendar/v3/calendars/${calId}/events`,
              { method: "POST", headers: gHeaders, body: JSON.stringify(event) }
            );
            if (!res.ok) continue;
            const created = await res.json();
            eventId = created.id;
          }
          await admin
            .from("appointments")
            .update({ google_event_id: eventId, google_synced_at: new Date().toISOString() })
            .eq("id", a.id);
          pushed++;
        } catch (e) {
          console.error("push failed for", a.id, e);
        }
      }
      return json({ pushed, connected: true });
    }

    return json({ error: "Acción desconocida" }, 400);
  } catch (e) {
    console.error("google-calendar-sync error:", e);
    return json({ error: (e as Error)?.message ?? "Error interno" }, 500);
  }
});
