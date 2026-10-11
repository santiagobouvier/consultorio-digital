// Suscripción push por CUENTA al cambiar de sesión en el mismo navegador.
// Build de producción real (service worker único) + Supabase simulado con la
// tabla push_subscriptions y sus reglas RLS. Cuentas y datos ficticios.
//
// El servicio push real (FCM/Apple) no se usa: dentro del navegador hay un
// servicio push FALSO (un endpoint por perfil, compartido entre pestañas) y el
// "envío" lo simula este script igual que send-push-notification: por cada
// fila de la cuenta, si el endpoint sigue vivo se entrega al service worker
// (CDP ServiceWorker.deliverPushMessage, que muestra la notificación); si no,
// la fila se borra como con un 404/410. No sale ningún aviso real.
//
// Uso:  NODE_PATH=<playwright-core> node tests/e2e/push-cuentas.e2e.mjs [--dist <build>]
//       Usar las versiones del lockfile (supabase-js 2.86.0): el portal las necesita.
import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import { fakeJwt, nowSec, sessionFor, startMockSupabase } from "./mock-supabase.mjs";
import { startStaticServer } from "./static-server.mjs";

const ROOT = fileURLToPath(new URL("../../", import.meta.url));
const { chromium } = createRequire(import.meta.url)("playwright-core");
const MOCK_PORT = 54395;
const APP_PORT = 5303;
const APP = `http://127.0.0.1:${APP_PORT}`;
const KEY = "sb-127-auth-token";
const PW = "clave-ficticia-qa";
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const clinic = { slug: "qa-psico", name: "Consultorio Ficticio QA" };
const USERS = {
  A: { id: "00000000-0000-4000-8000-0000000000a1", email: "cuenta.a@example.test", password: PW, fullName: "Cuenta A Ficticia", roles: ["patient"], clinics: [clinic] },
  B: { id: "00000000-0000-4000-8000-0000000000b1", email: "cuenta.b@example.test", password: PW, fullName: "Cuenta B Ficticia", roles: ["patient"], clinics: [clinic] },
};

const results = [];
const check = (ok, msg) => {
  results.push({ ok: !!ok, msg });
  console.log(`${ok ? "OK  " : "FALLA"} ${msg}`);
};

function buildDist() {
  const out = mkdtempSync(path.join(tmpdir(), "cd-push-"));
  const r = spawnSync(process.execPath, [path.join(ROOT, "node_modules/vite/bin/vite.js"), "build", "--outDir", out, "--emptyOutDir"], {
    cwd: ROOT, stdio: "ignore",
    env: { ...process.env, VITE_SUPABASE_URL: `http://127.0.0.1:${MOCK_PORT}`, VITE_SUPABASE_PUBLISHABLE_KEY: fakeJwt("anon", "", "anon"), VITE_SUPABASE_PROJECT_ID: "" },
  });
  if (r.status !== 0) throw new Error("Falló vite build");
  return out;
}

// Servicio push falso dentro del navegador (mismo perfil = mismo endpoint).
const fakePushService = () => {
  const KEY_EP = "__fake_push_endpoint";
  const make = (endpoint) => ({
    endpoint,
    expirationTime: null,
    getKey: () => null,
    toJSON: () => ({ endpoint, keys: { p256dh: "clave-publica-falsa", auth: "auth-falso" } }),
    unsubscribe: async () => {
      if (localStorage.getItem(KEY_EP) !== endpoint) return false;
      localStorage.removeItem(KEY_EP);
      await window.__fakePush?.("unsub", endpoint);
      return true;
    },
  });
  PushManager.prototype.getSubscription = async function () {
    const ep = localStorage.getItem(KEY_EP);
    return ep ? make(ep) : null;
  };
  PushManager.prototype.subscribe = async function () {
    if (Notification.permission !== "granted") throw new DOMException("Permiso denegado", "NotAllowedError");
    let ep = localStorage.getItem(KEY_EP);
    if (!ep) {
      ep = `https://push.invalid/falso/${crypto.randomUUID()}`;
      localStorage.setItem(KEY_EP, ep);
      await window.__fakePush?.("sub", ep);
    }
    return make(ep);
  };
};

