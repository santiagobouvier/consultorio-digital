// Pruebas de send-push-notification (CD-004) con envío simulado: ningún push
// real sale de acá. Corre con `npm run test:functions`.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { createPushHandler, sanitizeUserUrl, type PushDeps, type PushPayload } from "./handler.ts";

const SERVICE_ROLE = "service-role-secret-for-tests";
const PROFESIONAL = "aaaaaaaa-0000-4000-8000-000000000001";
const PROFESIONAL_OTRO = "aaaaaaaa-0000-4000-8000-000000000002";
const PACIENTE_MIO = "bbbbbbbb-0000-4000-8000-000000000001";
const PACIENTE_AJENO = "bbbbbbbb-0000-4000-8000-000000000002";
const TOKENS: Record<string, string> = { "jwt-pro": PROFESIONAL, "jwt-otro": PROFESIONAL_OTRO };
// Pacientes de cada profesional (lo que resuelve la base con patients + user_belongs_to_business)
const MIS_PACIENTES: Record<string, string[]> = {
  [PROFESIONAL]: [PACIENTE_MIO],
  [PROFESIONAL_OTRO]: [PACIENTE_AJENO],
};

function makeDeps(overrides: Partial<PushDeps> = {}) {
  const enviados: { to: string; payload: PushPayload }[] = [];
  const deps: PushDeps = {
    serviceRoleKey: SERVICE_ROLE,
    getUserIdFromToken: async (t) => TOKENS[t] ?? null,
    isPatientOfCallerBusiness: async (caller, target) => (MIS_PACIENTES[caller] ?? []).includes(target),
    deliver: async (to, payload) => {
      enviados.push({ to, payload });
      return { sent: 1, total: 1, cleaned: 0 };
    },
    ...overrides,
  };
  return { deps, enviados };
}

const req = (body: unknown, auth?: string, method = "POST") =>
  new Request("https://example.test/functions/v1/send-push-notification", {
    method,
    headers: { "Content-Type": "application/json", ...(auth ? { Authorization: auth } : {}) },
    body: method === "POST" ? JSON.stringify(body) : undefined,
  });

const aviso = (user_id: string, extra: Record<string, unknown> = {}) => ({
  user_id, title: "Tu cita fue confirmada", body: "Te esperamos el jueves a las 10:00.", ...extra,
});

// ── Rechazos (no se envía nada) ──

test("sin Authorization → 401", async () => {
  const { deps, enviados } = makeDeps();
  assert.equal((await createPushHandler(deps)(req(aviso(PACIENTE_MIO)))).status, 401);
  assert.equal(enviados.length, 0);
});

test("clave pública (anon) → 401: ya no alcanza para mandar pushes", async () => {
  const { deps, enviados } = makeDeps();
  assert.equal((await createPushHandler(deps)(req(aviso(PROFESIONAL), "Bearer anon-publica"))).status, 401);
  assert.equal(enviados.length, 0);
});

test("token que falla al verificarse o service role casi igual → 401", async () => {
  const { deps, enviados } = makeDeps({ getUserIdFromToken: async () => { throw new Error("jwt malformed"); } });
  const h = createPushHandler(deps);
  assert.equal((await h(req(aviso(PACIENTE_MIO), "Bearer basura"))).status, 401);
  assert.equal((await h(req(aviso(PACIENTE_MIO), `Bearer ${SERVICE_ROLE.slice(0, -1)}`))).status, 401);
  assert.equal(enviados.length, 0);
});

test("aislamiento: un profesional no puede avisar al paciente de otro consultorio → 403", async () => {
  const { deps, enviados } = makeDeps();
  assert.equal((await createPushHandler(deps)(req(aviso(PACIENTE_AJENO), "Bearer jwt-pro"))).status, 403);
  assert.equal(enviados.length, 0);
});

test("un usuario logueado no puede mandarle pushes a un profesional (phishing al panel) → 403", async () => {
  const { deps, enviados } = makeDeps();
  assert.equal((await createPushHandler(deps)(req(aviso(PROFESIONAL_OTRO), "Bearer jwt-pro"))).status, 403);
  assert.equal(enviados.length, 0);
});

test("si la verificación en la base falla, se niega (fail closed)", async () => {
  const { deps, enviados } = makeDeps({ isPatientOfCallerBusiness: async () => { throw new Error("db down"); } });
  assert.equal((await createPushHandler(deps)(req(aviso(PACIENTE_MIO), "Bearer jwt-pro"))).status, 403);
  assert.equal(enviados.length, 0);
});

