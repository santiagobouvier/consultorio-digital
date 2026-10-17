// Webhook de Mercado Pago. La lógica de los cobros a pacientes (firma, token
// por consultorio, idempotencia, pagos tardíos, reintentos) vive en
// handler.ts; acá se conectan el entorno, Supabase y Mercado Pago.
// La lógica de suscripciones de profesionales (débitos heredados) es la de
// siempre: handlePreapprovalEvent y handleSubscriptionPayment.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import {
  createWebhookHandler,
  type AppointmentForPayment,
  type MpFetchResult,
  type MpPayment,
  type PaymentNotifier,
  type PaymentStore,
} from "./handler.ts";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const mercadoPagoToken = Deno.env.get("MERCADOPAGO_ACCESS_TOKEN")!;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

const parseExternalReference = (value: unknown) => {
  if (typeof value !== "string" || !value.trim()) return null;
  try {
    return JSON.parse(value) as {
      business_id?: string;
      plan_code?: string;
      billing_period?: string;
      amount?: number;
    };
  } catch {
    return null;
  }
};

const nowIso = () => new Date().toISOString();

// ── Mercado Pago ──

async function fetchPayment(id: string, token: string): Promise<MpFetchResult> {
  let resp: Response;
  try {
    resp = await fetch(`https://api.mercadopago.com/v1/payments/${encodeURIComponent(id)}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
  } catch {
    return { kind: "error", status: 0 };
  }
  if (resp.ok) return { kind: "ok", payment: (await resp.json()) as MpPayment };
  // 401/403/404: este token no ve ese pago (es de otra cuenta o no existe).
  if (resp.status === 401 || resp.status === 403 || resp.status === 404) return { kind: "not_found" };
  return { kind: "error", status: resp.status };
}

async function getClinicToken(businessId: string): Promise<string | null> {
  const { data, error } = await supabase
    .from("payment_policies")
    .select("mp_access_token")
    .eq("business_id", businessId)
    .maybeSingle();
  if (error) throw error;
  return data?.mp_access_token ?? null;
}

async function listClinicTokens(): Promise<{ business_id: string; token: string }[]> {
  const { data, error } = await supabase
    .from("payment_policies")
    .select("mp_access_token, business_id")
    .not("mp_access_token", "is", null);
  if (error) throw error;
  return (data ?? []).map((p) => ({ business_id: p.business_id, token: p.mp_access_token as string }));
}

// ── Circuito 1: suscripciones de profesionales (sin cambios de lógica) ──

async function handlePreapprovalEvent(preapprovalId: string): Promise<void> {
  const mpResponse = await fetch(`https://api.mercadopago.com/preapproval/${preapprovalId}`, {
    headers: { Authorization: `Bearer ${mercadoPagoToken}` },
  });

  if (!mpResponse.ok) {
    console.error("Failed to fetch preapproval:", mpResponse.status);
    return;
  }

  const preapproval = await mpResponse.json();
  console.log("Preapproval status:", preapproval.status);

  let newStatus: string;
  switch (preapproval.status) {
    case "authorized":
      newStatus = "active";
      break;
    case "paused":
    case "pending":
      newStatus = "pending";
      break;
    case "cancelled":
      newStatus = "cancelled";
      break;
    default:
      newStatus = "pending";
  }

  const { data: subscription, error: findError } = await supabase
    .from("subscriptions")
    .select("id, business_id, status, plan_code, billing_period, trial_ends_at")
    .eq("mercadopago_preapproval_id", preapprovalId)
    .maybeSingle();

  if (findError || !subscription) {
    console.error("Subscription not found for preapproval:", preapprovalId);
    return;
  }

  // GUARDA DE ACCESO: un preapproval "pending" (checkout abandonado) o
  // "cancelled" (canceló el débito) NO debe pisar una prueba vigente ni
  // bloquear a un activo por un intento de cambio de plan a medias.
  const trialStillValid = subscription.status === "trial"
    && !!subscription.trial_ends_at
    && new Date(subscription.trial_ends_at).getTime() > Date.now();

  if ((newStatus === "pending" || newStatus === "cancelled") && trialStillValid) {
    console.log(`Preapproval ${newStatus} pero el trial sigue vigente: se mantiene el acceso`);
    return;
  }
  if (newStatus === "pending" && subscription.status === "active") {
    console.log("Preapproval pending pero la suscripción está activa: se mantiene el acceso");
    return;
  }

  const externalReference = parseExternalReference(preapproval.external_reference);

  const updateData: Record<string, unknown> = {
    status: newStatus,
    cancelled_at: newStatus === "cancelled" ? nowIso() : null,
  };

  if (externalReference?.plan_code) updateData.plan_code = externalReference.plan_code;
  if (externalReference?.billing_period) updateData.billing_period = externalReference.billing_period;
  if (typeof externalReference?.amount === "number") updateData.amount = externalReference.amount;

  if (newStatus === "active" && preapproval.next_payment_date) {
    updateData.current_period_end = preapproval.next_payment_date;
    updateData.current_period_start = nowIso();
  }

  await supabase.from("subscriptions").update(updateData).eq("id", subscription.id);

  if (newStatus === "cancelled" || newStatus === "expired" || newStatus === "pending") {
    await supabase.from("businesses").update({ is_active: false }).eq("id", subscription.business_id);
  } else if (newStatus === "active") {
    await supabase
      .from("businesses")
      .update({
        is_active: true,
        plan_code: externalReference?.plan_code || subscription.plan_code,
        billing_period: externalReference?.billing_period || subscription.billing_period,
        plan_started_at: nowIso(),
      })
      .eq("id", subscription.business_id);
  }

  console.log(`Subscription ${subscription.id} updated to ${newStatus}`);
}

