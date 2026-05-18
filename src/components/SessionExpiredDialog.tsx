import { useEffect, useState } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { supabase } from "@/integrations/supabase/client";
import { clearServiceWorkerCaches } from "@/lib/session-recovery";

const SESSION_EXPIRED_EVENT = "app:session-expired";

/**
 * Whitelist de rutas protegidas del panel del profesional.
 * El modal de sesión expirada SOLO debe aparecer cuando el usuario
 * está activamente dentro de estas rutas. En cualquier otra
 * (landing, /auth, /acceso, /portal/*, /portal-paciente, booking público,
 * reset password, etc.) se ignora silenciosamente.
 */
const PROTECTED_ROUTE_PREFIXES = [
  "/dashboard",
  "/patients",
  "/appointments",
  "/agenda",
  "/centro-control",
  "/recordatorios-pendientes",
  "/mi-consultorio",
  "/horarios-disponibles",
  "/solicitudes",
  "/pagos",
  "/personalizar-portal",
  "/billing",
  "/estadisticas",
  "/saas-admin",
];

const isOnProtectedRoute = () => {
  if (typeof window === "undefined") return false;
  const path = window.location.pathname;
  return PROTECTED_ROUTE_PREFIXES.some((prefix) => path.startsWith(prefix));
};

/**
 * Dispara el dialog de sesión expirada desde cualquier parte de la app
 * sin hacer hard reset del navegador.
 *
 * Guard a prueba de balas: aunque algún caller olvide chequear la ruta,
 * acá filtramos para que JAMÁS se dispare fuera del panel protegido.
 */
export const triggerSessionExpired = () => {
  if (typeof window === "undefined") return;
  if (!isOnProtectedRoute()) return;
  window.dispatchEvent(new CustomEvent(SESSION_EXPIRED_EVENT));
};

export const SessionExpiredDialog = () => {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const handler = () => setOpen(true);
    window.addEventListener(SESSION_EXPIRED_EVENT, handler);
    return () => window.removeEventListener(SESSION_EXPIRED_EVENT, handler);
  }, []);

  const handleReauth = async () => {
    setOpen(false);
    try {
      await supabase.auth.signOut();
    } catch {
      // ignorar errores, igual vamos a /auth
    }
    try {
      await clearServiceWorkerCaches();
    } catch {
      // silencioso
    }
    window.location.replace("/auth?session=expired");
  };

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Tu sesión expiró por inactividad</AlertDialogTitle>
          <AlertDialogDescription>
            Por seguridad cerramos tu sesión luego de un período sin actividad.
            Por favor, volvé a iniciar sesión para continuar.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogAction onClick={handleReauth}>
            Volver a iniciar sesión
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};
