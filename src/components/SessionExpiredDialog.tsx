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
 * Dispara el dialog de sesión expirada desde cualquier parte de la app
 * sin hacer hard reset del navegador.
 */
export const triggerSessionExpired = () => {
  if (typeof window === "undefined") return;
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
