import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.48.0";

// "Tu día de mañana": push nocturno al profesional con el resumen del día
// siguiente (cuántos pacientes, primero y último). Lo dispara pg_cron a las
// 20:00 de Montevideo. Si el profesional no tiene turnos mañana, no se envía
// nada (cero spam). Solo cantidad y horas: ningún dato clínico viaja acá.

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const supabase = createClient(supabaseUrl, serviceRoleKey);

const APP_URL = "https://consultoriodigital.app";

const fmtTime = (iso: string) =>
  new Date(iso).toLocaleTimeString("es-UY", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "America/Montevideo",
  });

serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  try {
    // Mañana en hora de Montevideo (UTC-3 fijo, sin horario de verano)
    const nowMvd = new Date(Date.now() - 3 * 3600 * 1000);
    const tomorrow = new Date(nowMvd);
    tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
    const tomorrowStr = tomorrow.toISOString().slice(0, 10); // YYYY-MM-DD
    const dayStart = `${tomorrowStr}T00:00:00-03:00`;
    const dayEnd = `${tomorrowStr}T23:59:59-03:00`;

    const { data: appointments, error } = await supabase
      .from("appointments")
      .select("business_id, professional_id, start_at")
      .not("status", "in", "(cancelled,cancelled_by_patient)")
      .gte("start_at", new Date(dayStart).toISOString())
      .lte("start_at", new Date(dayEnd).toISOString())
      .order("start_at", { ascending: true })
      .limit(2000);

    if (error) throw error;
    if (!appointments || appointments.length === 0) {
      return new Response(JSON.stringify({ sent: 0, reason: "no_appointments" }), {
        headers: { "Content-Type": "application/json" },
      });
    }

    // Dueños por negocio (para turnos sin profesional asignado)
    const businessIds = [...new Set(appointments.map((a) => a.business_id))];
    const { data: businesses } = await supabase
      .from("businesses")
      .select("id, owner_user_id")
      .in("id", businessIds);
    const ownerByBusiness = new Map<string, string | null>(
      (businesses ?? []).map((b) => [b.id, b.owner_user_id])
    );

    // Agrupar por destinatario (profesional del turno, o dueño si no tiene)
    const byUser = new Map<string, { count: number; first: string; last: string }>();
    for (const a of appointments) {
      const userId = a.professional_id ?? ownerByBusiness.get(a.business_id) ?? null;
      if (!userId) continue;
      const agg = byUser.get(userId);
      if (!agg) {
        byUser.set(userId, { count: 1, first: a.start_at, last: a.start_at });
      } else {
        agg.count++;
        if (a.start_at < agg.first) agg.first = a.start_at;
        if (a.start_at > agg.last) agg.last = a.start_at;
      }
    }

    let sent = 0;
    for (const [userId, agg] of byUser) {
      const body =
        agg.count === 1
          ? `Mañana tenés 1 paciente, a las ${fmtTime(agg.first)}.`
          : `Mañana tenés ${agg.count} pacientes. El primero a las ${fmtTime(agg.first)} y el último a las ${fmtTime(agg.last)}.`;

      try {
        const res = await fetch(`${supabaseUrl}/functions/v1/send-push-notification`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${serviceRoleKey}`,
            apikey: serviceRoleKey,
          },
          body: JSON.stringify({
            user_id: userId,
            title: "Tu día de mañana 📋",
            body,
            url: `${APP_URL}/agenda?date=${tomorrowStr}`,
          }),
        });
        if (res.ok) sent++;
        else console.error(`summary push failed for ${userId}: ${res.status}`);
      } catch (e) {
        console.error(`summary push error for ${userId}:`, e);
      }
    }

    return new Response(JSON.stringify({ sent, recipients: byUser.size }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("daily-agenda-summary error:", error);
    return new Response(JSON.stringify({ error: "unexpected_error" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});
