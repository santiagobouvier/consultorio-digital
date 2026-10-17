// Capturas del portal del paciente en móvil y escritorio (hasta 2560 px),
// por escenario y tema. Datos ficticios; sin backend (page.route).
// Uso: NODE_PATH=<playwright-core> node tests/visual/portal-paciente.mjs <carpeta-salida> [--vite-root <dir>]
import { spawn } from "node:child_process";
import { mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const ROOT = fileURLToPath(new URL("../../", import.meta.url));
const OUT = path.resolve(process.argv[2] || "portal-capturas");
const rootArg = process.argv.indexOf("--vite-root");
const VITE_ROOT = rootArg > 0 ? process.argv[rootArg + 1] : ROOT;
const PORT = 5212;
const BASE = `http://127.0.0.1:${PORT}/tests/visual/portal-paciente.html`;
const { chromium } = createRequire(import.meta.url)("playwright-core");

const iso = (days) => new Date(Date.now() + days * 86400000).toISOString();
const NOVEDADES = [
  { id: "n1", patient_id: "pac-ficticio", type: "appointment_created_by_professional", title: "Te agendaron una cita", body: "Mañana a las 10:00 hs.", read_at: null, created_at: iso(-0.1) },
  { id: "n2", patient_id: "pac-ficticio", type: "payment_due_soon", title: "Tenés un pago por vencer", body: "Sesión del jueves.", read_at: null, created_at: iso(-3) },
  { id: "n3", patient_id: "pac-ficticio", type: "reschedule_approved", title: "Se aprobó tu reprogramación", body: "La cita quedó para el lunes.", read_at: null, created_at: iso(-40) },
  { id: "n4", patient_id: "pac-ficticio", type: "payment_received", title: "Recibimos tu pago", body: "Gracias.", read_at: null, created_at: iso(-60) },
];
const DOCS = [
  { id: "d1", business_id: "b", appointment_id: null, file_path: "x", file_name: "Pautas de higiene del sueño.pdf", file_size: 182000, mime_type: "application/pdf", document_type: "guide", notes: null, shared_at: iso(-10), created_at: iso(-10), appointments: null },
  { id: "d2", business_id: "b", appointment_id: "p0", file_path: "y", file_name: "Registro semanal de emociones.pdf", file_size: 92000, mime_type: "application/pdf", document_type: "exercise", notes: null, shared_at: iso(-7), created_at: iso(-7), appointments: { start_at: iso(-7) } },
];

const SIZES = {
  movil: { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true },
  "escritorio-1280": { viewport: { width: 1280, height: 800 } },
  "escritorio-1536": { viewport: { width: 1536, height: 864 } },
  "escritorio-1920": { viewport: { width: 1920, height: 1080 } },
  "escritorio-2560": { viewport: { width: 2560, height: 1440 } },
};
const SHOTS = [
  ["completo", "oscuro", ["movil", "escritorio-1280", "escritorio-1536", "escritorio-1920", "escritorio-2560"], true],
  ["completo", "claro", ["movil", "escritorio-1536"], true],
  ["vacio", "oscuro", ["movil", "escritorio-1536"], false],
  ["sin-citas-con-pagos", "oscuro", ["movil", "escritorio-1536"], true],
  ["al-dia", "claro", ["movil", "escritorio-1920"], false],
];

async function main() {
  mkdirSync(OUT, { recursive: true });
  const vite = spawn(process.execPath, [path.join(VITE_ROOT, "node_modules/vite/bin/vite.js"), "--port", String(PORT), "--host", "127.0.0.1", "--strictPort"], {
    cwd: VITE_ROOT, stdio: "ignore",
    env: { ...process.env, VITE_SUPABASE_URL: "http://127.0.0.1:9", VITE_SUPABASE_PUBLISHABLE_KEY: "x.y.z", VITE_SUPABASE_PROJECT_ID: "" },
  });
  const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM || "/opt/pw-browsers/chromium" });
  const report = [];
  try {
    for (let i = 0; i < 60; i++) {
      try { if ((await fetch(BASE)).ok) break; } catch { /* esperando */ }
      await new Promise((r) => setTimeout(r, 1000));
    }
    for (const [escenario, tema, sizes, withNews] of SHOTS) {
      for (const size of sizes) {
        const ctx = await browser.newContext(SIZES[size]);
        const page = await ctx.newPage();
        const errors = [];
        page.on("pageerror", (e) => errors.push(e.message));
        await page.route("http://127.0.0.1:9/**", (route) => {
          const u = route.request().url();
          const json = (b) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(b) });
          if (u.includes("/rest/v1/patient_notifications")) return json(withNews ? NOVEDADES : []);
          if (u.includes("/rest/v1/patient_documents")) return json(escenario === "vacio" ? [] : DOCS);
          if (u.includes("/rest/v1/")) return json([]);
          return route.fulfill({ status: 401, body: "{}" });
        });
        await page.goto(`${BASE}?escenario=${escenario}&tema=${tema}`);
        await page.getByText("Hola, Lucía").waitFor({ timeout: 30000 });
        await page.waitForTimeout(1500);
        const name = `${escenario}-${tema}-${size}`;
        await page.screenshot({ path: path.join(OUT, `${name}.png`), fullPage: true });
        await page.screenshot({ path: path.join(OUT, `${name}-primera-pantalla.png`) });
        // Medidas: posición de lo prioritario y largo de línea de los textos
        const m = await page.evaluate(() => {
          const top = (re) => {
            const el = [...document.querySelectorAll("h2, button, p")].find((e) => re.test(e.textContent || ""));
            return el ? Math.round(el.getBoundingClientRect().top + scrollY) : null;
          };
          const main = document.querySelector("main");
          return {
            ancho_contenido: main ? Math.round(main.getBoundingClientRect().width) : null,
            y_proxima_cita: top(/^Tu próxima cita$/),
            y_reservar: top(/Reservar una cita/),
            y_pagos: top(/^Tus pagos$/),
            y_novedades: top(/novedad(es)? sin leer/),
            scroll_horizontal: document.documentElement.scrollWidth > innerWidth,
            alto_total: document.documentElement.scrollHeight,
          };
        });
        report.push({ name, ...m, errores: errors.length });
        await ctx.close();
      }
    }
  } finally {
    await browser.close();
    vite.kill("SIGTERM");
  }
  console.table(report);
}

main().catch((e) => { console.error(e); process.exit(1); });
