// /modo-capturas: activar o salir del modo capturas. Solo para las cuentas
// que la base autoriza (can_use_showcase_mode); a las demás no se les ofrece.
import { useEffect, useState } from "react";
import { Camera, Loader2, LogOut, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { useBusinessIdContext } from "@/contexts/BusinessIdContext";
import { isShowcaseActive } from "@/lib/showcase/session";
import { checkShowcaseAccess, leaveShowcase, startShowcase } from "@/lib/showcase/runtime";

type State = "checking" | "allowed" | "denied";

const ShowcaseMode = () => {
  const { user } = useAuth();
  const { businessId, loading } = useBusinessIdContext();
  const active = isShowcaseActive();
  const [state, setState] = useState<State>("checking");
  const [starting, setStarting] = useState(false);

  useEffect(() => {
    if (active || loading) return;
    if (!businessId || !user) {
      setState("denied");
      return;
    }
    let cancelled = false;
    checkShowcaseAccess(businessId)
      .then((ok) => !cancelled && setState(ok ? "allowed" : "denied"))
      .catch(() => !cancelled && setState("denied"));
    return () => {
      cancelled = true;
    };
  }, [active, loading, businessId, user]);

  if (active) {
    return (
      <div className="mx-auto max-w-xl space-y-4 p-6">
        <h1 className="flex items-center gap-2 text-xl font-semibold">
          <Camera className="h-5 w-5" /> Estás en modo capturas
        </h1>
        <p className="text-sm text-muted-foreground">
          Todo lo que ves son datos ficticios. Nada de lo que hagas se guarda ni se envía. Al salir vuelven tus datos reales, tal como estaban.
        </p>
        <Button onClick={leaveShowcase} data-testid="showcase-exit-page">
          <LogOut className="mr-2 h-4 w-4" /> Salir del modo capturas
        </Button>
      </div>
    );
  }

  if (state === "checking") {
    return (
      <div className="flex justify-center p-10">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (state === "denied") {
    return (
      <div className="mx-auto max-w-xl p-6 text-sm text-muted-foreground" data-testid="showcase-denied">
        Esta herramienta no está habilitada para tu cuenta.
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-xl space-y-4 p-6">
      <h1 className="flex items-center gap-2 text-xl font-semibold">
        <Camera className="h-5 w-5" /> Modo capturas
      </h1>
      <p className="text-sm text-muted-foreground">
        Muestra la aplicación con un consultorio y pacientes <strong>ficticios</strong> para sacar capturas y grabar tutoriales, usando las mismas pantallas de siempre.
      </p>
      <ul className="space-y-1.5 text-sm">
        <li className="flex gap-2"><ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" /> Tus datos reales no se muestran, no se mezclan y no se modifican.</li>
        <li className="flex gap-2"><ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" /> No se envían emails, WhatsApps, push ni recordatorios; no hay cobros ni sincronización de calendarios.</li>
        <li className="flex gap-2"><ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" /> Lo que cambies en el modo se descarta al salir.</li>
        <li className="flex gap-2"><ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" /> Vale solo para esta pestaña. Salís con el botón "Salir" de la barra superior.</li>
      </ul>
      <Button
        data-testid="showcase-activate"
        disabled={starting}
        onClick={async () => {
          setStarting(true);
          const r = await startShowcase(user?.id ?? null, businessId);
          if (r !== "activated") {
            setStarting(false);
            setState("denied");
          }
        }}
      >
        {starting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Camera className="mr-2 h-4 w-4" />}
        Activar modo capturas
      </Button>
    </div>
  );
};

export default ShowcaseMode;
