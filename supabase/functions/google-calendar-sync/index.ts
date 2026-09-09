import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Sincronización instantánea con Google Calendar (vía OAuth).
//
// POST { action: "status" }          → { connected, email }
// POST { action: "disconnect" }      → borra de Google los eventos que
//                                      creamos nosotros, revoca el permiso
//                                      y elimina la cuenta
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

// Paleta de colores de eventos de Google (id → hex)
const EVENT_COLORS: Record<string, string> = {
  "1": "#7986cb", "2": "#33b679", "3": "#8e24aa", "4": "#e67c73",
  "5": "#f6bf26", "6": "#f4511e", "7": "#039be5", "8": "#616161",
  "9": "#3f51b5", "10": "#0b8043", "11": "#d50000",
};

// Colores de las etiquetas fijas legadas de eventos personales
const CATEGORY_COLORS: Record<string, string> = {
  personal: "#64748b", salud: "#f43f5e", familia: "#f59e0b", tramite: "#8b5cf6",
  ejercicio: "#22c55e", estudio: "#3b82f6", descanso: "#06b6d4",
};

// El color de la etiqueta → el color de evento de Google más parecido
const nearestColorId = (hex: string | null | undefined): string | null => {
  if (!hex) return null;
  const m = hex.replace("#", "");
  if (m.length !== 6) return null;
  const r = parseInt(m.slice(0, 2), 16);
  const g = parseInt(m.slice(2, 4), 16);
  const b = parseInt(m.slice(4, 6), 16);
  let best: string | null = null;
  let bestDist = Infinity;
  for (const [id, c] of Object.entries(EVENT_COLORS)) {
    const cr = parseInt(c.slice(1, 3), 16);
    const cg = parseInt(c.slice(3, 5), 16);
    const cb = parseInt(c.slice(5, 7), 16);
    const d = (r - cr) ** 2 + (g - cg) ** 2 + (b - cb) ** 2;
    if (d < bestDist) {
      bestDist = d;
      best = id;
    }
  }
  return best;
};
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
        // Desconectar EN SERIO: primero se sacan de Google todos los eventos
        // que creamos nosotros (citas y eventos personales), así el calendario
        // del profesional queda como estaba antes de conectar. Recién después
        // se revoca el permiso y se borra la cuenta.
        const accessToken = await getAccessToken(account.refresh_token);
        const calId = encodeURIComponent(account.calendar_id || "primary");

        const { data: aptRows } = await admin
          .from("appointments")
          .select("id, google_event_id")
          .eq("business_id", account.business_id)
          .or(`professional_id.eq.${user.id},professional_id.is.null`)
          .not("google_event_id", "is", null);
        const { data: pevtRows } = await admin
          .from("personal_events")
          .select("id, google_event_id")
          .eq("professional_user_id", user.id)
          .not("google_event_id", "is", null);

        if (accessToken) {
          const gHeaders = { Authorization: `Bearer ${accessToken}` };
          const eventIds = [
            ...(aptRows ?? []).map((r: any) => r.google_event_id as string),
            ...(pevtRows ?? []).map((r: any) => r.google_event_id as string),
          ];
          // De a 5 en paralelo para que la desconexión no se eternice;
          // 404/410 (ya borrado allá) no es error.
          for (let i = 0; i < eventIds.length; i += 5) {
            await Promise.all(
              eventIds.slice(i, i + 5).map((id) =>
                fetch(
                  `https://www.googleapis.com/calendar/v3/calendars/${calId}/events/${encodeURIComponent(id)}`,
                  { method: "DELETE", headers: gHeaders }
                ).catch(() => null)
              )
            );
          }
        }

        // Los marcadores se limpian con o sin token: si el profesional
        // reconecta, la sincronización crea eventos nuevos desde cero en vez
        // de apuntar a eventos muertos de la conexión anterior.
        if ((aptRows ?? []).length > 0) {
          await admin
            .from("appointments")
            .update({ google_event_id: null, google_synced_at: null })
            .in("id", (aptRows ?? []).map((r: any) => r.id));
        }
        if ((pevtRows ?? []).length > 0) {
          await admin
            .from("personal_events")
            .update({ google_event_id: null, google_synced_at: null })
            .in("id", (pevtRows ?? []).map((r: any) => r.id));
        }

        // Revocar el permiso en Google (best effort) y borrar la cuenta
        try {
          await fetch(
            `https://oauth2.googleapis.com/revoke?token=${encodeURIComponent(account.refresh_token)}`,
            { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" } }
          );
        } catch { /* best effort */ }
        await admin.from("google_calendar_accounts").delete().eq("id", account.id);
      }

      // La otra pata de Google: el calendario conectado por link iCal (la
      // sección "que te avise si chocás") también se desconecta. Desconectar
      // Google = no queda NADA de Google, ni allá ni acá. Los links de otros
      // proveedores (iCloud, etc.) no se tocan.
      const { data: extCals } = await admin
        .from("external_calendars")
        .select("id, ics_url")
        .eq("professional_user_id", user.id);
      const googleFeedIds = (extCals ?? [])
        .filter((c: any) => {
          try {
            return new URL(String(c.ics_url)).host.endsWith("google.com");
          } catch {
            return false;
          }
        })
        .map((c: any) => c.id);
      if (googleFeedIds.length > 0) {
        await admin.from("external_calendars").delete().in("id", googleFeedIds);
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

      // Color por defecto: el del calendario (los eventos sin etiqueta de
      // color propia no traen colorId — Google usa el color del calendario)
      let calendarColor: string | null = null;
      try {
        const calRes = await fetch(
          `https://www.googleapis.com/calendar/v3/users/me/calendarList/${calId}`,
          { headers: gHeaders }
        );
        if (calRes.ok) {
          const calData = await calRes.json();
          calendarColor = calData?.backgroundColor ?? null;
        }
      } catch {
        calendarColor = null;
      }
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
          // Con OAuth podemos borrar el evento desde acá ("borrar y agendar")
          eventId: e.id,
          // Color real del evento en Google (o el del calendario si no tiene)
          color: EVENT_COLORS[e.colorId as string] ?? calendarColor,
        }));
      return json({ busy, connected: true });
    }

    // Borra UN evento del Google del profesional (lo usa "borrar y agendar"
    // cuando una cita nueva choca con algo suyo)
    if (action === "delete-event") {
      const eventId = String(body?.eventId ?? "");
      if (!eventId) return json({ error: "eventId requerido" }, 400);
      const res = await fetch(
        `https://www.googleapis.com/calendar/v3/calendars/${calId}/events/${encodeURIComponent(eventId)}`,
        { method: "DELETE", headers: gHeaders }
      );
      if (!res.ok && res.status !== 404 && res.status !== 410) {
        return json({ error: "No se pudo borrar el evento" }, 500);
      }
      return json({ ok: true });
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
            (a as any).google_event_id = null;
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
            // Peacock: las citas del consultorio se distinguen de un vistazo
            colorId: "7",
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
          (a as any).google_event_id = eventId;
          (a as any).google_synced_at = new Date().toISOString();
          pushed++;
        } catch (e) {
          console.error("push failed for", a.id, e);
        }
      }
      // ── Eventos personales: mismo espejo, con repetición si tienen ──
      const fetchPevts = (withIcon: boolean) =>
        admin
          .from("personal_events")
          .select(
            `id, title, ${withIcon ? "icon, " : ""}start_at, end_at, recurrence, recurrence_until, updated_at, google_event_id, google_synced_at, category, personal_event_labels ( color )`
          )
          .eq("professional_user_id", user.id)
          .lte("start_at", to.toISOString())
          .or(`start_at.gte.${from.toISOString()},recurrence.neq.none`);
      let { data: pevts, error: pevtsErr } = await fetchPevts(true);
      if (pevtsErr) {
        // La columna icon todavía no existe en la base: reintento sin ella
        ({ data: pevts } = await fetchPevts(false));
      }

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
            summary: `${(ev as any).icon ? `${(ev as any).icon} ` : ""}${ev.title || "Evento personal"}`,
            description: "Evento personal de Consultorio Digital",
            start: { dateTime: new Date(ev.start_at).toISOString(), timeZone: "America/Montevideo" },
            end: { dateTime: new Date(ev.end_at).toISOString(), timeZone: "America/Montevideo" },
            extendedProperties: { private: { cd_personal_event_id: ev.id, cd_origin: "consultorio" } },
          };
          if (recurrence) event.recurrence = recurrence;
          // El color de la etiqueta viaja a Google (el más parecido de su paleta)
          const labelHex =
            (ev as any).personal_event_labels?.color ??
            CATEGORY_COLORS[(ev as any).category as string] ??
            null;
          const colorId = nearestColorId(labelHex);
          if (colorId) event.colorId = colorId;

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
          (ev as any).google_event_id = eventId;
          (ev as any).google_synced_at = new Date().toISOString();
          pushed++;
        } catch (e) {
          console.error("push personal failed for", ev.id, e);
        }
      }

      // ── Reconciliación en los DOS sentidos ──
      // Regla: una cosa reemplaza a la otra, nunca conviven desincronizadas.
      //  · borrado acá  → se borra allá
      //  · movido allá  → se mueve acá (eventos simples, no series)
      //  · borrado allá → se ELIMINA acá (si la cita tiene datos atados que
      //    impiden borrarla, queda cancelada como red de seguridad)
      try {
        const aptById = new Map((apts ?? []).map((a: any) => [a.id, a]));
        const perById = new Map((pevts ?? []).map((p: any) => [p.id, p]));

        // Todos nuestros eventos en Google dentro del rango (con paginación)
        const items: any[] = [];
        let pageToken: string | undefined;
        for (let page = 0; page < 4; page++) {
          const listParams = new URLSearchParams({
            timeMin: from.toISOString(),
            timeMax: to.toISOString(),
            singleEvents: "true",
            maxResults: "250",
            privateExtendedProperty: "cd_origin=consultorio",
          });
          if (pageToken) listParams.set("pageToken", pageToken);
          const listRes = await fetch(
            `https://www.googleapis.com/calendar/v3/calendars/${calId}/events?${listParams.toString()}`,
            { headers: gHeaders }
          );
          if (!listRes.ok) throw new Error(`list failed: ${listRes.status}`);
          const listData = await listRes.json();
          items.push(...(listData.items ?? []));
          pageToken = listData.nextPageToken;
          if (!pageToken) break;
        }

        const presentIds = new Set<string>();
        const toDeleteInGoogle = new Set<string>();

        for (const e of items) {
          presentIds.add(e.id);
          if (e.recurringEventId) presentIds.add(e.recurringEventId);
          const p = e?.extendedProperties?.private ?? {};
          const target = e.recurringEventId ?? e.id; // instancia → su serie

          // Borrado acá → borrar allá
          if (p.cd_personal_event_id && !perById.has(p.cd_personal_event_id)) toDeleteInGoogle.add(target);
          if (p.cd_appointment_id && !aptById.has(p.cd_appointment_id)) toDeleteInGoogle.add(target);

          // Movido allá → mover acá (solo eventos simples con horario)
          if (e.recurringEventId || !e.start?.dateTime || !e.end?.dateTime) continue;
          const evUpdated = e.updated ? new Date(e.updated).getTime() : 0;
          const applyMove = async (table: string, row: any) => {
            const syncedAt = row.google_synced_at ? new Date(row.google_synced_at).getTime() : 0;
            const gStart = new Date(e.start.dateTime).getTime();
            const gEnd = new Date(e.end.dateTime).getTime();
            const moved =
              Math.abs(gStart - new Date(row.start_at).getTime()) >= 60_000 ||
              Math.abs(gEnd - new Date(row.end_at).getTime()) >= 60_000;
            // Margen de 2 min: nuestro propio PATCH también actualiza e.updated
            if (moved && evUpdated > syncedAt + 120_000) {
              await admin
                .from(table)
                .update({
                  start_at: new Date(gStart).toISOString(),
                  end_at: new Date(gEnd).toISOString(),
                  google_synced_at: new Date().toISOString(),
                })
                .eq("id", row.id);
              pushed++;
            }
          };
          if (p.cd_appointment_id && aptById.has(p.cd_appointment_id)) {
            const row = aptById.get(p.cd_appointment_id);
            if (!ACTIVE_EXCLUDED.includes(row.status)) await applyMove("appointments", row);
          }
          if (p.cd_personal_event_id && perById.has(p.cd_personal_event_id)) {
            const row = perById.get(p.cd_personal_event_id);
            if (row.recurrence === "none") await applyMove("personal_events", row);
          }
        }

        for (const id of toDeleteInGoogle) {
          await fetch(
            `https://www.googleapis.com/calendar/v3/calendars/${calId}/events/${encodeURIComponent(id)}`,
            { method: "DELETE", headers: gHeaders }
          );
          pushed++;
        }

        // Borrado allá → eliminar acá. Antes de borrar se verifica el evento
        // uno a uno (pudo simplemente moverse fuera del rango listado).
        const confirmGone = async (eventId: string): Promise<boolean> => {
          const res = await fetch(
            `https://www.googleapis.com/calendar/v3/calendars/${calId}/events/${encodeURIComponent(eventId)}`,
            { headers: gHeaders }
          );
          if (res.status === 404 || res.status === 410) return true;
          if (!res.ok) return false; // ante la duda, no borrar nada
          const ev = await res.json();
          return ev?.status === "cancelled";
        };

        for (const a of apts ?? []) {
          if (!a.google_event_id || !a.google_synced_at) continue;
          if (ACTIVE_EXCLUDED.includes(a.status)) continue;
          if (presentIds.has(a.google_event_id)) continue;
          if (!(await confirmGone(a.google_event_id))) continue;
          const { error: delErr } = await admin.from("appointments").delete().eq("id", a.id);
          if (delErr) {
            // Datos atados (pagos, notas): no se puede borrar → cancelada
            await admin
              .from("appointments")
              .update({ status: "cancelled", google_event_id: null, google_synced_at: new Date().toISOString() })
              .eq("id", a.id);
          }
          pushed++;
        }
        for (const pv of pevts ?? []) {
          if (!pv.google_event_id || !pv.google_synced_at) continue;
          if (presentIds.has(pv.google_event_id)) continue;
          if (!(await confirmGone(pv.google_event_id))) continue;
          await admin.from("personal_events").delete().eq("id", pv.id);
          pushed++;
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
