import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.48.0";

// Horarios 2.0 · Etapa 3: creación de reserva pública por SERVICIO + INICIO
// calculado (reemplaza al flujo por casillero precortado).
// - Revalida contra get_available_starts antes de crear (si justo se ocupó,
//   devuelve start_not_available).
// - Crea/encuentra el paciente por teléfono y crea la cita con service_id y
//   horario correcto en hora de Uruguay (-03:00, sin DST).
// - Transición: marca como reservado cualquier casillero viejo que se solape,
//   para que el flujo antiguo (portal, hasta la etapa 4) no pueda duplicar.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const supabase = createClient(supabaseUrl, serviceRoleKey);

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^\d{2}:\d{2}$/;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405, headers: corsHeaders });
  }

  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  try {
    const {
      slug, serviceId, date, startTime, modality: rawModality,
      name, email, phone, message,
    } = await req.json().catch(() => ({}));

    // Validaciones básicas
    if (
      !slug || typeof slug !== "string" ||
      !serviceId || typeof serviceId !== "string" ||
      typeof date !== "string" || !DATE_RE.test(date) ||
      typeof startTime !== "string" || !TIME_RE.test(startTime) ||
      typeof name !== "string" || name.trim().length < 2 || name.length > 100 ||
      typeof email !== "string" || !email.includes("@") || email.length > 255 ||
      typeof phone !== "string" || phone.trim().length < 6 || phone.length > 30
    ) {
      return json({ error: "invalid_params" }, 400);
    }
    const cleanName = name.trim();
    const cleanEmail = email.trim().toLowerCase();
    const cleanPhone = phone.trim();
    const cleanMessage = typeof message === "string" ? message.slice(0, 500) : "";

    // Negocio por slug público (fallback: subdominio)
    type Biz = { id: string; owner_user_id: string; name: string; contact_email: string | null };
    let business: Biz | null = null;
    const bySlug = await supabase
      .from("businesses").select("id, owner_user_id, name, contact_email").eq("public_slug", slug).maybeSingle();
    business = bySlug.data;
    if (!business) {
      const bySub = await supabase
        .from("businesses").select("id, owner_user_id, name, contact_email").eq("custom_subdomain", slug).maybeSingle();
      business = bySub.data;
    }
    if (!business) return json({ error: "business_not_found" }, 404);

    // Servicio activo del negocio
    const { data: service } = await supabase
      .from("services")
      .select("id, name, duration_minutes, mode, suggested_price")
      .eq("id", serviceId)
      .eq("business_id", business.id)
      .eq("is_active", true)
      .maybeSingle();
    if (!service) return json({ error: "service_not_found" }, 404);

    // Revalidar que el inicio siga libre (puede haberse ocupado recién)
    const { data: starts, error: startsError } = await supabase.rpc("get_available_starts", {
      p_business_id: business.id,
      p_professional_user_id: null,
      p_duration_minutes: service.duration_minutes,
      p_from: date,
      p_to: date,
    });
    if (startsError) throw startsError;
    const wanted = `${startTime}:00`;
    const match = (starts ?? []).find(
      (s: { start_time: string }) => s.start_time === wanted || s.start_time === startTime,
    );
    if (!match) return json({ error: "start_not_available" }, 409);

    // Paciente: buscar por teléfono, crear si no existe
    const { data: existingPatient } = await supabase
      .from("patients")
      .select("id, email, full_name")
      .eq("business_id", business.id)
      .eq("whatsapp_phone", cleanPhone)
      .maybeSingle();

    let patientId = existingPatient?.id;
    if (!patientId) {
      const { data: newPatient, error: patientError } = await supabase
        .from("patients")
        .insert({
          business_id: business.id,
          full_name: cleanName,
          email: cleanEmail,
          whatsapp_phone: cleanPhone,
          reason_for_consultation: cleanMessage || null,
          // El RLS de patients solo deja ver fichas asignadas al profesional o
          // creadas por él; sin esto la ficha queda huérfana ("Sin paciente").
          assigned_professional_id: business.owner_user_id,
          created_by: business.owner_user_id,
        })
        .select("id")
        .maybeSingle();
      if (patientError || !newPatient) {
        console.error("Error creating patient:", patientError);
        return json({ error: "patient_creation_failed" }, 500);
      }
      patientId = newPatient.id;
    }

    // Modalidad final según el servicio
    const modality =
      service.mode === "ambas"
        ? (rawModality === "presencial" ? "presencial" : "online")
        : service.mode;

    // Horario en hora de Uruguay (UTC-3 fijo, sin DST desde 2015)
    const startAt = new Date(`${date}T${startTime}:00-03:00`);
    const endAt = new Date(startAt.getTime() + service.duration_minutes * 60 * 1000);
    const endTimeLocal = endAt.toLocaleTimeString("en-GB", {
      timeZone: "America/Montevideo", hour: "2-digit", minute: "2-digit",
    });

    const { data: appointment, error: appointmentError } = await supabase
      .from("appointments")
      .insert({
        business_id: business.id,
        patient_id: patientId,
        professional_id: business.owner_user_id,
        service_id: service.id,
        start_at: startAt.toISOString(),
        end_at: endAt.toISOString(),
        modality,
        session_price: service.suggested_price,
        contact_name: cleanName,
        contact_email: cleanEmail,
        contact_phone: cleanPhone,
        notes: cleanMessage || null,
        status: "confirmed",
        source: "public_booking",
      })
      .select("id")
      .maybeSingle();

    if (appointmentError || !appointment) {
      console.error("Error creating appointment:", appointmentError);
      return json({ error: "appointment_creation_failed" }, 500);
    }

    // Transición: reservar los casilleros viejos que se solapen para que el
    // flujo por slots (portal) no pueda duplicar este horario.
    const { error: slotGuardError } = await supabase
      .from("availability_slots")
      .update({ status: "reserved" })
      .eq("business_id", business.id)
      .eq("date", date)
      .eq("status", "available")
      .lt("start_time", endTimeLocal)
      .gt("end_time", startTime);
    if (slotGuardError) {
      console.warn("Slot transition guard failed:", slotGuardError);
    }

    // Best-effort: mail de confirmación al paciente
    try {
      const [y, m, d] = date.split("-").map(Number);
      const fmtDate = `${String(d).padStart(2, "0")}/${String(m).padStart(2, "0")}/${y}`;
      await fetch(`${supabaseUrl}/functions/v1/send-resend-email`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${serviceRoleKey}`,
        },
        body: JSON.stringify({
          to: cleanEmail,
          template: "appointment_confirmation",
          businessId: business.id,
          data: {
            patientName: cleanName,
            date: fmtDate,
            time: startTime,
            modality,
            location: null,
          },
        }),
      });
    } catch (mailErr) {
      console.warn("Confirmation email failed:", mailErr);
    }

    // Best-effort: mail "Nueva reserva" al profesional
    try {
      if (business.contact_email) {
        const modLabel = modality === "online" ? "Online" : "Presencial";
        await fetch(`${supabaseUrl}/functions/v1/send-resend-email`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${serviceRoleKey}`,
          },
          body: JSON.stringify({
            to: business.contact_email,
            template: "raw",
            businessId: business.id,
            data: {
              subject: `Nueva reserva: ${cleanName} · ${date} ${startTime}`,
              message:
                `Tenés una nueva reserva online.\n\n` +
                `Paciente: ${cleanName}\n` +
                `Tipo de sesión: ${service.name} (${service.duration_minutes} min)\n` +
                `Fecha: ${date} a las ${startTime} · ${modLabel}\n` +
                `Teléfono: ${cleanPhone}\nEmail: ${cleanEmail}` +
                (cleanMessage ? `\nMotivo: ${cleanMessage}` : "") +
                `\n\nLa cita ya está confirmada en tu agenda.`,
            },
          }),
        });
      }
    } catch (ownerMailErr) {
      console.warn("Owner notification email failed:", ownerMailErr);
    }

    // Best-effort: push al dueño
    try {
      await fetch(`${supabaseUrl}/functions/v1/send-push-notification`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${serviceRoleKey}`,
        },
        body: JSON.stringify({
          user_id: business.owner_user_id,
          title: "Nueva reserva",
          body: `${cleanName} reservó ${service.name} el ${date} a las ${startTime}.`,
          url: "/agenda",
        }),
      });
    } catch (pushErr) {
      console.warn("Push notification to owner failed:", pushErr);
    }

    return json({ success: true });
  } catch (error) {
    console.error("Unexpected error in public-book-appointment:", error);
    return json({ error: "unexpected_error" }, 500);
  }
});
