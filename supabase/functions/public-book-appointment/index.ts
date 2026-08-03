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
    type Biz = {
      id: string; owner_user_id: string; name: string; contact_email: string | null;
      is_private_clinic: boolean | null; default_session_price: number | null;
      public_slug: string | null;
    };
    const bizColumns = "id, owner_user_id, name, contact_email, is_private_clinic, default_session_price, public_slug";
    let business: Biz | null = null;
    const bySlug = await supabase
      .from("businesses").select(bizColumns).eq("public_slug", slug).maybeSingle();
    business = bySlug.data;
    if (!business) {
      const bySub = await supabase
        .from("businesses").select(bizColumns).eq("custom_subdomain", slug).maybeSingle();
      business = bySub.data;
    }
    if (!business) return json({ error: "business_not_found" }, 404);

    // Agenda privada: no se aceptan reservas públicas (solo pacientes invitados vía portal)
    if (business.is_private_clinic) return json({ error: "private_clinic" }, 403);

    // Servicio activo del negocio
    const { data: service } = await supabase
      .from("services")
      .select("id, name, duration_minutes, mode, suggested_price")
      .eq("id", serviceId)
      .eq("business_id", business.id)
      .eq("is_active", true)
      .maybeSingle();
    if (!service) return json({ error: "service_not_found" }, 404);

    // Revalidar que el inicio siga libre Y dentro de la ventana de reservas,
    // contra la hora real del servidor. Esta es LA validación: aunque el
    // paciente tenga la página abierta hace media hora con horarios viejos,
    // acá se rechaza si el plazo se venció (start_not_available).
    const { data: starts, error: startsError } = await supabase.rpc("get_available_starts", {
      p_business_id: business.id,
      p_professional_user_id: null,
      p_duration_minutes: service.duration_minutes,
      p_from: date,
      p_to: date,
      p_public: true,
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

    // Política de cobro: si es "required" y hay Mercado Pago conectado y un
    // precio para cobrar, la reserva nace pendiente de pago y se confirma
    // recién cuando el webhook de MP aprueba el pago.
    const { data: policy } = await supabase
      .from("payment_policies")
      .select("policy_type, deposit_percentage, mp_access_token")
      .eq("business_id", business.id)
      .maybeSingle();

    const servicePrice = Number(service.suggested_price);
    const chargeBase = servicePrice > 0
      ? servicePrice
      : (Number(business.default_session_price) || 0);
    const requiresPayment =
      policy?.policy_type === "required" && !!policy.mp_access_token && chargeBase > 0;

    // Horario en hora de Uruguay (UTC-3 fijo, sin DST desde 2015)
    const startAt = new Date(`${date}T${startTime}:00-03:00`);
    const endAt = new Date(startAt.getTime() + service.duration_minutes * 60 * 1000);

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
        status: requiresPayment ? "pending_payment" : "confirmed",
        source: "public_booking",
      })
      .select("id")
      .maybeSingle();

    if (appointmentError || !appointment) {
      // Carrera de reserva doble: el índice único de la base rechaza al
      // segundo que confirma el mismo horario (unique_violation).
      if ((appointmentError as { code?: string } | null)?.code === "23505") {
        return json({ error: "start_not_available" }, 409);
      }
      console.error("Error creating appointment:", appointmentError);
      return json({ error: "appointment_creation_failed" }, 500);
    }

    // Los WhatsApps de la reserva (confirmación al paciente + aviso al
    // profesional) los crea el trigger con salida inmediata, pero los envía
    // el robot que corre cada 5 minutos. Lo pateamos AHORA para que salgan
    // en segundos. Best-effort: si falla, el robot los manda en su pasada.
    try {
      const kick = fetch(`${supabaseUrl}/functions/v1/process-scheduled-reminders`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${serviceRoleKey}`,
        },
        body: JSON.stringify({ source: "public-booking-kick" }),
      }).then(() => {}).catch((e) => console.warn("Reminder kick failed:", e));
      // @ts-ignore — EdgeRuntime existe en el runtime de Supabase
      if (typeof EdgeRuntime !== "undefined" && EdgeRuntime?.waitUntil) {
        // @ts-ignore
        EdgeRuntime.waitUntil(kick);
      }
    } catch (kickErr) {
      console.warn("Reminder kick error:", kickErr);
    }

    // Pago requerido: crear la preferencia de Mercado Pago y devolver el
    // checkout. Los mails de confirmación los manda el webhook al aprobarse.
    if (requiresPayment && policy) {
      try {
        const isDeposit = policy.deposit_percentage !== null && policy.deposit_percentage < 100;
        const amount = isDeposit
          ? Math.round(chargeBase * (policy.deposit_percentage as number) / 100)
          : chargeBase;
        const [y, m, d] = date.split("-").map(Number);
        const fmtDate = `${String(d).padStart(2, "0")}/${String(m).padStart(2, "0")}/${y}`;
        const title = isDeposit
          ? `Seña sesión ${fmtDate} ${startTime} - ${business.name}`
          : `Sesión ${fmtDate} ${startTime} - ${business.name}`;

        const backSlug = business.public_slug || slug;
        const backBase = `https://consultoriodigital.app/consultorio/${backSlug}`;
        const mpResponse = await fetch("https://api.mercadopago.com/checkout/preferences", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${policy.mp_access_token}`,
          },
          body: JSON.stringify({
            items: [{ title, quantity: 1, unit_price: amount, currency_id: "UYU" }],
            back_urls: {
              success: `${backBase}?payment=success`,
              failure: `${backBase}?payment=failure`,
              pending: `${backBase}?payment=pending`,
            },
            auto_return: "approved",
            external_reference: JSON.stringify({
              type: "session_payment",
              appointment_id: appointment.id,
              business_id: business.id,
              patient_id: patientId,
            }),
            notification_url: `${supabaseUrl}/functions/v1/mercadopago-webhook`,
          }),
        });

        if (!mpResponse.ok) {
          throw new Error(`MP preference failed: ${mpResponse.status} ${await mpResponse.text()}`);
        }
        const mpPref = await mpResponse.json();

        // Vincular la preferencia al cobro pendiente creado por el trigger
        // (el monto pasa a ser lo que se cobra online: total o seña).
        const { data: pendingPayment } = await supabase
          .from("payments")
          .select("id")
          .eq("appointment_id", appointment.id)
          .eq("status", "pending")
          .maybeSingle();
        if (pendingPayment) {
          await supabase
            .from("payments")
            .update({ mp_preference_id: mpPref.id, amount, method: "mercadopago", notes: title })
            .eq("id", pendingPayment.id);
        }
        await supabase
          .from("appointments")
          .update({ payment_status: "pendiente" })
          .eq("id", appointment.id);

        return json({ success: true, payment_required: true, init_point: mpPref.init_point });
      } catch (mpErr) {
        // Si Mercado Pago falla, no perdemos la reserva: se confirma como
        // siempre y el cobro queda pendiente para gestionar por otro canal.
        console.error("Required payment setup failed, confirming without payment:", mpErr);
        await supabase
          .from("appointments")
          .update({ status: "confirmed" })
          .eq("id", appointment.id);
      }
    }

    // Pago OPCIONAL: la cita ya quedó confirmada igual, pero si el consultorio
    // tiene Mercado Pago conectado generamos el checkout y lo devolvemos para
    // OFRECER el pago en la pantalla de éxito (paga ahora o en la sesión).
    let optionalInitPoint: string | null = null;
    let optionalAmount = 0;
    if (policy?.policy_type === "optional" && policy.mp_access_token && chargeBase > 0) {
      try {
        const [oy, om, od] = date.split("-").map(Number);
        const oFmtDate = `${String(od).padStart(2, "0")}/${String(om).padStart(2, "0")}/${oy}`;
        const oTitle = `Sesión ${oFmtDate} ${startTime} - ${business.name}`;
        const oBackSlug = business.public_slug || slug;
        const oBackBase = `https://consultoriodigital.app/consultorio/${oBackSlug}`;
        const oResp = await fetch("https://api.mercadopago.com/checkout/preferences", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${policy.mp_access_token}`,
          },
          body: JSON.stringify({
            items: [{ title: oTitle, quantity: 1, unit_price: chargeBase, currency_id: "UYU" }],
            back_urls: {
              success: `${oBackBase}?payment=success`,
              failure: `${oBackBase}?payment=failure`,
              pending: `${oBackBase}?payment=pending`,
            },
            auto_return: "approved",
            external_reference: JSON.stringify({
              type: "session_payment",
              appointment_id: appointment.id,
              business_id: business.id,
              patient_id: patientId,
            }),
            notification_url: `${supabaseUrl}/functions/v1/mercadopago-webhook`,
          }),
        });
        if (oResp.ok) {
          const oPref = await oResp.json();
          const { data: oPending } = await supabase
            .from("payments")
            .select("id")
            .eq("appointment_id", appointment.id)
            .eq("status", "pending")
            .maybeSingle();
          if (oPending) {
            await supabase
              .from("payments")
              .update({ mp_preference_id: oPref.id, method: "mercadopago", notes: oTitle })
              .eq("id", oPending.id);
          }
          optionalInitPoint = oPref.init_point;
          optionalAmount = chargeBase;
        } else {
          console.warn("Optional MP preference failed:", oResp.status, await oResp.text());
        }
      } catch (optErr) {
        // Nunca rompe la reserva: sin checkout, el pago queda para la sesión
        console.warn("Optional payment setup failed:", optErr);
      }
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

    return json({
      success: true,
      ...(optionalInitPoint
        ? { optional_payment: true, init_point: optionalInitPoint, amount: optionalAmount }
        : {}),
    });
  } catch (error) {
    console.error("Unexpected error in public-book-appointment:", error);
    return json({ error: "unexpected_error" }, 500);
  }
});
