import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Calendario personal del profesional (Google Calendar / iCloud / Outlook).
// El profesional pega el link iCal PRIVADO de su calendario y el sistema lo
// lee del lado del servidor para avisar choques al agendar. Nunca escribimos
// en su calendario; solo lectura.
//
// POST { action: "list" }                      → sus calendarios conectados
// POST { action: "add", url, label?, businessId } → valida el link y lo guarda
// POST { action: "remove", id }                → lo desconecta
// POST { action: "busy", from, to }            → bloques ocupados en ese rango

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

// ── Parser iCal (RFC 5545), lo justo para "ocupado o no" ──

interface RawEvent {
  start: Date;
  durMs: number;
  summary: string;
  rrule: string | null;
  exdates: Set<number>;
}

// Las líneas largas vienen "plegadas": la continuación empieza con espacio
const unfoldLines = (text: string): string[] => {
  const raw = text.split(/\r?\n/);
  const out: string[] = [];
  for (const line of raw) {
    if ((line.startsWith(" ") || line.startsWith("\t")) && out.length > 0) {
      out[out.length - 1] += line.slice(1);
    } else {
      out.push(line);
    }
  }
  return out;
};

// "20260827T150000" en una zona horaria → instante UTC real (doble pasada)
const zonedToUtc = (
  y: number, mo: number, d: number, h: number, mi: number, s: number, tz: string
): Date => {
  const guess = Date.UTC(y, mo - 1, d, h, mi, s);
  let dtf: Intl.DateTimeFormat;
  try {
    dtf = new Intl.DateTimeFormat("en-US", {
      timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit",
      hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false,
    });
  } catch {
    return new Date(guess); // TZID desconocida: mejor aproximado que nada
  }
  const asTz = (t: number) => {
    const p: Record<string, string> = {};
    for (const part of dtf.formatToParts(new Date(t))) p[part.type] = part.value;
    return Date.UTC(+p.year, +p.month - 1, +p.day, (+p.hour) % 24, +p.minute, +p.second);
  };
  let t = guess - (asTz(guess) - guess);
  t = guess - (asTz(t) - t);
  return new Date(t);
};

// DTSTART / DTEND / EXDATE → Date. Devuelve null para eventos de día entero
// (VALUE=DATE): un cumpleaños en Google no debe bloquear todo el día acá.
const parseIcsDate = (params: string, value: string): Date | null => {
  if (/VALUE=DATE(?:;|$)/i.test(params) || /^\d{8}$/.test(value)) return null;
  const m = value.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})(Z?)$/);
  if (!m) return null;
  const [, y, mo, d, h, mi, s, z] = m;
  if (z === "Z") return new Date(Date.UTC(+y, +mo - 1, +d, +h, +mi, +s));
  const tzMatch = params.match(/TZID=([^;:]+)/i);
  if (tzMatch) return zonedToUtc(+y, +mo, +d, +h, +mi, +s, tzMatch[1]);
  return new Date(+y, +mo - 1, +d, +h, +mi, +s); // hora "flotante": local del server
};

const parseIcs = (text: string): RawEvent[] => {
  const lines = unfoldLines(text);
  const events: RawEvent[] = [];
  let cur: Partial<RawEvent> & { end?: Date | null } | null = null;
  for (const line of lines) {
    if (line === "BEGIN:VEVENT") {
      cur = { summary: "Evento", rrule: null, exdates: new Set() };
      continue;
    }
    if (line === "END:VEVENT") {
      if (cur?.start && !isNaN(cur.start.getTime())) {
        const durMs = cur.end && cur.end > cur.start
          ? cur.end.getTime() - cur.start.getTime()
          : 30 * 60 * 1000;
        events.push({
          start: cur.start,
          durMs,
          summary: cur.summary || "Evento",
          rrule: cur.rrule ?? null,
          exdates: cur.exdates ?? new Set(),
        });
      }
      cur = null;
      continue;
    }
    if (!cur) continue;
    const idx = line.indexOf(":");
    if (idx < 0) continue;
    const left = line.slice(0, idx);
    const value = line.slice(idx + 1).trim();
    const [prop, ...paramParts] = left.split(";");
    const params = paramParts.join(";");
    switch (prop.toUpperCase()) {
      case "DTSTART":
        cur.start = parseIcsDate(params, value) ?? undefined;
        break;
      case "DTEND":
        cur.end = parseIcsDate(params, value);
        break;
      case "SUMMARY":
        cur.summary = value.replace(/\\,/g, ",").replace(/\\;/g, ";").replace(/\\n/gi, " ").replace(/\\\\/g, "\\");
        break;
      case "RRULE":
        cur.rrule = value;
        break;
      case "EXDATE":
        for (const v of value.split(",")) {
          const d = parseIcsDate(params, v.trim());
          if (d) cur.exdates!.add(d.getTime());
        }
        break;
      case "STATUS":
        if (value.toUpperCase() === "CANCELLED") cur.start = undefined;
        break;
    }
  }
  return events;
};

