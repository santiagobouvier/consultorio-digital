// /acceso/paciente con sesión ya iniciada: prueba de punta a punta con
// supabase-js REAL en Chromium contra un Supabase SIMULADO local (sin red,
// sin cuentas, sin correos reales).
// Uso:  NODE_PATH=<node_modules con playwright-core> node tests/e2e/patient-access-session.e2e.mjs
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import { fakeJwt, sessionFor, startMockSupabase } from "./mock-supabase.mjs";

const ROOT = fileURLToPath(new URL("../../", import.meta.url));
const require = createRequire(import.meta.url);
let chromium;
try {
  ({ chromium } = require("playwright-core"));
} catch {
  console.error("Falta playwright-core (usá NODE_PATH apuntando a un node_modules que lo tenga).");
  process.exit(2);
}

const MOCK_PORT = 54398;
const APP_PORT = 5201;
const APP = `http://127.0.0.1:${APP_PORT}`;
const STORAGE_KEY = "sb-127-auth-token";
const TEST_PASSWORD = "clave-qa-de-prueba";

const USERS = {
  paciente1: { id: "00000000-0000-4000-8000-0000000000c1", email: "paciente1.qa@example.test", password: TEST_PASSWORD,
    roles: ["patient"], clinics: [{ slug: "qa-psico", name: "QA Psicología" }] },
  paciente2: { id: "00000000-0000-4000-8000-0000000000c2", email: "paciente2.qa@example.test",
    roles: ["patient"], clinics: [{ slug: "qa-psico", name: "QA Psicología" }, { slug: "qa-odonto", name: "QA Odontología" }] },
  profesional: { id: "00000000-0000-4000-8000-0000000000d1", email: "profesional.qa@example.test",
    roles: ["owner"], ownsBusiness: true, clinics: [] },
  sinPortal: { id: "00000000-0000-4000-8000-0000000000e1", email: "sin.portal.qa@example.test", roles: [], clinics: [] },
};
// Consultorio de otra persona: nunca debe aparecer para paciente2
const AJENO = "QA Ajeno";
USERS.otra = { id: "00000000-0000-4000-8000-0000000000f1", email: "otra.qa@example.test", roles: ["patient"],
  clinics: [{ slug: "qa-ajeno", name: AJENO }] };

const results = [];
const check = (cond, msg) => {
  results.push({ ok: !!cond, msg });
  console.log(`${cond ? "OK  " : "FALLA"} ${msg}`);
};

