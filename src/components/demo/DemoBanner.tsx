// Barra superior para las pantallas de simulación: aclara que es demo (nada se
// guarda) y permite volver al hub de bloques.
import { Link } from "react-router-dom";
import { ArrowLeft, Sparkles } from "lucide-react";

export function DemoBanner() {
  return (
    <div
      className="sticky top-0 z-50 flex items-center justify-between gap-3 px-4 py-2.5 border-b border-white/10"
      style={{ backgroundColor: "rgba(10,10,10,0.85)", backdropFilter: "blur(12px)", WebkitBackdropFilter: "blur(12px)" }}
    >
      <Link to="/demo" className="inline-flex items-center gap-2 text-sm text-white/70 hover:text-white transition-colors">
        <ArrowLeft className="w-4 h-4" /> Volver a la demo
      </Link>
      <span
        className="inline-flex items-center gap-1.5 text-[11px] sm:text-xs font-medium px-2.5 py-1 rounded-full"
        style={{ backgroundColor: "rgba(0,199,138,0.12)", color: "#00c78a" }}
      >
        <Sparkles className="w-3.5 h-3.5" /> Modo demo · los cambios no se guardan
      </span>
    </div>
  );
}
