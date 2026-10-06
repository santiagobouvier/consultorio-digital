// Entorno de prueba AISLADO para revisar el bucle de recargas entre pestañas
// (PR #369) con los service workers REALES del build de producción.
//
// - Compila la app (la rama actual, u otra con --ref) apuntando a un Supabase
//   SIMULADO local con cuentas y datos ficticios. Nada sale a internet: no
//   toca producción, no manda correos, notificaciones, reservas ni cobros.
// - La sirve en http://127.0.0.1:4390 (127.0.0.1 permite service workers sin HTTPS).
//
// Dependencias: usar las versiones del lockfile del proyecto (las que usa
// Lovable): @supabase/supabase-js 2.86.0, vite-plugin-pwa 1.2.0, workbox-window 7.4.0.
//
// Revisar a mano (queda corriendo hasta Ctrl+C):
//   node tests/e2e/entorno-pestanas.mjs
// Verificación automática con dos pestañas y evidencia (capturas, videos, informe):
//   NODE_PATH=<node_modules con playwright-core> node tests/e2e/entorno-pestanas.mjs --verificar
// Comparar con otra versión (p. ej. main, que tiene el bucle):
//   ... --ref origin/main [--verificar]
// Otras opciones: --puerto 4390 --salida <carpeta de evidencia> --dist <build ya hecho>
import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, mkdirSync, readFileSync, renameSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import { fakeJwt, startMockSupabase } from "./mock-supabase.mjs";
import { startStaticServer } from "./static-server.mjs";

const ROOT = fileURLToPath(new URL("../../", import.meta.url));
const arg = (name, def) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > 0 ? process.argv[i + 1] : def;
};
const VERIFY = process.argv.includes("--verificar");
const REF = arg("ref", null);
const APP_PORT = Number(arg("puerto", 4390));
const MOCK_PORT = 54390;
const APP = `http://127.0.0.1:${APP_PORT}`;
const LABEL = REF ? REF.replace(/[^\w.-]+/g, "_") : "rama-actual";
const OUT = arg("salida", path.join(tmpdir(), `entorno-pestanas-${LABEL}`));
const STORAGE_KEY = "sb-127-auth-token";
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

// Cuentas FICTICIAS: solo existen dentro del Supabase simulado.
const PASSWORD = "clave-ficticia-qa";
const USERS = {
  paciente: { id: "00000000-0000-4000-8000-0000000000c1", email: "paciente.qa@example.test", password: PASSWORD,
    fullName: "Paciente Ficticio QA", roles: ["patient"], clinics: [{ slug: "qa-psico", name: "Consultorio Ficticio QA" }] },
};

// Versiones que fija el lockfile del proyecto (las del build de Lovable).
const PINNED = { "@supabase/supabase-js": "2.86.0", "vite-plugin-pwa": "1.2.0", "workbox-window": "7.4.0" };

function checkPinnedVersions() {
  const wrong = Object.entries(PINNED).filter(([name, version]) => {
    const pkg = path.join(ROOT, "node_modules", ...name.split("/"), "package.json");
    return !existsSync(pkg) || JSON.parse(readFileSync(pkg, "utf8")).version !== version;
  });
  if (!wrong.length) return;
  console.error(`
Faltan las versiones fijadas del proyecto: ${wrong.map(([n, v]) => `${n}@${v}`).join(", ")}.
Instalalas (no cambia package.json) y volvé a correr:
  npm install --no-save --package-lock=false ${Object.entries(PINNED).map(([n, v]) => `${n}@${v}`).join(" ")}
`);
  process.exit(3);
}

function build() {
  let cwd = ROOT;
  let worktree = null;
  if (REF) {
    worktree = mkdtempSync(path.join(tmpdir(), "cd-ref-"));
    const add = spawnSync("git", ["worktree", "add", "--detach", worktree, REF], { cwd: ROOT, stdio: "inherit" });
    if (add.status !== 0) throw new Error(`No se pudo preparar ${REF}`);
    // "junction" funciona en Windows sin permisos de administrador; en Mac/Linux se ignora.
    symlinkSync(path.join(ROOT, "node_modules"), path.join(worktree, "node_modules"), "junction");
    cwd = worktree;
  }
  const dist = mkdtempSync(path.join(tmpdir(), "cd-entorno-"));
  console.log(`Compilando ${REF || "la rama actual"} (build de producción) …`);
  // Vite con el mismo Node que corre este script: anda igual en Windows, Mac y Linux.
  const viteBin = path.join(ROOT, "node_modules", "vite", "bin", "vite.js");
  const r = spawnSync(process.execPath, [viteBin, "build", "--outDir", dist, "--emptyOutDir"], {
    cwd,
    stdio: "ignore",
    env: { ...process.env, VITE_SUPABASE_URL: `http://127.0.0.1:${MOCK_PORT}`, VITE_SUPABASE_PUBLISHABLE_KEY: fakeJwt("anon", "", "anon") },
  });
  if (worktree) spawnSync("git", ["worktree", "remove", "--force", worktree], { cwd: ROOT });
  if (r.status !== 0) throw new Error("Falló vite build");
  return dist;
}

