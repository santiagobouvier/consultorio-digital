// Pruebas de los módulos puros de "Mi plan" y la solicitud por WhatsApp.
// npm run test:unit
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { getBillingActions } from "../../src/lib/billing-actions.ts";
import {
  SUPPORT_WHATSAPP_NUMBER,
  buildAccessRequestUrl,
  buildPlanChangeRequestMessage,
  buildPlanChangeRequestUrl,
} from "../../src/lib/support-whatsapp.ts";

const src = (rel: string) => readFileSync(fileURLToPath(new URL(`../../${rel}`, import.meta.url)), "utf8");

test("activa gestionada a mano: pide cambio por soporte, sin cancelar ni agregar medio de pago", () => {
  assert.deepEqual(getBillingActions({ status: "active", mercadopago_preapproval_id: null }), {
    isManual: true,
    planChangeMode: "support_request",
    canCancel: false,
    canAddPlatformPayment: false,
  });
});

test("activa por la plataforma: pide cambio por soporte y conserva cancelar el débito", () => {
  assert.deepEqual(getBillingActions({ status: "active", mercadopago_preapproval_id: "mp-123" }), {
    isManual: false,
    planChangeMode: "support_request",
    canCancel: true,
    canAddPlatformPayment: false,
  });
});

test("prueba, vencida o sin suscripción: conserva el pago por la plataforma", () => {
  for (const status of ["trial", "expired", "past_due", "pending"]) {
    const a = getBillingActions({ status, mercadopago_preapproval_id: null });
    assert.equal(a.planChangeMode, "self_checkout", status);
    assert.equal(a.canAddPlatformPayment, true, status);
    assert.equal(a.isManual, false, status);
  }
  assert.equal(getBillingActions({ status: "cancelled", mercadopago_preapproval_id: null }).canCancel, false);
  assert.equal(getBillingActions(null).planChangeMode, "self_checkout");
});

test("la solicitud de cambio es solo un link a WhatsApp de soporte, sin importes", () => {
  const msg = buildPlanChangeRequestMessage({
    businessName: "QA Consultorio",
    currentPlanName: "Emprendedor",
    desiredPlanName: "Esencial",
    desiredPeriod: "annual",
  });
  assert.match(msg, /cambio de plan/);
  assert.match(msg, /Consultorio: QA Consultorio/);
  assert.match(msg, /Plan actual: Emprendedor/);
  assert.match(msg, /Plan que me interesa: Esencial \(pago anual\)/);
  assert.doesNotMatch(msg, /\$|\d{3,}/, "el mensaje no fija precios: los define soporte");

  const url = new URL(buildPlanChangeRequestUrl({ currentPlanName: "Emprendedor" }));
  assert.equal(url.origin + url.pathname, `https://wa.me/${SUPPORT_WHATSAPP_NUMBER}`);
  assert.match(url.searchParams.get("text") ?? "", /Plan actual: Emprendedor/);

  assert.match(new URL(buildAccessRequestUrl("QA")).searchParams.get("text") ?? "", /coordinar el acceso y el pago/);
});

test("el número de soporte es el mismo que ya usan landing y precios", () => {
  assert.equal(SUPPORT_WHATSAPP_NUMBER, "59898543623");
  assert.ok(src("src/pages/Pricing.tsx").includes(`wa.me/${SUPPORT_WHATSAPP_NUMBER}`));
});

test("los módulos de la solicitud no pueden cobrar ni escribir: no importan nada", () => {
  for (const file of ["src/lib/support-whatsapp.ts", "src/lib/billing-actions.ts"]) {
    const code = src(file);
    assert.doesNotMatch(code, /^\s*import\s/m, `${file} no debe importar módulos`);
    assert.doesNotMatch(code, /supabase|fetch\(|functions\.invoke/, `${file} no debe tocar la red ni la base`);
  }
});

test("Mi plan: en modo solicitud no invoca create-subscription", () => {
  const billing = src("src/pages/Billing.tsx");
  const handler = billing.slice(billing.indexOf("const handleRequestPlanChange"), billing.indexOf("const handleSelectPlan"));
  assert.ok(handler.length > 0, "existe handleRequestPlanChange antes de handleSelectPlan");
  assert.doesNotMatch(handler, /supabase|invoke|fetch\(/);
  assert.match(handler, /buildPlanChangeRequestUrl/);
});