test("cuerpo incompleto o user_id inválido → 400 sin envío", async () => {
  const { deps, enviados } = makeDeps();
  const h = createPushHandler(deps);
  assert.equal((await h(req({ user_id: PACIENTE_MIO }, `Bearer ${SERVICE_ROLE}`))).status, 400);
  assert.equal((await h(req(aviso("no-es-uuid"), `Bearer ${SERVICE_ROLE}`))).status, 400);
  assert.equal(enviados.length, 0);
});

// ── Caminos legítimos ──

test("backend (service role): reserva pública, webhook y resumen diario siguen avisando", async () => {
  const { deps, enviados } = makeDeps();
  const res = await createPushHandler(deps)(
    req(aviso(PROFESIONAL, { title: "Nueva reserva", url: "/agenda", icon: "/app-icon.svg" }), `Bearer ${SERVICE_ROLE}`),
  );
  assert.equal(res.status, 200);
  assert.deepEqual(enviados, [{
    to: PROFESIONAL,
    payload: { title: "Nueva reserva", body: "Te esperamos el jueves a las 10:00.", icon: "/app-icon.svg", data: { url: "/agenda" } },
  }]);
});

test("profesional a SU paciente (notifyPatient del panel) → 200, con link a su portal", async () => {
  const { deps, enviados } = makeDeps();
  const res = await createPushHandler(deps)(
    req(aviso(PACIENTE_MIO, { url: "https://consultoriodigital.app/portal/qa-psico" }), "Bearer jwt-pro"),
  );
  assert.equal(res.status, 200);
  assert.equal(enviados[0].to, PACIENTE_MIO);
  assert.equal(enviados[0].payload.data.url, "/portal/qa-psico");
});

test("profesional: links externos e íconos ajenos se neutralizan; textos se recortan", async () => {
  const { deps, enviados } = makeDeps();
  await createPushHandler(deps)(
    req(aviso(PACIENTE_MIO, {
      url: "https://sitio-falso.example/login",
      icon: "https://sitio-falso.example/logo.png",
      title: "x".repeat(500),
      body: "y".repeat(5000),
    }), "Bearer jwt-pro"),
  );
  const p = enviados[0].payload;
  assert.equal(p.data.url, "/");
  assert.equal(p.icon, "/app-icon.svg");
  assert.equal(p.title.length, 120);
  assert.equal(p.body.length, 500);
});

test("destino sin dispositivos registrados → 200 con sent 0 (igual que antes)", async () => {
  const { deps } = makeDeps({ deliver: async () => ({ sent: 0, total: 0, cleaned: 0 }) });
  const res = await createPushHandler(deps)(req(aviso(PROFESIONAL), `Bearer ${SERVICE_ROLE}`));
  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), { sent: 0, message: "No subscriptions found" });
});

test("OPTIONS (preflight) responde sin credencial", async () => {
  const { deps, enviados } = makeDeps();
  assert.equal((await createPushHandler(deps)(req(undefined, undefined, "OPTIONS"))).status, 200);
  assert.equal(enviados.length, 0);
});

test("sanitizeUserUrl: solo rutas propias", () => {
  assert.equal(sanitizeUserUrl("/agenda?date=2026-10-07"), "/agenda?date=2026-10-07");
  assert.equal(sanitizeUserUrl("https://consultoriodigital.app/portal/x#citas"), "/portal/x#citas");
  assert.equal(sanitizeUserUrl("//sitio-falso.example/x"), "/");
  assert.equal(sanitizeUserUrl("javascript:alert(1)"), "/");
  assert.equal(sanitizeUserUrl(undefined), "/");
});

// ── Llamadores reales ──

const read = (rel: string) => readFileSync(fileURLToPath(new URL(`../../../${rel}`, import.meta.url)), "utf8");

test("los llamadores del backend mandan la service role", () => {
  for (const fn of ["public-book-appointment", "mercadopago-webhook", "daily-agenda-summary"]) {
    const code = read(`supabase/functions/${fn}/index.ts`);
    const at = code.indexOf("/functions/v1/send-push-notification");
    assert.ok(at > 0, `${fn} llama a send-push-notification`);
    assert.match(code.slice(at, at + 400), /Authorization: `Bearer \$\{(serviceRoleKey|supabaseServiceKey)\}`/, fn);
  }
});

test("el panel solo avisa a pacientes: notifyPatient resuelve el usuario desde patients", () => {
  const lib = read("src/lib/push-notifications.ts");
  assert.match(lib, /from\("patients"\)[\s\S]*select\("auth_user_id, business_id"\)/);
  assert.match(lib, /user_id: data\.auth_user_id/);
});
