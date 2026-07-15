// Reporte de estadísticas en PDF dibujado de cero con jsPDF (nada de
// capturas de pantalla): portada con el color de marca, cajas de KPIs,
// gráficos de barras nativos y tablas. Nunca se corta, pesa poco y se ve
// igual de bien sin importar el tema de la app.

interface Kpis {
  totalCitas: number;
  cobrado: number;
  pendiente: number;
  noShowRate: number;
  activePatients: number;
  occupancy: number;
}

interface Trends {
  citas: number | null;
  cobrado: number | null;
  ausencias: number | null;
}

export interface StatsPdfInput {
  clinicName: string;
  periodLabel: string;
  /** HSL sin hsl(), ej: "176 100% 32%" */
  primaryColor: string;
  kpis: Kpis;
  trends: Trends | null;
  monthProjection: { cobrado: number; porCobrar: number; total: number };
  collectionDelay: number | null;
  sourceData: { panel: number; publica: number; portal: number; total: number };
  weekdayData: { day: string; count: number }[];
  revenueData: { month: string; cobrado: number; pendiente: number }[];
  noShowData: { month: string; total: number; noShow: number; rate: number }[];
  professionalRows: { name: string; citas: number; noShowRate: number }[];
  inactivePatients: { full_name: string; daysSinceLast: number }[];
  fileName: string;
}

const PAGE_W = 210;
const PAGE_H = 297;
const MARGIN = 14;
const CONTENT_W = PAGE_W - MARGIN * 2;
const BOTTOM = PAGE_H - 16;

const GRAY_TEXT: [number, number, number] = [90, 96, 104];
const GRAY_LIGHT: [number, number, number] = [235, 238, 241];
const GRAY_BORDER: [number, number, number] = [214, 219, 225];
const INK: [number, number, number] = [24, 30, 37];

const money = (n: number) => `$ ${Math.round(n).toLocaleString("es-UY")}`;

const hslToRgb = (hsl: string): [number, number, number] => {
  const parts = hsl.trim().split(/\s+/);
  const h = parseFloat(parts[0] ?? "176");
  const s = parseFloat(parts[1] ?? "100") / 100;
  const l = parseFloat(parts[2] ?? "32") / 100;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => {
    const k = (n + h / 30) % 12;
    return Math.round(255 * (l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1)));
  };
  return [f(0), f(8), f(4)];
};