async function main() {
  const mock = await startMockSupabase(USERS, { port: MOCK_PORT });
  const vite = spawn("npx", ["vite", "--port", String(APP_PORT), "--host", "127.0.0.1", "--strictPort"], {
    cwd: ROOT,
    env: { ...process.env, VITE_SUPABASE_URL: `http://127.0.0.1:${MOCK_PORT}`, VITE_SUPABASE_PUBLISHABLE_KEY: fakeJwt("anon", "", "anon") },
    stdio: "ignore",
  });
  try {
    for (let i = 0; i < 60; i++) {
      try { if ((await fetch(APP)).ok) break; } catch { /* esperando */ }
      await new Promise((r) => setTimeout(r, 1000));
    }
    const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM || "/opt/pw-browsers/chromium" });

    // Abre /acceso/paciente con (o sin) una sesión ya guardada, como la deja el
    // portal o la recuperación. Marca si el formulario de contraseña llegó a verse.
    const open = async (user, { expired = false } = {}) => {
      const ctx = await browser.newContext();
      const stored = user ? JSON.stringify(sessionFor(user, { expired })) : null;
      await ctx.addInitScript(([key, value]) => {
        if (value && !sessionStorage.getItem("__seeded")) {
          localStorage.setItem(key, value);
          sessionStorage.setItem("__seeded", "1");
        }
        window.__formSeen = false;
        new MutationObserver(() => {
          if (document.querySelector('input[type="password"]')) window.__formSeen = true;
        }).observe(document, { childList: true, subtree: true });
      }, [STORAGE_KEY, stored]);
      const page = await ctx.newPage();
      await page.goto(`${APP}/acceso/paciente`);
      return { ctx, page };
    };
    const lookupsBefore = () => mock.log.lookups.length;

    // 1) Sin sesión: muestra el formulario y no consulta consultorios
    {
      const before = lookupsBefore();
      const { ctx, page } = await open(null);
      await page.waitForSelector('input[type="password"]', { timeout: 15000 });
      check(mock.log.lookups.length === before, "sin sesión: formulario y ninguna consulta de consultorios");
      await ctx.close();
    }

    // 2) Paciente con un consultorio y sesión vigente: entra directo, sin contraseña
    {
      const before = lookupsBefore();
      const { ctx, page } = await open(USERS.paciente1);
      await page.waitForURL(`${APP}/portal/qa-psico`, { timeout: 15000 }).catch(() => {});
      check(new URL(page.url()).pathname === "/portal/qa-psico", "paciente con sesión: va directo a su portal");
      check(!(await page.evaluate(() => window.__formSeen)), "paciente con sesión: nunca se mostró el formulario de contraseña");
      const call = mock.log.lookups.slice(before)[0];
      check(call && call.user === USERS.paciente1.id && call.bodyKeys.length === 0,
        "paciente con sesión: la búsqueda usa su sesión y no manda ningún email");
      await ctx.close();
    }

    // 3) Paciente con dos consultorios: elige entre los SUYOS
    {
      const { ctx, page } = await open(USERS.paciente2);
      await page.waitForSelector("text=¿A cuál querés ingresar?", { timeout: 15000 });
      const text = await page.locator("body").innerText();
      check(text.includes("QA Psicología") && text.includes("QA Odontología"), "paciente con varios: muestra sus dos consultorios");
      check(!text.includes(AJENO), "paciente con varios: no aparece el consultorio de otra persona");
      check(!(await page.evaluate(() => window.__formSeen)), "paciente con varios: sin pedir contraseña");
      await page.click("text=QA Odontología");
      await page.waitForURL(`${APP}/portal/qa-odonto`, { timeout: 8000 }).catch(() => {});
      check(new URL(page.url()).pathname === "/portal/qa-odonto", "paciente con varios: entra al que elige");
      await ctx.close();
    }

    // 4) Profesional con sesión: no lo trata como paciente ni le cierra la sesión
    {
      const { ctx, page } = await open(USERS.profesional);
      await page.waitForSelector('[data-testid="access-active-session"]', { timeout: 15000 });
      const text = await page.locator("body").innerText();
      check(text.includes(USERS.profesional.email) && text.includes("equipo del consultorio"),
        "profesional con sesión: dice con qué cuenta está y que no tiene portal de paciente");
      check(!(await page.evaluate(() => window.__formSeen)), "profesional con sesión: no le pide contraseña");
      check(!!(await page.evaluate((k) => localStorage.getItem(k), STORAGE_KEY)), "profesional con sesión: no se le cierra la sesión");
      await page.click("text=Ir a mi panel");
      await page.waitForURL(`${APP}/dashboard`, { timeout: 8000 }).catch(() => {});
      check(new URL(page.url()).pathname === "/dashboard", "profesional con sesión: 'Ir a mi panel' lo lleva a /dashboard");
      await ctx.close();
    }

    // 5) Cuenta sin portal ni panel: lo dice y deja ingresar con otra cuenta
    {
      const { ctx, page } = await open(USERS.sinPortal);
      await page.waitForSelector('[data-testid="access-active-session"]', { timeout: 15000 });
      check(await page.getByText("Esta cuenta no tiene un portal de paciente.").isVisible(), "sin portal: lo explica");
      await page.click("text=Ingresar con otra cuenta");
      await page.waitForSelector('input[type="password"]', { timeout: 8000 });
      check(!(await page.evaluate((k) => localStorage.getItem(k), STORAGE_KEY)), "sin portal: 'Ingresar con otra cuenta' cierra la sesión y muestra el formulario");
      await ctx.close();
    }

    // 6) Carga asíncrona: el token guardado venció y el refresco tarda 2 s
    {
      mock.state.refreshDelayMs = 2000;
      const { ctx, page } = await open(USERS.paciente1, { expired: true });
      await page.waitForTimeout(800);
      const checking = await page.locator('[data-testid="access-checking"]').isVisible();
      check(checking && !(await page.evaluate(() => window.__formSeen)), "carga asíncrona: mientras refresca muestra 'Verificando tu sesión…', no el formulario");
      await page.waitForURL(`${APP}/portal/qa-psico`, { timeout: 15000 }).catch(() => {});
      check(new URL(page.url()).pathname === "/portal/qa-psico", "carga asíncrona: al terminar el refresco entra a su portal");
      mock.state.refreshDelayMs = 0;
      await ctx.close();
    }

    // 7) La búsqueda falla con sesión vigente: no lo confunde con "sin portal"
    {
      mock.state.lookupFails = true;
      const { ctx, page } = await open(USERS.paciente1);
      await page.waitForSelector('input[type="password"]', { timeout: 15000 });
      check(await page.getByText("No pudimos verificar tu sesión").isVisible(), "búsqueda con error: avisa y deja ingresar de nuevo");
      mock.state.lookupFails = false;
      await ctx.close();
    }

    // 8) Login normal sin sesión sigue funcionando
    {
      const { ctx, page } = await open(null);
      await page.waitForSelector('input[type="password"]', { timeout: 15000 });
      await page.fill('input[type="email"]', USERS.paciente1.email);
      await page.fill('input[type="password"]', TEST_PASSWORD);
      await page.click('button[type="submit"]');
      await page.waitForURL(`${APP}/portal/qa-psico`, { timeout: 15000 }).catch(() => {});
      check(new URL(page.url()).pathname === "/portal/qa-psico", "login normal: email y contraseña llevan a su portal");
      await ctx.close();
    }

    await browser.close();
  } finally {
    vite.kill("SIGTERM");
    mock.close();
  }
  const failed = results.filter((r) => !r.ok).length;
  console.log(failed ? `\n${failed} FALLAS` : `\nTODAS LAS PRUEBAS PASARON (${results.length})`);
  process.exit(failed ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
