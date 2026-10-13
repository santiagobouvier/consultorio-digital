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
    hasLegacyAutomaticDebit: false,
  });
});

test("débito automático heredado: pide cambio por soporte y conserva cancelar el débito", () => {
  assert.deepEqual(getBillingActions({ status: "active", mercadopago_preapproval_id: "mp-123" }), {
    isManual: false,
    planChangeMode: "support_request",
    canCancel: true,
    canAddPlatformPayment: false,
    hasLegacyAutomaticDebit: true,
  });
});

test("cobro manual: en ningún estado se ofrece pagar ni contratar por la plataforma", () => {
  for (const status of ["trial", "expired", "past_due", "pending", "cancelled", "active"]) {
    for (const pre of [null, "mp-1"]) {
      const a = getBillingActions({ status, mercadopago_preapproval_id: pre });
      assert.equal(a.planChangeMode, "support_request", `${status}/${pre}`);
      assert.equal(a.canAddPlatformPayment, false, `${status}/${pre}`);
    }
  }
  assert.equal(getBillingActions(null).planChangeMode, "support_request");
  assert.equal(getBillingActions({ status: "trial", mercadopago_preapproval_id: null }).canCancel, true, "la prueba se puede cancelar");
  assert.equal(getBillingActions({ status: "expired", mercadopago_preapproval_id: null }).canCancel, false);
  assert.equal(getBillingActions({ status: "cancelled", mercadopago_preapproval_id: "mp-1" }).canCancel, false);
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

test("ninguna pantalla invoca create-subscription (sin checkout de suscripción)", () => {
  for (const f of ["src/pages/Billing.tsx", "src/components/SubscriptionGuard.tsx", "src/pages/PlanPayment.tsx", "src/pages/ActivateTrial.tsx"]) {
    assert.doesNotMatch(src(f), /create-subscription/, f);
  }
  const billing = src("src/pages/Billing.tsx");
  assert.doesNotMatch(billing, /handleSelectPlan|Agregar método de pago/);
  assert.match(billing, /onClick=\{\(\) => handleRequestPlanChange\(code\)\}/);
});

test("el servidor rechaza contrataciones nuevas salvo habilitación explícita", () => {
  const fn = src("supabase/functions/create-subscription/index.ts");
  const guard = fn.indexOf('Deno.env.get("SUBSCRIPTIONS_SELF_CHECKOUT") !== "enabled"');
  assert.ok(guard > 0, "existe la guarda");
  assert.ok(guard < fn.indexOf("api.mercadopago.com/preapproval"), "la guarda va antes de tocar Mercado Pago");
  assert.ok(guard < fn.indexOf('.from("businesses")'), "y antes de crear o leer el consultorio");
  assert.match(fn.slice(guard, guard + 500), /status: 410/);
});
