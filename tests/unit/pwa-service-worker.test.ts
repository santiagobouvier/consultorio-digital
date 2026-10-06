// Un único service worker por alcance. Dos (sw.js + push-sw.js en "/") se
// reemplazaban entre sí en cada carga y recargaban sin fin a las demás
// pestañas. La prueba con navegador es tests/e2e/pwa-tabs.e2e.mjs.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("../../", import.meta.url));
const src = (rel: string) => readFileSync(path.join(ROOT, rel), "utf8");
const withoutComments = (code: string) => code.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");

const filesUnder = (dir: string): string[] =>
  readdirSync(path.join(ROOT, dir)).flatMap((name) => {
    const rel = path.join(dir, name);
    return statSync(path.join(ROOT, rel)).isDirectory() ? filesUnder(rel) : [rel];
  });

test("la app no registra service workers propios además del de Workbox", () => {
  const offenders = filesUnder("src")
    .filter((f) => /\.(ts|tsx)$/.test(f))
    .filter((f) => /serviceWorker\s*\.\s*register\s*\(/.test(withoutComments(src(f))));
  assert.deepEqual(offenders, [], "solo registerSW (virtual:pwa-register) puede registrar el service worker");
});

test("el service worker de Workbox incluye el manejo de push", () => {
  assert.match(src("vite.config.ts"), /importScripts:\s*\[\s*["']\/push-sw\.js["']\s*\]/);
});

test("push-sw.js no se activa ni toma el control por su cuenta", () => {
  const code = withoutComments(src("public/push-sw.js"));
  assert.doesNotMatch(code, /addEventListener\(\s*["']install["']/, "sin skipWaiting al instalarse");
  assert.doesNotMatch(code, /clients\.claim\s*\(/, "sin clients.claim");
  // skipWaiting solo a pedido explícito ("Actualizar")
  const skips = code.match(/skipWaiting\s*\(/g) ?? [];
  assert.equal(skips.length, 1);
  assert.match(code, /type\s*===\s*["']SKIP_WAITING["'][\s\S]{0,40}skipWaiting\(/);
});

test("push-sw.js sigue manejando push y clic en la notificación", () => {
  const code = src("public/push-sw.js");
  assert.match(code, /addEventListener\(\s*"push"/);
  assert.match(code, /addEventListener\(\s*"notificationclick"/);
});

test("las actualizaciones siguen en modo 'prompt' (sin recargas automáticas)", () => {
  const cfg = src("vite.config.ts");
  assert.match(cfg, /registerType:\s*"prompt"/);
  assert.match(cfg, /skipWaiting:\s*false/);
  assert.match(cfg, /clientsClaim:\s*false/);
});
