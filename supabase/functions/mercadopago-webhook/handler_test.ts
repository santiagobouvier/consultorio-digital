// Pruebas del webhook de Mercado Pago sin red ni base: Mercado Pago, la base
// y los avisos son dobles en memoria. Corre con `npm run test:functions`.
import { test } from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import {
  createWebhookHandler,
  signatureManifest,
  verifyMpSignature,
  type AppointmentForPayment,
  type MpFetchResult,
  type MpPayment,
  type WebhookDeps,
} from "./handler.ts";

const CLINICA_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const CLINICA_B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const CITA = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const SECRETO = "secreto-de-prueba";

const sessionRef = (businessId = CLINICA_A) =>
  JSON.stringify({ type: "session_payment", appointment_id: CITA, business_id: businessId });
const batchRef = (businessId = CLINICA_A) =>
  JSON.stringify({ type: "payment_batch", payment_ids: ["p1", "p2"], business_id: businessId, patient_id: "pac-1" });

function cita(overrides: Partial<AppointmentForPayment> = {}): AppointmentForPayment {
  return {
    id: CITA,
    status: "pending_payment",
    payment_status: null,
    business_id: CLINICA_A,
    start_at: "2026-10-20T13:00:00Z",
    modality: "presencial",
    contact_name: "Paciente QA",
    contact_email: "qa@example.test",
    contact_phone: null,
    ...overrides,
  };
}

interface Opts {
  payments?: Record<string, MpPayment>; // por token
  mpError?: number;
  appt?: AppointmentForPayment | null;
  /** La cita se cancela entre la lectura y la confirmación. */
  cancelledMidway?: boolean;
  batchAlreadyPaid?: boolean;
  failStore?: boolean;
  secret?: string | null;
  enforce?: boolean;
}

function makeDeps(o: Opts = {}) {
  const calls: string[] = [];
  const tokensUsados: string[] = [];
  let appt = o.appt === undefined ? cita() : o.appt;
  const tokens: Record<string, string> = { [CLINICA_A]: "tok-a", [CLINICA_B]: "tok-b" };
  const deps: WebhookDeps = {
    signatureSecret: o.secret ?? null,
    enforceSignature: o.enforce ?? false,
    platformToken: "tok-plataforma",
    fetchPayment: async (_id, token): Promise<MpFetchResult> => {
      tokensUsados.push(token);
      if (o.mpError) return { kind: "error", status: o.mpError };
      const p = o.payments?.[token];
      return p ? { kind: "ok", payment: p } : { kind: "not_found" };
    },
    getClinicToken: async (b) => tokens[b] ?? null,
    listClinicTokens: async () => Object.entries(tokens).map(([business_id, token]) => ({ business_id, token })),
    handlePreapprovalEvent: async (id) => void calls.push(`preapproval:${id}`),
    handleSubscriptionPayment: async (p) => void calls.push(`subscription_payment:${p.id}`),
    store: {
      getAppointment: async () => appt,
      markAppointmentPaymentsPaid: async () => {
        if (o.failStore) throw new Error("db caída");
        calls.push("markAppointmentPaymentsPaid");
        return 1;
      },
      confirmPaidAppointment: async () => {
        if (o.cancelledMidway) return false;
        calls.push("confirmPaidAppointment");
        if (appt) appt = { ...appt, status: "confirmed", payment_status: "pagado" };
        return true;
      },
      recordLatePayment: async () => {
        calls.push("recordLatePayment");
        if (appt) appt = { ...appt, payment_status: "pagado" };
      },
      markBatchPaid: async (ids, businessId) => {
        if (o.failStore) throw new Error("db caída");
        calls.push(`markBatchPaid:${businessId}`);
        return o.batchAlreadyPaid ? [] : ids.map((id) => ({ id, appointment_id: null }));
      },
      markAppointmentsPaid: async () => void calls.push("markAppointmentsPaid"),
      setBatchLinkStatus: async (_ids, status, businessId) => void calls.push(`linkStatus:${status}:${businessId}`),
      getPatientName: async () => "Paciente QA",
    },
    notify: {
      proPaymentWhatsApp: async (b) => void calls.push(`wa:${b}`),
      paidBookingConfirmations: async () => void calls.push("confirmaciones"),
      latePaymentToProfessional: async () => void calls.push("aviso_pago_tardio"),
    },
    log: () => {},
  };
  return { deps, calls, tokensUsados };
}

