// Modo capturas: aislamiento, ausencia de efectos externos, entrar/salir y
// coherencia de los datos ficticios. Sin navegador ni red. npm run test:unit
// (La prueba con navegador real está en tests/e2e/modo-capturas.e2e.mjs.)
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  classifyRequest,
  createShowcaseFetch,
  createStorageOverlay,
  isRealStorageKey,
  type BlockedEvent,
  type StorageOverlay,
} from "../../src/lib/showcase/interceptor.ts";
import { buildShowcaseStore } from "../../src/lib/showcase/fixtures.ts";
import { activateShowcase, exitShowcase, verifyShowcase, type ShowcaseDeps } from "../../src/lib/showcase/controller.ts";
import { SHOWCASE_SESSION_KEY, readShowcaseSession } from "../../src/lib/showcase/session.ts";

const SUPA = "https://proyecto.supabase.co";
const APP = "https://consultoriodigital.app";
const BIZ = "aaaaaaaa-1111-4111-8111-111111111111";
const USER = "11111111-1111-4111-8111-111111111111";

const route = (url: string, method = "GET") => classifyRequest(new URL(url), method, SUPA, APP);

test("clasificación: solo auth de sesión, la autorización y estáticos propios salen a la red", () => {
  assert.equal(route(`${SUPA}/auth/v1/user`).kind, "passthrough");
  assert.equal(route(`${SUPA}/auth/v1/token?grant_type=refresh_token`, "POST").kind, "passthrough");
  assert.equal(route(`${SUPA}/auth/v1/logout`, "POST").kind, "passthrough");
  assert.equal(route(`${SUPA}/rest/v1/rpc/can_use_showcase_mode`, "POST").kind, "passthrough");
  assert.equal(route(`${APP}/manifest.webmanifest`).kind, "passthrough");

  assert.deepEqual(route(`${SUPA}/auth/v1/user`, "PUT"), { kind: "blocked", reason: "auth-change" });
  assert.deepEqual(route(`${SUPA}/auth/v1/token?grant_type=password`, "POST"), { kind: "blocked", reason: "auth-change" });
  assert.deepEqual(route(`${SUPA}/auth/v1/recover`, "POST"), { kind: "blocked", reason: "auth-change" });
  assert.equal(route(`${SUPA}/rest/v1/patients?select=*`).kind, "rest");
  assert.equal(route(`${SUPA}/rest/v1/rpc/approve_reschedule_request`, "POST").kind, "rpc");
  assert.equal(route(`${SUPA}/rest/v1/rpc/can_use_showcase_mode`, "GET").kind, "rpc", "la autorización solo pasa como POST");
  assert.equal(route(`${SUPA}/functions/v1/send-whatsapp`, "POST").kind, "function");
  assert.equal(route(`${SUPA}/storage/v1/object/documents/a.pdf`, "POST").kind, "storage");
  assert.deepEqual(route("https://api.mercadopago.com/v1/payments", "POST"), { kind: "blocked", reason: "external" });
  assert.deepEqual(route("https://wa.me/59899000000"), { kind: "blocked", reason: "external" });
  assert.deepEqual(route(`${APP}/algo`, "POST"), { kind: "blocked", reason: "write-same-origin" });
});

function harness() {
  const real: { method: string; url: string }[] = [];
  const blocked: BlockedEvent[] = [];
  const realFetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    real.push({ method: (init?.method ?? "GET").toUpperCase(), url: String(input) });
    return new Response("true", { status: 200 });
  }) as typeof fetch;
  const store = buildShowcaseStore({ businessId: BIZ, userId: USER, now: new Date("2026-10-13T15:00:00Z") });
  const f = createShowcaseFetch({ supabaseOrigin: SUPA, appOrigin: APP, realFetch, store, fixture: { businessId: BIZ, userId: USER }, record: (e) => blocked.push(e) });
  return { f, real, blocked, store };
}