// Expansión de RRULE (lo común: DAILY / WEEKLY+BYDAY / MONTHLY / YEARLY,
// con INTERVAL, COUNT y UNTIL). Suficiente para calendarios personales.
const BYDAY_MAP: Record<string, number> = { SU: 0, MO: 1, TU: 2, WE: 3, TH: 4, FR: 5, SA: 6 };
const DAY_MS = 86400000;

const expandEvent = (
  ev: RawEvent, windowFrom: Date, windowTo: Date
): { start: Date; end: Date; title: string }[] => {
  const out: { start: Date; end: Date; title: string }[] = [];
  const pushIfVisible = (start: Date) => {
    if (ev.exdates.has(start.getTime())) return;
    const end = new Date(start.getTime() + ev.durMs);
    if (end > windowFrom && start < windowTo) {
      out.push({ start, end, title: ev.summary });
    }
  };

  if (!ev.rrule) {
    pushIfVisible(ev.start);
    return out;
  }

  const rule: Record<string, string> = {};
  for (const part of ev.rrule.split(";")) {
    const [k, v] = part.split("=");
    if (k && v) rule[k.toUpperCase()] = v;
  }
  const freq = rule.FREQ?.toUpperCase();
  if (!freq) return out;
  const interval = Math.max(1, parseInt(rule.INTERVAL || "1", 10) || 1);
  const count = rule.COUNT ? parseInt(rule.COUNT, 10) : null;
  let until: Date | null = null;
  if (rule.UNTIL) until = parseIcsDate("", rule.UNTIL) ?? null;
  const byday = freq === "WEEKLY" && rule.BYDAY
    ? rule.BYDAY.split(",").map((d) => BYDAY_MAP[d.slice(-2)]).filter((n) => n != null)
    : null;

  // Semana de referencia (lunes) para el INTERVAL semanal
  const weekStart = (d: Date) => {
    const x = new Date(d); x.setHours(0, 0, 0, 0);
    x.setDate(x.getDate() - ((x.getDay() + 6) % 7));
    return x.getTime();
  };
  const baseWeek = weekStart(ev.start);
  const startDay = new Date(ev.start); startDay.setHours(0, 0, 0, 0);

  let matched = 0;
  const hardStop = new Date(Math.min(windowTo.getTime(), (until ?? windowTo).getTime()));
  // Se recorre día a día desde el inicio del evento (tope de seguridad: 5 años)
  const maxDays = Math.min(Math.ceil((hardStop.getTime() - startDay.getTime()) / DAY_MS) + 1, 1830);
  for (let i = 0; i < maxDays; i++) {
    const day = new Date(startDay.getTime() + i * DAY_MS);
    let matches = false;
    if (freq === "DAILY") {
      matches = i % interval === 0;
    } else if (freq === "WEEKLY") {
      const weeksDiff = Math.round((weekStart(day) - baseWeek) / (7 * DAY_MS));
      const dow = day.getDay();
      matches = weeksDiff % interval === 0 &&
        (byday ? byday.includes(dow) : dow === ev.start.getDay());
      if (i === 0) matches = true; // la primera instancia siempre cuenta
    } else if (freq === "MONTHLY") {
      const monthsDiff = (day.getFullYear() - ev.start.getFullYear()) * 12 + (day.getMonth() - ev.start.getMonth());
      matches = day.getDate() === ev.start.getDate() && monthsDiff % interval === 0;
    } else if (freq === "YEARLY") {
      matches = day.getDate() === ev.start.getDate() &&
        day.getMonth() === ev.start.getMonth() &&
        (day.getFullYear() - ev.start.getFullYear()) % interval === 0;
    }
    if (!matches) continue;
    const occStart = new Date(day);
    occStart.setHours(ev.start.getHours(), ev.start.getMinutes(), ev.start.getSeconds(), 0);
    if (until && occStart > until) break;
    matched++;
    if (count && matched > count) break;
    pushIfVisible(occStart);
    if (out.length >= 500) break;
  }
  return out;
};

