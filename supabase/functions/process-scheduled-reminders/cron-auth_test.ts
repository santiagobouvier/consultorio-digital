// Pruebas de quién puede disparar las tareas de avisos (cron-auth.ts), sin
// red ni base. Corre con `npm run test:functions`.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { bearerToken, isAuthorizedCronCaller, type CronAuthDeps } from "./cron-auth.ts";

const SERVICE = "service-role-ficticia";
const CRON = "a".repeat(64);
const ANON = "eyJ.anon.ficticia";

function deps(overrides: Partial<CronAuthDeps> = {}) {
  const consultas: string[] = [];
  const d: CronAuthDeps = {
    serviceRoleKey: SERVICE,
    verifyCronToken: async (t) => {
      consultas.push(t);
      return t === CRON;
    },
    ...overrides,
  };
  return { d, consultas };
}

test("bearerToken lee solo 'Bearer <token>'", () => {
  assert.equal(bearerToken("Bearer abc"), "abc");
  assert.equal(bearerToken("bearer abc"), "abc");
  assert.equal(bearerToken("abc"), null);
  assert.equal(bearerToken(null), null);
});

test("sin header o con la anon key pública: rechazado", async () => {
  const { d, consultas } = deps();
  assert.equal(await isAuthorizedCronCaller(null, d), false);
  assert.equal(await isAuthorizedCronCaller(`Bearer ${ANON}`, d), false);
  assert.deepEqual(consultas, [], "un token con otro formato ni se consulta");
});

test("service role (servidor): aceptado sin consultar la base", async () => {
  const { d, consultas } = deps();
  assert.equal(await isAuthorizedCronCaller(`Bearer ${SERVICE}`, d), true);
  assert.deepEqual(consultas, []);
});

test("token de pg_cron vigente: aceptado; otro token de 64 hex: rechazado", async () => {
  const { d } = deps();
  assert.equal(await isAuthorizedCronCaller(`Bearer ${CRON}`, d), true);
  assert.equal(await isAuthorizedCronCaller(`Bearer ${"b".repeat(64)}`, d), false);
});

test("si la base no responde, se rechaza (no se abre la puerta)", async () => {
  const { d } = deps({ verifyCronToken: async () => { throw new Error("db caída"); } });
  assert.equal(await isAuthorizedCronCaller(`Bearer ${CRON}`, d), false);
});

test("sin service role configurada, un Bearer vacío no pasa", async () => {
  const { d } = deps({ serviceRoleKey: "" });
  assert.equal(await isAuthorizedCronCaller("Bearer ", d), false);
});

const read = (rel: string) => readFileSync(fileURLToPath(new URL(`../../../${rel}`, import.meta.url)), "utf8");

test("las dos funciones usan la misma copia y la chequean antes de trabajar", () => {
  const a = read("supabase/functions/process-scheduled-reminders/cron-auth.ts");
  const b = read("supabase/functions/daily-agenda-summary/cron-auth.ts");
  assert.equal(a, b, "cron-auth.ts tiene que ser idéntico en las dos carpetas");
  for (const fn of ["process-scheduled-reminders", "daily-agenda-summary"]) {
    const code = read(`supabase/functions/${fn}/index.ts`);
    const auth = code.indexOf("isAuthorizedCronCaller(req.headers");
    assert.ok(auth > 0, `${fn} chequea el llamador`);
    assert.ok(auth < code.indexOf('.from("'), `${fn} chequea antes de leer la base`);
  }
});
