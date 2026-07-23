import { Bell, BellOff, BellRing, CheckCircle2, Loader2, MonitorSmartphone, Smartphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { usePushNotifications } from "@/hooks/use-push-notifications";
import { IOSInstallTutorial } from "@/components/pwa/IOSInstallTutorial";
import { toast } from "@/hooks/use-toast";

interface NotificationActivationCardProps {
  variant?: "compact" | "full";
  /** Ajusta los ejemplos de avisos al rol de quien activa. */
  audience?: "professional" | "patient";
}

// Ejemplos REALES de lo que envía el sistema hoy, por rol.
const AUDIENCE_EXAMPLES: Record<"professional" | "patient", string[]> = {
  professional: [
    "Nueva reserva o solicitud de cita desde tu web",
    "Reserva pagada online (seña o sesión)",
  ],
  patient: [
    "Cuando te agendan o confirman una cita",
    "Si tu cita cambia de fecha o se cancela",
    "Cuando se registra un pago tuyo",
  ],
};

export function NotificationActivationCard({
  variant = "compact",
  audience = "patient",
}: NotificationActivationCardProps) {
  const {
    permission,
    isSubscribed,
    loading,
    subscribe,
    needsIOSInstall,
    dismissIOSGuide,
    supportsNotifications,
    deviceType,
    isPWAInstalled,
  } = usePushNotifications();

  const handleActivate = async () => {
    const ok = await subscribe();
    if (ok) {
      toast({ title: "Notificaciones activadas ✓", description: "Este dispositivo ya recibe los avisos." });
    } else if (permission === "denied") {
      toast({
        title: "Permiso denegado",
        description: "Podés activarlas más tarde desde la configuración de tu navegador.",
        variant: "destructive",
      });
    }
  };

  const examples = AUDIENCE_EXAMPLES[audience];
  const iosNeedsApp = deviceType === "ios" && !isPWAInstalled;

  // Already active
  if (isSubscribed) {
    if (variant === "compact") {
      return (
        <div className="flex items-center gap-2 text-xs text-emerald-500">
          <CheckCircle2 className="h-3.5 w-3.5" />
          <span>Notificaciones activas</span>
        </div>
      );
    }
    return (
      <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 px-4 py-3 space-y-1">
        <div className="flex items-center gap-3">
          <CheckCircle2 className="h-5 w-5 text-emerald-500 shrink-0" />
          <span className="text-sm font-medium text-emerald-500">Notificaciones activas en este dispositivo ✓</span>
        </div>
        <p className="text-xs text-muted-foreground pl-8">
          Te llegan aunque no tengas la página abierta. Si también las querés en otro
          dispositivo (celular o compu), activalas desde ahí.
        </p>
      </div>
    );
  }

  // Denied
  if (permission === "denied") {
    if (variant === "compact") {
      return (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <BellOff className="h-3.5 w-3.5" />
          <span>Notificaciones bloqueadas en el navegador</span>
        </div>
      );
    }
    return (
      <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 px-4 py-3 space-y-1.5">
        <div className="flex items-center gap-3">
          <BellOff className="h-5 w-5 text-amber-500 shrink-0" />
          <span className="text-sm font-medium">Las notificaciones están bloqueadas</span>
        </div>
        <p className="text-xs text-muted-foreground pl-8 leading-relaxed">
          En algún momento se le dijo "No permitir" al navegador. Para desbloquearlas:
          tocá el <strong>candadito</strong> (o el ícono de ajustes) al lado de la dirección
          de la página → <strong>Notificaciones</strong> → <strong>Permitir</strong>, y recargá.
        </p>
      </div>
    );
  }

  // Not supported (old browser, not HTTPS, etc.)
  if (!supportsNotifications && permission === "unsupported") return null;

  if (variant === "compact") {
    return (
      <>
        <Button
          variant="outline"
          size="sm"
          onClick={handleActivate}
          disabled={loading}
          className="gap-1.5 text-xs h-8"
        >
          {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Bell className="h-3.5 w-3.5" />}
          Activar notificaciones
        </Button>
        <IOSInstallTutorial open={needsIOSInstall} onClose={dismissIOSGuide} />
      </>
    );
  }

  return (
    <>
      <div className="rounded-xl border bg-card p-4 sm:p-5 space-y-4">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <BellRing className="h-5 w-5" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold">Activá las notificaciones en este dispositivo</p>
            <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
              Son avisos del sistema que llegan al instante, <strong>aunque no tengas la página
              abierta</strong> — como los de cualquier app.
            </p>
          </div>
        </div>

        {/* Qué avisos vas a recibir (ejemplos reales según el rol) */}
        <ul className="space-y-1.5">
          {examples.map((e) => (
            <li key={e} className="flex items-start gap-2 text-xs text-muted-foreground">
              <CheckCircle2 className="h-3.5 w-3.5 text-primary/70 shrink-0 mt-0.5" />
              <span>{e}</span>
            </li>
          ))}
        </ul>

        {/* Nota según el dispositivo */}
        <div className="flex items-start gap-2 rounded-lg bg-muted/50 px-3 py-2">
          {iosNeedsApp ? (
            <>
              <Smartphone className="h-3.5 w-3.5 text-muted-foreground shrink-0 mt-0.5" />
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                En iPhone, Apple pide que primero <strong>instales la app en tu pantalla de
                inicio</strong>. Al tocar el botón te mostramos cómo (son 3 pasos).
              </p>
            </>
          ) : (
            <>
              <MonitorSmartphone className="h-3.5 w-3.5 text-muted-foreground shrink-0 mt-0.5" />
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                Funciona en computadora (Chrome, Edge, Firefox) y en Android. Se activan{" "}
                <strong>por dispositivo</strong>: si las querés también en el celular o en otra
                compu, activalas desde ahí.
              </p>
            </>
          )}
        </div>

        <Button onClick={handleActivate} disabled={loading} className="w-full gap-2">
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Bell className="h-4 w-4" />}
          {iosNeedsApp ? "Instalar la app y activar avisos" : "Activar notificaciones"}
        </Button>
      </div>
      <IOSInstallTutorial open={needsIOSInstall} onClose={dismissIOSGuide} />
    </>
  );
}