const normalizeUrl = (raw: string): string | null => {
  let u = raw.trim();
  if (u.startsWith("webcal://")) u = "https://" + u.slice("webcal://".length);
  if (!u.startsWith("https://")) return null;
  try { new URL(u); } catch { return null; }
  return u;
};

const guessLabel = (url: string): string => {
  if (url.includes("calendar.google.com")) return "Google Calendar";
  if (url.includes("icloud.com")) return "Calendario de iPhone";
  if (url.includes("outlook")) return "Outlook";
  return "Mi calendario";
};

const fetchIcs = async (url: string): Promise<string | null> => {
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 10000);
    const res = await fetch(url, { signal: ctrl.signal, redirect: "follow" });
    clearTimeout(t);
    if (!res.ok) return null;
    const text = await res.text();
    if (text.length > 3_000_000) return text.slice(0, 3_000_000);
    return text;
  } catch {
    return null;
  }
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
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

    if (action === "list") {
      const { data } = await admin
        .from("external_calendars")
        .select("id, label, ics_url, created_at")
        .eq("professional_user_id", user.id)
        .order("created_at");
      // El link es secreto: al frontend solo va el dominio, no la URL entera
      const rows = (data ?? []).map((r: any) => ({
        id: r.id,
        label: r.label,
        host: (() => { try { return new URL(r.ics_url).host; } catch { return ""; } })(),
        created_at: r.created_at,
      }));
      return json({ calendars: rows });
    }

    if (action === "add") {
      const url = normalizeUrl(String(body?.url ?? ""));
      if (!url) return json({ error: "El link no es válido. Tiene que empezar con https:// o webcal://" }, 400);
      const ics = await fetchIcs(url);
      if (!ics || !ics.includes("BEGIN:VCALENDAR")) {
        return json({ error: "Ese link no devuelve un calendario. Fijate de copiar la dirección iCal (termina en .ics)." }, 400);
      }
      const { count } = await admin
        .from("external_calendars")
        .select("id", { count: "exact", head: true })
        .eq("professional_user_id", user.id);
      if ((count ?? 0) >= 3) return json({ error: "Podés conectar hasta 3 calendarios." }, 400);
      const label = String(body?.label ?? "").trim() || guessLabel(url);
      const { data, error } = await admin
        .from("external_calendars")
        .insert({
          professional_user_id: user.id,
          business_id: body?.businessId ?? null,
          label,
          ics_url: url,
        })
        .select("id, label")
        .single();
      if (error) throw error;
      return json({ ok: true, calendar: data });
    }

    if (action === "remove") {
      const id = String(body?.id ?? "");
      if (!id) return json({ error: "id requerido" }, 400);
      await admin
        .from("external_calendars")
        .delete()
        .eq("id", id)
        .eq("professional_user_id", user.id);
      return json({ ok: true });
    }

    if (action === "busy") {
      const from = new Date(String(body?.from ?? ""));
      const to = new Date(String(body?.to ?? ""));
      if (isNaN(from.getTime()) || isNaN(to.getTime()) || to <= from) {
        return json({ error: "Rango inválido" }, 400);
      }
      const { data: cals } = await admin
        .from("external_calendars")
        .select("id, label, ics_url")
        .eq("professional_user_id", user.id);
      if (!cals || cals.length === 0) return json({ busy: [], connected: 0 });

      const busy: { start: string; end: string; title: string; calendar: string }[] = [];
      await Promise.all(
        cals.map(async (cal: any) => {
          const ics = await fetchIcs(cal.ics_url);
          if (!ics) return;
          for (const ev of parseIcs(ics)) {
            for (const occ of expandEvent(ev, from, to)) {
              busy.push({
                start: occ.start.toISOString(),
                end: occ.end.toISOString(),
                title: occ.title,
                calendar: cal.label,
              });
            }
          }
        })
      );
      busy.sort((a, b) => a.start.localeCompare(b.start));
      return json({ busy: busy.slice(0, 300), connected: cals.length });
    }

    return json({ error: "Acción desconocida" }, 400);
  } catch (e) {
    console.error("external-calendar error:", e);
    return json({ error: (e as Error)?.message ?? "Error interno" }, 500);
  }
});
