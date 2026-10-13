// Modo capturas, de punta a punta: build de producción + navegador real +
// backend Supabase SIMULADO que guarda y registra CADA pedido que le llega.
// Todas las cuentas y datos son ficticios ("REAL-QA" hace de dato real).
//
// Verifica:
//  1. Aislamiento: con el modo activo no se ve ningún dato "real" y al
//     backend solo llegan auth y la consulta de autorización (solo lectura).
//  2. Sin efectos externos: escrituras, funciones (mails, WhatsApp, push,
//     cobros, calendarios), storage, tiempo real, beacons, ventanas y enlaces
//     externos y registro push quedan en el navegador.
//  3. Restauración: al salir reaparecen solo los datos reales; el backend y
//     el localStorage real quedaron igual.
//  4. Otras cuentas: sin el modo no se instala nada; una cuenta no
//     autorizada no lo puede activar, ni siquiera forzando la marca.
//
// Uso:  NODE_PATH=<carpeta con playwright-core> node --experimental-strip-types tests/e2e/modo-capturas.e2e.mjs [--dist <build>] [--shots <carpeta>]
import http from "node:http";
import { spawnSync } from "node:child_process";
import { mkdtempSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import { fakeJwt, sessionFor, userJson } from "./mock-supabase.mjs";
import { startStaticServer } from "./static-server.mjs";
import { handleRest } from "../../src/lib/showcase/postgrest.ts";
import { buildShowcaseStore } from "../../src/lib/showcase/fixtures.ts";

const ROOT = fileURLToPath(new URL("../../", import.meta.url));
const { chromium } = createRequire(import.meta.url)("playwright-core");
const MOCK_PORT = 54397;
const APP_PORT = 5305;
const APP = `http://127.0.0.1:${APP_PORT}`;
const SUPA = `http://127.0.0.1:${MOCK_PORT}`;
const KEY = "sb-127-auth-token";
const FLAG = "cd_modo_capturas";

const MC = { id: "11111111-1111-4111-8111-111111111111", email: "dueña@consultorio-real-qa.invalid", biz: "aaaaaaaa-1111-4111-8111-111111111111" };
const OTRO = { id: "22222222-2222-4222-8222-222222222222", email: "otra@consultorio-otro-qa.invalid", biz: "bbbbbbbb-2222-4222-8222-222222222222" };
for (const u of [MC, OTRO]) u.token = fakeJwt(u.id, u.email);

const results = [];
const check = (ok, msg) => {
  results.push({ ok: !!ok, msg });
  console.log(`${ok ? "OK  " : "FALLA"} ${msg}`);
};
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

// ── Base "real" simulada: mismas formas que la app, otros nombres e ids ──
function realStoreFor(u, label, idPrefix) {
  const s = buildShowcaseStore({ businessId: u.biz, userId: u.id });
  let n = 0;
  for (const p of s.patients) p.full_name = `${label} Paciente ${++n}`;
  for (const a of s.appointments) a.contact_name = s.patients.find((p) => p.id === a.patient_id)?.full_name ?? a.contact_name;
  s.businesses[0].name = `Consultorio ${label}`;
  s.businesses[0].dashboard_display_name = `Consultorio ${label}`;
  s.businesses[0].portal_clinic_display_name = `Consultorio ${label}`;
  s.profiles[0].name = `Profesional ${label}`;
  s.clinic_settings[0].clinic_name = `Consultorio ${label}`;
  for (const note of s.session_notes) note.content = `Nota ${label}`;
  delete s.businesses_public_branding;
  return JSON.parse(JSON.stringify(s).replaceAll("5c0a5e", idPrefix));
}
function mergeStores(...stores) {
  const out = {};
  for (const s of stores) for (const [t, rows] of Object.entries(s)) (out[t] ??= []).push(...rows);
  return out;
}

function startRealBackend() {
  const db = mergeStores(realStoreFor(MC, "REAL-QA", "7ea100"), realStoreFor(OTRO, "OTRO-QA", "0e0e0e"));
  const allowed = new Set([`${MC.id}:${MC.biz}`]); // fila de showcase_mode_access
  const log = [];
  const users = [MC, OTRO];
  const who = (auth) => users.find((u) => auth === `Bearer ${u.token}`) || null;
  const server = http.createServer(async (req, res) => {
    const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "*", "Access-Control-Allow-Methods": "GET,POST,PUT,PATCH,DELETE,HEAD,OPTIONS", "Access-Control-Expose-Headers": "Content-Range" };
    if (req.method === "OPTIONS") { res.writeHead(204, cors); return res.end(); }
    let raw = "";
    for await (const c of req) raw += c;
    const url = new URL(req.url, SUPA);
    const u = who(req.headers.authorization);
    log.push({ method: req.method, path: url.pathname, user: u?.id ?? null, at: Date.now() });
    const send = (status, body, headers = {}) => {
      res.writeHead(status, { ...cors, "Content-Type": "application/json", ...headers });
      res.end(body === undefined || body === null ? (status === 204 ? "" : "null") : JSON.stringify(body));
    };
    const body = raw ? (() => { try { return JSON.parse(raw); } catch { return raw; } })() : undefined;
    const p = url.pathname;
    if (p === "/auth/v1/user") return u ? send(200, userJson(u)) : send(401, { message: "invalid JWT" });
    if (p === "/auth/v1/token" && url.searchParams.get("grant_type") === "refresh_token") {
      const x = users.find((y) => body?.refresh_token === `refresh-${y.id}`);
      return x ? send(200, sessionFor(x)) : send(400, { message: "Invalid Refresh Token" });
    }
    if (p === "/auth/v1/logout") return send(204);
    if (p.startsWith("/auth/v1/")) return send(200, {});
    if (p === "/rest/v1/rpc/can_use_showcase_mode") return send(200, !!u && allowed.has(`${u.id}:${body?.p_business_id}`));
    if (p === "/rest/v1/rpc/is_super_admin") return send(200, false);
    if (p.startsWith("/rest/v1/rpc/")) return send(200, null);
    if (p.startsWith("/rest/v1/")) {
      if (!u) return send(401, { message: "JWT requerido" });
      const r = handleRest(db, { method: req.method, table: p.slice(9), params: url.searchParams, headers: new Headers(req.headers), body });
      return send(r.status, r.body, r.headers);
    }
    if (p.startsWith("/functions/v1/")) return send(200, { ok: true });
    if (p.startsWith("/storage/v1/")) return send(200, {});
    return send(404, { message: "no simulado" });
  });
  return new Promise((r) => server.listen(MOCK_PORT, "127.0.0.1", () => r({ db, log, close: () => server.close() })));
}

