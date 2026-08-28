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
        // Lo que creamos NOSOTROS no es "choque": citas y eventos del sistema
        .filter((e: any) => {
          const p = e?.extendedProperties?.private;
          return !p?.cd_appointment_id && !p?.cd_personal_event_id && !p?.cd_origin;
        })
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
            extendedProperties: { private: { cd_appointment_id: a.id, cd_origin: "consultorio" } },
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
      // ── Eventos personales: mismo espejo, con repetición si tienen ──
      const { data: pevts } = await admin
        .from("personal_events")
        .select("id, title, start_at, end_at, recurrence, recurrence_until, updated_at, google_event_id, google_synced_at")
        .eq("professional_user_id", user.id)
        .lte("start_at", to.toISOString())
        .or(`start_at.gte.${from.toISOString()},recurrence.neq.none`);

      const RECUR_FREQ: Record<string, string> = { daily: "DAILY", weekly: "WEEKLY", monthly: "MONTHLY" };
      const pendingPersonal = (pevts ?? [])
        .filter((ev: any) =>
          !ev.google_synced_at ||
          (ev.updated_at && new Date(ev.updated_at) > new Date(ev.google_synced_at))
        )
        .slice(0, MAX_PUSH_PER_RUN);

      for (const ev of pendingPersonal) {
        try {
          const freq = RECUR_FREQ[ev.recurrence];
          let recurrence: string[] | undefined;
          if (freq) {
            const until = ev.recurrence_until
              ? `;UNTIL=${String(ev.recurrence_until).slice(0, 10).replace(/-/g, "")}T235959Z`
              : "";
            recurrence = [`RRULE:FREQ=${freq}${until}`];
          }
          const event: Record<string, unknown> = {
            summary: ev.title || "Evento personal",
            description: "Evento personal de Consultorio Digital",
            start: { dateTime: new Date(ev.start_at).toISOString(), timeZone: "America/Montevideo" },
            end: { dateTime: new Date(ev.end_at).toISOString(), timeZone: "America/Montevideo" },
            extendedProperties: { private: { cd_personal_event_id: ev.id, cd_origin: "consultorio" } },
          };
          if (recurrence) event.recurrence = recurrence;

          let eventId = ev.google_event_id as string | null;
          if (eventId) {
            const res = await fetch(
              `https://www.googleapis.com/calendar/v3/calendars/${calId}/events/${encodeURIComponent(eventId)}`,
              { method: "PATCH", headers: gHeaders, body: JSON.stringify(event) }
            );
            if (res.status === 404 || res.status === 410) eventId = null;
            else if (!res.ok) continue;
          }
          if (!eventId) {
            const res = await fetch(
              `https://www.googleapis.com/calendar/v3/calendars/${calId}/events`,
              { method: "POST", headers: gHeaders, body: JSON.stringify(event) }
            );
            if (!res.ok) continue;
            eventId = (await res.json()).id;
          }
          await admin
            .from("personal_events")
            .update({ google_event_id: eventId, google_synced_at: new Date().toISOString() })
            .eq("id", ev.id);
          pushed++;
        } catch (e) {
          console.error("push personal failed for", ev.id, e);
        }
      }

      // ── Reconciliación: lo que se borró acá, se borra allá también ──
      // Se listan los eventos con nuestra marca (cd_origin) y se elimina
      // todo el que ya no exista en el sistema (citas o eventos borrados).
      try {
        const aptIds = new Set((apts ?? []).map((a: any) => a.id));
        const perIds = new Set((pevts ?? []).map((p: any) => p.id));
        const listParams = new URLSearchParams({
          timeMin: from.toISOString(),
          timeMax: to.toISOString(),
          singleEvents: "true",
          maxResults: "250",
          privateExtendedProperty: "cd_origin=consultorio",
        });
        const listRes = await fetch(
          `https://www.googleapis.com/calendar/v3/calendars/${calId}/events?${listParams.toString()}`,
          { headers: gHeaders }
        );
        if (listRes.ok) {
          const listData = await listRes.json();
          const toDelete = new Set<string>();
          for (const e of listData.items ?? []) {
            const p = e?.extendedProperties?.private ?? {};
            const target = e.recurringEventId ?? e.id; // instancia → su serie
            if (p.cd_personal_event_id && !perIds.has(p.cd_personal_event_id)) toDelete.add(target);
            if (p.cd_appointment_id && !aptIds.has(p.cd_appointment_id)) toDelete.add(target);
          }
          for (const id of toDelete) {
            await fetch(
              `https://www.googleapis.com/calendar/v3/calendars/${calId}/events/${encodeURIComponent(id)}`,
              { method: "DELETE", headers: gHeaders }
            );
            pushed++;
          }
        }
      } catch (e) {
        console.error("reconcile failed:", e);
      }

      return json({ pushed, connected: true });
    }

    return json({ error: "Acción desconocida" }, 400);
  } catch (e) {
    console.error("google-calendar-sync error:", e);
    return json({ error: (e as Error)?.message ?? "Error interno" }, 500);
  }
});
