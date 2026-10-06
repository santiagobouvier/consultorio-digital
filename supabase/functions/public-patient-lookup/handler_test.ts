// Pruebas de public-patient-lookup (CD-003) sin red ni base: la "base" es un
// doble en memoria. Corre con `npm run test:functions`.
import { test } from "node:test";
import assert from "node:assert/strict";
import { createLookupHandler, type LookupDeps, type PatientClinic } from "./handler.ts";

const PACIENTE_A = "11111111-1111-4111-8111-111111111111";
const PACIENTE_B = "22222222-2222-4222-8222-222222222222";
const TOKENS: Record<string, string> = { "jwt-a": PACIENTE_A, "jwt-b": PACIENTE_B };

const CLINICAS: Record<string, PatientClinic[]> = {
  [PACIENTE_A]: [
    { slug: "qa-psico", name: "QA Psicología", specialty: "Psicología", logo_url: null },
    { slug: "qa-odonto", name: "QA Odontología", specialty: "Odontología", logo_url: null },
  ],
  [PACIENTE_B]: [{ slug: "qa-otra", name: "QA Otra", specialty: null, logo_url: null }],
};

function makeDeps(overrides: Partial<LookupDeps> = {}) {
  const lookups: string[] = [];
  const deps: LookupDeps = {
    getUserIdFromToken: async (t) => TOKENS[t] ?? null,
    listClinicsForUser: async (uid) => {
      lookups.push(uid);
      return CLINICAS[uid] ?? [];
    },
    ...overrides,
  };
  return { deps, lookups };
}

const req = (body: unknown, auth?: string, method = "POST") =>
  new Request("https://example.test/functions/v1/public-patient-lookup", {
    method,
    headers: { "Content-Type": "application/json", ...(auth ? { Authorization: auth } : {}) },
    body: method === "POST" ? JSON.stringify(body) : undefined,
  });

test("sin sesión: un email solo no revela nada (401, sin consultar la base)", async () => {
  const { deps, lookups } = makeDeps();
  const res = await createLookupHandler(deps)(req({ email: "paciente.prueba@example.test" }));
  assert.equal(res.status, 401);
  assert.equal(lookups.length, 0);
});

test("con la clave pública (anon) tampoco: 401", async () => {
  const { deps, lookups } = makeDeps();
  const res = await createLookupHandler(deps)(req({ email: "paciente.prueba@example.test" }, "Bearer anon-publica"));
  assert.equal(res.status, 401);
  assert.equal(lookups.length, 0);
});

test("token que falla al verificarse: 401", async () => {
  const { deps } = makeDeps({ getUserIdFromToken: async () => { throw new Error("jwt malformed"); } });
  assert.equal((await createLookupHandler(deps)(req({}, "Bearer basura"))).status, 401);
});

test("paciente logueado: recibe solo SUS consultorios", async () => {
  const { deps, lookups } = makeDeps();
  const res = await createLookupHandler(deps)(req({}, "Bearer jwt-a"));
  assert.equal(res.status, 200);
  assert.deepEqual((await res.json()).clinics.map((c: PatientClinic) => c.slug), ["qa-psico", "qa-odonto"]);
  assert.deepEqual(lookups, [PACIENTE_A]);
});

test("aislamiento: mandar el email de otra persona no cambia nada, manda la sesión", async () => {
  const { deps, lookups } = makeDeps();
  const res = await createLookupHandler(deps)(req({ email: "otra.persona@example.test", user_id: PACIENTE_B }, "Bearer jwt-a"));
  const slugs = (await res.json()).clinics.map((c: PatientClinic) => c.slug);
  assert.ok(!slugs.includes("qa-otra"));
  assert.deepEqual(lookups, [PACIENTE_A]);
});

test("usuario logueado que no es paciente: lista vacía", async () => {
  const { deps } = makeDeps({ getUserIdFromToken: async () => "33333333-3333-4333-8333-333333333333" });
  const res = await createLookupHandler(deps)(req({}, "Bearer jwt-pro"));
  assert.equal(res.status, 200);
  assert.deepEqual((await res.json()).clinics, []);
});

test("error de base: 500 (no se confunde con 'no encontrado')", async () => {
  const { deps } = makeDeps({ listClinicsForUser: async () => { throw new Error("db down"); } });
  assert.equal((await createLookupHandler(deps)(req({}, "Bearer jwt-a"))).status, 500);
});

test("OPTIONS (preflight) responde sin credencial", async () => {
  const { deps, lookups } = makeDeps();
  const res = await createLookupHandler(deps)(req(undefined, undefined, "OPTIONS"));
  assert.equal(res.status, 200);
  assert.equal(lookups.length, 0);
});