export async function buildStatisticsPdf(input: StatsPdfInput) {
  const { default: jsPDF } = await import("jspdf");
  const pdf = new jsPDF("p", "mm", "a4");
  const brand = hslToRgb(input.primaryColor);
  let y = 0;

  const ensure = (needed: number) => {
    if (y + needed > BOTTOM) {
      pdf.addPage();
      y = MARGIN;
    }
  };

  // ── Portada / encabezado ──
  pdf.setFillColor(...brand);
  pdf.rect(0, 0, PAGE_W, 30, "F");
  pdf.setTextColor(255, 255, 255);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(17);
  pdf.text("Reporte de estadísticas", MARGIN, 13);
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(10);
  pdf.text(input.clinicName, MARGIN, 20);
  pdf.setFontSize(9);
  const genLabel = `Generado el ${new Date().toLocaleDateString("es-UY")}`;
  pdf.text(`Período: ${input.periodLabel}`, PAGE_W - MARGIN, 13, { align: "right" });
  pdf.text(genLabel, PAGE_W - MARGIN, 20, { align: "right" });
  y = 40;

  const sectionTitle = (title: string) => {
    y += 3;
    ensure(14);
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(10.5);
    pdf.setTextColor(...INK);
    pdf.text(title.toUpperCase(), MARGIN, y);
    pdf.setDrawColor(...brand);
    pdf.setLineWidth(0.8);
    pdf.line(MARGIN, y + 1.6, MARGIN + 12, y + 1.6);
    y += 7;
  };

  const kpiBox = (
    x: number,
    w: number,
    label: string,
    value: string,
    sub?: string | null,
    valueColor: [number, number, number] = INK,
  ) => {
    const h = 20;
    pdf.setDrawColor(...GRAY_BORDER);
    pdf.setFillColor(250, 251, 252);
    pdf.roundedRect(x, y, w, h, 2, 2, "FD");
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(7.5);
    pdf.setTextColor(...GRAY_TEXT);
    pdf.text(label, x + 4, y + 6);
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(13);
    pdf.setTextColor(...valueColor);
    pdf.text(value, x + 4, y + 13.5);
    if (sub) {
      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(7);
      pdf.setTextColor(...GRAY_TEXT);
      pdf.text(sub, x + 4, y + 17.8);
    }
  };

  const trendLabel = (v: number | null | undefined, suffix = "%") =>
    v === null || v === undefined ? null : `${v > 0 ? "+" : ""}${v}${suffix} vs período anterior`;

  // ── Cobros ──
  sectionTitle("Cobros");
  ensure(24);
  {
    const gap = 4;
    const w = (CONTENT_W - gap * 2) / 3;
    const rate =
      input.kpis.cobrado + input.kpis.pendiente > 0
        ? Math.round((input.kpis.cobrado / (input.kpis.cobrado + input.kpis.pendiente)) * 100)
        : 0;
    kpiBox(MARGIN, w, "Cobrado en el período", money(input.kpis.cobrado), trendLabel(input.trends?.cobrado), brand);
    kpiBox(MARGIN + w + gap, w, "Pendiente de cobro", money(input.kpis.pendiente), null, [180, 120, 20]);
    kpiBox(MARGIN + (w + gap) * 2, w, "Tasa de cobranza", `${rate}%`);
    y += 26;
  }

  // ── Actividad ──
  sectionTitle("Actividad");
  ensure(24);
  {
    const gap = 4;
    const w = (CONTENT_W - gap * 3) / 4;
    kpiBox(MARGIN, w, "Citas", String(input.kpis.totalCitas), trendLabel(input.trends?.citas));
    kpiBox(MARGIN + w + gap, w, "Pacientes activos", String(input.kpis.activePatients));
    kpiBox(MARGIN + (w + gap) * 2, w, "Ocupación", `${input.kpis.occupancy}%`);
    kpiBox(
      MARGIN + (w + gap) * 3,
      w,
      "Ausencias",
      `${input.kpis.noShowRate}%`,
      trendLabel(input.trends?.ausencias, " pts"),
      [200, 60, 60],
    );
    y += 24;
  }

  // ── Este mes / demora / origen ──
  ensure(26);
  {
    const gap = 4;
    const w = (CONTENT_W - gap * 2) / 3;
    kpiBox(
      MARGIN,
      w,
      "Proyección de este mes",
      money(input.monthProjection.total),
      `${money(input.monthProjection.cobrado)} cobrado + ${money(input.monthProjection.porCobrar)} por cobrar`,
    );
    kpiBox(
      MARGIN + w + gap,
      w,
      "Demora promedio de cobro",
      input.collectionDelay === null ? "—" : `${input.collectionDelay} días`,
      "entre vencimiento y pago",
    );
    const src = input.sourceData;
    kpiBox(
      MARGIN + (w + gap) * 2,
      w,
      "Origen de las reservas",
      `${src.total} citas`,
      `Panel ${src.panel} · Web ${src.publica} · Portal ${src.portal}`,
    );
    y += 26;
  }

  // ── Gráfico de barras genérico ──
  const barChart = (
    title: string,
    items: { label: string; a: number; b?: number }[],
    opts: { money?: boolean; legendA?: string; legendB?: string } = {},
  ) => {
    if (!items.length) return;
    const chartH = 38;
    const labelsH = 6;
    ensure(10 + chartH + labelsH + (opts.legendA ? 6 : 0));
    sectionTitle(title);

    const max = Math.max(...items.map((i) => Math.max(i.a, i.b ?? 0)), 1);
    const slot = CONTENT_W / items.length;
    const grouped = items.some((i) => i.b !== undefined);
    const barW = Math.min(grouped ? slot / 2 - 2 : slot - 4, 14);
    const baseY = y + chartH;

    pdf.setDrawColor(...GRAY_BORDER);
    pdf.setLineWidth(0.2);
    pdf.line(MARGIN, baseY, MARGIN + CONTENT_W, baseY);

    items.forEach((it, idx) => {
      const cx = MARGIN + slot * idx + slot / 2;
      const hA = (it.a / max) * (chartH - 8);
      const xA = grouped ? cx - barW - 0.6 : cx - barW / 2;
      pdf.setFillColor(...brand);
      if (hA > 0) pdf.roundedRect(xA, baseY - hA, barW, hA, 0.8, 0.8, "F");
      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(6.3);
      pdf.setTextColor(...GRAY_TEXT);
      const valA = opts.money ? `$${Math.round(it.a / 1000)}k` : String(it.a);
      if (it.a > 0) pdf.text(valA, xA + barW / 2, baseY - hA - 1.2, { align: "center" });

      if (it.b !== undefined) {
        const hB = (it.b / max) * (chartH - 8);
        const xB = cx + 0.6;
        pdf.setFillColor(...GRAY_LIGHT);
        pdf.setDrawColor(...GRAY_BORDER);
        if (hB > 0) pdf.roundedRect(xB, baseY - hB, barW, hB, 0.8, 0.8, "FD");
        const valB = opts.money ? `$${Math.round(it.b / 1000)}k` : String(it.b);
        if (it.b > 0) pdf.text(valB, xB + barW / 2, baseY - hB - 1.2, { align: "center" });
      }

      pdf.setFontSize(7);
      pdf.setTextColor(...INK);
      pdf.text(it.label, cx, baseY + 4, { align: "center", maxWidth: slot - 1 });
    });

    y = baseY + labelsH + 2;

    if (opts.legendA) {
      pdf.setFontSize(7);
      pdf.setFillColor(...brand);
      pdf.rect(MARGIN, y - 2.2, 2.6, 2.6, "F");
      pdf.setTextColor(...GRAY_TEXT);
      pdf.text(opts.legendA, MARGIN + 4, y);
      if (opts.legendB) {
        const off = MARGIN + 4 + pdf.getTextWidth(opts.legendA) + 8;
        pdf.setFillColor(...GRAY_LIGHT);
        pdf.setDrawColor(...GRAY_BORDER);
        pdf.rect(off - 4, y - 2.2, 2.6, 2.6, "FD");
        pdf.text(opts.legendB, off, y);
      }
      y += 6;
    }
    y += 4;
  };

  const revenueItems = input.revenueData.slice(-12).map((r) => ({
    label: r.month,
    a: r.cobrado,
    b: r.pendiente,
  }));
  barChart("Ingresos por mes", revenueItems, { money: true, legendA: "Cobrado", legendB: "Pendiente" });

  barChart(
    "Citas por día de la semana",
    input.weekdayData.map((w) => ({ label: w.day, a: w.count })),
  );

  // ── Tabla genérica ──
  const table = (title: string, header: string[], widths: number[], rows: string[][]) => {
    if (!rows.length) return;
    sectionTitle(title);
    const rowH = 7;
    const drawHeader = () => {
      ensure(rowH * 2);
      pdf.setFillColor(...brand);
      pdf.rect(MARGIN, y, CONTENT_W, rowH, "F");
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(8);
      pdf.setTextColor(255, 255, 255);
      let x = MARGIN;
      header.forEach((h, i) => {
        pdf.text(h, x + 2.5, y + 4.8);
        x += widths[i];
      });
      y += rowH;
    };
    drawHeader();
    rows.forEach((row, ri) => {
      if (y + rowH > BOTTOM) {
        pdf.addPage();
        y = MARGIN;
        drawHeader();
      }
      if (ri % 2 === 1) {
        pdf.setFillColor(248, 249, 251);
        pdf.rect(MARGIN, y, CONTENT_W, rowH, "F");
      }
      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(8);
      pdf.setTextColor(...INK);
      let x = MARGIN;
      row.forEach((cell, i) => {
        pdf.text(cell, x + 2.5, y + 4.8, { maxWidth: widths[i] - 5 });
        x += widths[i];
      });
      y += rowH;
    });
    pdf.setDrawColor(...GRAY_BORDER);
    pdf.setLineWidth(0.2);
    pdf.line(MARGIN, y, MARGIN + CONTENT_W, y);
    y += 8;
  };

  table(
    "Ausencias por mes",
    ["Mes", "Citas", "Ausencias", "Tasa"],
    [CONTENT_W - 90, 30, 30, 30],
    input.noShowData.slice(-12).map((n) => [n.month, String(n.total), String(n.noShow), `${n.rate}%`]),
  );

  if (input.professionalRows.length > 1) {
    table(
      "Por profesional",
      ["Profesional", "Citas", "Ausencias"],
      [CONTENT_W - 60, 30, 30],
      input.professionalRows.map((p) => [p.name, String(p.citas), `${p.noShowRate}%`]),
    );
  }

  table(
    "Pacientes activos sin próxima cita",
    ["Paciente", "Sin venir hace"],
    [CONTENT_W - 45, 45],
    input.inactivePatients
      .slice(0, 12)
      .map((p) => [p.full_name, p.daysSinceLast === 9999 ? "Nunca tuvo cita" : `${p.daysSinceLast} días`]),
  );

  // ── Pie de página ──
  const pages = pdf.getNumberOfPages();
  for (let i = 1; i <= pages; i++) {
    pdf.setPage(i);
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(7.5);
    pdf.setTextColor(...GRAY_TEXT);
    pdf.text(`${input.clinicName} · ${genLabel}`, MARGIN, PAGE_H - 8);
    pdf.text(`Página ${i} de ${pages}`, PAGE_W - MARGIN, PAGE_H - 8, { align: "right" });
  }

  pdf.save(input.fileName);
}
