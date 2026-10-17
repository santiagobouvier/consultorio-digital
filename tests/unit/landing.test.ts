// Landing: los planes se muestran sin precios, con lo que incluye cada uno.
// npm run test:unit
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const src = (rel: string) => readFileSync(fileURLToPath(new URL(`../../${rel}`, import.meta.url)), "utf8");

test("landing: los planes se muestran sin precios, con lo que incluye cada uno", () => {
  const code = src("src/pages/Landing.tsx");
  assert.doesNotMatch(code, /formatPrice|priceAnnual|priceMonthly|getAnnualTotal|\/mes|cuotas/, "la landing no publica precios");
  assert.match(code, /PUBLIC_PLAN_ORDER/, "sigue mostrando los planes públicos");
  for (const field of ["maxPatients", "whatsappMonthly", "maxProfessionals", "description"]) {
    assert.match(code, new RegExp(`p\\.${field}`), `muestra ${field}`);
  }
  assert.doesNotMatch(code, /waPlanUrl\(plan\.name,/, "el mensaje de WhatsApp no lleva precio");
  assert.match(src("src/components/landing/LandingNavbar.tsx"), /label: "Planes"/);
});
