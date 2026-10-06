// Prueba de punta a punta de /reset-password con supabase-js REAL contra un
// Supabase SIMULADO local (sin red, sin cuentas, sin correos reales).
//
// Requisitos (no son dependencias del proyecto):
//   - playwright-core resoluble (por ejemplo NODE_PATH=<carpeta>/node_modules)
//   - Chromium (PW_CHROMIUM=/ruta/al/chromium; por defecto /opt/pw-browsers/chromium)
// Uso:  NODE_PATH=... node tests/e2e/reset-password.e2e.mjs
// Levanta su propio Vite en 127.0.0.1:5200 apuntando al Supabase simulado.
import http from "node:http";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const ROOT = fileURLToPath(new URL("../../", import.meta.url));
const require = createRequire(import.meta.url);
let chromium;
try {
  ({ chromium } = require("playwright-core"));
} catch {
  console.error("Falta playwright-core (usá NODE_PATH apuntando a un node_modules que lo tenga).");
  process.exit(2);
}

const MOCK_PORT = 54399;
const APP_PORT = 5200;
const APP = `http://127.0.0.1:${APP_PORT}`;
const b64url = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");
const now = () => Math.floor(Date.now() / 1000);
const fakeJwt = (sub, email, role = "authenticated") =>
  `${b64url({ alg: "HS256", typ: "JWT" })}.${b64url({ sub, email, role, aud: "authenticated", iat: now(), exp: now() + 3600 })}.firma-de-prueba`;

const USERS = {
  patient: { id: "00000000-0000-4000-8000-0000000000a1", email: "paciente.qa@example.test" },
  pro: { id: "00000000-0000-4000-8000-0000000000b1", email: "profesional.qa@example.test" },
};
for (const u of Object.values(USERS)) u.token = fakeJwt(u.id, u.email);
const byToken = (auth) => Object.values(USERS).find((u) => auth === `Bearer ${u.token}`) || null;
const userJson = (u) => ({ id: u.id, aud: "authenticated", role: "authenticated", email: u.email, app_metadata: {}, user_metadata: {}, created_at: "2026-09-22T00:00:00Z" });

// Registro de lo que pidió la app (nunca se guardan contraseñas: solo su largo)
const log = { passwordUpdates: [], recover: [], verify: [] };

const mock = http.createServer(async (req, res) => {
  const cors = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "*",
    "Access-Control-Allow-Methods": "GET,POST,PUT,PATCH,DELETE,OPTIONS",
  };
  const send = (status, body) => {
    res.writeHead(status, { ...cors, "Content-Type": "application/json" });
    res.end(body === undefined ? "" : JSON.stringify(body));
  };
  if (req.method === "OPTIONS") return send(204);
  let raw = "";
  for await (const c of req) raw += c;
  const body = raw ? JSON.parse(raw) : {};
  const url = new URL(req.url, `http://127.0.0.1:${MOCK_PORT}`);
  const who = byToken(req.headers.authorization);

  if (url.pathname === "/auth/v1/user" && req.method === "GET") {
    return who ? send(200, userJson(who)) : send(401, { code: "bad_jwt", message: "invalid JWT" });
  }
  if (url.pathname === "/auth/v1/user" && req.method === "PUT") {
    if (!who) return send(403, { code: "session_not_found", message: "Auth session missing!" });
    log.passwordUpdates.push({ user: who.id, length: String(body.password || "").length });
    return send(200, userJson(who));
  }
  if (url.pathname === "/auth/v1/verify" && req.method === "POST") {
    log.verify.push({ type: body.type, ok: body.token_hash === "hash-ok" });
    if (body.type === "recovery" && body.token_hash === "hash-ok") {
      const u = USERS.patient;
      return send(200, { access_token: u.token, token_type: "bearer", expires_in: 3600, expires_at: now() + 3600, refresh_token: "r-ok", user: userJson(u) });
    }
    return send(403, { code: "otp_expired", error_code: "otp_expired", msg: "Token has expired or is invalid" });
  }
  if (url.pathname === "/auth/v1/recover" && req.method === "POST") {
    log.recover.push({ email: body.email, redirectTo: url.searchParams.get("redirect_to") });
    return send(200, {});
  }
  if (url.pathname === "/auth/v1/token") return send(400, { code: "refresh_token_not_found", message: "no" });
  if (url.pathname === "/auth/v1/logout") return send(204);
  if (url.pathname === "/rest/v1/rpc/is_super_admin") return send(200, false);
  if (url.pathname === "/rest/v1/user_roles") {
    return send(200, who === USERS.pro ? [{ role: "owner" }] : who === USERS.patient ? [{ role: "patient" }] : []);
  }
  if (url.pathname === "/rest/v1/businesses") return send(200, who === USERS.pro ? [{ id: "biz-qa" }] : []);
  if (url.pathname.startsWith("/rest/v1/rpc/")) return send(200, null);
  if (url.pathname.startsWith("/rest/v1/")) return send(200, []);
  if (url.pathname === "/functions/v1/public-patient-lookup") {
    if (!who) return send(401, { error: "unauthorized" });
    return send(200, { clinics: who === USERS.patient ? [{ slug: "qa-psico", name: "QA Psicología", specialty: null, logo_url: null }] : [] });
  }
  return send(404, { message: "no simulado" });
});