test("ningún pedido con efectos llega al fetch real", async () => {
  const { f, real, blocked } = harness();
  const post = (url: string, body: unknown = {}) =>
    f(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  await f(`${SUPA}/rest/v1/patients?select=*`);
  await post(`${SUPA}/rest/v1/patients`, { full_name: "x" });
  await f(`${SUPA}/rest/v1/appointments?id=eq.1`, { method: "PATCH", body: "{}" });
  await f(`${SUPA}/rest/v1/payments?id=eq.1`, { method: "DELETE" });
  for (const fn of ["send-resend-email", "send-whatsapp", "send-push-notification", "process-scheduled-reminders", "daily-agenda-summary", "create-payment-link", "create-session-payment", "create-patient-payment", "google-calendar-sync", "external-calendar", "create-patient-invite", "delete-business"]) {
    await post(`${SUPA}/functions/v1/${fn}`, { to: "x@ejemplo.invalid" });
  }
  await post(`${SUPA}/rest/v1/rpc/approve_reschedule_request`);
  await f(`${SUPA}/storage/v1/object/documents/a.pdf`, { method: "POST", body: new Blob(["x"]) });
  await f(`${SUPA}/auth/v1/user`, { method: "PUT", body: JSON.stringify({ password: "otra" }) });
  await post("https://api.mercadopago.com/checkout/preferences");
  await f("https://www.googleapis.com/calendar/v3/calendars");
  assert.deepEqual(real, [], "el fetch real no se llamó ni una vez");
  assert.ok(blocked.some((b) => b.kind === "function" && b.target.endsWith("/send-whatsapp")));
  assert.ok(blocked.some((b) => b.kind === "external"));
  assert.ok(blocked.some((b) => b.kind === "auth-change"));
});

test("lo permitido sí sale (sesión y autorización), tal cual", async () => {
  const { f, real } = harness();
  await f(`${SUPA}/auth/v1/user`);
  await f(`${SUPA}/auth/v1/token?grant_type=refresh_token`, { method: "POST", body: "{}" });
  await f(`${SUPA}/rest/v1/rpc/can_use_showcase_mode`, { method: "POST", body: JSON.stringify({ p_business_id: BIZ }) });
  assert.deepEqual(real.map((r) => `${r.method} ${new URL(r.url).pathname}`), [
    "GET /auth/v1/user",
    "POST /auth/v1/token",
    "POST /rest/v1/rpc/can_use_showcase_mode",
  ]);
});

test("las escrituras solo cambian la copia en memoria", async () => {
  const { f, store } = harness();
  const before = store.patients.length;
  const r = await f(`${SUPA}/rest/v1/patients?select=id`, { method: "POST", headers: { Prefer: "return=representation" }, body: JSON.stringify({ full_name: "Nueva" }) });
  assert.equal(r.status, 200);
  assert.equal(store.patients.length, before + 1);
  // Una copia nueva (= recargar / salir y volver) no tiene el cambio
  assert.equal(buildShowcaseStore({ businessId: BIZ, userId: USER }).patients.length, before);
});

function memStorage(seed: Record<string, string> = {}): StorageOverlay & { data: Map<string, string> } {
  const data = new Map(Object.entries(seed));
  return {
    data,
    getItem: (k) => (data.has(k) ? data.get(k)! : null),
    setItem: (k, v) => void data.set(k, v),
    removeItem: (k) => void data.delete(k),
    clear: () => data.clear(),
    key: (i) => [...data.keys()][i] ?? null,
    get length() {
      return data.size;
    },
  };
}

test("almacenamiento local: el modo lee lo real pero no lo modifica", () => {
  const real = memStorage({ "panel-brand": "real", "sb-proyecto-auth-token": "tok", tema: "oscuro" });
  const snapshot = new Map(real.data);
  const o = createStorageOverlay(real, isRealStorageKey);
  assert.equal(o.getItem("tema"), "oscuro", "lee lo real");
  o.setItem("panel-brand", "ficticio");
  o.setItem("nuevo", "x");
  o.removeItem("tema");
  assert.equal(o.getItem("panel-brand"), "ficticio");
  assert.equal(o.getItem("tema"), null);
  o.clear();
  assert.equal(o.getItem("nuevo"), null);
  // Lo único que pasa a lo real: token de sesión (renovación) y la marca del modo
  o.setItem("sb-proyecto-auth-token", "tok-renovado");
  real.data.set(SHOWCASE_SESSION_KEY, "{}");
  o.removeItem(SHOWCASE_SESSION_KEY);
  const expected = new Map(snapshot);
  expected.set("sb-proyecto-auth-token", "tok-renovado");
  assert.deepEqual(real.data, expected, "al descartar la capa (salir), lo real quedó como estaba");
  assert.equal(o.getItem("sb-proyecto-auth-token"), "tok-renovado");
});

test("marca del modo: sin marca o con ids inválidos no hay modo", () => {
  const st = (v: string | null) => ({ getItem: () => v });
  assert.equal(readShowcaseSession(st(null)), null);
  assert.equal(readShowcaseSession(st("no-json")), null);
  assert.equal(readShowcaseSession(st(JSON.stringify({ userId: "Mental Care", businessId: BIZ }))), null, "no se acepta un nombre en lugar del id");
  assert.deepEqual(readShowcaseSession(st(JSON.stringify({ userId: USER, businessId: BIZ, startedAt: "t" }))), { userId: USER, businessId: BIZ, startedAt: "t" });
});

function controllerDeps(opts: { uid?: string | null; allowed?: boolean | Error } = {}) {
  const storage = new Map<string, string>();
  const nav: string[] = [];
  let listener: (() => void) | null = null;
  const deps: ShowcaseDeps = {
    storage: { setItem: (k, v) => void storage.set(k, v), removeItem: (k) => void storage.delete(k) },
    navigate: (p) => void nav.push(p),
    getSessionUserId: async () => (opts.uid === undefined ? USER : opts.uid),
    canUse: async () => {
      if (opts.allowed instanceof Error) throw opts.allowed;
      return opts.allowed ?? true;
    },
    onSignedOutOrUserChange: (cb) => {
      listener = cb;
    },
  };
  return { deps, storage, nav, fireSignOut: () => listener?.() };
}

test("activar: solo si la base autoriza; si no, no se escribe ninguna marca", async () => {
  const ok = controllerDeps();
  assert.equal(await activateShowcase(ok.deps, USER, BIZ), "activated");
  assert.ok(ok.storage.has(SHOWCASE_SESSION_KEY));
  assert.deepEqual(ok.nav, ["/dashboard"]);

  for (const allowed of [false, new Error("sin red")]) {
    const no = controllerDeps({ allowed });
    assert.equal(await activateShowcase(no.deps, USER, BIZ), "not_allowed");
    assert.equal(no.storage.size, 0);
    assert.deepEqual(no.nav, []);
  }
  const noBiz = controllerDeps();
  assert.equal(await activateShowcase(noBiz.deps, USER, null), "not_allowed");
});

test("verificar al arrancar: otra sesión, sin permiso o error → sale solo", async () => {
  const session = { userId: USER, businessId: BIZ, startedAt: "" };
  for (const opts of [{ uid: "22222222-2222-4222-8222-222222222222" }, { uid: null }, { allowed: false }, { allowed: new Error("x") }]) {
    const c = controllerDeps(opts);
    c.storage.set(SHOWCASE_SESSION_KEY, "{}");
    assert.equal(await verifyShowcase(c.deps, session), "exited", JSON.stringify(opts));
    assert.equal(c.storage.has(SHOWCASE_SESSION_KEY), false);
    assert.deepEqual(c.nav, ["/dashboard"]);
  }
  const ok = controllerDeps();
  ok.storage.set(SHOWCASE_SESSION_KEY, "{}");
  assert.equal(await verifyShowcase(ok.deps, session), "ok");
  assert.equal(ok.storage.has(SHOWCASE_SESSION_KEY), true);
  ok.fireSignOut();
  assert.equal(ok.storage.has(SHOWCASE_SESSION_KEY), false, "al cerrar sesión se sale del modo");
  assert.deepEqual(ok.nav, ["/auth"]);
});

test("salir: borra la marca y recarga (solo datos reales)", () => {
  const c = controllerDeps();
  c.storage.set(SHOWCASE_SESSION_KEY, "{}");
  exitShowcase(c.deps);
  assert.equal(c.storage.size, 0);
  assert.deepEqual(c.nav, ["/dashboard"]);
});

test("datos ficticios: completos, coherentes y sin datos reales", () => {
  const now = new Date("2026-10-13T15:00:00Z");
  const s = buildShowcaseStore({ businessId: BIZ, userId: USER, now });
  // Los únicos ids externos son el del consultorio y el del usuario; el resto es 5c0a5e…
  const ids = new Set<string>();
  for (const rows of Object.values(s)) {
    for (const r of rows) {
      for (const [k, v] of Object.entries(r)) {
        if (typeof v === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-/.test(v) && (k === "id" || k.endsWith("_id"))) ids.add(v);
      }
    }
  }
  for (const id of ids) assert.ok(id === BIZ || id === USER || id.startsWith("5c0a5e"), `id inesperado ${id}`);
  // Contactos inventados
  const text = JSON.stringify(s);
  for (const m of text.matchAll(/[\w.+-]+@[\w.-]+/g)) assert.ok(m[0].endsWith(".invalid"), `correo no reservado: ${m[0]}`);
  for (const p of s.patients) assert.match(String(p.whatsapp_phone), / 555 /);
  // Integridad
  const pIds = new Set(s.patients.map((p) => p.id));
  const aIds = new Set(s.appointments.map((a) => a.id));
  for (const a of s.appointments) assert.ok(pIds.has(a.patient_id as string));
  for (const p of s.payments) {
    assert.ok(pIds.has(p.patient_id as string));
    if (p.appointment_id) assert.ok(aIds.has(p.appointment_id as string));
  }
  for (const n of s.session_notes) assert.ok(aIds.has(n.appointment_id as string));
  // Pantallas con contenido
  const today = "2026-10-13";
  const mvd = (iso: unknown) => new Date(Date.parse(String(iso)) - 3 * 3600_000).toISOString().slice(0, 10);
  assert.ok(s.patients.length >= 12, "pacientes");
  assert.ok(s.appointments.some((a) => mvd(a.start_at) === today), "citas hoy");
  assert.ok(s.appointments.some((a) => Date.parse(String(a.start_at)) > now.getTime()), "citas futuras");
  assert.ok(s.payments.some((p) => p.status === "paid") && s.payments.some((p) => p.status === "overdue"), "pagos cobrados y vencidos");
  assert.ok(s.scheduled_reminders.length > 0 && s.scheduled_reminders.every((r) => Date.parse(String(r.scheduled_for)) > now.getTime()), "recordatorios futuros");
  assert.ok(s.appointments.some((a) => a.status === "pending" && a.source === "patient_portal"), "solicitudes del portal");
  assert.equal(s.subscriptions[0].status, "active");
  // Coherencia temporal: nada atendido en el futuro, nada "confirmado" en el pasado
  for (const a of s.appointments) {
    const past = Date.parse(String(a.start_at)) < now.getTime();
    if (["attended", "no_show"].includes(String(a.status))) assert.ok(past, "atendida en el futuro");
    if (["confirmed", "scheduled"].includes(String(a.status))) assert.ok(!past, "confirmada en el pasado");
  }
  // Sin superposiciones de la agenda de la profesional
  const active = s.appointments.filter((a) => !["cancelled", "cancelled_by_patient"].includes(String(a.status)));
  for (const a of active) {
    for (const b of active) {
      if (a === b) continue;
      const overlap = Date.parse(String(a.start_at)) < Date.parse(String(b.end_at)) && Date.parse(String(b.start_at)) < Date.parse(String(a.end_at));
      assert.ok(!overlap, `superposición ${a.start_at} / ${b.start_at}`);
    }
  }
  // Mismos datos en cada captura (semilla fija)
  assert.equal(JSON.stringify(buildShowcaseStore({ businessId: BIZ, userId: USER, now })), JSON.stringify(s));
});

// ── Guardas estáticas ──
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
const src = (rel: string) => readFileSync(fileURLToPath(new URL(`../../${rel}`, import.meta.url)), "utf8");

test("la capa se instala antes que todo: boot es el primer import y no carga Supabase", () => {
  const main = src("src/main.tsx");
  const firstImport = main.split("\n").find((l) => l.startsWith("import "));
  assert.equal(firstImport, 'import { showcaseReady } from "@/lib/showcase/boot";');
  assert.ok(main.indexOf("await showcaseReady();") > 0 && main.indexOf("await showcaseReady();") < main.indexOf("createRoot("), "la app espera la capa antes de mostrarse");
  // Ni boot ni lo que importa pueden traer el cliente (se crearía antes de la capa)
  for (const f of ["boot.ts", "interceptor.ts", "postgrest.ts", "fixtures.ts", "session.ts"]) {
    assert.ok(!/integrations\/supabase\/client|@supabase\/supabase-js/.test(src(`src/lib/showcase/${f}`)), f);
  }
});

test("sin la marca, boot no instala nada", () => {
  const boot = src("src/lib/showcase/boot.ts");
  assert.match(boot, /if \(!session \|\| !supabaseUrl\) return;/);
  assert.ok(boot.indexOf("if (!session || !supabaseUrl) return;") < boot.indexOf('import("./interceptor.ts")'), "la capa solo se carga con la marca");
  assert.ok(!/^import .*interceptor/m.test(boot), "boot no importa la capa de forma estática");
});

test("el esquema del emulador tiene las mismas relaciones que types.ts", async () => {
  // Columnas agregadas o quitadas por otros cambios son inocuas (el emulador
  // devuelve null o el valor ficticio); una relación distinta rompería
  // pantallas. Para regenerar: node scripts/generate-showcase-schema.mjs
  const gen = await import("../../scripts/generate-showcase-schema.mjs");
  const { SHOWCASE_SCHEMA } = await import("../../src/lib/showcase/schema.generated.ts");
  const current = gen.buildSchema(src("src/integrations/supabase/types.ts"));
  for (const [table, def] of Object.entries(current) as [string, { fks: { name: string; columns: string[]; ref: string }[] }][]) {
    const mine = SHOWCASE_SCHEMA[table];
    if (!mine) continue; // tabla nueva: el emulador responde "no existe" hasta regenerar
    const key = (f: { name: string; columns: string[]; ref: string }) => `${f.name}:${f.columns.join(",")}->${f.ref}`;
    const real = def.fks.filter((f) => !f.ref.endsWith("_public_branding")).map(key).sort();
    assert.deepEqual(mine.fks.map(key).sort(), real, `relaciones de ${table}`);
  }
  assert.ok(Object.keys(SHOWCASE_SCHEMA).length >= 35);
});
