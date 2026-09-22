// Pruebas de autorización de send-resend-email con proveedor simulado.
// Corren con Node (node --experimental-strip-types --test) y con Deno
// (deno test); no tocan la red ni envían correos: `fetch` es un doble.
import { test } from "node:test";
import assert from "node:assert/strict";
import { createHandler, DEFAULT_BRANDING, type HandlerDeps } from "./handler.ts";

const SERVICE_ROLE = "service-role-secret-for-tests";
const ANON_KEY = "anon-key-public-for-tests";
const USER_TOKEN = "user-jwt-for-tests";
const MY_BUSINESS = "11111111-1111-4111-8111-111111111111";
const OTHER_BUSINESS = "22222222-2222-4222-8222-222222222222";
// "Base de datos" simulada de destinatarios conocidos por consultorio
const KNOWN_RECIPIENTS: Record<string, string[]> = {
  [MY_BUSINESS]: ["paciente.prueba@example.test", "solicitante@example.test"],
  [OTHER_BUSINESS]: ["paciente.ajeno@example.test"],
};
const FUNCTION_URL = "https://example.test/functions/v1/send-resend-email";
// Token dedicado del trigger (64 hex) y uno con la misma forma pero inválido
const PORTAL_TOKEN = "a".repeat(32) + "b".repeat(32);
const WRONG_PORTAL_TOKEN = "c".repeat(64);
const CONTACT_EMAILS: Record<string, string | null> = {
  [MY_BUSINESS]: "profesional.prueba@example.test",
  [OTHER_BUSINESS]: null,
};
const portalNotice = (businessId: string, data: Record<string, unknown> = { kind: "new_booking", when: "23/09/2026 09:00" }, extra: Record<string, unknown> = {}) => ({
  template: "portal_notice",
  businessId,
  data,
  ...extra,
});

interface ResendPayload {
  from?: string;
  to?: string[];
  subject?: string;
  html?: string;
  attachments?: { filename: string; content: string }[];
}

interface Recorded {
  calls: { url: string; body: ResendPayload }[];
}