function req(opts: { query?: string; body?: unknown; headers?: Record<string, string>; method?: string } = {}) {
  return new Request(`https://example.test/functions/v1/mercadopago-webhook${opts.query ?? ""}`, {
    method: opts.method ?? "POST",
    headers: { "Content-Type": "application/json", ...(opts.headers ?? {}) },
    body: (opts.method ?? "POST") === "POST" ? JSON.stringify(opts.body ?? { type: "payment", data: { id: "123" } }) : undefined,
  });
}

const firmar = (dataId: string, requestId: string, ts: string, secret = SECRETO) =>
  `ts=${ts},v1=${createHmac("sha256", secret).update(signatureManifest(dataId, requestId, ts)).digest("hex")}`;

const aprobado = (ref: string, extra: Partial<MpPayment> = {}): MpPayment => ({
  id: 123,
  status: "approved",
  external_reference: ref,
  transaction_amount: 1500,
  ...extra,
});

// ── Firma ──

test("firma: el manifest sigue el formato de Mercado Pago", () => {
  assert.equal(signatureManifest("ABC123", "req-1", "1700"), "id:abc123;request-id:req-1;ts:1700;");
  assert.equal(signatureManifest(null, null, "1700"), "ts:1700;");
});

test("firma: válida se acepta, alterada o con otro secreto se rechaza", async () => {
  const header = firmar("123", "req-1", "1700");
  assert.equal(await verifyMpSignature({ secret: SECRETO, xSignature: header, xRequestId: "req-1", dataId: "123" }), true);
  assert.equal(await verifyMpSignature({ secret: SECRETO, xSignature: header, xRequestId: "req-1", dataId: "124" }), false);
  assert.equal(await verifyMpSignature({ secret: "otro", xSignature: header, xRequestId: "req-1", dataId: "123" }), false);
  assert.equal(await verifyMpSignature({ secret: SECRETO, xSignature: null, xRequestId: "req-1", dataId: "123" }), false);
});

test("firma obligatoria: sin firma válida responde 401 y no consulta Mercado Pago", async () => {
  const { deps, calls, tokensUsados } = makeDeps({ secret: SECRETO, enforce: true, payments: { "tok-a": aprobado(sessionRef()) } });
  const res = await createWebhookHandler(deps)(req({ query: `?business_id=${CLINICA_A}&data.id=123&type=payment` }));
  assert.equal(res.status, 401);
  assert.deepEqual(tokensUsados, []);
  assert.deepEqual(calls, []);
});

test("firma obligatoria: con firma válida procesa el pago", async () => {
  const { deps, calls } = makeDeps({ secret: SECRETO, enforce: true, payments: { "tok-a": aprobado(sessionRef()) } });
  const res = await createWebhookHandler(deps)(
    req({
      query: `?business_id=${CLINICA_A}&data.id=123&type=payment`,
      headers: { "x-signature": firmar("123", "req-9", "1700"), "x-request-id": "req-9" },
    }),
  );
  assert.equal(res.status, 200);
  assert.ok(calls.includes("confirmPaidAppointment"));
});

test("firma en modo observación: una firma inválida se registra pero no corta el cobro", async () => {
  const { deps, calls } = makeDeps({ secret: SECRETO, enforce: false, payments: { "tok-a": aprobado(sessionRef()) } });
  const res = await createWebhookHandler(deps)(req({ query: `?business_id=${CLINICA_A}`, headers: { "x-signature": "ts=1,v1=00" } }));
  assert.equal(res.status, 200);
  assert.ok(calls.includes("confirmPaidAppointment"));
});

