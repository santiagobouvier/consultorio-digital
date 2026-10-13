// Textos de fechas en español.
//
// En español solo va en mayúscula la primera letra: "Lunes 19 de octubre",
// no "Lunes 19 De Octubre" (que es lo que hace la clase CSS `capitalize`,
// palabra por palabra). Para fechas de varias palabras usar capitalizeFirst
// en vez de `capitalize`.

/** Primera letra en mayúscula; el resto queda como viene. */
export function capitalizeFirst(text: string): string {
  return text ? text.charAt(0).toUpperCase() + text.slice(1) : text;
}

/**
 * Fecha sin hora ("2026-10-04", columnas `date` de Postgres) como día LOCAL.
 * `new Date("2026-10-04")` la toma como medianoche UTC, que en Uruguay
 * (UTC-3) es el día anterior a las 21:00.
 */
export function parseDateOnly(value: string): Date {
  const [y, m, d] = value.slice(0, 10).split("-").map(Number);
  return new Date(y, m - 1, d);
}