const results = [];
const check = (cond, msg) => {
  results.push({ ok: !!cond, msg });
  console.log(`${cond ? "OK  " : "FALLA"} ${msg}`);
};

async function main() {
  await new Promise((r) => mock.listen(MOCK_PORT, "127.0.0.1", r));
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
    const open = async (path) => {
      const ctx = await browser.newContext();
      const page = await ctx.newPage();
      await page.goto(`${APP}${path}`);
      return { ctx, page };
    };
    const implicitLink = (u) =>
      `/reset-password#access_token=${u.token}&refresh_token=r-${u.id.slice(-2)}&expires_in=3600&expires_at=${now() + 3600}&token_type=bearer&type=recovery`;
    const fillAndSave = async (page) => {
      await page.fill("#password", "clave-qa-nueva-1");
      await page.fill("#confirmPassword", "clave-qa-nueva-1");
      await page.click('button[type="submit"]');
    };

    // 1) Paciente con enlace válido: establece sesión, guarda y vuelve a SU portal
    {
      const { ctx, page } = await open(implicitLink(USERS.patient));
      await page.waitForSelector('[data-testid="reset-form"]', { timeout: 15000 });
      check(!page.url().includes("access_token"), "enlace válido: los tokens se borran de la barra de direcciones");
      check(await page.getByText(USERS.patient.email).isVisible(), "enlace válido: muestra a qué cuenta se le cambia la contraseña");
      const before = log.passwordUpdates.length;
      await fillAndSave(page);
      await page.waitForSelector('[data-testid="reset-success"]', { timeout: 15000 });
      check(log.passwordUpdates.length === before + 1 && log.passwordUpdates.at(-1).user === USERS.patient.id,
        "paciente: la contraseña se guarda una vez, en su propia cuenta");
      await page.waitForURL(`${APP}/portal/qa-psico`, { timeout: 8000 }).catch(() => {});
      check(new URL(page.url()).pathname === "/portal/qa-psico", "paciente: vuelve a su portal (/portal/qa-psico)");
      await ctx.close();
    }

    // 2) Profesional con enlace válido: vuelve a su panel
    {
      const { ctx, page } = await open(implicitLink(USERS.pro));
      await page.waitForSelector('[data-testid="reset-form"]', { timeout: 15000 });
      await fillAndSave(page);
      await page.waitForSelector('[data-testid="reset-success"]', { timeout: 15000 });
      await page.waitForURL(`${APP}/dashboard`, { timeout: 8000 }).catch(() => {});
      check(new URL(page.url()).pathname === "/dashboard", "profesional: vuelve a su panel (/dashboard)");
      await ctx.close();
    }

    // 3) Enlace vencido o ya usado: no muestra el formulario ni intenta guardar; permite pedir otro
    {
      const before = log.passwordUpdates.length;
      const { ctx, page } = await open("/reset-password#error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired");
      await page.waitForSelector('[data-testid="reset-failed-expired"]', { timeout: 15000 });
      check(!(await page.locator('[data-testid="reset-form"]').count()), "vencido: no muestra el formulario");
      check(log.passwordUpdates.length === before, "vencido: no intenta guardar (sin 'Auth session missing')");
      await page.fill("#resetEmail", "cualquiera@example.test");
      await page.click('button:has-text("Pedir un enlace nuevo")');
      await page.waitForSelector('[role="status"]', { timeout: 8000 });
      const last = log.recover.at(-1);
      check(last && last.redirectTo === `${APP}/reset-password`, "vencido: pide un enlace nuevo que vuelve a /reset-password");
      check(await page.getByText("Si ese email tiene una cuenta").isVisible(), "vencido: mensaje genérico (no revela si el email existe)");
      await ctx.close();
    }

    // 4) Sin enlace ni sesión
    {
      const { ctx, page } = await open("/reset-password");
      await page.waitForSelector('[data-testid="reset-failed-missing"]', { timeout: 15000 });
      check(!(await page.locator('[data-testid="reset-form"]').count()), "sin enlace: no muestra el formulario");
      await ctx.close();
    }

    // 5) Enlace con token_hash válido
    {
      const before = log.passwordUpdates.length;
      const { ctx, page } = await open("/reset-password?token_hash=hash-ok&type=recovery");
      await page.waitForSelector('[data-testid="reset-form"]', { timeout: 15000 });
      check(!page.url().includes("token_hash"), "token_hash válido: se verifica y se limpia de la URL");
      await fillAndSave(page);
      await page.waitForSelector('[data-testid="reset-success"]', { timeout: 15000 });
      check(log.passwordUpdates.length === before + 1, "token_hash válido: guarda la contraseña");
      await ctx.close();
    }

    // 6) Enlace con token_hash vencido
    {
      const { ctx, page } = await open("/reset-password?token_hash=hash-vencido&type=recovery");
      await page.waitForSelector('[data-testid="reset-failed-expired"]', { timeout: 15000 });
      check(true, "token_hash vencido: muestra 'El enlace venció o ya se usó'");
      await ctx.close();
    }

    // 7) La sesión se pierde antes de guardar (por ejemplo, se cerró en otra pestaña)
    {
      const before = log.passwordUpdates.length;
      const { ctx, page } = await open(implicitLink(USERS.patient));
      await page.waitForSelector('[data-testid="reset-form"]', { timeout: 15000 });
      await page.evaluate(() => {
        for (const k of Object.keys(localStorage)) if (k.startsWith("sb-")) localStorage.removeItem(k);
      });
      await fillAndSave(page);
      await page.waitForSelector('[data-testid="reset-failed-missing"]', { timeout: 15000 });
      check(log.passwordUpdates.length === before, "sesión perdida: no llama a guardar y explica qué hacer");
      await ctx.close();
    }

    // 8) Paciente que olvidó la contraseña desde /acceso/paciente
    {
      const { ctx, page } = await open("/acceso/paciente");
      await page.fill('input[type="email"]', "paciente.qa@example.test");
      const before = log.recover.length;
      await page.click('button:has-text("¿Olvidaste tu contraseña?")');
      await page.waitForSelector('[role="status"]', { timeout: 8000 });
      check(log.recover.length === before + 1 && log.recover.at(-1).redirectTo === `${APP}/reset-password`,
        "acceso paciente: '¿Olvidaste tu contraseña?' pide el enlace a /reset-password");
      check(await page.getByText("Si ese email tiene una cuenta").isVisible(), "acceso paciente: mensaje genérico");
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