// ── Token por consultorio ──

test("con business_id se usa SOLO el token de ese consultorio", async () => {
  const { deps, tokensUsados } = makeDeps({ payments: { "tok-a": aprobado(sessionRef()) } });
  await createWebhookHandler(deps)(req({ query: `?business_id=${CLINICA_A}` }));
  assert.deepEqual(tokensUsados, ["tok-a"]);
});

test("el pago de otro consultorio se ignora (no confirma ni avisa)", async () => {
  const { deps, calls } = makeDeps({ payments: { "tok-a": aprobado(sessionRef(CLINICA_B)) } });
  const res = await createWebhookHandler(deps)(req({ query: `?business_id=${CLINICA_A}` }));
  assert.equal(res.status, 200);
  assert.deepEqual(calls, []);
});

test("notificación vieja sin business_id: sigue funcionando (búsqueda por consultorio)", async () => {
  const { deps, calls, tokensUsados } = makeDeps({ payments: { "tok-b": aprobado(sessionRef(CLINICA_B)) }, appt: cita({ business_id: CLINICA_B }) });
  const res = await createWebhookHandler(deps)(req());
  assert.equal(res.status, 200);
  assert.deepEqual(tokensUsados, ["tok-plataforma", "tok-a", "tok-b"]);
  assert.ok(calls.includes("confirmPaidAppointment"));
});

// ── Cobro de sesión ──

test("reserva con pago requerido: confirma, avisa por WhatsApp y manda las confirmaciones", async () => {
  const { deps, calls } = makeDeps({ payments: { "tok-a": aprobado(sessionRef()) } });
  await createWebhookHandler(deps)(req({ query: `?business_id=${CLINICA_A}` }));
  assert.deepEqual(calls, ["markAppointmentPaymentsPaid", "confirmPaidAppointment", `wa:${CLINICA_A}`, "confirmaciones"]);
});

test("reenvío del mismo pago: no se repiten registros ni avisos", async () => {
  const { deps, calls } = makeDeps({ payments: { "tok-a": aprobado(sessionRef()) } });
  const handle = createWebhookHandler(deps);
  await handle(req({ query: `?business_id=${CLINICA_A}` }));
  const antes = calls.length;
  const res = await handle(req({ query: `?business_id=${CLINICA_A}` }));
  assert.equal(res.status, 200);
  assert.equal(calls.length, antes);
});

test("pago que llega con la reserva ya cancelada: se registra, NO se reconfirma y se avisa al profesional", async () => {
  const { deps, calls } = makeDeps({ payments: { "tok-a": aprobado(sessionRef()) }, appt: cita({ status: "cancelled" }) });
  const res = await createWebhookHandler(deps)(req({ query: `?business_id=${CLINICA_A}` }));
  assert.equal(res.status, 200);
  assert.deepEqual(calls, ["recordLatePayment", "aviso_pago_tardio"]);
});

test("la reserva se cancela mientras llega el pago: se trata como pago tardío", async () => {
  const { deps, calls } = makeDeps({ payments: { "tok-a": aprobado(sessionRef()) }, cancelledMidway: true });
  await createWebhookHandler(deps)(req({ query: `?business_id=${CLINICA_A}` }));
  assert.deepEqual(calls, ["markAppointmentPaymentsPaid", "recordLatePayment", "aviso_pago_tardio"]);
});

test("pago no aprobado de una sesión: no cambia nada", async () => {
  const { deps, calls } = makeDeps({ payments: { "tok-a": aprobado(sessionRef(), { status: "rejected" }) } });
  await createWebhookHandler(deps)(req({ query: `?business_id=${CLINICA_A}` }));
  assert.deepEqual(calls, []);
});