function makeDeps(overrides: Partial<HandlerDeps> = {}): {
  deps: HandlerDeps;
  resend: Recorded;
  recipientChecks: { businessId: string; email: string }[];
  tokenChecks: string[];
} {
  const resend: Recorded = { calls: [] };
  const recipientChecks: { businessId: string; email: string }[] = [];
  const tokenChecks: string[] = [];
  const deps: HandlerDeps = {
    verifyPortalNotifyToken: async (token) => {
      tokenChecks.push(token);
      return token === PORTAL_TOKEN;
    },
    getBusinessContactEmail: async (businessId) => CONTACT_EMAILS[businessId] ?? null,
    serviceRoleKey: SERVICE_ROLE,
    resendApiKey: "re_test_key",
    fromEmail: "Consultorio Digital <noreply@example.test>",
    getUserIdFromToken: async (token) => (token === USER_TOKEN ? "user-1" : null),
    userBelongsToBusiness: async (userId, businessId) => userId === "user-1" && businessId === MY_BUSINESS,
    recipientBelongsToBusiness: async (businessId, email) => {
      recipientChecks.push({ businessId, email });
      return (KNOWN_RECIPIENTS[businessId] ?? []).some((e) => e.toLowerCase() === email.toLowerCase());
    },
    getBranding: async () => DEFAULT_BRANDING,
    fetch: (async (url: RequestInfo | URL, init?: RequestInit) => {
      resend.calls.push({ url: String(url), body: JSON.parse(String(init?.body ?? "{}")) });
      return new Response(JSON.stringify({ id: "email-123" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }) as typeof fetch,
    ...overrides,
  };
  return { deps, resend, recipientChecks, tokenChecks };
}

function request(body: unknown, auth?: string, method = "POST"): Request {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (auth !== undefined) headers["Authorization"] = auth;
  return new Request(FUNCTION_URL, {
    method,
    headers,
    body: method === "POST" ? JSON.stringify(body) : undefined,
  });
}

const rawEmail = (businessId?: string, to = "paciente.prueba@example.test") => ({
  to,
  template: "raw",
  businessId,
  data: { subject: "Prueba", message: "Hola" },
});

// ── Rechazos (ninguno llega al proveedor) ──

test("sin Authorization → 401 y no se envía nada", async () => {
  const { deps, resend } = makeDeps();
  const res = await createHandler(deps)(request(rawEmail(MY_BUSINESS)));
  assert.equal(res.status, 401);
  assert.equal(resend.calls.length, 0);
});

test("anon key pública como bearer → 401 (no es un usuario)", async () => {
  const { deps, resend } = makeDeps();
  const res = await createHandler(deps)(request(rawEmail(MY_BUSINESS), `Bearer ${ANON_KEY}`));
  assert.equal(res.status, 401);
  assert.equal(resend.calls.length, 0);
});

test("token inválido que hace fallar la verificación → 401", async () => {
  const { deps, resend } = makeDeps({
    getUserIdFromToken: async () => {
      throw new Error("jwt malformed");
    },
  });
  const res = await createHandler(deps)(request(rawEmail(MY_BUSINESS), "Bearer basura"));
  assert.equal(res.status, 401);
  assert.equal(resend.calls.length, 0);
});

test("service role casi igual (prefijo) → 401", async () => {
  const { deps, resend } = makeDeps();
  const res = await createHandler(deps)(request(rawEmail(MY_BUSINESS), `Bearer ${SERVICE_ROLE.slice(0, -1)}`));
  assert.equal(res.status, 401);
  assert.equal(resend.calls.length, 0);
});

test("usuario logueado sin businessId → 403", async () => {
  const { deps, resend } = makeDeps();
  const res = await createHandler(deps)(request(rawEmail(undefined), `Bearer ${USER_TOKEN}`));
  assert.equal(res.status, 403);
  assert.equal(resend.calls.length, 0);
});

test("usuario logueado con businessId de otro consultorio → 403", async () => {
  const { deps, resend } = makeDeps();
  const res = await createHandler(deps)(request(rawEmail(OTHER_BUSINESS), `Bearer ${USER_TOKEN}`));
  assert.equal(res.status, 403);
  assert.equal(resend.calls.length, 0);
});

test("usuario logueado no puede mandar invitaciones ni activaciones", async () => {
  const { deps, resend } = makeDeps();
  const handler = createHandler(deps);
  for (const template of ["patient_invite", "business_activation"]) {
    const res = await handler(
      request(
        { to: "x@example.test", template, businessId: MY_BUSINESS, data: { inviteUrl: "https://example.test/i", activationUrl: "https://example.test/a" } },
        `Bearer ${USER_TOKEN}`,
      ),
    );
    assert.equal(res.status, 403, template);
  }
  assert.equal(resend.calls.length, 0);
});

test("profesional a un email que no es de su consultorio → 403 sin envío", async () => {
  const { deps, resend } = makeDeps();
  const res = await createHandler(deps)(request(rawEmail(MY_BUSINESS, "desconocido@example.test"), `Bearer ${USER_TOKEN}`));
  assert.equal(res.status, 403);
  assert.deepEqual(await res.json(), { error: "recipient_not_allowed" });
  assert.equal(resend.calls.length, 0);
});

test("profesional a un paciente de OTRO consultorio (aunque exista) → 403", async () => {
  const { deps, resend } = makeDeps();
  const res = await createHandler(deps)(request(rawEmail(MY_BUSINESS, "paciente.ajeno@example.test"), `Bearer ${USER_TOKEN}`));
  assert.equal(res.status, 403);
  assert.equal(resend.calls.length, 0);
});

test("profesional: si la consulta de destinatarios falla, se niega (fail closed)", async () => {
  const { deps, resend } = makeDeps({
    recipientBelongsToBusiness: async () => {
      throw new Error("db down");
    },
  });
  const res = await createHandler(deps)(request(rawEmail(MY_BUSINESS), `Bearer ${USER_TOKEN}`));
  assert.equal(res.status, 403);
  assert.equal(resend.calls.length, 0);
});

test("profesional: el destinatario se valida ya normalizado (mailto:, espacios, mayúsculas)", async () => {
  const { deps, resend, recipientChecks } = makeDeps();
  const res = await createHandler(deps)(
    request(rawEmail(MY_BUSINESS, " mailto:Paciente.Prueba@Example.Test "), `Bearer ${USER_TOKEN}`),
  );
  assert.equal(res.status, 200);
  assert.deepEqual(recipientChecks, [{ businessId: MY_BUSINESS, email: "Paciente.Prueba@example.test" }]);
  assert.deepEqual(resend.calls[0].body.to, ["Paciente.Prueba@example.test"]);
});

test("profesional a un solicitante de turno (appointment_requests) → 200", async () => {
  const { deps, resend } = makeDeps();
  const res = await createHandler(deps)(request(rawEmail(MY_BUSINESS, "solicitante@example.test"), `Bearer ${USER_TOKEN}`));
  assert.equal(res.status, 200);
  assert.equal(resend.calls.length, 1);
});

test("service role no pasa por la validación de destinatarios (avisos al profesional, activaciones)", async () => {
  const { deps, resend, recipientChecks } = makeDeps();
  const res = await createHandler(deps)(
    request(
      { to: "profesional@example.test", template: "business_activation", data: { activationUrl: "https://example.test/a" } },
      `Bearer ${SERVICE_ROLE}`,
    ),
  );
  assert.equal(res.status, 200);
  assert.equal(recipientChecks.length, 0);
  assert.equal(resend.calls.length, 1);
});

// ── Trigger del portal (token dedicado) ──

test("trigger: token válido → 200, texto fijo y destinatario del servidor (se ignora el `to` del cuerpo)", async () => {
  const { deps, resend, recipientChecks } = makeDeps();
  const res = await createHandler(deps)(
    request(portalNotice(MY_BUSINESS, undefined, { to: "atacante@example.test" }), `Bearer ${PORTAL_TOKEN}`),
  );
  assert.equal(res.status, 200);
  assert.equal(resend.calls.length, 1);
  assert.deepEqual(resend.calls[0].body.to, ["profesional.prueba@example.test"]);
  assert.equal(resend.calls[0].body.subject, "Nueva reserva desde el portal · 23/09/2026 09:00");
  assert.match(resend.calls[0].body.html ?? "", /reservó desde su portal para el 23\/09\/2026 09:00/);
  assert.equal(recipientChecks.length, 0);
});

test("trigger: reprogramación → asunto y texto fijos del tipo", async () => {
  const { deps, resend } = makeDeps();
  const res = await createHandler(deps)(
    request(portalNotice(MY_BUSINESS, { kind: "reschedule_request", when: "24/09/2026 15:30" }), `Bearer ${PORTAL_TOKEN}`),
  );
  assert.equal(res.status, 200);
  assert.equal(resend.calls[0].body.subject, "Solicitud de reprogramación · 24/09/2026 15:30");
});

test("trigger: token con la forma correcta pero no vigente → 401 sin envío", async () => {
  const { deps, resend, tokenChecks } = makeDeps();
  const res = await createHandler(deps)(request(portalNotice(MY_BUSINESS), `Bearer ${WRONG_PORTAL_TOKEN}`));
  assert.equal(res.status, 401);
  assert.equal(resend.calls.length, 0);
  assert.deepEqual(tokenChecks, [WRONG_PORTAL_TOKEN]);
});

test("trigger: rotación → el token viejo deja de servir al instante", async () => {
  const NEW_TOKEN = "d".repeat(64);
  const { deps, resend } = makeDeps({ verifyPortalNotifyToken: async (t) => t === NEW_TOKEN });
  const handler = createHandler(deps);
  assert.equal((await handler(request(portalNotice(MY_BUSINESS), `Bearer ${PORTAL_TOKEN}`))).status, 401);
  assert.equal((await handler(request(portalNotice(MY_BUSINESS), `Bearer ${NEW_TOKEN}`))).status, 200);
  assert.equal(resend.calls.length, 1);
});

test("trigger: si la verificación en la base falla → 401 (fail closed)", async () => {
  const { deps, resend } = makeDeps({
    verifyPortalNotifyToken: async () => {
      throw new Error("db down");
    },
  });
  const res = await createHandler(deps)(request(portalNotice(MY_BUSINESS), `Bearer ${PORTAL_TOKEN}`));
  assert.equal(res.status, 401);
  assert.equal(resend.calls.length, 0);
});

test("trigger: no puede usar otras plantillas (raw, confirmación, invitación)", async () => {
  const { deps, resend } = makeDeps();
  const handler = createHandler(deps);
  for (const template of ["raw", "appointment_confirmation", "patient_invite", "business_activation"]) {
    const res = await handler(
      request({ to: "x@example.test", template, businessId: MY_BUSINESS, data: { subject: "x", message: "y" } }, `Bearer ${PORTAL_TOKEN}`),
    );
    assert.equal(res.status, 403, template);
  }
  assert.equal(resend.calls.length, 0);
});

test("trigger: tipo desconocido o fecha con otro formato → 400 sin envío", async () => {
  const { deps, resend } = makeDeps();
  const handler = createHandler(deps);
  assert.equal((await handler(request(portalNotice(MY_BUSINESS, { kind: "marketing", when: "23/09/2026 09:00" }), `Bearer ${PORTAL_TOKEN}`))).status, 400);
  assert.equal((await handler(request(portalNotice(MY_BUSINESS, { kind: "new_booking", when: "<b>hola</b>" }), `Bearer ${PORTAL_TOKEN}`))).status, 400);
  assert.equal((await handler(request(portalNotice(MY_BUSINESS, { kind: "new_booking" }), `Bearer ${PORTAL_TOKEN}`))).status, 400);
  assert.equal((await handler(request(portalNotice("no-es-uuid"), `Bearer ${PORTAL_TOKEN}`))).status, 403);
  assert.equal(resend.calls.length, 0);
});

test("trigger: consultorio sin contact_email → 200 omitido, sin envío", async () => {
  const { deps, resend } = makeDeps();
  const res = await createHandler(deps)(request(portalNotice(OTHER_BUSINESS), `Bearer ${PORTAL_TOKEN}`));
  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), { success: false, skipped: "no_contact_email" });
  assert.equal(resend.calls.length, 0);
});

test("profesional logueado no puede disparar portal_notice", async () => {
  const { deps, resend, tokenChecks } = makeDeps();
  const res = await createHandler(deps)(request(portalNotice(MY_BUSINESS), `Bearer ${USER_TOKEN}`));
  assert.equal(res.status, 403);
  assert.equal(resend.calls.length, 0);
  assert.equal(tokenChecks.length, 0, "un JWT nunca se manda a verificar como token del portal");
});

test("service role puede usar portal_notice con la misma composición cerrada", async () => {
  const { deps, resend } = makeDeps();
  const res = await createHandler(deps)(
    request({ to: "profesional.prueba@example.test", ...portalNotice(MY_BUSINESS) }, `Bearer ${SERVICE_ROLE}`),
  );
  assert.equal(res.status, 200);
  assert.equal(resend.calls[0].body.subject, "Nueva reserva desde el portal · 23/09/2026 09:00");
});

test("service role con cuerpo incompleto → 400 sin envío", async () => {
  const { deps, resend } = makeDeps();
  const res = await createHandler(deps)(request({ to: "x@example.test" }, `Bearer ${SERVICE_ROLE}`));
  assert.equal(res.status, 400);
  assert.equal(resend.calls.length, 0);
});

// ── Caminos autorizados (proveedor simulado) ──

test("service role → 200 y llega a Resend con adjunto .ics", async () => {
  const { deps, resend } = makeDeps();
  const res = await createHandler(deps)(
    request(
      {
        to: "paciente.prueba@example.test",
        template: "appointment_confirmation",
        businessId: OTHER_BUSINESS, // el backend puede mandar por cualquier consultorio
        data: { patientName: "Prueba", date: "23/09/2026", time: "09:00", modality: "online", isoDate: "2026-09-23", endTime: "09:50", serviceName: "Sesión" },
      },
      `Bearer ${SERVICE_ROLE}`,
    ),
  );
  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), { success: true, id: "email-123" });
  assert.equal(resend.calls.length, 1);
  const call = resend.calls[0];
  assert.equal(call.url, "https://api.resend.com/emails");
  assert.deepEqual(call.body.to, ["paciente.prueba@example.test"]);
  assert.equal(call.body.from, deps.fromEmail);
  assert.match(call.body.subject, /Confirmación de cita/);
  assert.equal(call.body.attachments?.[0]?.filename, "cita.ics");
});