async function handleSubscriptionPayment(payment: MpPayment): Promise<void> {
  const preapprovalId = payment.metadata?.preapproval_id;
  if (!preapprovalId) return;
  const { data: subscription } = await supabase
    .from("subscriptions")
    .select("id, business_id, plan_code, billing_period")
    .eq("mercadopago_preapproval_id", preapprovalId)
    .maybeSingle();
  if (!subscription) return;

  const externalReference = parseExternalReference(payment.external_reference);

  // Renovación: extender el período hasta el próximo cobro de MP
  // (sin esto, current_period_end quedaba congelado en el primer mes).
  let periodEnd: string | null = null;
  try {
    const preResp = await fetch(`https://api.mercadopago.com/preapproval/${preapprovalId}`, {
      headers: { Authorization: `Bearer ${mercadoPagoToken}` },
    });
    if (preResp.ok) {
      const pre = await preResp.json();
      periodEnd = pre.next_payment_date ?? null;
    }
  } catch (e) {
    console.error("No se pudo leer next_payment_date del preapproval:", e);
  }

  await supabase
    .from("subscriptions")
    .update({
      status: "active",
      current_period_start: nowIso(),
      ...(periodEnd ? { current_period_end: periodEnd } : {}),
      cancelled_at: null,
      ...(externalReference?.plan_code ? { plan_code: externalReference.plan_code } : {}),
      ...(externalReference?.billing_period ? { billing_period: externalReference.billing_period } : {}),
      ...(typeof externalReference?.amount === "number" ? { amount: externalReference.amount } : {}),
    })
    .eq("id", subscription.id);

  await supabase
    .from("businesses")
    .update({
      is_active: true,
      plan_code: externalReference?.plan_code || subscription.plan_code,
      billing_period: externalReference?.billing_period || subscription.billing_period,
      plan_started_at: nowIso(),
    })
    .eq("id", subscription.business_id);
}

// ── Circuito 2: cobros de pacientes. Las escrituras lanzan si fallan (→ 500 → reintento). ──

const OPEN_PAYMENT_STATUSES = ["pending", "due_soon", "overdue"];
const LATE_PAYMENT_NOTE =
  "Pago recibido por Mercado Pago después de que la reserva se canceló (venció sin pago). " +
  "La cita no se reconfirmó: coordiná con el paciente si se reprograma o se devuelve el dinero.";