async function verify() {
  const require = createRequire(import.meta.url);
  const { chromium } = require("playwright-core");
  mkdirSync(OUT, { recursive: true });
  const results = [];
  const check = (ok, msg) => {
    results.push({ ok: !!ok, msg });
    console.log(`${ok ? "OK  " : "FALLA"} ${msg}`);
  };
  const timeline = [];
  const t0 = Date.now();
  const note = (msg) => {
    timeline.push(`${((Date.now() - t0) / 1000).toFixed(1).padStart(6)} s  ${msg}`);
  };

  const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM || "/opt/pw-browsers/chromium" });
  // Un perfil limpio = un contexto: las dos pestañas comparten sesión y service worker.
  const ctx = await browser.newContext({ recordVideo: { dir: path.join(OUT, "videos"), size: { width: 900, height: 700 } },
    viewport: { width: 900, height: 700 } });
  const tabs = {};
  const openTab = async (name, route) => {
    const page = await ctx.newPage();
    const tab = { name, page, loads: 0 };
    page.on("load", () => { tab.loads++; note(`pestaña ${name}: carga #${tab.loads} (${new URL(page.url()).pathname})`); });
    tabs[name] = tab;
    await page.goto(`${APP}${route}`);
    return tab;
  };
  const loads = () => `A=${tabs.A.loads}, B=${tabs.B ? tabs.B.loads : "-"}`;
  const pathOf = (tab) => new URL(tab.page.url()).pathname;
  const sessionUser = (tab) => tab.page.evaluate((k) => {
    try { return JSON.parse(localStorage.getItem(k) || "null")?.user?.email ?? null; } catch { return null; }
  }, STORAGE_KEY).catch(() => null);
  const shot = (tab, file) => tab.page.screenshot({ path: path.join(OUT, file) }).catch(() => {});

  try {
    // Pestaña A: ingreso normal con la cuenta ficticia
    const A = await openTab("A", "/acceso/paciente");
    await A.page.waitForSelector('input[type="password"]', { timeout: 20000 });
    await A.page.fill('input[type="email"]', USERS.paciente.email);
    await A.page.fill('input[type="password"]', PASSWORD);
    await A.page.click('button[type="submit"]');
    note("pestaña A: ingresa con email y contraseña ficticios");
    await A.page.waitForURL(`${APP}/portal/qa-psico`, { timeout: 20000 }).catch(() => {});
    await A.page.getByText("Consultorio Ficticio QA").first().waitFor({ timeout: 15000 }).catch(() => {});
    check(pathOf(A) === "/portal/qa-psico", "A: el ingreso lleva al portal ficticio");
    await wait(4000);

    // Pestaña B: misma sesión, sin contraseña
    const B = await openTab("B", "/acceso/paciente");
    await B.page.waitForURL(`${APP}/portal/qa-psico`, { timeout: 20000 }).catch(() => {});
    note("pestaña B: abre /acceso/paciente con la sesión vigente");
    check(pathOf(B) === "/portal/qa-psico", "B: reconoce la sesión y abre el portal sin pedir contraseña");
    await B.page.getByText("Consultorio Ficticio QA").first().waitFor({ timeout: 15000 }).catch(() => {});
    await shot(A, "1-A-inicio.png");
    await shot(B, "1-B-inicio.png");

    // 1) Dos pestañas quietas
    const quiet = 25;
    note(`esperando ${quiet} s con las dos pestañas abiertas`);
    await wait(quiet * 1000);
    check(A.loads === 1 && B.loads === 1, `dos pestañas abiertas ${quiet} s: ninguna se recarga (cargas ${loads()})`);

    // 2) Navegar dentro de la app en A
    await A.page.evaluate(() => {
      history.pushState({}, "", "/acceso/paciente");
      dispatchEvent(new PopStateEvent("popstate"));
    });
    note("pestaña A: navega dentro de la app a /acceso/paciente");
    await A.page.waitForURL(`${APP}/portal/qa-psico`, { timeout: 15000 }).catch(() => {});
    await wait(12000);
    check(A.loads === 1 && B.loads === 1 && pathOf(A) === "/portal/qa-psico",
      `navegar en A no recarga ninguna pestaña (cargas ${loads()})`);

    // 3) Refrescar A a mano
    await A.page.reload();
    note("pestaña A: F5 (refresco manual)");
    await wait(15000);
    check(A.loads === 2 && B.loads === 1, `refrescar A recarga solo A, B sigue igual (cargas ${loads()})`);

    // 4) Refrescar B a mano
    await B.page.reload();
    note("pestaña B: F5 (refresco manual)");
    await wait(15000);
    check(A.loads === 2 && B.loads === 2, `refrescar B recarga solo B, A sigue igual (cargas ${loads()})`);

    // 5) Navegar en B escribiendo otra dirección
    await B.page.goto(`${APP}/acceso/paciente`);
    note("pestaña B: escribe /acceso/paciente en la barra (carga completa)");
    await B.page.waitForURL(`${APP}/portal/qa-psico`, { timeout: 15000 }).catch(() => {});
    await wait(12000);
    check(A.loads === 2 && B.loads === 3, `navegar con carga completa en B no recarga A (cargas ${loads()})`);

    // Sesión y service worker al final
    const [ua, ub] = [await sessionUser(A), await sessionUser(B)];
    check(ua === USERS.paciente.email && ub === USERS.paciente.email, `la sesión se conserva en las dos pestañas (${ua} / ${ub})`);
    // Portal con sesión: muestra el consultorio y el botón "Salir" (sin sesión mostraría el login)
    const inPortal = async (tab) => {
      const text = await tab.page.locator("body").innerText().catch(() => "");
      return text.includes("Consultorio Ficticio QA") && text.includes("Salir") && !(await tab.page.locator('input[type="password"]').count());
    };
    check(await inPortal(A) && await inPortal(B), "las dos pestañas siguen dentro del portal, con sesión y sin pedir contraseña");
    const regs = await A.page.evaluate(async () => (await navigator.serviceWorker.getRegistrations())
      .map((r) => ({ activo: r.active?.scriptURL.split("/").pop() ?? null, esperando: r.waiting?.scriptURL.split("/").pop() ?? null })));
    check(regs.length === 1 && regs[0].activo === "sw.js" && !regs[0].esperando,
      `un único service worker real controla el sitio (${JSON.stringify(regs)})`);
    const toast = (await A.page.getByText("Hay una versión nueva").count()) + (await B.page.getByText("Hay una versión nueva").count());
    check(toast === 0, "no aparece 'Hay una versión nueva' sin un deploy nuevo");
    await shot(A, "2-A-final.png");
    await shot(B, "2-B-final.png");
  } catch (e) {
    check(false, `la verificación se interrumpió: ${e.message.split("\n")[0]}`);
  } finally {
    const videos = await Promise.all(Object.values(tabs).map(async (t) => [t.name, await t.page.video()?.path().catch(() => null)]));
    await ctx.close(); // cierra y guarda los videos
    await browser.close();
    for (const [name, file] of videos) if (file) renameSync(file, path.join(OUT, "videos", `pestana-${name}.webm`));
  }

  const failed = results.filter((r) => !r.ok).length;
  const report = [
    `# Prueba de dos pestañas — ${REF || "rama actual"}`,
    "",
    `Fecha: ${new Date().toISOString()}  ·  Entorno: ${APP} (build de producción + Supabase simulado, cuentas ficticias)`,
    "",
    `Resultado: ${failed ? `${failed} FALLAS` : `TODO OK (${results.length} comprobaciones)`}`,
    "",
    "## Comprobaciones",
    ...results.map((r) => `- ${r.ok ? "OK" : "FALLA"} — ${r.msg}`),
    "",
    "## Línea de tiempo (cargas de página)",
    "```",
    ...timeline,
    "```",
    "",
    "Capturas: 1-*-inicio.png, 2-*-final.png · Videos: videos/pestana-A.webm y videos/pestana-B.webm",
    "",
  ].join("\n");
  writeFileSync(path.join(OUT, "informe.md"), report);
  console.log(`\n${failed ? `${failed} FALLAS` : `TODAS LAS COMPROBACIONES PASARON (${results.length})`}`);
  console.log(`Evidencia en ${OUT}`);
  return failed;
}