test("profesional del consultorio → 200 con plantilla raw", async () => {
  const { deps, resend } = makeDeps();
  const res = await createHandler(deps)(request(rawEmail(MY_BUSINESS), `Bearer ${USER_TOKEN}`));
  assert.equal(res.status, 200);
  assert.equal(resend.calls.length, 1);
  assert.equal(resend.calls[0].body.subject, "Prueba");
  assert.match(resend.calls[0].body.html, /Hola/);
});

test("profesional del consultorio → 200 con appointment_confirmation", async () => {
  const { deps, resend } = makeDeps();
  const res = await createHandler(deps)(
    request(
      {
        to: "paciente.prueba@example.test",
        template: "appointment_confirmation",
        businessId: MY_BUSINESS,
        data: { patientName: "Prueba", date: "23/09/2026", time: "09:00", modality: "presencial", location: null },
      },
      `Bearer ${USER_TOKEN}`,
    ),
  );
  assert.equal(res.status, 200);
  assert.equal(resend.calls.length, 1);
});

test("error del proveedor → 502 (no se enmascara como éxito)", async () => {
  const { deps } = makeDeps({
    fetch: (async () =>
      new Response(JSON.stringify({ message: "domain not verified" }), { status: 403 })) as typeof fetch,
  });
  const res = await createHandler(deps)(request(rawEmail(MY_BUSINESS), `Bearer ${SERVICE_ROLE}`));
  assert.equal(res.status, 502);
});

test("OPTIONS (preflight CORS) no exige credencial", async () => {
  const { deps, resend } = makeDeps();
  const res = await createHandler(deps)(request(undefined, undefined, "OPTIONS"));
  assert.equal(res.status, 200);
  assert.equal(resend.calls.length, 0);
});
