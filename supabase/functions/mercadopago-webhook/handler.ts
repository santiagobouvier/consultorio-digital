// Lógica del webhook de Mercado Pago, sin Supabase ni fetch: todo entra por
// dependencias (index.ts las conecta). Se prueba con node:test
// (handler_test.ts).
//
// El webhook atiende DOS circuitos que no hay que mezclar:
//  1. Suscripciones de profesionales a Consultorio Digital (token de la
//     plataforma): eventos "subscription_preapproval" y pagos con
//     metadata.preapproval_id. Desde oct. 2026 no se crean débitos nuevos,
//     pero los que existían siguen llegando: esa lógica NO cambia (vive en
//     index.ts y entra por handlePreapprovalEvent / handleSubscriptionPayment).
//  2. Cobros de PACIENTES a profesionales (token de cada consultorio):
//     external_reference "session_payment" y "payment_batch". Es lo que se
//     corrige acá:
//       - firma x-signature de Mercado Pago (si hay secreto configurado);
//       - el pago se consulta SOLO con el token del consultorio indicado en
//         la URL (?business_id=…), no probando los tokens de todos;
//       - idempotencia: un reenvío del mismo pago no vuelve a avisar;
//       - un pago que llega con la reserva ya cancelada (vencida) se registra
//         como cobrado, la cita NO se reconfirma y se avisa al profesional;
//       - errores reales responden 500 para que Mercado Pago reintente
//         (antes respondía 200 siempre y el aviso se perdía).

export interface MpPayment {
  id: string | number;
  status: string;
  external_reference?: string | null;
  transaction_amount?: number | null;
  metadata?: { preapproval_id?: string | null } | null;
}

export type MpFetchResult =
  | { kind: "ok"; payment: MpPayment }
  | { kind: "not_found" }
  | { kind: "error"; status: number };

export interface AppointmentForPayment {
  id: string;
  status: string;
  payment_status: string | null;
  business_id: string;
  start_at: string;
  modality: string | null;
  contact_name: string | null;
  contact_email: string | null;
  contact_phone: string | null;
}

export interface PaymentStore {
  getAppointment(id: string): Promise<AppointmentForPayment | null>;
  /** payments pendientes de la cita → paid. Devuelve cuántas filas cambiaron. */
  markAppointmentPaymentsPaid(appointmentId: string): Promise<number>;
  /**
   * Cita pagada y (si esperaba) confirmada, solo si NO está cancelada.
   * false = se canceló entre la lectura y la escritura (p. ej. venció).
   */
  confirmPaidAppointment(appointmentId: string): Promise<boolean>;
  /** Pago tardío: cobro registrado como pagado con nota, la cita sigue cancelada. */
  recordLatePayment(appointmentId: string): Promise<void>;
  /** Lote: marca pagadas (solo del consultorio indicado) y devuelve las que cambiaron. */
  markBatchPaid(paymentIds: string[], businessId: string | null): Promise<{ id: string; appointment_id: string | null }[]>;
  markAppointmentsPaid(appointmentIds: string[]): Promise<void>;
  setBatchLinkStatus(paymentIds: string[], status: "rejected" | "in_process", businessId: string | null): Promise<void>;
  getPatientName(patientId: string): Promise<string | null>;
}

export interface PaymentNotifier {
  /** WhatsApp "¡Cobraste!" al profesional (best-effort). */
  proPaymentWhatsApp(businessId: string, patientName: string | null, amount: number | null): Promise<void>;
  /** Mails y push de una reserva pagada que esperaba el pago (best-effort). */
  paidBookingConfirmations(appt: AppointmentForPayment): Promise<void>;
  /** Pago recibido de una reserva ya cancelada: avisar al profesional (best-effort). */
  latePaymentToProfessional(appt: AppointmentForPayment, amount: number | null): Promise<void>;
}

export interface WebhookDeps {
  /** Secreto de la firma de Mercado Pago (Tus integraciones > Webhooks). */
  signatureSecret: string | null;
  /** true: una firma inválida o ausente se rechaza con 401. false: solo se registra. */
  enforceSignature: boolean;
  platformToken: string;
  fetchPayment(id: string, token: string): Promise<MpFetchResult>;
  getClinicToken(businessId: string): Promise<string | null>;
  /** Solo para notificaciones viejas sin ?business_id (preferencias creadas antes de este cambio). */
  listClinicTokens(): Promise<{ business_id: string; token: string }[]>;
  handlePreapprovalEvent(preapprovalId: string): Promise<void>;
  handleSubscriptionPayment(payment: MpPayment): Promise<void>;
  store: PaymentStore;
  notify: PaymentNotifier;
  log?: (msg: string, extra?: unknown) => void;
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-signature, x-request-id",
};

const text = (body: string, status: number) => new Response(body, { status, headers: corsHeaders });

