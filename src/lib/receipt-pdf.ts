import { jsPDF } from "jspdf";
import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import { formatCurrency, PAYMENT_METHODS } from "@/lib/payments";

export interface ReceiptInput {
  payment: {
    id: string;
    amount: number;
    currency: string;
    paid_at: string | null;
    due_date: string;
    method: string | null;
    notes: string | null;
  };
  patient: {
    full_name: string;
    email?: string | null;
  };
  clinic: {
    name: string;
    specialty?: string;
    logoUrl?: string;
    contactEmail?: string;
  };
}

export function buildReceiptNumber(paymentId: string): string {
  return `CD-${paymentId.replace(/-/g, "").slice(0, 8).toUpperCase()}`;
}

function methodLabel(method: string | null): string {
  if (!method) return "—";
  const normalized = method === "mercadopago" ? "mercado_pago" : method;
  const found = PAYMENT_METHODS.find((m) => m.value === normalized);
  return found?.label || method;
}

async function loadImageAsDataURL(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, { mode: "cors" });
    const blob = await res.blob();
    return await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

export async function downloadReceiptPdf(input: ReceiptInput): Promise<void> {
  const { payment, patient, clinic } = input;
  const receiptNumber = buildReceiptNumber(payment.id);
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 18;

  // Header: optional logo + clinic name
  let cursorY = margin;
  if (clinic.logoUrl) {
    const dataUrl = await loadImageAsDataURL(clinic.logoUrl);
    if (dataUrl) {
      try {
        doc.addImage(dataUrl, "PNG", margin, cursorY, 22, 22, undefined, "FAST");
      } catch {
        // ignore image errors
      }
    }
  }

  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text(clinic.name, margin + 28, cursorY + 9);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(110);
  if (clinic.specialty) doc.text(clinic.specialty, margin + 28, cursorY + 15);
  if (clinic.contactEmail) doc.text(clinic.contactEmail, margin + 28, cursorY + 20);

  // Title block right
  doc.setTextColor(20);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.text("COMPROBANTE DE PAGO", pageWidth - margin, cursorY + 9, { align: "right" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(110);
  doc.text(`N.º ${receiptNumber}`, pageWidth - margin, cursorY + 15, { align: "right" });
  const issuedAt = payment.paid_at ? parseISO(payment.paid_at) : new Date();
  doc.text(
    `Emitido: ${format(issuedAt, "d 'de' MMMM yyyy", { locale: es })}`,
    pageWidth - margin,
    cursorY + 20,
    { align: "right" },
  );

  cursorY += 32;
  doc.setDrawColor(220);
  doc.line(margin, cursorY, pageWidth - margin, cursorY);
  cursorY += 8;

  // Patient block
  doc.setTextColor(20);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text("Paciente", margin, cursorY);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  doc.text(patient.full_name, margin, cursorY + 6);
  if (patient.email) {
    doc.setFontSize(10);
    doc.setTextColor(110);
    doc.text(patient.email, margin, cursorY + 11);
  }

  cursorY += 22;

  // Detail card
  doc.setDrawColor(220);
  doc.setFillColor(248, 250, 252);
  doc.roundedRect(margin, cursorY, pageWidth - margin * 2, 56, 3, 3, "FD");

  const detailX = margin + 6;
  let dy = cursorY + 10;

  const addRow = (label: string, value: string, opts?: { bold?: boolean; size?: number }) => {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(120);
    doc.text(label.toUpperCase(), detailX, dy);
    doc.setFont("helvetica", opts?.bold ? "bold" : "normal");
    doc.setFontSize(opts?.size ?? 11);
    doc.setTextColor(20);
    doc.text(value, detailX, dy + 5);
    dy += 13;
  };

  addRow("Concepto", payment.notes?.trim() || "Pago de sesión");
  addRow(
    "Fecha de pago",
    payment.paid_at
      ? format(parseISO(payment.paid_at), "d 'de' MMMM yyyy", { locale: es })
      : "—",
  );
  addRow("Método", methodLabel(payment.method));

  // Amount big at right
  doc.setFont("helvetica", "bold");
  doc.setFontSize(20);
  doc.setTextColor(20);
  doc.text(
    formatCurrency(Number(payment.amount), payment.currency || "UYU"),
    pageWidth - margin - 6,
    cursorY + 22,
    { align: "right" },
  );
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(120);
  doc.text("MONTO PAGADO", pageWidth - margin - 6, cursorY + 14, { align: "right" });

  cursorY += 64;

  // Footer note
  doc.setFont("helvetica", "italic");
  doc.setFontSize(9);
  doc.setTextColor(140);
  const footerLines = [
    "Este comprobante es generado automáticamente por el sistema del consultorio.",
    `Número de referencia: ${receiptNumber} · ID interno: ${payment.id}`,
  ];
  footerLines.forEach((line, i) => {
    doc.text(line, margin, cursorY + 6 + i * 5);
  });

  doc.save(`comprobante-${receiptNumber}.pdf`);
}