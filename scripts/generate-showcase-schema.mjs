// Genera src/lib/showcase/schema.generated.ts a partir de
// src/integrations/supabase/types.ts: columnas de cada tabla/vista y claves
// foráneas (para que el modo capturas devuelva filas con la misma forma que
// las reales y resuelva relaciones como `patients(full_name)`).
//   node scripts/generate-showcase-schema.mjs          → escribe el archivo
//   node scripts/generate-showcase-schema.mjs --check  → falla si está desactualizado
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("../", import.meta.url));
const TYPES = `${ROOT}src/integrations/supabase/types.ts`;
const OUT = `${ROOT}src/lib/showcase/schema.generated.ts`;

export function buildSchema(src) {
  const pub = src.slice(src.indexOf("  public: {"));
  const section = (name, next) => {
    const start = pub.indexOf(`    ${name}: {`);
    const end = pub.indexOf(`    ${next}: {`, start);
    return pub.slice(start, end);
  };
  const parse = (block) => {
    const out = {};
    const re = /\n {6}(\w+): \{\n {8}Row: \{\n([\s\S]*?)\n {8}\}[\s\S]*?Relationships: \[(?:\]|([\s\S]*?)\n {8}\])/g;
    for (const m of block.matchAll(re)) {
      const columns = [...m[2].matchAll(/^ {10}(\w+)\??:/gm)].map((x) => x[1]);
      const fks = [...(m[3] ?? "").matchAll(/foreignKeyName: "([^"]+)"\s*columns: \[([^\]]*)\]\s*isOneToOne: (true|false)\s*referencedRelation: "([^"]+)"/g)].map((f) => ({
        name: f[1],
        columns: [...f[2].matchAll(/"([^"]+)"/g)].map((c) => c[1]),
        oneToOne: f[3] === "true",
        ref: f[4],
      }));
      out[m[1]] = { columns, fks };
    }
    return out;
  };
  return { ...parse(section("Tables", "Views")), ...parse(section("Views", "Functions")) };
}

export function render(schema) {
  const tables = Object.keys(schema).sort();
  const lines = [
    "// GENERADO por scripts/generate-showcase-schema.mjs desde types.ts. No editar a mano.",
    "export interface ShowcaseFk { name: string; columns: string[]; oneToOne: boolean; ref: string }",
    "export const SHOWCASE_SCHEMA: Record<string, { columns: string[]; fks: ShowcaseFk[] }> = {",
  ];
  for (const t of tables) {
    const { columns, fks } = schema[t];
    // Solo claves foráneas hacia tablas (las que apuntan a vistas duplican la relación)
    const real = fks.filter((f) => !f.ref.endsWith("_public_branding"));
    lines.push(`  ${t}: {`);
    lines.push(`    columns: ${JSON.stringify(columns)},`);
    lines.push(`    fks: ${JSON.stringify(real)},`);
    lines.push("  },");
  }
  lines.push("};", "");
  return lines.join("\n");
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (isMain) {
  const text = render(buildSchema(readFileSync(TYPES, "utf8")));
  if (process.argv.includes("--check")) {
    if (readFileSync(OUT, "utf8") !== text) {
      console.error("schema.generated.ts está desactualizado: correr node scripts/generate-showcase-schema.mjs");
      process.exit(1);
    }
  } else {
    writeFileSync(OUT, text);
    console.log(`Escrito ${OUT}`);
  }
}
