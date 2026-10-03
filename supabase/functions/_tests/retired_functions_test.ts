// Regresión de funciones retiradas (CD-002 y siguientes).
// Corre con `npm run test:functions` (node:test). Lee el repo; no toca red,
// base de datos ni producción.
//
// Garantiza que una función retirada no vuelva por accidente y que nada del
// repo dependa de ella: ni su carpeta, ni su entrada en config.toml, ni
// llamadas desde el frontend, otras funciones, scripts o migraciones.
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("../../../", import.meta.url));
const THIS_FILE = fileURLToPath(import.meta.url);

// Retiradas: nombre de la función y textos que solo existían por ella.
const RETIRED: { name: string; markers: string[] }[] = [
  {
    name: "setup-demo-user",
    // Cuenta demo vieja y su secreto: nada del código debe depender de ellos.
    markers: ["setup-demo-user", "demo@consultorio.app", "DEMO_USER_PASSWORD"],
  },
];

const SCAN_DIRS = ["src", "supabase", "scripts", "public", "index.html"];
const SCAN_EXT = /\.(ts|tsx|js|mjs|cjs|json|toml|sql|html|md)$/;

function walk(path: string, out: string[] = []): string[] {
  if (!existsSync(path)) return out;
  const st = statSync(path);
  if (st.isFile()) {
    if (SCAN_EXT.test(path)) out.push(path);
    return out;
  }
  for (const entry of readdirSync(path)) {
    if (entry === "node_modules" || entry === "dist" || entry.startsWith(".")) continue;
    walk(join(path, entry), out);
  }
  return out;
}

const configToml = readFileSync(join(ROOT, "supabase/config.toml"), "utf8");
const configuredFunctions = [...configToml.matchAll(/^\[functions\.([a-z0-9-]+)\]/gm)].map((m) => m[1]);

for (const { name, markers } of RETIRED) {
  test(`${name}: no existe la carpeta de la función`, () => {
    assert.equal(existsSync(join(ROOT, "supabase/functions", name)), false);
  });

  test(`${name}: no tiene entrada en supabase/config.toml`, () => {
    assert.ok(!configuredFunctions.includes(name), `config.toml todavía declara [functions.${name}]`);
  });

  test(`${name}: ningún archivo del repo la usa ni depende de su cuenta/secreto`, () => {
    const files = SCAN_DIRS.flatMap((d) => walk(join(ROOT, d))).filter(
      (f) => f !== THIS_FILE && !f.endsWith("RETIRADAS.md"),
    );
    const hits: string[] = [];
    for (const file of files) {
      const text = readFileSync(file, "utf8");
      for (const marker of markers) {
        if (text.includes(marker)) hits.push(`${relative(ROOT, file)} → "${marker}"`);
      }
    }
    assert.deepEqual(hits, []);
  });
}

test("config.toml no declara funciones sin código (entradas huérfanas)", () => {
  const orphans = configuredFunctions.filter(
    (fn) => !existsSync(join(ROOT, "supabase/functions", fn, "index.ts")),
  );
  assert.deepEqual(orphans, []);
});

test("el resto de las funciones públicas sigue declarado (no se borró de más)", () => {
  for (const fn of [
    "public-get-available-starts",
    "public-book-appointment",
    "get-clinic-manifest",
    "mercadopago-webhook",
    "send-resend-email",
    "calendar-feed",
    "google-oauth-callback",
  ]) {
    assert.ok(configuredFunctions.includes(fn), `falta [functions.${fn}]`);
    assert.ok(existsSync(join(ROOT, "supabase/functions", fn, "index.ts")), `falta el código de ${fn}`);
  }
});