// ── Firma de Mercado Pago ──
// x-signature: "ts=<epoch>,v1=<hmac hex>"; manifest: "id:<data.id>;request-id:<x-request-id>;ts:<ts>;"
// HMAC-SHA256 con el secreto. data.id alfanumérico va en minúsculas.
export function parseSignatureHeader(header: string | null): { ts: string; v1: string } | null {
  if (!header) return null;
  const parts = Object.fromEntries(
    header.split(",").map((p) => {
      const i = p.indexOf("=");
      return [p.slice(0, i).trim(), p.slice(i + 1).trim()];
    }),
  );
  return parts.ts && parts.v1 ? { ts: parts.ts, v1: parts.v1 } : null;
}

export function signatureManifest(dataId: string | null, requestId: string | null, ts: string): string {
  let m = "";
  if (dataId) m += `id:${/^[a-z0-9]+$/i.test(dataId) ? dataId.toLowerCase() : dataId};`;
  if (requestId) m += `request-id:${requestId};`;
  m += `ts:${ts};`;
  return m;
}

async function hmacHex(secret: string, message: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(message));
  return Array.from(new Uint8Array(sig)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

function timingSafeEqualHex(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export async function verifyMpSignature(opts: {
  secret: string;
  xSignature: string | null;
  xRequestId: string | null;
  dataId: string | null;
}): Promise<boolean> {
  const parsed = parseSignatureHeader(opts.xSignature);
  if (!parsed) return false;
  const expected = await hmacHex(opts.secret, signatureManifest(opts.dataId, opts.xRequestId, parsed.ts));
  return timingSafeEqualHex(expected, parsed.v1.toLowerCase());
}

export const CANCELLED_STATUSES = new Set(["cancelled", "cancelled_by_patient"]);

interface ParsedRef {
  type?: string;
  appointment_id?: string;
  business_id?: string;
  patient_id?: string;
  payment_ids?: string[];
}

const parseRef = (value: unknown): ParsedRef | null => {
  if (typeof value !== "string" || !value.trim()) return null;
  try {
    const v = JSON.parse(value);
    return v && typeof v === "object" ? (v as ParsedRef) : null;
  } catch {
    return null;
  }
};

export function createWebhookHandler(deps: WebhookDeps) {
  const log = deps.log ?? ((m: string, e?: unknown) => console.log(m, e ?? ""));

  /** Busca el pago en Mercado Pago con el token que corresponde. */
  async function loadPayment(
    paymentId: string,
    businessId: string | null,
  ): Promise<{ result: "ok"; payment: MpPayment; scopedTo: string | null } | { result: "ignore" | "retry" }> {
    if (businessId) {
      const token = await deps.getClinicToken(businessId);
      if (!token) {
        log("Consultorio sin Mercado Pago conectado; no se puede consultar el pago", { businessId, paymentId });
        return { result: "ignore" };
      }
      const r = await deps.fetchPayment(paymentId, token);
      if (r.kind === "ok") return { result: "ok", payment: r.payment, scopedTo: businessId };
      return r.kind === "not_found" ? { result: "ignore" } : { result: "retry" };
    }
    // Sin business_id: suscripción (token de plataforma) o preferencia vieja.
    const platform = await deps.fetchPayment(paymentId, deps.platformToken);
    if (platform.kind === "ok") return { result: "ok", payment: platform.payment, scopedTo: null };
    let sawError = platform.kind === "error";
    log("Notificación sin business_id (preferencia anterior al cambio): búsqueda por consultorio", { paymentId });
    for (const c of await deps.listClinicTokens()) {
      const r = await deps.fetchPayment(paymentId, c.token);
      if (r.kind === "ok") return { result: "ok", payment: r.payment, scopedTo: c.business_id };
      if (r.kind === "error") sawError = true;
    }
    return sawError ? { result: "retry" } : { result: "ignore" };
  }

  async function handleSessionPayment(payment: MpPayment, ref: ParsedRef): Promise<void> {
    if (payment.status !== "approved" || !ref.appointment_id) return;
    const appt = await deps.store.getAppointment(ref.appointment_id);
    if (!appt) {
      log("Pago aprobado de una cita que no existe", { appointment: ref.appointment_id });
      return;
    }
    // Idempotencia: este cobro ya se procesó (reenvío de Mercado Pago)
    if (appt.payment_status === "pagado") {
      log("Pago ya registrado: no se repiten avisos", { appointment: appt.id });
      return;
    }
    const amount = typeof payment.transaction_amount === "number" ? payment.transaction_amount : null;

    // Pago tardío (p. ej. la reserva venció a los 15 min): el dinero se
    // cobró, así que se registra; la cita NO se reconfirma (el horario puede
    // estar tomado) y el profesional decide si reprograma o devuelve.
    const late = async () => {
      await deps.store.recordLatePayment(appt.id);
      await deps.notify.latePaymentToProfessional(appt, amount);
    };
    if (CANCELLED_STATUSES.has(appt.status)) return late();

    const wasAwaitingPayment = appt.status === "pending_payment";
    await deps.store.markAppointmentPaymentsPaid(appt.id);
    if (!(await deps.store.confirmPaidAppointment(appt.id))) return late();
    await deps.notify.proPaymentWhatsApp(ref.business_id || appt.business_id, appt.contact_name, amount);
    if (wasAwaitingPayment) await deps.notify.paidBookingConfirmations(appt);
  }

  async function handleBatchPayment(payment: MpPayment, ref: ParsedRef, scopedTo: string | null): Promise<void> {
    const ids = Array.isArray(ref.payment_ids) ? ref.payment_ids.filter((x) => typeof x === "string") : [];
    if (ids.length === 0) return;
    const businessId = ref.business_id ?? scopedTo;
    if (payment.status === "approved") {
      const updated = await deps.store.markBatchPaid(ids, businessId);
      if (updated.length === 0) {
        log("Lote ya registrado: no se repiten avisos", { ids });
        return;
      }
      const apptIds = updated.map((p) => p.appointment_id).filter((x): x is string => !!x);
      if (apptIds.length > 0) await deps.store.markAppointmentsPaid(apptIds);
      const patientName = ref.patient_id ? await deps.store.getPatientName(ref.patient_id) : null;
      if (businessId) {
        await deps.notify.proPaymentWhatsApp(
          businessId,
          patientName,
          typeof payment.transaction_amount === "number" ? payment.transaction_amount : null,
        );
      }
      return;
    }
    const linkStatus = payment.status === "rejected" || payment.status === "cancelled" ? "rejected" : "in_process";
    await deps.store.setBatchLinkStatus(ids, linkStatus, businessId);
  }

  return async function handle(req: Request): Promise<Response> {
    if (req.method === "OPTIONS") return text("ok", 200);
    if (req.method !== "POST") return text("Method not allowed", 405);

    const url = new URL(req.url);
    let body: { type?: string; action?: string; data?: { id?: string | number } } = {};
    try {
      const raw = await req.text();
      body = raw ? JSON.parse(raw) : {};
    } catch {
      return text("Bad request", 400);
    }

    const queryDataId = url.searchParams.get("data.id") ?? url.searchParams.get("id");
    const type = body.type ?? url.searchParams.get("type") ?? url.searchParams.get("topic") ?? "";
    const dataId = body.data?.id != null ? String(body.data.id) : queryDataId;

    // Firma (si Santiago configuró el secreto en Cloud)
    if (deps.signatureSecret) {
      const valid = await verifyMpSignature({
        secret: deps.signatureSecret,
        xSignature: req.headers.get("x-signature"),
        xRequestId: req.headers.get("x-request-id"),
        dataId: queryDataId ?? dataId,
      });
      if (!valid) {
        log(deps.enforceSignature ? "Firma de Mercado Pago inválida: rechazada" : "Firma de Mercado Pago inválida (modo observación)", { type, dataId });
        if (deps.enforceSignature) return text("Invalid signature", 401);
      }
    }

    if (!dataId) return text("OK", 200);

    try {
      if (type === "subscription_preapproval") {
        // Circuito 1 (suscripciones): sin cambios de lógica.
        await deps.handlePreapprovalEvent(dataId);
        return text("OK", 200);
      }

      if (type !== "payment") return text("OK", 200);

      const loaded = await loadPayment(dataId, url.searchParams.get("business_id"));
      if (loaded.result === "retry") return text("Retry", 500);
      if (loaded.result === "ignore") return text("OK", 200);

      const { payment, scopedTo } = loaded;
      const ref = parseRef(payment.external_reference);

      // El pago tiene que pertenecer al consultorio cuyo token se usó
      if (scopedTo && ref?.business_id && ref.business_id !== scopedTo) {
        log("El pago no corresponde al consultorio de la notificación: ignorado", { scopedTo, ref: ref.business_id });
        return text("OK", 200);
      }

      if (ref?.type === "session_payment") {
        await handleSessionPayment(payment, ref);
      } else if (ref?.type === "payment_batch") {
        await handleBatchPayment(payment, ref, scopedTo);
      } else if (payment.status === "approved" && payment.metadata?.preapproval_id && !scopedTo) {
        // Circuito 1 (renovación de un débito heredado): sin cambios de lógica.
        await deps.handleSubscriptionPayment(payment);
      }
      return text("OK", 200);
    } catch (err) {
      // Error real (base o Mercado Pago): 500 para que Mercado Pago reintente.
      // Los pasos son idempotentes, así que el reintento no duplica avisos.
      log("Error procesando la notificación", err instanceof Error ? err.message : err);
      return text("Error", 500);
    }
  };
}
