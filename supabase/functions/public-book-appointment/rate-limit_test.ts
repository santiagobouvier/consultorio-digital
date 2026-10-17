// Pruebas del límite de reservas públicas (rate-limit.ts) sin red ni base.
// Corre con `npm run test:functions`.
import { test } from "node:test";
import assert from "node:assert/strict";
import { checkPublicBookingRate, clientIp, normalizePhone, type RateLimitDeps } from "./rate-limit.ts";

const BIZ = "bbbbbbbb-0000-4000-8000-0000000000e1";

function deps(result: string | null | Error = null) {
  const llamadas: { clientKey: string | null; businessId: string; phoneKey: string | null }[] = [];
  const d: RateLimitDeps = {
    secret: "secreto-ficticio",
    register: async (clientKey, businessId, phoneKey) => {
      llamadas.push({ clientKey, businessId, phoneKey });
      if (result instanceof Error) throw result;
      return result;
    },
    log: () => {},
  };
  return { d, llamadas };
}

test("IP del cliente: primer valor de x-forwarded-for, o x-real-ip", () => {
  assert.equal(clientIp(new Headers({ "x-forwarded-for": "203.0.113.7, 10.0.0.1" })), "203.0.113.7");
  assert.equal(clientIp(new Headers({ "x-real-ip": "203.0.113.8" })), "203.0.113.8");
  assert.equal(clientIp(new Headers()), null);
});

test("teléfono: solo dígitos", () => {
  assert.equal(normalizePhone("+598 98-123 456"), "59898123456");
});

test("las claves van como HMAC: ni la IP ni el teléfono llegan en claro a la base", async () => {
  const { d, llamadas } = deps();
  await checkPublicBookingRate(new Headers({ "x-forwarded-for": "203.0.113.7" }), BIZ, "099 123 456", d);
  const [c] = llamadas;
  assert.match(c.clientKey!, /^[0-9a-f]{64}$/);
  assert.match(c.phoneKey!, /^[0-9a-f]{64}$/);
  assert.ok(!c.clientKey!.includes("203.0.113.7"));
  assert.equal(c.businessId, BIZ);
});

test("mismo teléfono escrito distinto → misma clave; otra IP → otra clave", async () => {
  const { d, llamadas } = deps();
  await checkPublicBookingRate(new Headers({ "x-forwarded-for": "203.0.113.7" }), BIZ, "099-123-456", d);
  await checkPublicBookingRate(new Headers({ "x-forwarded-for": "203.0.113.9" }), BIZ, "099 123 456", d);
  assert.equal(llamadas[0].phoneKey, llamadas[1].phoneKey);
  assert.notEqual(llamadas[0].clientKey, llamadas[1].clientKey);
});

test("sin IP: no se inventa una clave común para todos", async () => {
  const { d, llamadas } = deps();
  await checkPublicBookingRate(new Headers(), BIZ, "099123456", d);
  assert.equal(llamadas[0].clientKey, null);
});

test("devuelve el límite superado tal cual", async () => {
  const { d } = deps("client_10min");
  assert.equal(await checkPublicBookingRate(new Headers(), BIZ, "099123456", d), "client_10min");
});

test("si la base falla (migración sin aplicar), la reserva no se bloquea", async () => {
  const { d } = deps(new Error("function register_public_booking_attempt does not exist"));
  assert.equal(await checkPublicBookingRate(new Headers(), BIZ, "099123456", d), null);
});
