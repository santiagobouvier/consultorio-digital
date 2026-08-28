// Pestaña "Reserva online" del panel de horarios de la agenda: muestra el
// alcance de disponibilidad vigente (aviso mínimo + horizonte) y deja abrir el
// link real de reserva en una pestaña nueva para verlo como lo ve el paciente.
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { buildShareUrl } from "@/config/app";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ExternalLink, Loader2, Settings2, Clock, CalendarRange } from "lucide-react";

interface Props {
  businessId: string;
  /** Cierra el panel al navegar a otra pantalla. */
  onNavigateAway?: () => void;
}

export function BookingScopePanel({ businessId, onNavigateAway }: Props) {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [slug, setSlug] = useState<string | null>(null);
  const [noticeHours, setNoticeHours] = useState(24);
  const [horizonDays, setHorizonDays] = useState(60);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      const { data } = await supabase
        .from("businesses")
        .select("public_slug, min_booking_notice_hours, max_booking_horizon_days")
        .eq("id", businessId)
        .maybeSingle();
      if (cancelled) return;
      const b = data as {
        public_slug?: string | null;
        min_booking_notice_hours?: number | null;
        max_booking_horizon_days?: number | null;
      } | null;
      setSlug(b?.public_slug ?? null);
      setNoticeHours(b?.min_booking_notice_hours ?? 24);
      setHorizonDays(b?.max_booking_horizon_days ?? 60);
      setLoading(false);
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [businessId]);

  const bookingUrl = slug ? buildShareUrl(`/consultorio/${slug}/reservar`) : null;

  const noticeLabel =
    noticeHours === 0
      ? "Sin aviso mínimo"
      : noticeHours < 24
        ? `${noticeHours} h de aviso mínimo`
        : `${Math.round(noticeHours / 24)} ${Math.round(noticeHours / 24) === 1 ? "día" : "días"} de aviso mínimo`;

  if (loading) {
    return (
      <div className="py-16 flex items-center justify-center text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin mr-2" /> Cargando...
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Alcance de la reserva</CardTitle>
          <CardDescription>
            Hasta dónde puede reservar un paciente desde tu link público.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-xl border border-border/70 bg-muted/30 p-3">
              <div className="flex items-center gap-2 text-muted-foreground">
                <Clock className="h-4 w-4" />
                <span className="text-[11px] uppercase tracking-wide font-semibold">Aviso mínimo</span>
              </div>
              <p className="mt-1.5 text-lg font-bold leading-none">{noticeLabel}</p>
            </div>
            <div className="rounded-xl border border-border/70 bg-muted/30 p-3">
              <div className="flex items-center gap-2 text-muted-foreground">
                <CalendarRange className="h-4 w-4" />
                <span className="text-[11px] uppercase tracking-wide font-semibold">Horizonte</span>
              </div>
              <p className="mt-1.5 text-lg font-bold leading-none">{horizonDays} días</p>
            </div>
          </div>
          <Button
            variant="outline"
            className="w-full rounded-xl gap-2"
            onClick={() => {
              onNavigateAway?.();
              navigate("/mi-consultorio");
            }}
          >
            <Settings2 className="h-4 w-4" />
            Ajustar alcance
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Simulador del link de reserva</CardTitle>
          <CardDescription>
            Abrí tu link público tal cual lo ve el paciente, con la disponibilidad de hoy.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {bookingUrl ? (
            <>
              <p className="text-xs text-muted-foreground break-all">{bookingUrl}</p>
              <Button
                className="w-full rounded-xl gap-2"
                onClick={() => window.open(bookingUrl, "_blank", "noopener,noreferrer")}
              >
                <ExternalLink className="h-4 w-4" />
                Ver el link de reserva
              </Button>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">
              Todavía no tenés una dirección pública configurada.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
