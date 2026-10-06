// Validación visual de la guía de notificaciones bloqueadas en Chromium real.
// El permiso "denied" lo fija el propio Chromium (CDP); no hay red, sesión,
// datos ni envíos. Guarda capturas DE LA APP (la guía y sus ilustraciones)
// en móvil y escritorio, por plataforma.
//
// Uso:  NODE_PATH=<node_modules con playwright-core> node tests/visual/notificaciones-bloqueadas.mjs [carpeta-salida]
import { spawn } from "node:child_process";
import { mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const ROOT = fileURLToPath(new URL("../../", import.meta.url));
const OUT = path.resolve(process.argv[2] || path.join(ROOT, "docs/img/notificaciones-bloqueadas"));
const PORT = 5210;
const BASE = `http://127.0.0.1:${PORT}`;
const PAGE = `${BASE}/tests/visual/notificaciones-bloqueadas.html`;
const { chromium } = createRequire(import.meta.url)("playwright-core");

const UA = {
  android: "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Mobile Safari/537.36",
  iphone: "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1",
  macSafari: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15",
  macChrome: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36",
  winChrome: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36",
};
const MOBILE = { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true };
const DESKTOP = { viewport: { width: 1280, height: 860 }, deviceScaleFactor: 1 };

const results = [];
const check = (ok, msg) => {
  results.push({ ok: !!ok, msg });
  console.log(`${ok ? "OK  " : "FALLA"} ${msg}`);
};

async function main() {
  mkdirSync(OUT, { recursive: true });
  const vite = spawn(process.execPath, [path.join(ROOT, "node_modules/vite/bin/vite.js"), "--port", String(PORT), "--host", "127.0.0.1", "--strictPort"], {
    cwd: ROOT,
    stdio: "ignore",
    // Supabase apuntando a un puerto muerto: esta página no habla con ningún backend.
    env: { ...process.env, VITE_SUPABASE_URL: "http://127.0.0.1:9", VITE_SUPABASE_PUBLISHABLE_KEY: "x.y.z", VITE_SUPABASE_PROJECT_ID: "" },
  });
  const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM || "/opt/pw-browsers/chromium" });
  try {
    for (let i = 0; i < 60; i++) {
      try { if ((await fetch(PAGE)).ok) break; } catch { /* esperando */ }
      await new Promise((r) => setTimeout(r, 1000));
    }

    const open = async ({ ua, device, permission = "denied", theme }) => {
      const ctx = await browser.newContext({ ...device, userAgent: ua });
      await ctx.addInitScript(() => {
        window.__permissionRequests = 0;
        if (window.Notification) {
          const original = Notification.requestPermission.bind(Notification);
          Notification.requestPermission = (...a) => { window.__permissionRequests++; return original(...a); };
        }
      });
      const page = await ctx.newPage();
      const cdp = await ctx.newCDPSession(page);
      const { targetInfo } = await cdp.send("Target.getTargetInfo");
      await cdp.send("Browser.setPermission", {
        origin: BASE, browserContextId: targetInfo.browserContextId, permission: { name: "notifications" }, setting: permission,
      });
      await page.goto(theme ? `${PAGE}?tema=${theme}` : PAGE);
      await page.waitForSelector(permission === "denied" ? '[data-testid="notifications-blocked-card"]' : "text=Activar notificaciones", { timeout: 30000 });
      return { ctx, page };
    };
    const requests = (page) => page.evaluate(() => window.__permissionRequests);
    const guide = (page) => page.locator('[data-testid="blocked-notifications-guide"]');
    const shootGuide = async (page, name) => {
      await page.waitForTimeout(500); // fin de la animación de apertura
      await page.screenshot({ path: path.join(OUT, `${name}.png`) });
      // Contenido completo: se agranda la ventana hasta que entre toda la guía.
      const size = page.viewportSize();
      await guide(page).locator("details").evaluate((d) => d.setAttribute("open", ""));
      const extra = await guide(page).evaluate((el) => {
        const scroller = el.querySelector(".overflow-y-auto");
        return scroller ? scroller.scrollHeight - scroller.clientHeight : 0;
      });
      await page.setViewportSize({ width: size.width, height: size.height + extra + 40 });
      await page.waitForTimeout(300);
      await guide(page).screenshot({ path: path.join(OUT, `${name}-completa.png`) });
      await page.setViewportSize(size);
    };

    // 1) Tarjeta bloqueada: texto neutral, sin pedir permiso al cargar
    for (const [name, device, ua] of [["tarjeta-movil", MOBILE, UA.android], ["tarjeta-escritorio", DESKTOP, UA.winChrome]]) {
      const { ctx, page } = await open({ ua, device });
      const card = page.locator('[data-testid="notifications-blocked-card"]');
      const text = await card.innerText();
      check(/bloqueadas en este dispositivo/.test(text) && !/No permitir|En algún momento/.test(text), `${name}: texto neutral, sin atribuir el bloqueo`);
      check((await requests(page)) === 0, `${name}: no se pide permiso al cargar`);
      await card.screenshot({ path: path.join(OUT, `${name}.png`) });
      await ctx.close();
    }

    // 2) Guía por plataforma, autodetectada
    const cases = [
      { name: "android-chrome-movil", ua: UA.android, device: MOBILE, expect: ["Android", "Chrome"], heading: /Permití los avisos de este sitio en Chrome/, system: /Android deje mostrar avisos/ },
      { name: "iphone-movil", ua: UA.iphone, device: MOBILE, expect: ["iPhone / iPad"], heading: /Permití las notificaciones de la app/, system: /16\.4/ },
      { name: "mac-safari-escritorio", ua: UA.macSafari, device: DESKTOP, expect: ["Mac", "Safari"], heading: /en Safari/, system: /la Mac deje mostrar avisos/ },
      { name: "mac-chrome-escritorio", ua: UA.macChrome, device: DESKTOP, expect: ["Mac", "Chrome"], heading: /en Chrome/, system: /la Mac deje mostrar avisos/ },
      { name: "windows-chrome-escritorio", ua: UA.winChrome, device: DESKTOP, expect: ["Windows", "Chrome"], heading: /en Chrome/, system: /Windows deje mostrar avisos/ },
    ];
    for (const c of cases) {
      const { ctx, page } = await open({ ua: c.ua, device: c.device });
      await page.getByRole("button", { name: "Ver cómo habilitarlas" }).click();
      await guide(page).waitFor();
      const checked = await page.locator('[role="radio"][aria-checked="true"]').allInnerTexts();
      check(c.expect.every((e) => checked.some((t) => t.startsWith(e))), `${c.name}: elige sola ${c.expect.join(" + ")} (${checked.map((t) => t.split("\n")[0]).join(", ")})`);
      const text = await guide(page).innerText();
      check(c.heading.test(text) && c.system.test(text), `${c.name}: muestra los pasos del navegador y del sistema correctos`);
      check((await page.locator('[data-testid="help-illustration"]').count()) > 0 && /Ilustración/.test(text), `${c.name}: las imágenes están rotuladas «Ilustración»`);
      const box = await guide(page).boundingBox();
      check(box && box.width <= c.device.viewport.width + 1, `${c.name}: la guía entra en el ancho de la pantalla`);
      await shootGuide(page, c.name);
      check((await requests(page)) === 0, `${c.name}: abrir la guía no pide permiso`);
      await ctx.close();
    }

    // 3) Elegir otra plataforma a mano
    {
      const { ctx, page } = await open({ ua: UA.winChrome, device: DESKTOP });
      await page.getByRole("button", { name: "Ver cómo habilitarlas" }).click();
      await page.getByRole("radio", { name: /^Mac/ }).click();
      await page.getByRole("radio", { name: "Safari" }).click();
      const text = await guide(page).innerText();
      check(/Sitios web/.test(text) && !/Notificaciones de aplicaciones y otros remitentes/.test(text), "cambiar a Mac + Safari muestra los pasos de Safari");
      await page.getByRole("radio", { name: /^Android/ }).click();
      check(/Notificaciones de apps/.test(await guide(page).innerText()), "cambiar a Android muestra los pasos de Android");
      check((await requests(page)) === 0, "cambiar de plataforma no pide permiso");
      await ctx.close();
    }

    // 4) Tema claro (móvil)
    {
      const { ctx, page } = await open({ ua: UA.android, device: MOBILE, theme: "claro" });
      await page.locator('[data-testid="notifications-blocked-card"]').screenshot({ path: path.join(OUT, "tarjeta-movil-claro.png") });
      await page.getByRole("button", { name: "Ver cómo habilitarlas" }).click();
      await guide(page).waitFor();
      await page.waitForTimeout(500);
      await page.screenshot({ path: path.join(OUT, "android-chrome-movil-claro.png") });
      await ctx.close();
    }

    // 5) Permiso sin decidir: se pide SOLO al tocar el botón
    {
      const { ctx, page } = await open({ ua: UA.winChrome, device: DESKTOP, permission: "prompt" });
      check((await requests(page)) === 0, "sin decidir: no se pide permiso al cargar");
      await page.getByRole("button", { name: "Activar notificaciones" }).click();
      await page.waitForTimeout(800);
      check((await requests(page)) === 1, "sin decidir: el clic en «Activar notificaciones» pide el permiso una vez");
      await ctx.close();
    }
  } finally {
    await browser.close();
    vite.kill("SIGTERM");
  }
  const failed = results.filter((r) => !r.ok).length;
  console.log(failed ? `\n${failed} FALLAS` : `\nTODAS LAS COMPROBACIONES PASARON (${results.length})`);
  console.log(`Capturas de la app en ${OUT}`);
  process.exit(failed ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
