import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ArrowLeft, Users, Loader2, ListChecks, CalendarCog, ArrowRight } from "lucide-react";
import { useBusinessId } from "@/hooks/use-business-id";
import { useProfessionals } from "@/hooks/use-professionals";
import { useAvailabilityTemplate, DAY_KEYS, DAY_LABELS } from "@/hooks/use-availability-template";
import { ServicesManager } from "@/components/horarios/ServicesManager";
import { DayBar } from "@/components/horarios/WeeklyTemplateEditor";
import { AgendaScheduleSheet } from "@/components/calendar-v2/AgendaScheduleSheet";
import { HelpTooltip } from "@/components/HelpTooltip";

/**
 * Horarios y sesiones. La semana tipo se EDITA en el panel de la agenda
 * ("Mis horarios") — acá solo se ve el resumen y viven los tipos de sesión,
 * que son configuración de verdad (precios y duraciones de la reserva).
 */
const AvailableSlots = () => {
  const navigate = useNavigate();
  const { businessId, loading: businessLoading } = useBusinessId();
  const { professionals, currentUserId, isOwner, loading: profLoading } = useProfessionals(businessId);

  // Profesional seleccionado para gestionar
  const [selectedProUserId, setSelectedProUserId] = useState<string | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);

  useEffect(() => {
    if (!selectedProUserId && currentUserId) {
      setSelectedProUserId(currentUserId);
    }
  }, [currentUserId, selectedProUserId]);

  const { template, loading: templateLoading, reload } = useAvailabilityTemplate(
    businessId,
    selectedProUserId
  );

  const totalWeek = useMemo(
    () => (template ? DAY_KEYS.reduce((sum, k) => sum + template.days[k].blocks.length, 0) : 0),
    [template]
  );

  const loading = businessLoading || profLoading;
  const showProfessionalSelector = isOwner && professionals.length > 1;

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto w-full max-w-[1500px] p-4 sm:p-6 space-y-6">
        {/* Encabezado de página */}
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3 min-w-0">
            <span className="h-11 w-11 rounded-2xl flex items-center justify-center shrink-0" style={{ background: "hsla(262, 80%, 66%, 0.14)" }}>
              <ListChecks className="h-5 w-5" style={{ color: "hsl(262 80% 66%)" }} />
            </span>
            <div className="min-w-0">
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight inline-flex items-center gap-2">
                Horarios y sesiones
                <HelpTooltip id="schedules" />
              </h1>
              <p className="text-sm text-muted-foreground">
                Qué tipos de sesión ofrecés y cuándo atendés — la reserva online se arma sola con esto.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {showProfessionalSelector && (
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-muted-foreground" />
                <Select value={selectedProUserId ?? ""} onValueChange={setSelectedProUserId}>
                  <SelectTrigger className="w-56 bg-background">
                    <SelectValue placeholder="Profesional" />
                  </SelectTrigger>
                  <SelectContent>
                    {professionals.map((p) => (
                      <SelectItem key={p.userId} value={p.userId}>
                        {p.name}{p.userId === currentUserId ? " (vos)" : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <Button variant="ghost" onClick={() => navigate("/dashboard")}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Volver
            </Button>
          </div>
        </div>

        {loading || !businessId || !selectedProUserId ? (
          <Card>
            <CardContent className="py-16 flex items-center justify-center text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin mr-2" /> Cargando...
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
            {/* Tipos de sesión: la configuración de verdad, protagonista */}
            <div className="order-2 lg:order-1 lg:col-span-2">
              <ServicesManager businessId={businessId} />
            </div>

            {/* Tu semana tipo: resumen + editar (mismo panel que la agenda) */}
            <Card className="order-1 lg:order-2">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <CardTitle className="text-base">Tu semana tipo</CardTitle>
                    <CardDescription className="mt-1">
                      Los cupos que ofrecés cada semana
                    </CardDescription>
                  </div>
                  {totalWeek > 0 && (
                    <div className="text-right shrink-0">
                      <p className="text-2xl font-bold leading-none text-primary" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
                        {totalWeek}
                      </p>
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wide mt-0.5">
                        sesiones
                      </p>
                    </div>
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {templateLoading || !template ? (
                  <div className="py-6 flex items-center justify-center text-muted-foreground text-sm">
                    <Loader2 className="h-4 w-4 animate-spin mr-2" /> Cargando...
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    {DAY_KEYS.map((k) => {
                      const blocks = template.days[k].blocks;
                      return (
                        <div key={k} className="flex items-center gap-3">
                          <span className={`w-16 text-xs font-medium shrink-0 ${blocks.length > 0 ? "text-foreground" : "text-muted-foreground/60"}`}>
                            {DAY_LABELS[k]}
                          </span>
                          <div className="flex-1 min-w-0">
                            <DayBar blocks={blocks} />
                          </div>
                          <span className="w-6 text-right text-xs tabular-nums text-muted-foreground shrink-0">
                            {blocks.length > 0 ? blocks.length : "—"}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}

                <Button
                  onClick={() => setEditorOpen(true)}
                  className="w-full h-12 rounded-xl gap-2 font-bold"
                >
                  <CalendarCog className="h-4 w-4" />
                  Editar mis horarios
                </Button>
                <button
                  type="button"
                  onClick={() => navigate("/agenda")}
                  className="w-full inline-flex items-center justify-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors py-1"
                >
                  El día a día se maneja tocando los cupos en la agenda
                  <ArrowRight className="h-3 w-3" />
                </button>
              </CardContent>
            </Card>
          </div>
        )}

        {/* El MISMO editor que abre la agenda: una sola fuente de verdad */}
        {businessId && selectedProUserId && (
          <AgendaScheduleSheet
            open={editorOpen}
            onOpenChange={setEditorOpen}
            businessId={businessId}
            professionalUserId={selectedProUserId}
            onSaved={reload}
          />
        )}
      </div>
    </div>
  );
};

export default AvailableSlots;