async function main() {
  if (!arg("dist", null)) checkPinnedVersions();
  const dist = arg("dist", null) || build();
  const mock = await startMockSupabase(USERS, { port: MOCK_PORT });
  const server = await startStaticServer(dist, { port: APP_PORT });
  const stop = () => {
    server.close();
    mock.close();
    if (!arg("dist", null)) rmSync(dist, { recursive: true, force: true });
  };

  if (VERIFY) {
    let failed = 1;
    try {
      failed = await verify();
    } finally {
      stop();
    }
    process.exit(failed ? 1 : 0);
  }

  console.log(`
Entorno de prueba listo (${REF || "rama actual"}) — todo local, nada sale a internet.

  1. Abrí una ventana NUEVA de invitado o de incógnito de Chrome (perfil limpio).
  2. Pestaña 1: ${APP}/acceso/paciente
     Email: ${USERS.paciente.email}   Contraseña: ${PASSWORD}   (ficticios)
  3. Pestaña 2: ${APP}/acceso/paciente  → entra sola al portal (misma sesión).
  4. Dejá las dos abiertas, navegá y refrescá (F5) una: la otra no debe recargarse.
     DevTools → Application → Service workers: debe haber solo sw.js.

Ctrl+C para cerrar el entorno (no deja nada instalado; para borrar el
service worker del navegador, cerrá la ventana de invitado/incógnito).
`);
  process.on("SIGINT", () => { stop(); process.exit(0); });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
