import { toast } from "@/hooks/use-toast";

/**
 * Exports data as a CSV file with UTF-8 BOM and semicolon separator.
 * Compatible with Excel in Spanish.
 */
export function exportCSV(
  headers: string[],
  rows: string[][],
  filename: string
) {
  if (rows.length === 0) {
    toast({
      title: "Sin datos",
      description: "No hay datos para exportar",
    });
    return;
  }

  const BOM = "\uFEFF";
  const csvContent =
    BOM +
    [headers.join(";"), ...rows.map((row) => row.map(escapeCSV).join(";"))].join(
      "\r\n"
    );

  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);

  toast({
    title: "Exportación exitosa",
    description: `Se descargó ${filename}`,
  });
}

function escapeCSV(value: string): string {
  if (value.includes(";") || value.includes('"') || value.includes("\n")) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export function todayDateString(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
