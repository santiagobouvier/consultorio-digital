import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { CheckCircle2 } from "lucide-react";

const STORAGE_KEY = "pwa_install_celebrated";
const EVENT_NAME = "pwa:show-install-celebration";

/**
 * Triggers the celebration modal manually. Used as a fallback when the native
 * `appinstalled` event does not fire (some browsers / PWA contexts).
 * By default respects the once-per-device flag, but accepts `force=true` to
 * bypass it (e.g. when the user just clicked "Install" — even on reinstalls
 * the celebration should always show).
 */
export const triggerPWAInstalledCelebration = (force = false) => {
  if (typeof window === "undefined") return;
  if (force) {
    // Clear the flag so the modal always shows after an explicit install action.
    localStorage.removeItem(STORAGE_KEY);
  } else if (localStorage.getItem(STORAGE_KEY) === "true") {
    return;
  }
  window.dispatchEvent(new CustomEvent(EVENT_NAME, { detail: { force } }));
};

export const PWAInstalledCelebrationModal = () => {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const showOnce = (e?: Event) => {
      const forced = (e as CustomEvent | undefined)?.detail?.force === true;
      if (!forced && localStorage.getItem(STORAGE_KEY) === "true") return;
      localStorage.setItem(STORAGE_KEY, "true");
      setOpen(true);
    };

    window.addEventListener("appinstalled", showOnce);
    window.addEventListener(EVENT_NAME, showOnce);
    return () => {
      window.removeEventListener("appinstalled", showOnce);
      window.removeEventListener(EVENT_NAME, showOnce);
    };
  }, []);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="sm:max-w-md text-center">
        <DialogHeader className="items-center">
          <div className="relative mb-2">
            <div className="absolute inset-0 rounded-full bg-primary/20 blur-2xl animate-pulse" />
            <div className="relative h-20 w-20 rounded-full bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center shadow-lg">
              <CheckCircle2 className="h-12 w-12 text-primary-foreground" strokeWidth={2.5} />
            </div>
          </div>
          <div className="text-4xl mt-1">🚀</div>
          <DialogTitle className="text-2xl font-bold mt-2">
            ¡App instalada con éxito!
          </DialogTitle>
          <DialogDescription className="text-base text-foreground/80 mt-2">
            Buscá el ícono de Consultorio Digital en tu pantalla de inicio y abrila desde ahí para la mejor experiencia.
          </DialogDescription>
        </DialogHeader>
        <p className="text-sm text-muted-foreground px-2">
          La app se actualiza sola, no necesitás volver a instalarla.
        </p>
        <DialogFooter className="sm:justify-center">
          <Button
            onClick={() => setOpen(false)}
            className="w-full sm:w-auto px-8 font-semibold"
            size="lg"
          >
            ¡Entendido!
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default PWAInstalledCelebrationModal;
