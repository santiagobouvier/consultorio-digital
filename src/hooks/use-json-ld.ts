import { useEffect } from "react";

/**
 * Inyecta un bloque JSON-LD en el <head> mientras el componente está montado.
 * `id` identifica el script para poder reemplazarlo/limpiarlo.
 */
export function useJsonLd(id: string, data: unknown | null) {
  useEffect(() => {
    if (!data) return;
    let el = document.head.querySelector<HTMLScriptElement>(`script[data-jsonld="${id}"]`);
    if (!el) {
      el = document.createElement("script");
      el.type = "application/ld+json";
      el.setAttribute("data-jsonld", id);
      document.head.appendChild(el);
    }
    el.textContent = JSON.stringify(data);
    return () => {
      el?.remove();
    };
  }, [id, data]);
}
