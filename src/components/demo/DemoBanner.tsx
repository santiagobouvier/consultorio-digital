// Barra superior para las pantallas de simulación: aclara que es demo (nada se
// guarda) y permite volver al hub de bloques. Estética clara, como la landing.
import { Link } from "react-router-dom";
import { ArrowLeft, Sparkles } from "lucide-react";

export function DemoBanner() {
  return (
    <div
      className="sticky top-0 z-50 flex items-center justify-between gap-3 px-4 py-2.5"
      style={{
        backgroundColor: "rgba(251,250,247,0.88)",
        borderBottom: "1px solid rgba(22,33,28,0.08)",
        backdropFilter: "blur(12px)",
        WebkitBackdropFilter: "blur(12px)",
      }}
    >
      <Link
        to="/demo"
        className="inline-flex items-center gap-2 text-sm font-medium transition-opacity hover:opacity-70"
        style={{ color: "#5b6a63" }}
      >
        <ArrowLeft className="w-4 h-4" /> Volver a la demo
      </Link>
      <span
        className="inline-flex items-center gap-1.5 text-[11px] sm:text-xs font-semibold px-2.5 py-1 rounded-full"
        style={{ backgroundColor: "rgba(31,147,141,0.1)", color: "#14655f" }}
      >
        <Sparkles className="w-3.5 h-3.5" /> Modo demo · los cambios no se guardan
      </span>
    </div>
  );
}
