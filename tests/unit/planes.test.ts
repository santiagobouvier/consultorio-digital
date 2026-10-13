// Planes (oct. 2026): precios anuales acordados, límites, sin "web" como
// prestación y textos alineados con el cobro manual. npm run test:unit
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import {
  PLAN_DEFINITIONS,
  PUBLIC_PLAN_ORDER,
  getAnnualTotal,
  getPlanPrice,
} from "../../src/lib/plan-definitions.ts";

const src = (rel: string) => readFileSync(fileURLToPath(new URL(`../../${rel}`, import.meta.url)), "utf8");

test("precios anuales acordados: 9.600 / 18.000 / 36.000 (800 / 1.500 / 3.000 por mes)", () => {
  const expected = { emprendedor: [800, 9600], esencial: [1500, 18000], profesional: [3000, 36000] } as const;
  for (const [code, [perMonth, perYear]] of Object.entries(expected)) {
    assert.equal(getPlanPrice(code, "annual"), perMonth, code);
    assert.equal(getAnnualTotal(code), perYear, code);
  }
});

test("los precios mensuales no se redefinieron", () => {
  assert.equal(PLAN_DEFINITIONS.emprendedor.priceMonthly, 1590);
  assert.equal(PLAN_DEFINITIONS.esencial.priceMonthly, 2900);
  assert.equal(PLAN_DEFINITIONS.profesional.priceMonthly, 5490);
});

test("límites acordados (ya coincidían)", () => {
  const p = PLAN_DEFINITIONS;
  assert.deepEqual([p.emprendedor.maxProfessionals, p.emprendedor.maxPatients, p.emprendedor.whatsappMonthly], [1, 15, 250]);
  assert.deepEqual([p.esencial.maxProfessionals, p.esencial.maxPatients, p.esencial.whatsappMonthly], [1, 40, 700]);
  assert.deepEqual([p.profesional.maxProfessionals, p.profesional.maxPatients, p.profesional.whatsappMonthly], [1, null, 1500]);
  // El servidor aplica los mismos topes
  const limits = src("supabase/migrations/20260912000000_plan_limits_v3.sql");
  assert.match(limits, /WHEN 'emprendedor' THEN 15/);
  assert.match(limits, /WHEN 'esencial' THEN 40/);
  const reminders = src("supabase/functions/process-scheduled-reminders/index.ts");
  assert.match(reminders, /emprendedor: 250,[\s\S]*esencial: 700,[\s\S]*profesional: 1500,/);
});

test("planes no discutidos (Consultorio, Personalizado) quedan igual", () => {
  assert.deepEqual([PLAN_DEFINITIONS.consultorio.priceAnnual, PLAN_DEFINITIONS.consultorio.priceMonthly], [8000, 10000]);
  assert.deepEqual([PLAN_DEFINITIONS.personalizado.priceAnnual, PLAN_DEFINITIONS.personalizado.priceMonthly], [0, 0]);
});

test("el precio anual del servidor coincide con el de la app", () => {
  const fn = src("supabase/functions/create-subscription/index.ts");
  for (const code of PUBLIC_PLAN_ORDER) {
    const m = fn.match(new RegExp(`\\b${code}: \\{ monthly: \\d+, annual: (\\d+) \\}`));
    assert.ok(m, code);
    assert.equal(Number(m![1]), PLAN_DEFINITIONS[code].priceAnnual, code);
  }
});

test("la web ya no es prestación, pero la reserva online y el portal siguen en todos los planes", () => {
  for (const code of Object.keys(PLAN_DEFINITIONS)) {
    const def = PLAN_DEFINITIONS[code] as unknown as Record<string, unknown>;
    assert.equal(def.includesOnlineBooking, true, code);
    assert.equal("customWebsite" in def, false, code);
    assert.equal("hasPublicWeb" in def, false, code);
  }
  for (const f of ["src/pages/PublicBooking.tsx", "src/pages/PublicClinic.tsx"]) {
    assert.match(src(f), /planDef\.includesOnlineBooking/, f);
  }
});

test("landing, precios y Mi plan: sin cuotas, sin prorrateo, sin web como prestación", () => {
  for (const f of ["src/pages/Landing.tsx", "src/pages/Pricing.tsx", "src/pages/Billing.tsx", "src/pages/PlanPayment.tsx"]) {
    const code = src(f);
    assert.doesNotMatch(code, /cuotas/i, f);
    assert.doesNotMatch(code, /diferencia proporcional/i, f);
    assert.doesNotMatch(code, /Web pública (incluida|del consultorio)/, f);
  }
  assert.match(src("src/pages/Landing.tsx"), /pago anual de \{formatPrice\(plan\.annualTotal\)\}/);
  assert.match(src("src/pages/Pricing.tsx"), /pago anual de \{formatPrice\(getAnnualTotal\(plan\.code\)\)\}/);
  assert.doesNotMatch(src("src/pages/Billing.tsx"), /-20%/);
});
