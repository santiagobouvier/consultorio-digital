import { useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Inbox, ArrowRight } from "lucide-react";
import { usePendingRequestsCount } from "@/hooks/use-pending-requests-count";

/**
 * Franja "te están esperando": reservas del portal, solicitudes públicas y
 * reprogramaciones pendientes de respuesta. Solo aparece si hay algo, y se
 * actualiza sola en tiempo real (mismo contador que el menú lateral).
 */
export const PendingRequestsBanner = () => {
  const navigate = useNavigate();
  const count = usePendingRequestsCount();

  if (count === 0) return null;

  return (
    <Card className="border-orange-500/40 bg-orange-500/10">
      <CardContent className="p-3.5 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-9 h-9 rounded-xl bg-orange-500/15 flex items-center justify-center shrink-0">
            <Inbox className="h-4.5 w-4.5 text-orange-500" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-foreground">
              {count === 1 ? "1 solicitud espera tu respuesta" : `${count} solicitudes esperan tu respuesta`}
            </p>
            <p className="text-xs text-muted-foreground truncate">
              Reservas y reprogramaciones de tus pacientes
            </p>
          </div>
        </div>
        <Button
          size="sm"
          onClick={() => navigate("/solicitudes")}
          className="rounded-xl gap-1.5 shrink-0 bg-orange-500 hover:bg-orange-600 text-white"
        >
          Responder
          <ArrowRight className="h-3.5 w-3.5" />
        </Button>
      </CardContent>
    </Card>
  );
};
