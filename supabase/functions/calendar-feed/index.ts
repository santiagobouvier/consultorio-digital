import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.48.0";

// Feed iCal privado: la agenda del profesional en Google Calendar / iPhone.
// GET ?token=<uuid> → text/calendar con sus turnos (y eventos personales).
// El token vive en calendar_feed_tokens; sin token válido no sale nada.
// Privacidad: nombre del paciente + tipo de sesión + horario. Nada clínico.

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const supabase = createClient(supabaseUrl, serviceRoleKey);

const DAYS_BACK = 30;
const DAYS_FORWARD = 120;

// "2026-08-23T12:00:00.000Z" → "20260823T120000Z"
const toIcsUtc = (iso: string) =>
  new Date(iso).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");

// Escapar texto según RFC 5545
const esc = (s: string) =>
  s.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");

serve(async (req) => {
  if (req.method !== "GET") {
    return new Response("Method not allowed", { status: 405 });
  }

  try {
    const url = new URL(req.url);
    const token = url.searchParams.get("token") ?? "";
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(token)) {
      return new Response("Not found", { status: 404 });
    }

    const { data: tokenRow } = await supabase
      .from("calendar_feed_tokens")
      .select("business_id, professional_user_id")
      .eq("token", token)
      .maybeSingle();

    if (!tokenRow) {
      return new Response("Not found", { status: 404 });
    }

    const { data: business } = await supabase
      .from("businesses")
      .select("name")
      .eq("id", tokenRow.business_id)
      .maybeSingle();

    const from = new Date();
    from.setDate(from.getDate() - DAYS_BACK);
    const to = new Date();
    to.setDate(to.getDate() + DAYS_FORWARD);

    // Turnos del profesional (incluye los sin profesional asignado del
    // consultorio, que también ocupan su agenda en la práctica unipersonal)
    const { data: appointments } = await supabase
      .from("appointments")
      .select(`
        id, start_at, end_at, status, modality,
        patients ( full_name ),
        services ( name )
      `)
      .eq("business_id", tokenRow.business_id)
      .or(`professional_id.eq.${tokenRow.professional_user_id},professional_id.is.null`)
      .not("status", "in", "(cancelled,cancelled_by_patient)")
      .gte("start_at", from.toISOString())
      .lte("start_at", to.toISOString())
      .order("start_at", { ascending: true })
      .limit(1000);

    // Eventos personales (expandiendo la repetición semanal)
    const { data: personalEvents } = await supabase
      .from("personal_events")
      .select("id, title, start_at, end_at, recurrence, recurrence_until")
      .eq("business_id", tokenRow.business_id)
      .eq("professional_user_id", tokenRow.professional_user_id)
      .lte("start_at", to.toISOString())
      .limit(500);

    const clinicName = business?.name ?? "Mi consultorio";
    const lines: string[] = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//Consultorio Digital//Agenda//ES",
      "CALSCALE:GREGORIAN",
      "METHOD:PUBLISH",
      `X-WR-CALNAME:${esc(clinicName)}`,
      "X-WR-TIMEZONE:America/Montevideo",
      // Sugerencia de refresco para los clientes que la respetan
      "REFRESH-INTERVAL;VALUE=DURATION:PT30M",
      "X-PUBLISHED-TTL:PT30M",
    ];
    const dtstamp = toIcsUtc(new Date().toISOString());

    for (const a of appointments ?? []) {
      const patient = (a as any).patients?.full_name ?? "Paciente";
      const service = (a as any).services?.name;
      const summary = service ? `${patient} · ${service}` : patient;
      const isPending = a.status === "pending" || a.status === "reschedule_requested";
      lines.push(
        "BEGIN:VEVENT",
        `UID:apt-${a.id}@consultoriodigital.app`,
        `DTSTAMP:${dtstamp}`,
        `DTSTART:${toIcsUtc(a.start_at)}`,
        `DTEND:${toIcsUtc(a.end_at)}`,
        `SUMMARY:${esc(summary)}`,
        `LOCATION:${esc(a.modality === "online" ? "Online" : clinicName)}`,
        `STATUS:${isPending ? "TENTATIVE" : "CONFIRMED"}`,
        "END:VEVENT",
      );
    }

    const WEEK_MS = 7 * 86400000;
    for (const ev of personalEvents ?? []) {
      const evStart = new Date(ev.start_at).getTime();
      const evEnd = new Date(ev.end_at).getTime();
      const durMs = evEnd - evStart;
      if (durMs <= 0) continue;

      const pushEvent = (sMs: number) => {
        const s = new Date(sMs);
        if (s < from || s > to) return;
        lines.push(
          "BEGIN:VEVENT",
          `UID:pe-${ev.id}-${toIcsUtc(s.toISOString()).slice(0, 8)}@consultoriodigital.app`,
          `DTSTAMP:${dtstamp}`,
          `DTSTART:${toIcsUtc(s.toISOString())}`,
          `DTEND:${toIcsUtc(new Date(sMs + durMs).toISOString())}`,
          `SUMMARY:${esc(ev.title)}`,
          "STATUS:CONFIRMED",
          "END:VEVENT",
        );
      };

      if (ev.recurrence === "weekly" || ev.recurrence === "daily") {
        const stepMs = ev.recurrence === "daily" ? 86400000 : WEEK_MS;
        const until = ev.recurrence_until
          ? new Date(`${ev.recurrence_until}T23:59:59-03:00`).getTime()
          : to.getTime();
        let occ = evStart;
        if (occ < from.getTime()) {
          occ += Math.floor((from.getTime() - occ) / stepMs) * stepMs;
        }
        for (let i = 0; occ <= Math.min(until, to.getTime()) && i < 400; occ += stepMs, i++) {
          pushEvent(occ);
        }
      } else {
        pushEvent(evStart);
      }
    }

    lines.push("END:VCALENDAR");

    return new Response(lines.join("\r\n"), {
      status: 200,
      headers: {
        "Content-Type": "text/calendar; charset=utf-8",
        "Cache-Control": "private, max-age=300",
        "Content-Disposition": 'inline; filename="agenda.ics"',
      },
    });
  } catch (error) {
    console.error("calendar-feed error:", error);
    return new Response("Internal error", { status: 500 });
  }
});
