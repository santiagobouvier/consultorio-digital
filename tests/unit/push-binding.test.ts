// Vínculo push ↔ cuenta con sesión. npm run test:unit
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { isAlreadyRegistered, reconcileDevicePush, type PushBindingDeps } from "../../src/lib/push-binding.ts";

const src = (rel: string) => readFileSync(fileURLToPath(new URL(`../../${rel}`, import.meta.url)), "utf8");

/** Navegador falso con una suscripción y una tabla con filas (userId, endpoint). */
function fakeDevice(endpoint: string | null, rows: Array<[string, string]>, { failQuery = false } = {}) {
  const state = { endpoint, unsubscribes: 0, queries: 0 };
  const deps: PushBindingDeps = {
    getSubscription: async () =>
      state.endpoint
        ? { endpoint: state.endpoint, unsubscribe: async () => { state.unsubscribes++; state.endpoint = null; return true; } }
        : null,
    ownsEndpoint: async (userId, ep) => {
      state.queries++;
      if (failQuery) throw new Error("sin red");
      return rows.some(([u, e]) => u === userId && e === ep);
    },
  };
  return { state, deps };
}

test("sin suscripción en el navegador: inactiva y no consulta nada", async () => {
  const { state, deps } = fakeDevice(null, []);
  assert.deepEqual(await reconcileDevicePush("A", deps), { state: "inactive", released: false });
  assert.equal(state.queries, 0);
});

test("misma cuenta dueña del endpoint: activa y no se toca", async () => {
  const { state, deps } = fakeDevice("E1", [["A", "E1"]]);
  assert.deepEqual(await reconcileDevicePush("A", deps), { state: "active", released: false });
  assert.equal(state.unsubscribes, 0);
  assert.equal(state.endpoint, "E1");
});

test("cambio de A a B: la suscripción de A se da de baja en este navegador", async () => {
  const { state, deps } = fakeDevice("E1", [["A", "E1"]]);
  assert.deepEqual(await reconcileDevicePush("B", deps), { state: "inactive", released: true });
  assert.equal(state.endpoint, null, "los avisos de A ya no llegan a este navegador");
});

test("B no queda 'activa' por una suscripción ajena aunque B tenga otras filas", async () => {
  const { deps } = fakeDevice("E1", [["A", "E1"], ["B", "E-otro-dispositivo"]]);
  assert.equal((await reconcileDevicePush("B", deps)).state, "inactive");
});

test("logout (sin cuenta): el navegador no conserva suscripción", async () => {
  const { state, deps } = fakeDevice("E1", [["A", "E1"]]);
  assert.deepEqual(await reconcileDevicePush(null, deps), { state: "inactive", released: true });
  assert.equal(state.queries, 0);
  assert.equal(state.endpoint, null);
});

test("si no se puede verificar (sin red), no se da de baja nada", async () => {
  const { state, deps } = fakeDevice("E1", [["A", "E1"]], { failQuery: true });
  assert.deepEqual(await reconcileDevicePush("A", deps), { state: "unknown", released: false });
  assert.equal(state.endpoint, "E1");
});

test("idempotente: dos pestañas a la vez no rompen nada", async () => {
  const { state, deps } = fakeDevice("E1", [["A", "E1"]]);
  const [r1, r2] = await Promise.all([reconcileDevicePush("B", deps), reconcileDevicePush("B", deps)]);
  assert.equal(r1.state, "inactive");
  assert.equal(r2.state, "inactive");
  assert.equal(state.endpoint, null);
});

test("una fila propia ya existente cuenta como registrada", () => {
  assert.equal(isAlreadyRegistered({ code: "23505" }), true);
  assert.equal(isAlreadyRegistered({ code: "42501" }), false);
  assert.equal(isAlreadyRegistered(null), false);
});

test("el hook no usa upsert (no hay política UPDATE) y revisa el error del alta", () => {
  const hook = src("src/hooks/use-push-notifications.ts");
  assert.doesNotMatch(hook, /\.upsert\(/);
  assert.match(hook, /\.from\("push_subscriptions"\)\.insert\(/);
  assert.match(hook, /if \(error && !isAlreadyRegistered\(error\)\)/);
});

test("'activas' sale de la verificación por cuenta, no solo de getSubscription", () => {
  const hook = src("src/hooks/use-push-notifications.ts");
  assert.doesNotMatch(hook, /setIsSubscribed\(!!sub\)/);
  assert.match(hook, /reconcileThisDevice\(session\?\.user\?\.id \?\? null\)/);
  assert.match(hook, /setIsSubscribed\(state === "active"\)/);
  assert.match(hook, /onAuthStateChange/);
});

test("el permiso se sigue pidiendo solo dentro de subscribe (clic)", () => {
  const hook = src("src/hooks/use-push-notifications.ts");
  assert.equal((hook.match(/requestPermission\(/g) ?? []).length, 1);
  const subscribeBody = hook.slice(hook.indexOf("const subscribe = useCallback"));
  assert.match(subscribeBody, /Notification\.requestPermission\(\)/);
  for (const f of ["src/lib/push-account.ts", "src/lib/push-binding.ts", "src/main.tsx"]) {
    assert.doesNotMatch(src(f), /requestPermission|pushManager\.subscribe/, f);
  }
});

test("el guardián se instala al arrancar y no llama a Supabase dentro del callback de auth", () => {
  assert.match(src("src/main.tsx"), /installPushAccountGuard\(\);/);
  const guard = src("src/lib/push-account.ts");
  assert.match(guard, /window\.setTimeout\(\(\) => \{\s*void reconcileThisDevice\(userId\)/);
  assert.match(guard, /getRegistration\(\)/, "no espera .ready si no hay service worker");
});