async function main() {
  const distArg = process.argv.indexOf("--dist");
  const dist = distArg > 0 ? process.argv[distArg + 1] : buildDist();
  const mock = await startMockSupabase(USERS, { port: MOCK_PORT });
  const server = await startStaticServer(dist, { port: APP_PORT });
  const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM || "/opt/pw-browsers/chromium" });
  const rowsOf = (u) => mock.db.push.filter((r) => r.user_id === u.id);
  // "Servicio push": endpoint → perfil dueño y si sigue vivo (un perfil cerrado
  // es otro dispositivo que sigue existiendo).
  const pushService = new Map();
  let profiles = 0;

  // Un perfil de Chrome = un contexto (comparte sesión, service worker y suscripción).
  const newProfile = async ({ seed } = {}) => {
    const ctx = await browser.newContext();
    const profileId = ++profiles;
    await ctx.exposeBinding("__fakePush", (_source, op, ep) => {
      if (op === "sub") pushService.set(ep, { profileId, alive: true });
      if (op === "unsub" && pushService.has(ep)) pushService.get(ep).alive = false;
    });
    await ctx.grantPermissions(["notifications"], { origin: APP });
    await ctx.addInitScript(fakePushService);
    if (seed) {
      await ctx.addInitScript(([k, v]) => {
        if (!sessionStorage.getItem("__seeded")) { localStorage.setItem(k, v); sessionStorage.setItem("__seeded", "1"); }
      }, [KEY, JSON.stringify(sessionFor(seed))]);
    }
    const tabs = [];
    const openTab = async (route) => {
      const page = await ctx.newPage();
      const tab = { page, loads: 0 };
      page.on("load", () => { tab.loads++; });
      await page.goto(`${APP}${route}`);
      tabs.push(tab);
      return tab;
    };
    const endpoint = async () => tabs[0].page.evaluate(() => localStorage.getItem("__fake_push_endpoint"));
    let registrationId = null;
    // Envío simulado con la misma lógica que send-push-notification
    const sendTo = async (u, title) => {
      const live = await endpoint();
      if (!registrationId) {
        const cdp = await ctx.newCDPSession(tabs[0].page);
        registrationId = await new Promise((resolve) => {
          cdp.on("ServiceWorker.workerRegistrationUpdated", ({ registrations }) => {
            const r = registrations.find((x) => x.scopeURL === `${APP}/` && !x.isDeleted);
            if (r) resolve(r.registrationId);
          });
          void cdp.send("ServiceWorker.enable");
          setTimeout(() => resolve(null), 5000);
        });
        tabs[0].cdp = cdp;
      }
      let sent = 0, cleaned = 0, otherDevices = 0;
      for (const row of rowsOf(u)) {
        const svc = pushService.get(row.endpoint);
        if (svc?.alive && svc.profileId !== profileId) {
          otherDevices++; // llega a otro dispositivo de la misma cuenta
        } else if (svc?.alive && row.endpoint === live && registrationId) {
          await tabs[0].cdp.send("ServiceWorker.deliverPushMessage", { origin: APP, registrationId, data: JSON.stringify({ title, body: "aviso simulado" }) });
          sent++;
        } else {
          mock.db.push = mock.db.push.filter((r) => r.id !== row.id); // 404/410 → se borra
          cleaned++;
        }
      }
      await wait(800);
      return { sent, cleaned, otherDevices };
    };
    const shown = async () => tabs[0].page.evaluate(async () =>
      ((await (await navigator.serviceWorker.getRegistration())?.getNotifications()) ?? []).map((n) => n.title));
    return { ctx, openTab, tabs, endpoint, sendTo, shown };
  };

  const login = async (tab, u) => {
    await tab.page.goto(`${APP}/acceso/paciente`);
    await tab.page.waitForSelector('input[type="password"]', { timeout: 20000 });
    await tab.page.fill('input[type="email"]', u.email);
    await tab.page.fill('input[type="password"]', PW);
    await tab.page.click('button[type="submit"]');
    await tab.page.waitForURL(`${APP}/portal/${clinic.slug}`, { timeout: 20000 });
    await cardReady(tab);
  };
  const cardReady = (tab) => tab.page.getByText(/Activá las notificaciones|Notificaciones activas|están bloqueadas/).first().waitFor({ timeout: 20000 });
  const cardState = async (tab) => {
    await wait(1500); // la verificación por cuenta es asíncrona
    const t = await tab.page.locator("body").innerText();
    if (/Notificaciones activas en este dispositivo/.test(t)) return "activas";
    if (/están bloqueadas/.test(t)) return "bloqueadas";
    if (/Activá las notificaciones/.test(t)) return "activar";
    return "?";
  };
  const activate = async (tab) => {
    await tab.page.getByRole("button", { name: /Activar notificaciones/ }).click();
    await tab.page.getByText("Notificaciones activas en este dispositivo").first().waitFor({ timeout: 15000 }).catch(() => {});
  };
  const logout = async (tab) => {
    await tab.page.getByRole("button", { name: /Salir/ }).first().click();
    await tab.page.waitForSelector('input[type="password"]', { timeout: 15000 });
    await wait(1000);
  };

  try {
    // 1) A → logout → B (el caso reportado)
    {
      const p = await newProfile();
      const t = await p.openTab("/acceso/paciente");
      await login(t, USERS.A);
      check((await cardState(t)) === "activar", "A sin suscripción: ofrece «Activar»");
      await activate(t);
      const eA = await p.endpoint();
      check((await cardState(t)) === "activas" && rowsOf(USERS.A).length === 1 && rowsOf(USERS.A)[0].endpoint === eA,
        "A activa: fila propia con el endpoint de este navegador");
      const s1 = await p.sendTo(USERS.A, "Aviso para A");
      check(s1.sent === 1 && (await p.shown()).includes("Aviso para A"), "A recibe su aviso (simulado)");
      await logout(t);
      check((await p.endpoint()) === null, "logout de A: el navegador ya no conserva la suscripción");
      await login(t, USERS.B);
      check((await cardState(t)) === "activar", "B entra: NO figura «activas» por la suscripción de A; ofrece «Activar»");
      check(rowsOf(USERS.B).length === 0, "B todavía no tiene filas");
      const before = (await p.shown()).length;
      const s2 = await p.sendTo(USERS.A, "Aviso privado de A");
      check(s2.sent === 0 && !(await p.shown()).includes("Aviso privado de A") && (await p.shown()).length === before,
        "un aviso para A ya no llega a este navegador con B adentro");
      check(s2.cleaned === 1 && rowsOf(USERS.A).length === 0, "la fila vieja de A se limpia como con un 404/410 real");
      await activate(t);
      const eB = await p.endpoint();
      check((await cardState(t)) === "activas" && eB && eB !== eA && rowsOf(USERS.B).length === 1 && rowsOf(USERS.B)[0].endpoint === eB,
        "B activa: suscripción NUEVA y fila propia (no reutiliza la de A)");
      const s3 = await p.sendTo(USERS.B, "Aviso para B");
      check(s3.sent === 1 && (await p.shown()).includes("Aviso para B"), "B recibe su aviso (simulado)");
      await p.ctx.close();
    }

    // 2) A → B sin logout (otra cuenta reemplaza la sesión, p. ej. un enlace de recuperación)
    {
      const p = await newProfile();
      const t = await p.openTab("/acceso/paciente");
      await login(t, USERS.A);
      await activate(t);
      check(rowsOf(USERS.A).length >= 1 && (await p.endpoint()), "A activa antes del cambio");
      const exp = nowSec() + 3600;
      await t.page.goto(`${APP}/reset-password#access_token=${USERS.B.token}&refresh_token=refresh-${USERS.B.id}&expires_in=3600&expires_at=${exp}&token_type=bearer&type=recovery`);
      await t.page.waitForSelector('[data-testid="reset-form"]', { timeout: 15000 }).catch(() => {});
      await wait(1500);
      check((await p.endpoint()) === null, "la sesión pasa a B sin logout: la suscripción de A se da de baja igual");
      await t.page.goto(`${APP}/portal/${clinic.slug}`);
      await cardReady(t);
      check((await cardState(t)) === "activar", "B ve «Activar», no «activas»");
      const s = await p.sendTo(USERS.A, "Aviso de A tras el cambio");
      check(s.sent === 0, "avisos de A no llegan con B adentro");
      await p.ctx.close();
    }

    // 3) Permiso denegado al cambiar de cuenta
    {
      const p = await newProfile();
      const t = await p.openTab("/acceso/paciente");
      await login(t, USERS.A);
      await activate(t);
      const cdp = await p.ctx.newCDPSession(t.page);
      const { targetInfo } = await cdp.send("Target.getTargetInfo");
      await cdp.send("Browser.setPermission", { origin: APP, browserContextId: targetInfo.browserContextId, permission: { name: "notifications" }, setting: "denied" });
      await logout(t);
      await login(t, USERS.B);
      check((await cardState(t)) === "bloqueadas", "permiso denegado: B ve la tarjeta de bloqueadas (con la guía)");
      check((await p.endpoint()) === null, "permiso denegado: igual no queda la suscripción de A");
      check((await p.sendTo(USERS.A, "Aviso A denegado")).sent === 0, "permiso denegado: avisos de A no llegan");
      await p.ctx.close();
    }

    // 4) Mismo usuario: recargar no cambia nada; logout + login exige volver a activar
    {
      const p = await newProfile();
      const t = await p.openTab("/acceso/paciente");
      await login(t, USERS.A);
      await activate(t);
      const e1 = await p.endpoint();
      await t.page.reload();
      await cardReady(t);
      check((await cardState(t)) === "activas" && (await p.endpoint()) === e1 && rowsOf(USERS.A).length === 1,
        "mismo usuario al recargar: sigue «activas», misma suscripción, una sola fila");
      await logout(t);
      await login(t, USERS.A);
      check((await cardState(t)) === "activar", "logout + login de A: hay que volver a activar (el logout libera este navegador)");
      await activate(t);
      const e2 = await p.endpoint();
      const s = await p.sendTo(USERS.A, "Aviso A de nuevo");
      check(e2 !== e1 && s.sent === 1 && s.cleaned === 1 && rowsOf(USERS.A).length === 1,
        "reactivación: llega una vez y la fila vieja se limpia (sin duplicados ni error de UPDATE)");
      await p.ctx.close();
    }

    // 5) Dos pestañas con la misma cuenta
    {
      const p = await newProfile({ seed: USERS.A });
      const t1 = await p.openTab(`/portal/${clinic.slug}`);
      const t2 = await p.openTab(`/portal/${clinic.slug}`);
      await cardReady(t1);
      await cardReady(t2);
      await t1.page.bringToFront();
      await activate(t1);
      const e1 = await p.endpoint();
      await t2.page.bringToFront();
      await t2.page.evaluate(() => document.dispatchEvent(new Event("visibilitychange")));
      let st2 = await cardState(t2);
      if (st2 === "activar") {
        await activate(t2);
        st2 = await cardState(t2);
      }
      const here = (ep) => rowsOf(USERS.A).filter((r) => r.endpoint === ep).length;
      check(st2 === "activas" && (await p.endpoint()) === e1 && here(e1) === 1,
        `segunda pestaña: queda «activas» sin crear otra suscripción ni otra fila (${st2}, filas de este navegador: ${here(e1)})`);
      const otherRows = rowsOf(USERS.A).filter((r) => r.endpoint !== e1);
      await t1.page.bringToFront();
      await logout(t1);
      await wait(2000);
      check((await p.endpoint()) === null, "logout en una pestaña: el navegador suelta la suscripción (la otra pestaña se entera)");
      const s5 = await p.sendTo(USERS.A, "Aviso A tras logout");
      check(s5.sent === 0, "tras el logout no llegan avisos de A a este navegador");
      check(otherRows.length === 1 && s5.otherDevices === 1 && rowsOf(USERS.A).some((r) => r.id === otherRows[0].id),
        "la suscripción de A en OTRO dispositivo no se toca y sigue recibiendo");
      check(t1.loads === 1 && t2.loads === 1, `ninguna pestaña se recargó sola (cargas ${t1.loads}/${t2.loads})`);
      const regs = await t2.page.evaluate(async () => (await navigator.serviceWorker.getRegistrations()).map((r) => r.active?.scriptURL.split("/").pop()));
      check(regs.length === 1 && regs[0] === "sw.js", "sigue habiendo un único service worker (sw.js)");
      await p.ctx.close();
    }
  } finally {
    await browser.close();
    server.close();
    mock.close();
    if (distArg < 0) rmSync(dist, { recursive: true, force: true });
  }
  const failed = results.filter((r) => !r.ok).length;
  console.log(failed ? `\n${failed} FALLAS` : `\nTODAS LAS PRUEBAS PASARON (${results.length})`);
  process.exit(failed ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
