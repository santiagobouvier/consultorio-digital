// Varias pestañas del mismo perfil sobre un BUILD DE PRODUCCIÓN (con service
// worker real) y un Supabase SIMULADO local: sin red, sin cuentas reales, sin
// notificaciones reales (el push se inyecta solo en este Chromium de prueba).
//
// Correr con las versiones del lockfile del proyecto (supabase-js 2.86.0,
// vite-plugin-pwa 1.2.0, workbox-window 7.4.0), como el build de Lovable.
// Uso:  NODE_PATH=<node_modules con playwright-core> node tests/e2e/pwa-tabs.e2e.mjs
//       ... --dist <carpeta>   para probar un build ya hecho (apuntando al mock
//                              en http://127.0.0.1:54396), sin compilar.
import { spawnSync } from "node:child_process";
import { cpSync, appendFileSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import { fakeJwt, sessionFor, startMockSupabase } from "./mock-supabase.mjs";
import { startStaticServer } from "./static-server.mjs";

const ROOT = fileURLToPath(new URL("../../", import.meta.url));
const require = createRequire(import.meta.url);
let chromium;
try {
  ({ chromium } = require("playwright-core"));
} catch {
  console.error("Falta playwright-core (usá NODE_PATH apuntando a un node_modules que lo tenga).");
  process.exit(2);
}

const MOCK_PORT = 54396;
const APP_PORT = 5302;
const APP = `http://127.0.0.1:${APP_PORT}`;
const STORAGE_KEY = "sb-127-auth-token";
const TOAST = "Hay una versión nueva";
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

const USERS = {
  paciente: { id: "00000000-0000-4000-8000-0000000000c1", email: "paciente.qa@example.test", roles: ["patient"],
    clinics: [{ slug: "qa-psico", name: "QA Psicología" }] },
};

const results = [];
const check = (cond, msg) => {
  results.push({ ok: !!cond, msg });
  console.log(`${cond ? "OK  " : "FALLA"} ${msg}`);
};

function buildDist() {
  const out = mkdtempSync(path.join(tmpdir(), "cd-pwa-"));
  console.log(`Compilando build de producción en ${out} …`);
  const r = spawnSync("npx", ["vite", "build", "--outDir", out, "--emptyOutDir"], {
    cwd: ROOT,
    stdio: "ignore",
    env: { ...process.env, VITE_SUPABASE_URL: `http://127.0.0.1:${MOCK_PORT}`, VITE_SUPABASE_PUBLISHABLE_KEY: fakeJwt("anon", "", "anon") },
  });
  if (r.status !== 0) throw new Error("Falló vite build");
  return out;
}

async function main() {
  const distArg = process.argv.indexOf("--dist");
  const dist = distArg > 0 ? process.argv[distArg + 1] : buildDist();
  // "Deploy nuevo": mismo build con sw.js distinto byte a byte.
  const distNext = mkdtempSync(path.join(tmpdir(), "cd-pwa-next-"));
  cpSync(dist, distNext, { recursive: true });
  appendFileSync(path.join(distNext, "sw.js"), "\n// deploy de prueba 2\n");

  const mock = await startMockSupabase(USERS, { port: MOCK_PORT });
  const server = await startStaticServer(dist, { port: APP_PORT });
  const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM || "/opt/pw-browsers/chromium" });

  // Un "perfil" = un contexto del navegador: comparte localStorage (la sesión)
  // y el service worker entre todas sus pestañas, como en la vida real.
  const newProfile = async () => {
    server.setRoot(dist);
    const ctx = await browser.newContext();
    await ctx.addInitScript(([k, v]) => {
      if (!localStorage.getItem(k) && !sessionStorage.getItem("__seeded")) localStorage.setItem(k, v);
      sessionStorage.setItem("__seeded", "1");
    }, [STORAGE_KEY, JSON.stringify(sessionFor(USERS.paciente))]);
    const tabs = [];
    const open = async (route, { legacyRegister = false } = {}) => {
      const page = await ctx.newPage();
      const tab = { page, loads: 0 };
      page.on("load", () => { tab.loads++; });
      if (legacyRegister) {
        // Pestaña que quedó abierta con la versión ANTERIOR de la app: en cada
        // carga registraba /push-sw.js como segundo service worker en "/".
        await page.addInitScript(() => {
          navigator.serviceWorker?.register("/push-sw.js").catch(() => {});
        });
      }
      await page.goto(`${APP}${route}`);
      tabs.push(tab);
      await wait(3000);
      return tab;
    };
    const loads = () => tabs.map((t) => t.loads);
    const regs = () => tabs[0].page.evaluate(async () =>
      (await navigator.serviceWorker.getRegistrations()).map((r) => ({
        active: r.active?.scriptURL.split("/").pop() ?? null,
        waiting: r.waiting?.scriptURL.split("/").pop() ?? null,
      })));
    const hasSession = () => tabs[0].page.evaluate((k) => !!localStorage.getItem(k), STORAGE_KEY);
    const toastIn = (tab) => tab.page.getByText(TOAST).count().then((n) => n > 0);
    return { ctx, open, loads, regs, hasSession, toastIn, tabs };
  };

  try {
    // 1) Una sola pestaña: estable, un solo service worker, sin aviso falso de versión nueva
    {
      const logoutsBefore = mock.log.logouts.length;
      const p = await newProfile();
      const a = await p.open("/portal/qa-psico");
      await wait(15000);
      check(a.loads === 1, `una pestaña: carga una sola vez en 18 s (cargas: ${a.loads})`);
      const regs = await p.regs();
      check(regs.length === 1 && regs[0].active === "sw.js" && !regs[0].waiting,
        `una pestaña: un único service worker (sw.js) controla el sitio (${JSON.stringify(regs)})`);
      check(!(await p.toastIn(a)), "una pestaña: no aparece 'Hay una versión nueva' sin deploy nuevo");
      check(await p.hasSession() && mock.log.logouts.length === logoutsBefore, "una pestaña: la sesión sigue abierta");
      await p.ctx.close();
    }

    // 2) Dos y tres pestañas con sesión: ninguna se recarga sola
    {
      const logoutsBefore = mock.log.logouts.length;
      const p = await newProfile();
      const [a, b] = [await p.open("/portal/qa-psico"), await p.open("/acceso/paciente")];
      await wait(12000);
      check(a.loads === 1 && b.loads === 1, `dos pestañas: ninguna se recarga sola (cargas: ${p.loads()})`);
      check(new URL(b.page.url()).pathname === "/portal/qa-psico", "dos pestañas: /acceso/paciente reconoce la sesión y abre el portal");
      const c = await p.open("/auth");
      await wait(12000);
      check(p.loads().every((n) => n === 1), `tres pestañas: ninguna se recarga sola (cargas: ${p.loads()})`);

      // Navegar dentro de la app y refrescar a mano UNA pestaña no recarga las otras
      await a.page.evaluate(() => {
        history.pushState({}, "", "/acceso/paciente");
        dispatchEvent(new PopStateEvent("popstate"));
      });
      await a.page.waitForURL(`${APP}/portal/qa-psico`, { timeout: 10000 }).catch(() => {});
      await c.page.reload();
      await wait(10000);
      check(a.loads === 1 && b.loads === 1 && c.loads === 2,
        `navegar y refrescar a mano una pestaña no recarga a las demás (cargas: ${p.loads()})`);
      const regs = await p.regs();
      check(regs.length === 1 && regs[0].active === "sw.js" && !regs[0].waiting,
        `varias pestañas: sigue habiendo un único service worker (${JSON.stringify(regs)})`);
      check(await p.hasSession() && mock.log.logouts.length === logoutsBefore, "varias pestañas: la sesión sigue abierta en todas");
      await p.ctx.close();
    }

    // 3) Deploy nuevo con dos pestañas: aviso en ambas, nada se recarga solo;
    //    "Actualizar" recarga cada pestaña UNA vez y después queda estable
    {
      const p = await newProfile();
      // Perfil que ya tenía la app instalada: en la primerísima visita la
      // pestaña no queda controlada por el service worker (sin clientsClaim).
      const warm = await p.ctx.newPage();
      await warm.goto(`${APP}/portal/qa-psico`);
      await wait(3000);
      await warm.close();
      const [a, b] = [await p.open("/portal/qa-psico"), await p.open("/portal/qa-psico")];
      server.setRoot(distNext);
      await a.page.evaluate(async () => { await (await navigator.serviceWorker.getRegistration())?.update(); });
      await a.page.getByText(TOAST).first().waitFor({ timeout: 15000 }).catch(() => {});
      await b.page.getByText(TOAST).first().waitFor({ timeout: 5000 }).catch(() => {});
      check(await p.toastIn(a) && await p.toastIn(b), "actualización: las dos pestañas muestran 'Hay una versión nueva'");
      await wait(8000);
      check(a.loads === 1 && b.loads === 1, `actualización: mientras nadie toca 'Actualizar', no se recarga nada (cargas: ${p.loads()})`);
      await a.page.getByRole("button", { name: "Actualizar" }).first().click();
      await wait(12000);
      check(a.loads === 2 && b.loads === 2, `actualización: 'Actualizar' recarga cada pestaña una sola vez (cargas: ${p.loads()})`);
      const regs = await p.regs();
      check(regs.length === 1 && regs[0].active === "sw.js" && !regs[0].waiting, `actualización: queda activa la versión nueva (${JSON.stringify(regs)})`);
      check(!(await p.toastIn(a)) && !(await p.toastIn(b)), "actualización: después de actualizar ya no aparece el aviso");
      check(await p.hasSession(), "actualización: la sesión sigue abierta");
      await p.ctx.close();
    }

    // 4) Transición: una pestaña quedó con la versión anterior (registra /push-sw.js)
    {
      const p = await newProfile();
      const a = await p.open("/portal/qa-psico");
      const b = await p.open("/acceso/paciente", { legacyRegister: true });
      await b.page.reload(); // la pestaña vieja recarga: antes esto le quitaba el control a las demás
      await wait(15000);
      check(a.loads === 1 && b.loads === 2, `pestaña con versión anterior: no arrastra a las demás a recargar (cargas: ${p.loads()})`);
      await p.ctx.close();
    }

    // 5) El service worker único sigue mostrando notificaciones push (inyectadas localmente)
    {
      const p = await newProfile();
      await p.ctx.grantPermissions(["notifications"], { origin: APP });
      const a = await p.open("/portal/qa-psico");
      const cdp = await p.ctx.newCDPSession(a.page);
      const registrationId = await new Promise((resolve) => {
        cdp.on("ServiceWorker.workerRegistrationUpdated", ({ registrations }) => {
          const r = registrations.find((x) => x.scopeURL === `${APP}/` && !x.isDeleted);
          if (r) resolve(r.registrationId);
        });
        void cdp.send("ServiceWorker.enable");
        setTimeout(() => resolve(null), 5000);
      });
      if (registrationId) {
        await cdp.send("ServiceWorker.deliverPushMessage", {
          origin: APP, registrationId, data: JSON.stringify({ title: "Prueba local QA", body: "sin envío real", data: { url: "/portal/qa-psico" } }),
        });
        await wait(1500);
      }
      const titles = await a.page.evaluate(async () =>
        (await (await navigator.serviceWorker.getRegistration())?.getNotifications() ?? []).map((n) => n.title));
      check(titles.includes("Prueba local QA"), `push: el service worker único muestra la notificación (${JSON.stringify(titles)})`);
      await p.ctx.close();
    }

    await browser.close();
  } finally {
    server.close();
    mock.close();
    rmSync(distNext, { recursive: true, force: true });
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
