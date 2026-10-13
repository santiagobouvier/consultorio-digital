// Indicador fijo del modo capturas: deja claro que lo que se ve es ficticio
// y permite salir en un toque. "Ocultar" lo esconde unos segundos para sacar
// la captura limpia y vuelve solo.
import { useEffect, useState } from "react";
import { Camera, EyeOff, LogOut } from "lucide-react";
import { isShowcaseActive } from "@/lib/showcase/session";
import { leaveShowcase } from "@/lib/showcase/runtime";

const HIDE_MS = 15_000;

export function ShowcaseBanner() {
  const active = isShowcaseActive();
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    if (!hidden) return;
    const t = window.setTimeout(() => setHidden(false), HIDE_MS);
    return () => window.clearTimeout(t);
  }, [hidden]);

  if (!active || hidden) return null;
  return (
    <div
      role="status"
      data-testid="showcase-banner"
      className="fixed left-1/2 top-2 z-[2147483000] flex -translate-x-1/2 items-center gap-1.5 whitespace-nowrap rounded-full border border-amber-300 bg-amber-50 px-3 py-1.5 text-xs font-medium text-amber-900 shadow-lg dark:border-amber-700 dark:bg-amber-950 dark:text-amber-100"
    >
      <Camera className="h-3.5 w-3.5 shrink-0" aria-hidden />
      <span className="whitespace-nowrap">
        <span className="sm:hidden">Capturas</span>
        <span className="hidden sm:inline">Modo capturas · datos ficticios · nada se guarda ni se envía</span>
      </span>
      <button
        type="button"
        onClick={() => setHidden(true)}
        className="ml-1 inline-flex items-center gap-1 rounded-full px-2 py-0.5 hover:bg-amber-100 dark:hover:bg-amber-900"
        title="Ocultar 15 segundos para la captura"
      >
        <EyeOff className="h-3.5 w-3.5" aria-hidden />
        <span className="hidden sm:inline">Ocultar</span>
      </button>
      <button
        type="button"
        data-testid="showcase-exit"
        onClick={leaveShowcase}
        className="inline-flex items-center gap-1 rounded-full bg-amber-900 px-2.5 py-0.5 text-amber-50 hover:bg-amber-800 dark:bg-amber-200 dark:text-amber-950"
      >
        <LogOut className="h-3.5 w-3.5" aria-hidden />
        Salir
      </button>
    </div>
  );
}
