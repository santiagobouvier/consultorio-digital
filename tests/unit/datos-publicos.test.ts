// La web pública no pide datos internos del consultorio (owner_user_id,
// plan_code) y sigue funcionando sin ellos. npm run test:unit
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { getPlanDefinition } from "../../src/lib/plan-definitions.ts";

const src = (rel: string) => readFileSync(fileURLToPath(new URL(`../../${rel}`, import.meta.url)), "utf8");

test("las páginas públicas no piden owner_user_id ni plan_code a la vista pública", () => {
  for (const page of ["src/pages/PublicBooking.tsx", "src/pages/PublicClinic.tsx"]) {
    const code = src(page);
    const cols = [...code.matchAll(/const columns =\s*"([^"]+)"/g)].map((m) => m[1]);
    assert.ok(cols.length > 0, page);
    for (const c of cols) {
      assert.ok(!/\bowner_user_id\b/.test(c), `${page}: owner_user_id`);
      assert.ok(!/\bplan_code\b/.test(c), `${page}: plan_code`);
    }
  }
});

test("sin plan_code, la reserva online sigue habilitada (está en todos los planes)", () => {
  const def = getPlanDefinition(undefined as unknown as string) as unknown as Record<string, unknown>;
  // includesOnlineBooking (planes nuevos) o hasPublicWeb (antes del cambio comercial)
  assert.equal(def.includesOnlineBooking ?? def.hasPublicWeb, true);
});

test("la página del consultorio no busca al dueño si no hay sesión", () => {
  const code = src("src/pages/PublicClinic.tsx");
  const fn = code.slice(code.indexOf("async function loadOwnerSettings"), code.indexOf("const PublicClinic = ("));
  assert.ok(fn.indexOf("getSession") >= 0 && fn.indexOf("getSession") < fn.indexOf('.from("businesses")'));
});

test("la reserva pública muestra un mensaje propio cuando se frena por límite", () => {
  const code = src("src/pages/PublicBooking.tsx");
  assert.match(code, /errCode === "rate_limited"/);
  assert.match(code, /error\.context|context\?: Response/);
});