const store: PaymentStore = {
  async getAppointment(id) {
    const { data, error } = await supabase
      .from("appointments")
      .select("id, status, payment_status, business_id, start_at, modality, contact_name, contact_email, contact_phone")
      .eq("id", id)
      .maybeSingle();
    if (error) throw error;
    return (data as AppointmentForPayment | null) ?? null;
  },

  async markAppointmentPaymentsPaid(appointmentId) {
    const { data, error } = await supabase
      .from("payments")
      .update({ status: "paid", paid_at: nowIso(), method: "mercadopago" })
      .eq("appointment_id", appointmentId)
      .in("status", OPEN_PAYMENT_STATUSES)
      .select("id");
    if (error) throw error;
    return data?.length ?? 0;
  },

  async confirmPaidAppointment(appointmentId) {
    // Si esperaba confirmación (reserva con pago requerido, agendada): confirmada y pagada.
    const { data: confirmed, error } = await supabase
      .from("appointments")
      .update({ status: "confirmed", payment_status: "pagado" })
      .eq("id", appointmentId)
      .in("status", ["pending_payment", "scheduled", "pending"])
      .select("id");
    if (error) throw error;
    if ((confirmed?.length ?? 0) > 0) return true;
    // Otro estado no cancelado (confirmada, atendida…): solo se marca pagada.
    const { data: paid, error: paidError } = await supabase
      .from("appointments")
      .update({ payment_status: "pagado" })
      .eq("id", appointmentId)
      .not("status", "in", "(cancelled,cancelled_by_patient)")
      .select("id");
    if (paidError) throw paidError;
    return (paid?.length ?? 0) > 0;
  },

  async recordLatePayment(appointmentId) {
    // El trigger de cancelación ya había pasado el cobro a "cancelled": se
    // recupera como pagado, con una nota visible en el módulo Pagos.
    const { data: rows, error } = await supabase
      .from("payments")
      .select("id, notes")
      .eq("appointment_id", appointmentId)
      .is("paid_at", null)
      .neq("status", "paid");
    if (error) throw error;
    for (const row of rows ?? []) {
      const notes = row.notes ? `${row.notes}\n${LATE_PAYMENT_NOTE}` : LATE_PAYMENT_NOTE;
      const { error: updError } = await supabase
        .from("payments")
        .update({ status: "paid", paid_at: nowIso(), method: "mercadopago", notes })
        .eq("id", row.id)
        .is("paid_at", null);
      if (updError) throw updError;
    }
    if (!rows?.length) console.warn("Pago tardío sin cobro asociado en Pagos", { appointmentId });
    const { error: apptError } = await supabase
      .from("appointments")
      .update({ payment_status: "pagado" })
      .eq("id", appointmentId);
    if (apptError) throw apptError;
  },

  async markBatchPaid(paymentIds, businessId) {
    let q = supabase
      .from("payments")
      .update({ status: "paid", paid_at: nowIso(), method: "mercadopago", mp_link_status: "approved" })
      .in("id", paymentIds)
      .neq("status", "paid");
    if (businessId) q = q.eq("business_id", businessId);
    const { data, error } = await q.select("id, appointment_id");
    if (error) throw error;
    return (data ?? []) as { id: string; appointment_id: string | null }[];
  },

  async markAppointmentsPaid(appointmentIds) {
    const { error } = await supabase.from("appointments").update({ payment_status: "pagado" }).in("id", appointmentIds);
    if (error) throw error;
  },

  async setBatchLinkStatus(paymentIds, status, businessId) {
    let q = supabase.from("payments").update({ mp_link_status: status }).in("id", paymentIds).neq("status", "paid");
    if (businessId) q = q.eq("business_id", businessId);
    const { error } = await q;
    if (error) throw error;
  },

  async getPatientName(patientId) {
    const { data } = await supabase.from("patients").select("full_name").eq("id", patientId).maybeSingle();
    return data?.full_name || null;
  },
};

// ── Avisos (best-effort: si fallan, el cobro ya quedó registrado) ──

async function callFunction(name: string, payload: unknown) {
  await fetch(`${supabaseUrl}/functions/v1/${name}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${supabaseServiceKey}` },
    body: JSON.stringify(payload),
  });
}

function whenLabel(startAt: string) {
  const d = new Date(startAt);
  return {
    dateStr: d.toLocaleDateString("es-UY", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "America/Montevideo" }),
    timeStr: d.toLocaleTimeString("es-UY", { hour: "2-digit", minute: "2-digit", timeZone: "America/Montevideo" }),
  };
}

async function getBusinessContact(businessId: string) {
  const { data } = await supabase
    .from("businesses")
    .select("id, name, contact_email, owner_user_id")
    .eq("id", businessId)
    .maybeSingle();
  return data;
}

