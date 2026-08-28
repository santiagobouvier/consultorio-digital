import { useEffect } from "react";
import { toast } from "@/hooks/use-toast";
import { ToastAction } from "@/components/ui/toast";

/**
 * Aviso de versión nueva de la app. main.tsx dispara "pwa:need-refresh"
 * cuando el service worker tiene una actualización esperando; acá se
 * muestra el toast con el botón que la aplica (una sola recarga, iniciada
 * por el usuario — nunca en medio de lo que está haciendo).
 */
export const PwaUpdatePrompt = () => {
  useEffect(() => {
    const onNeedRefresh = () => {
      toast({
        title: "Hay una versión nueva ✨",
        description: "Tocá Actualizar y en 2 segundos tenés lo último.",
        duration: 1000 * 60 * 10,
        action: (
          <ToastAction
            altText="Actualizar la app"
            onClick={() => window.dispatchEvent(new Event("pwa:do-update"))}
          >
            Actualizar
          </ToastAction>
        ),
      });
    };
    window.addEventListener("pwa:need-refresh", onNeedRefresh);
    return () => window.removeEventListener("pwa:need-refresh", onNeedRefresh);
  }, []);
  return null;
};
