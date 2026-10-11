// Página de prueba visual (solo para tests/visual): monta la tarjeta REAL de
// notificaciones, sin rutas, sesión ni datos. Se sirve con el servidor de Vite.
import { createRoot } from "react-dom/client";
import "@/index.css";
import { NotificationActivationCard } from "@/components/NotificationActivationCard";
import { Toaster } from "@/components/ui/toaster";

const theme = new URLSearchParams(location.search).get("tema");
if (theme === "claro") document.documentElement.classList.remove("dark");

createRoot(document.getElementById("root")!).render(
  <div className="min-h-screen bg-background p-4 text-foreground">
    <div className="mx-auto max-w-md space-y-3">
      <p className="text-xs text-muted-foreground">Portal del paciente · sección Avisos</p>
      <NotificationActivationCard variant="full" audience="patient" />
    </div>
    <Toaster />
  </div>,
);