const notify: PaymentNotifier = {
  // Aviso "¡Cobraste!" por WhatsApp al profesional (plantilla cobro_recibido_pro).
  async proPaymentWhatsApp(businessId, patientName, amount) {
    try {
      const { data: biz } = await supabase
        .from("businesses")
        .select("owner_user_id")
        .eq("id", businessId)
        .maybeSingle();
      if (!biz?.owner_user_id) return;

      const [{ data: cs }, { data: prof }] = await Promise.all([
        supabase
          .from("clinic_settings")
          .select("auto_whatsapp_reminders, whatsapp_contact_phone")
          .eq("user_id", biz.owner_user_id)
          .maybeSingle(),
        supabase.from("profiles").select("name").eq("id", biz.owner_user_id).maybeSingle(),
      ]);
      if (cs?.auto_whatsapp_reminders === false) return;
      const contact = cs?.whatsapp_contact_phone;
      if (!contact || !String(contact).trim()) return;

      const profFirst = String(prof?.name || "Profesional").trim().split(/\s+/)[0];
      await callFunction("send-whatsapp", {
        to: contact,
        template: "cobro_recibido_pro",
        languageCode: "es",
        params: [
          profFirst,
          patientName || "Un paciente",
          Number(amount || 0).toLocaleString("es-UY", { maximumFractionDigits: 0 }),
        ],
      });
    } catch (e) {
      console.warn("WA pro payment notice failed:", e);
    }
  },

  // Reserva pública con pago requerido: los avisos que la reserva no mandó.
  async paidBookingConfirmations(appt) {
    const biz = await getBusinessContact(appt.business_id).catch(() => null);
    const { dateStr, timeStr } = whenLabel(appt.start_at);
    const modLabel = appt.modality === "online" ? "Online" : "Presencial";

    try {
      if (appt.contact_email) {
        await callFunction("send-resend-email", {
          to: appt.contact_email,
          template: "appointment_confirmation",
          businessId: appt.business_id,
          data: { patientName: appt.contact_name || "", date: dateStr, time: timeStr, modality: appt.modality, location: null },
        });
      }
    } catch (mailErr) {
      console.warn("Paid-booking patient email failed:", mailErr);
    }

    try {
      if (biz?.contact_email) {
        await callFunction("send-resend-email", {
          to: biz.contact_email,
          template: "raw",
          businessId: appt.business_id,
          data: {
            subject: `Nueva reserva pagada: ${appt.contact_name || "Paciente"} · ${dateStr} ${timeStr}`,
            message:
              `Tenés una nueva reserva online con el pago ya realizado.\n\n` +
              `Paciente: ${appt.contact_name || "-"}\n` +
              `Fecha: ${dateStr} a las ${timeStr} · ${modLabel}\n` +
              `Teléfono: ${appt.contact_phone || "-"}\nEmail: ${appt.contact_email || "-"}` +
              `\n\nLa cita quedó confirmada en tu agenda y el cobro figura como pagado.`,
          },
        });
      }
    } catch (ownerMailErr) {
      console.warn("Paid-booking owner email failed:", ownerMailErr);
    }

    try {
      if (biz?.owner_user_id) {
        await callFunction("send-push-notification", {
          user_id: biz.owner_user_id,
          title: "Nueva reserva pagada",
          body: `${appt.contact_name || "Un paciente"} reservó y pagó la sesión del ${dateStr} ${timeStr}.`,
          url: "/agenda",
        });
      }
    } catch (pushErr) {
      console.warn("Paid-booking push failed:", pushErr);
    }
  },

  // Pago de una reserva que ya se había cancelado: solo al profesional.
  async latePaymentToProfessional(appt, amount) {
    const biz = await getBusinessContact(appt.business_id).catch(() => null);
    const { dateStr, timeStr } = whenLabel(appt.start_at);
    const amountStr = amount != null ? `$${Number(amount).toLocaleString("es-UY", { maximumFractionDigits: 0 })}` : "el pago";

    try {
      if (biz?.contact_email) {
        await callFunction("send-resend-email", {
          to: biz.contact_email,
          template: "raw",
          businessId: appt.business_id,
          data: {
            subject: `Pago recibido de una reserva cancelada: ${appt.contact_name || "Paciente"} · ${dateStr} ${timeStr}`,
            message:
              `Mercado Pago acreditó ${amountStr} de una reserva online que ya se había cancelado ` +
              `(venció antes de que llegara el pago).\n\n` +
              `Paciente: ${appt.contact_name || "-"}\n` +
              `Horario reservado: ${dateStr} a las ${timeStr}\n` +
              `Teléfono: ${appt.contact_phone || "-"}\nEmail: ${appt.contact_email || "-"}` +
              `\n\nLa cita NO se reconfirmó porque el horario pudo haberse ocupado. ` +
              `El cobro figura como pagado en Pagos: coordiná con el paciente si se reprograma o le devolvés el dinero.`,
          },
        });
      }
    } catch (mailErr) {
      console.warn("Late-payment owner email failed:", mailErr);
    }

    try {
      if (biz?.owner_user_id) {
        await callFunction("send-push-notification", {
          user_id: biz.owner_user_id,
          title: "Pago de una reserva cancelada",
          body: `${appt.contact_name || "Un paciente"} pagó la reserva del ${dateStr} ${timeStr}, que ya estaba cancelada. Revisá Pagos.`,
          url: "/pagos",
        });
      }
    } catch (pushErr) {
      console.warn("Late-payment push failed:", pushErr);
    }
  },
};

Deno.serve(
  createWebhookHandler({
    signatureSecret: Deno.env.get("MP_WEBHOOK_SECRET") || null,
    enforceSignature: Deno.env.get("MP_WEBHOOK_ENFORCE_SIGNATURE") === "true",
    platformToken: mercadoPagoToken,
    fetchPayment,
    getClinicToken,
    listClinicTokens,
    handlePreapprovalEvent,
    handleSubscriptionPayment,
    store,
    notify,
  }),
);
