import { Bell, BellOff, CheckCircle2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { usePushNotifications } from "@/hooks/use-push-notifications";
import { IOSInstallTutorial } from "@/components/pwa/IOSInstallTutorial";
import { toast } from "@/hooks/use-toast";

interface NotificationActivationCardProps {
  variant?: "compact" | "full";
}

export function NotificationActivationCard({ variant = "compact" }: NotificationActivationCardProps) {
  const {
    permission,
    isSubscribed,
    loading,
    subscribe,
    needsIOSInstall,
    dismissIOSGuide,
    supportsNotifications,
  } = usePushNotifications();

  const handleActivate = async () => {
    const ok = await subscribe();
    if (ok) {
      toast({ title: "Notificaciones activadas ✓", description: "Te avisaremos de citas, pagos y recordatorios." });
    } else if (permission === "denied") {
      toast({
        title: "Permiso denegado",
        description: "Podés activarlas más tarde desde la configuración de tu navegador.",
        variant: "destructive",
      });
    }
  };

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
      <div className="flex items-center gap-3 rounded-xl border border-emerald-500/20 bg-emerald-500/5 px-4 py-3">
        <CheckCircle2 className="h-5 w-5 text-emerald-500" />
        <span className="text-sm font-medium text-emerald-500">Notificaciones activas ✓</span>
      </div>
    );
  }

  // Denied
  if (permission === "denied") {
    return (
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <BellOff className="h-3.5 w-3.5" />
        <span>Notificaciones bloqueadas en el navegador</span>
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
      <div className="rounded-xl border bg-card p-4 space-y-3">
        <div className="flex items-start gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Bell className="h-4.5 w-4.5" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-medium">Activá las notificaciones</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Recibí avisos de citas, pagos y recordatorios al instante.
            </p>
          </div>
        </div>
        <Button
          onClick={handleActivate}
          disabled={loading}
          className="w-full gap-2"
          size="sm"
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Bell className="h-4 w-4" />}
          Activar notificaciones
        </Button>
      </div>
      <IOSInstallTutorial open={needsIOSInstall} onClose={dismissIOSGuide} />
    </>
  );
}
