// Fechas en español: mayúscula solo al inicio y fechas sin hora como día local.
// npm run test:unit
process.env.TZ = "America/Montevideo"; // antes de crear cualquier Date
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { capitalizeFirst, parseDateOnly } from "../../src/lib/date-text.ts";

const ROOT = fileURLToPath(new URL("../../", import.meta.url));
const src = (rel: string) => readFileSync(path.join(ROOT, rel), "utf8");
const LARGA = "EEEE d 'de' MMMM yyyy";

test("capitalizeFirst: solo la primera letra", () => {
  assert.equal(capitalizeFirst("lunes 19 de octubre"), "Lunes 19 de octubre");
  assert.equal(capitalizeFirst("mié 7 oct · 10:00"), "Mié 7 oct · 10:00");
  assert.equal(capitalizeFirst("19 oct - 25 oct"), "19 oct - 25 oct");
  assert.equal(capitalizeFirst(""), "");
});

test("vencimiento 2026-10-04 en Uruguay: domingo 4, no sábado 3", () => {
  assert.equal(new Date().getTimezoneOffset(), 180, "la prueba corre con hora de Uruguay (UTC-3)");
  // El error de antes, para dejarlo documentado:
  assert.equal(format(new Date("2026-10-04"), LARGA, { locale: es }), "sábado 3 de octubre 2026");
  // Con la corrección:
  assert.equal(capitalizeFirst(format(parseDateOnly("2026-10-04"), LARGA, { locale: es })), "Domingo 4 de octubre 2026");
});

test("parseDateOnly da el mismo día en otras zonas y acepta un valor con hora", () => {
  const d = parseDateOnly("2026-01-01");
  assert.deepEqual([d.getFullYear(), d.getMonth(), d.getDate()], [2026, 0, 1]);
  const e = parseDateOnly("2026-12-31T00:00:00+00:00");
  assert.deepEqual([e.getFullYear(), e.getMonth(), e.getDate()], [2026, 11, 31]);
});

test("el detalle de pagos de la agenda usa parseDateOnly para el vencimiento", () => {
  const drawer = src("src/components/calendar-v2/PaymentDayDrawer.tsx");
  assert.doesNotMatch(drawer, /new Date\(payment\.due_date\)/);
  assert.match(drawer, /format\(parseDateOnly\(payment\.due_date\)/);
});

const files = (dir: string): string[] =>
  readdirSync(path.join(ROOT, dir)).flatMap((n) => {
    const rel = path.join(dir, n);
    return statSync(path.join(ROOT, rel)).isDirectory() ? files(rel) : rel.endsWith(".tsx") ? [rel] : [];
  });

test("ninguna fecha de varias palabras usa la clase capitalize (palabra por palabra)", () => {
  // Formatos con palabras en minúscula después de la primera: "d 'de' MMMM", "d MMM"
  const multiWord = /format\([^)]*"[^"]*(d 'de' MMMM|d MMM)[^"]*"/;
  // El portal lo corrige el PR #372 (whenLabel); acá queda fuera para no pisarlo
  const skip = (f: string) => /components\/portal\/PatientPortalView/.test(f);
  const offenders: string[] = [];
  for (const f of files("src").filter((f) => !skip(f) && !f.includes("components/ui/"))) {
    const lines = src(f).split("\n");
    lines.forEach((line, i) => {
      if (!/\bcapitalize\b/.test(line)) return;
      // Solo el contenido de ese elemento: hasta la línea que lo cierra
      let end = i;
      while (end < i + 6 && end < lines.length - 1 && !/<\//.test(lines[end])) end++;
      const block = lines.slice(i, end + 1).join("\n");
      if (multiWord.test(block)) offenders.push(`${f}:${i + 1}`);
    });
  }
  assert.deepEqual(offenders, []);
});

test("demo pública: fechas armadas con toLocaleDateString tampoco usan capitalize", () => {
  const rec = src("src/pages/DemoRecorrido.tsx");
  assert.match(rec, /const tomorrowEs = capitalizeFirst\(/);
  assert.doesNotMatch(rec, /capitalize"[^>]*>\{tomorrowEs\}|capitalize" style=\{\{[^}]*\}\}>\{tomorrowEs\}/);
  assert.doesNotMatch(rec, /\bcapitalize\b/);
  assert.doesNotMatch(src("src/pages/DemoExpediente.tsx"), /\bcapitalize\b/);
  assert.doesNotMatch(src("src/pages/DemoAgenda.tsx"), /\bcapitalize\b/);
});

test("textos que no son fechas tampoco se capitalizan palabra por palabra", () => {
  assert.doesNotMatch(src("src/components/calendar-v2/SlotActionSheet.tsx"), /capitalize">(Solo este|Todos los)/);
  assert.doesNotMatch(src("src/components/expediente/SessionNoteSheet.tsx"), /className="capitalize[^"]*">\{subtitleText\}/);
  assert.doesNotMatch(src("src/components/PersonalEventModal.tsx"), /truncate capitalize">\{value\}/);
  assert.match(src("src/components/desktop/DesktopDashboard.tsx"), /Sesión de \{/);
});

test("Tus documentos: sin el encabezado repetido, con la descripción y el contador", () => {
  const docs = src("src/components/portal/PortalDocuments.tsx");
  assert.doesNotMatch(docs, /Mis documentos/);
  assert.match(docs, /Todo lo que tu profesional compartió con vos/);
  assert.match(docs, /documento\{documents\.length !== 1 \? "s" : ""\}/);
  assert.match(src("src/components/portal/PatientPortalView.tsx"), /<SectionTitle>Tus documentos<\/SectionTitle>/);
});
