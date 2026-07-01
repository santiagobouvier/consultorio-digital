// Control de tema para la web pública (sin login):
// - Si el visitante nunca eligió, arranca en OSCURO (default).
// - Si ya eligió, se respeta (queda fijo por navegador vía localStorage).
// - Botón flotante para cambiar en cualquier momento.
import { useEffect } from "react";
import { useTheme } from "@/contexts/ThemeContext";
import { ThemeToggle } from "@/components/ThemeToggle";

const STORAGE_KEY = "theme-preference";

export function PublicThemeControl() {
  const { setTheme } = useTheme();

  useEffect(() => {
    let stored: string | null = null;
    try {
      stored = localStorage.getItem(STORAGE_KEY);
    } catch {
      /* ignore */
    }
    // Default oscuro solo si el visitante no eligió antes.
    if (stored !== "light" && stored !== "dark") {
      setTheme("dark");
    }
  }, [setTheme]);

  return (
    <div className="fixed top-4 right-4 z-50">
      <ThemeToggle variant="ghost" />
    </div>
  );
}