// ── Lotes (portal y links de cobro) ──

test("lote aprobado: se marca pagado solo dentro del consultorio y avisa una vez", async () => {
  const { deps, calls } = makeDeps({ payments: { "tok-a": aprobado(batchRef()) } });
  await createWebhookHandler(deps)(req({ query: `?business_id=${CLINICA_A}` }));
  assert.deepEqual(calls, [`markBatchPaid:${CLINICA_A}`, `wa:${CLINICA_A}`]);
});

test("lote ya registrado (reenvío): no vuelve a avisar", async () => {
  const { deps, calls } = makeDeps({ payments: { "tok-a": aprobado(batchRef()) }, batchAlreadyPaid: true });
  await createWebhookHandler(deps)(req({ query: `?business_id=${CLINICA_A}` }));
  assert.deepEqual(calls, [`markBatchPaid:${CLINICA_A}`]);
});

test("lote rechazado: queda el rastro en el link de cobro", async () => {
  const { deps, calls } = makeDeps({ payments: { "tok-a": aprobado(batchRef(), { status: "rejected" }) } });
  await createWebhookHandler(deps)(req({ query: `?business_id=${CLINICA_A}` }));
  assert.deepEqual(calls, [`linkStatus:rejected:${CLINICA_A}`]);
});

// ── Errores y reintentos ──

test("error de la base: responde 500 para que Mercado Pago reintente", async () => {
  const { deps } = makeDeps({ payments: { "tok-a": aprobado(sessionRef()) }, failStore: true });
  const res = await createWebhookHandler(deps)(req({ query: `?business_id=${CLINICA_A}` }));
  assert.equal(res.status, 500);
});

test("Mercado Pago con error temporal: 500 (reintento)", async () => {
  const { deps } = makeDeps({ mpError: 503 });
  const res = await createWebhookHandler(deps)(req({ query: `?business_id=${CLINICA_A}` }));
  assert.equal(res.status, 500);
});

test("pago inexistente o consultorio sin Mercado Pago: 200 sin reintentos", async () => {
  const sinPago = makeDeps({});
  assert.equal((await createWebhookHandler(sinPago.deps)(req({ query: `?business_id=${CLINICA_A}` }))).status, 200);
  const sinToken = makeDeps({});
  const res = await createWebhookHandler(sinToken.deps)(req({ query: "?business_id=dddddddd-dddd-4ddd-8ddd-dddddddddddd" }));
  assert.equal(res.status, 200);
  assert.deepEqual(sinToken.tokensUsados, []);
});

test("cuerpo inválido: 400; otro método: 405", async () => {
  const { deps } = makeDeps();
  const handle = createWebhookHandler(deps);
  const bad = new Request("https://example.test/x", { method: "POST", body: "{no json" });
  assert.equal((await handle(bad)).status, 400);
  assert.equal((await handle(req({ method: "GET" }))).status, 405);
});

// ── Circuito de suscripciones (no cambia) ──

test("suscripciones: preapproval y renovación siguen yendo a la lógica de siempre", async () => {
  const { deps, calls } = makeDeps({
    payments: { "tok-plataforma": { id: 77, status: "approved", metadata: { preapproval_id: "pre-1" } } },
  });
  const handle = createWebhookHandler(deps);
  await handle(req({ body: { type: "subscription_preapproval", data: { id: "pre-1" } } }));
  await handle(req({ body: { type: "payment", data: { id: "77" } } }));
  assert.deepEqual(calls, ["preapproval:pre-1", "subscription_payment:77"]);
});

test("un pago de consultorio con metadata de preapproval no toca suscripciones", async () => {
  const { deps, calls } = makeDeps({
    payments: { "tok-a": { id: 78, status: "approved", metadata: { preapproval_id: "pre-1" } } },
  });
  await createWebhookHandler(deps)(req({ query: `?business_id=${CLINICA_A}` }));
  assert.deepEqual(calls, []);
});