function buildDist() {
  const out = mkdtempSync(path.join(tmpdir(), "cd-capturas-"));
  const r = spawnSync(process.execPath, [path.join(ROOT, "node_modules/vite/bin/vite.js"), "build", "--outDir", out, "--emptyOutDir"], {
    cwd: ROOT, stdio: "ignore",
    env: { ...process.env, VITE_SUPABASE_URL: SUPA, VITE_SUPABASE_PUBLISHABLE_KEY: fakeJwt("anon", "", "anon"), VITE_SUPABASE_PROJECT_ID: "" },
  });
  if (r.status !== 0) throw new Error("Falló vite build");
  return out;
}

const text = (page) => page.evaluate(() => document.body.innerText);
async function waitText(page, needle, timeout = 15000) {
  try {
    await page.waitForFunction((n) => document.body.innerText.includes(n), needle, { timeout });
    return true;
  } catch {
    return false;
  }
}
const realLocalStorage = (page) =>
  page.evaluate(() => {
    // Lee lo REAL aunque el modo esté activo (descriptor original no disponible: se usa una pestaña nueva)
    const out = {};
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      out[k] = localStorage.getItem(k);
    }
    return out;
  });

async function main() {
  const distArg = process.argv.indexOf("--dist");
  const dist = distArg > 0 ? process.argv[distArg + 1] : buildDist();
  const shotsArg = process.argv.indexOf("--shots");
  const shots = shotsArg > 0 ? process.argv[shotsArg + 1] : null;
  if (shots) mkdirSync(shots, { recursive: true });
  const backend = await startRealBackend();
  const server = await startStaticServer(dist, { port: APP_PORT });
  const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM || "/opt/pw-browsers/chromium" });

  const newSession = async (u, { forgeFlag } = {}) => {
    const ctx = await browser.newContext({ viewport: { width: 1366, height: 860 }, locale: "es-UY", timezoneId: "America/Montevideo" });
    await ctx.grantPermissions(["notifications"], { origin: APP });
    await ctx.addInitScript(([k, v]) => {
      if (!localStorage.getItem(k)) localStorage.setItem(k, v);
    }, [KEY, JSON.stringify(sessionFor(u))]);
    if (forgeFlag) {
      await ctx.addInitScript(([k, v]) => {
        if (!sessionStorage.getItem("__forjado")) {
          sessionStorage.setItem(k, v);
          sessionStorage.setItem("__forjado", "1");
        }
      }, [FLAG, JSON.stringify({ ...forgeFlag, startedAt: new Date().toISOString() })]);
    }
    return ctx;
  };

  try {
    // ── 1) Cuenta autorizada: vista real ──
    const ctx = await newSession(MC);
    const page = await ctx.newPage();
    await page.goto(`${APP}/patients`);
    check(await waitText(page, "REAL-QA Paciente"), "modo normal: se ven los pacientes reales");
    check(await page.evaluate(() => !window.__cdShowcase && Function.prototype.toString.call(window.fetch).includes("[native code]")),
      "modo normal: no hay ninguna capa instalada (fetch nativo)");
    const realStorageBefore = await realLocalStorage(page);
    const dbBefore = JSON.stringify(backend.db);

    // ── 2) Activar ──
    await page.goto(`${APP}/modo-capturas`);
    await page.getByTestId("showcase-activate").waitFor({ timeout: 15000 });
    check(true, "la cuenta autorizada ve el botón de activar");
    const logMark = backend.log.length;
    await page.getByTestId("showcase-activate").click();
    await page.waitForURL(`${APP}/dashboard`, { timeout: 15000 });
    await page.getByTestId("showcase-banner").waitFor({ timeout: 15000 });
    check(true, "al activar aparece la barra del modo capturas");

    // ── 3) Pantallas con datos ficticios, sin datos reales ──
    const screens = [
      ["/dashboard", "inicio"],
      ["/agenda", "agenda"],
      ["/patients", "pacientes"],
      ["/pagos", "pagos"],
      ["/recordatorios-pendientes", "recordatorios"],
      ["/solicitudes", "solicitudes"],
      ["/mi-consultorio", "mi-consultorio"],
      ["/estadisticas", "estadisticas"],
    ];
    for (const [route, name] of screens) {
      await page.goto(`${APP}${route}`);
      await page.getByTestId("showcase-banner").waitFor({ timeout: 15000 });
      await wait(2500);
      const t = await text(page);
      check(!t.includes("REAL-QA") && !t.includes("OTRO-QA"), `${route}: ningún dato real a la vista`);
      if (shots) await page.screenshot({ path: path.join(shots, `${name}.png`) });
    }
    if (shots) {
      await page.setViewportSize({ width: 390, height: 844 });
      for (const [route, name] of [["/dashboard", "iphone-inicio"], ["/agenda", "iphone-agenda"], ["/patients", "iphone-pacientes"]]) {
        await page.goto(`${APP}${route}`);
        await wait(2500);
        await page.screenshot({ path: path.join(shots, `${name}.png`) });
      }
      await page.setViewportSize({ width: 1366, height: 860 });
    }
    await page.goto(`${APP}/patients`);
    check(await waitText(page, "Lucía Fernández"), "pacientes: se ven los pacientes ficticios");
    const patientsText = await text(page);
    check(patientsText.includes("Martín Sosa") && !patientsText.includes("REAL-QA"), "pacientes: lista ficticia completa, sin reales");
    // Ficha de un paciente ficticio
    await page.locator("text=Lucía Fernández >> visible=true").first().click();
    await page.waitForURL(/\/patients\/5c0a5e/, { timeout: 15000 }).catch(() => {});
    await wait(2500);
    check((await text(page)).includes("Lucía Fernández") && /\/patients\/5c0a5e/.test(page.url()), "ficha del paciente ficticio abre con su id ficticio");
    if (shots) await page.screenshot({ path: path.join(shots, "ficha.png") });

    // ── 4) Intentos de efectos externos (como los haría cualquier componente) ──
    const attempts = await page.evaluate(async (supa) => {
      const out = {};
      const j = (r) => r.json().catch(() => null);
      out.insert = await fetch(`${supa}/rest/v1/patients`, { method: "POST", headers: { "Content-Type": "application/json", Prefer: "return=representation" }, body: JSON.stringify({ full_name: "Escritura de prueba" }) }).then(j);
      out.update = (await fetch(`${supa}/rest/v1/appointments?id=neq.x`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: "cancelled" }) })).status;
      out.del = (await fetch(`${supa}/rest/v1/payments?id=neq.x`, { method: "DELETE" })).status;
      for (const fn of ["send-resend-email", "send-whatsapp", "send-push-notification", "process-scheduled-reminders", "create-payment-link", "create-session-payment", "google-calendar-sync", "external-calendar", "public-book-appointment"]) {
        out[fn] = await fetch(`${supa}/functions/v1/${fn}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ to: "alguien@ejemplo.invalid", action: "add" }) }).then(j);
      }
      out.rpc = (await fetch(`${supa}/rest/v1/rpc/approve_reschedule_request`, { method: "POST", body: "{}" })).status;
      out.upload = (await fetch(`${supa}/storage/v1/object/documents/x.pdf`, { method: "POST", body: new Blob(["x"]) })).status;
      out.authChange = (await fetch(`${supa}/auth/v1/user`, { method: "PUT", body: JSON.stringify({ password: "otra" }) })).status;
      out.external = (await fetch("https://api.mercadopago.com/checkout/preferences", { method: "POST" })).status;
      out.beacon = navigator.sendBeacon(`${supa}/rest/v1/patients`, "x");
      const ws = new WebSocket(`${supa.replace("http", "ws")}/realtime/v1/websocket`);
      out.wsState = ws.readyState;
      out.waWindow = !!window.open("https://wa.me/59899000000?text=hola", "_blank");
      const a = document.createElement("a");
      a.href = "mailto:alguien@ejemplo.invalid";
      document.body.appendChild(a);
      a.click();
      a.remove();
      try {
        const reg = await navigator.serviceWorker.getRegistration();
        await reg?.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: new Uint8Array(65) });
        out.push = "suscripto";
      } catch (e) {
        out.push = e.name;
      }
      out.pushSub = await (await navigator.serviceWorker.getRegistration())?.pushManager.getSubscription();
      localStorage.setItem("prueba-capturas", "dato-ficticio");
      sessionStorage.setItem("prueba-capturas", "dato-ficticio");
      out.blocked = window.__cdShowcase.blocked.map((b) => b.kind);
      return out;
    }, SUPA);
    check(attempts.insert?.[0]?.full_name === "Escritura de prueba", "insert: la app recibe respuesta normal (en memoria)");
    check(attempts["send-whatsapp"]?.showcase === true && attempts["send-resend-email"]?.showcase === true, "funciones de envío: respuesta simulada");
    check(attempts.authChange === 403, "cambio de contraseña/cuenta: bloqueado");
    check(attempts.external === 403, "pedido a otro dominio (Mercado Pago): bloqueado");
    check(attempts.beacon === false && attempts.wsState === 0, "sendBeacon y tiempo real: bloqueados");
    check(attempts.push === "NotAllowedError" && attempts.pushSub === null, "push: no se registra ni se lee la suscripción del dispositivo");
    for (const k of ["external-window", "external-link", "realtime", "beacon", "push-subscribe", "function", "auth-change", "external"]) {
      check(attempts.blocked.includes(k), `quedó registrado como simulado/bloqueado: ${k}`);
    }

    // Acciones reales de la interfaz (los mismos botones que usaría alguien)
    const kinds = () => page.evaluate(() => window.__cdShowcase.blocked.map((b) => b.kind));
    await page.goto(`${APP}/dashboard`);
    await page.getByTestId("showcase-banner").waitFor({ timeout: 15000 });
    await wait(2000);
    await page.keyboard.press("Escape");
    const before = (await kinds()).filter((k) => k === "external-window").length;
    const wa = page.locator("button:has-text('WhatsApp') >> visible=true").first();
    if (await wa.count()) {
      await wa.click();
      await wait(800);
      // Puede abrir un menú con opciones: se elige la primera
      const opt = page.locator("[role=menuitem] >> visible=true").first();
      if (await opt.count()) {
        await opt.click();
        await wait(800);
      }
    }
    check((await kinds()).filter((k) => k === "external-window").length > before, "interfaz: el botón WhatsApp de la próxima sesión no abre WhatsApp");
    await page.goto(`${APP}/pagos`);
    await wait(2500);
    await page.keyboard.press("Escape");
    const cobrar = page.locator("button:has-text('Cobrar') >> visible=true").first();
    if (await cobrar.count()) {
      await cobrar.click();
      await wait(1000);
      const confirmar = page.locator("[role=dialog] button:has-text('Cobrar'), [role=dialog] button:has-text('Confirmar'), [role=dialog] button:has-text('Registrar') >> visible=true").first();
      if (await confirmar.count()) await confirmar.click().catch(() => {});
      await wait(1500);
    }
    await page.goto(`${APP}/recordatorios-pendientes`);
    await wait(2500);
    const cancelar = page.locator("button:has-text('Cancelar') >> visible=true").first();
    if (await cancelar.count()) {
      await cancelar.click();
      await wait(800);
      const ok = page.locator("[role=alertdialog] button >> visible=true").last();
      if (await ok.count()) await ok.click().catch(() => {});
      await wait(1000);
    }

    // ── 5) Nada llegó al backend salvo auth y la autorización ──
    const during = backend.log.slice(logMark);
    const allowedReq = (r) =>
      (r.path === "/rest/v1/rpc/can_use_showcase_mode" && r.method === "POST") ||
      (r.path === "/auth/v1/user" && r.method === "GET") ||
      (r.path === "/auth/v1/token" && r.method === "POST");
    const leaked = during.filter((r) => !allowedReq(r));
    check(leaked.length === 0, `con el modo activo no salió ningún otro pedido al backend (${during.length} pedidos permitidos${leaked.length ? `; filtrados: ${JSON.stringify(leaked.slice(0, 5))}` : ""})`);
    check(during.some((r) => r.path === "/rest/v1/rpc/can_use_showcase_mode"), "al arrancar el modo se verificó la autorización en la base");
    check(JSON.stringify(backend.db) === dbBefore, "la base real no cambió en nada");

    // ── 6) Salir ──
    await page.getByTestId("showcase-exit").click();
    await page.waitForURL(`${APP}/dashboard`, { timeout: 15000 });
    await wait(1500);
    check(await page.evaluate(() => !window.__cdShowcase && !sessionStorage.getItem("cd_modo_capturas")), "al salir no queda capa ni marca");
    check(await page.evaluate(() => Function.prototype.toString.call(window.fetch).includes("[native code]")), "al salir fetch vuelve a ser el nativo");
    await page.goto(`${APP}/patients`);
    check(await waitText(page, "REAL-QA Paciente"), "al salir reaparecen los pacientes reales");
    const after = await text(page);
    check(!after.includes("Lucía Fernández") && !after.includes("Centro Aurora"), "al salir no queda ningún dato ficticio a la vista");
    const realStorageAfter = await realLocalStorage(page);
    const leakedKeys = Object.entries(realStorageAfter).filter(([k, v]) => k === "prueba-capturas" || /Centro Aurora|5c0a5e|Valentina/.test(String(v)));
    check(leakedKeys.length === 0, "el localStorage real no guardó nada del modo capturas");
    const removed = Object.keys(realStorageBefore).filter((k) => !(k in realStorageAfter));
    check(removed.length === 0, `el localStorage real no perdió claves (${removed.join(", ") || "ninguna"})`);
    check(JSON.stringify(backend.db) === dbBefore, "después de salir, la base real sigue idéntica");
    await ctx.close();

    // ── 7) Otra cuenta: sin capa y sin acceso ──
    const ctx2 = await newSession(OTRO);
    const p2 = await ctx2.newPage();
    const assetsOtro = [];
    p2.on("request", (r) => assetsOtro.push(r.url()));
    await p2.goto(`${APP}/patients`);
    check(await waitText(p2, "OTRO-QA Paciente"), "otra cuenta: ve sus datos reales");
    check(await p2.evaluate(() => !window.__cdShowcase && Function.prototype.toString.call(window.fetch).includes("[native code]")), "otra cuenta: no se instala ninguna capa");
    check(!assetsOtro.some((u) => /interceptor-.*\.js/.test(u)), "otra cuenta: la capa del modo capturas ni se carga en la página");
    const otherCalls = backend.log.filter((r) => r.user === OTRO.id && r.path === "/rest/v1/rpc/can_use_showcase_mode").length;
    check(otherCalls === 0, "otra cuenta: en sus pantallas normales no se consulta nada del modo capturas");
    await p2.goto(`${APP}/modo-capturas`);
    check(await waitText(p2, "no está habilitada"), "otra cuenta: /modo-capturas dice que no está habilitada");
    check((await p2.getByTestId("showcase-activate").count()) === 0, "otra cuenta: no hay botón de activar");
    await ctx2.close();

    // ── 8) Marca forjada por una cuenta no autorizada (propio consultorio y el de Mental Care) ──
    for (const forged of [{ userId: OTRO.id, businessId: OTRO.biz }, { userId: OTRO.id, businessId: MC.biz }]) {
      const mark = backend.log.length;
      const c = await newSession(OTRO, { forgeFlag: forged });
      const p = await c.newPage();
      await p.goto(`${APP}/dashboard`);
      await wait(4000);
      const st = await p.evaluate(() => ({ flag: sessionStorage.getItem("cd_modo_capturas"), layer: !!window.__cdShowcase }));
      check(!st.flag && !st.layer, `marca forjada (${forged.businessId === MC.biz ? "consultorio ajeno" : "propio"}): la base no autoriza y el modo se cierra solo`);
      await p.goto(`${APP}/patients`);
      check(await waitText(p, "OTRO-QA Paciente"), "tras cerrarse, la cuenta ve solo sus datos reales");
      const writes = backend.log.slice(mark).filter((r) => r.method !== "GET" && r.method !== "HEAD" && !["/auth/v1/token", "/rest/v1/rpc/can_use_showcase_mode", "/rest/v1/rpc/is_super_admin"].includes(r.path));
      check(writes.length === 0, "la marca forjada no produjo escrituras");
      await c.close();
    }

    // ── 9) Marca de OTRA persona en esta pestaña (sesión distinta): se cierra ──
    {
      const c = await newSession(OTRO, { forgeFlag: { userId: MC.id, businessId: MC.biz } });
      const p = await c.newPage();
      await p.goto(`${APP}/dashboard`);
      await wait(4000);
      check(await p.evaluate(() => !sessionStorage.getItem("cd_modo_capturas") && !window.__cdShowcase), "marca con el usuario de otra persona: se cierra");
      await c.close();
    }
  } finally {
    await browser.close();
    server.close();
    backend.close();
  }
  const failed = results.filter((r) => !r.ok);
  console.log(`\n${results.length - failed.length}/${results.length} verificaciones OK`);
  process.exit(failed.length ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
