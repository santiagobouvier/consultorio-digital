import { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { ArrowLeft, Users, Loader2, Plus, ListChecks, ChevronDown } from "lucide-react";
import { useBusinessId } from "@/hooks/use-business-id";
import { useProfessionals } from "@/hooks/use-professionals";
import { useAvailabilityTemplate } from "@/hooks/use-availability-template";
import { WeeklyTemplateEditor } from "@/components/horarios/WeeklyTemplateEditor";
import { ServicesManager } from "@/components/horarios/ServicesManager";
import { PunctualBlockForm } from "@/components/horarios/PunctualBlockForm";
import { SlotsList, SlotRow } from "@/components/horarios/SlotsList";
import { toast } from "@/hooks/use-toast";
import { HelpTooltip } from "@/components/HelpTooltip";

const AvailableSlots = () => {
  const navigate = useNavigate();
  const { businessId, loading: businessLoading } = useBusinessId();
  const { professionals, currentUserId, isOwner, loading: profLoading } = useProfessionals(businessId);

  // Profesional seleccionado para gestionar
  const [selectedProUserId, setSelectedProUserId] = useState<string | null>(null);

  // Cuando carguen los profesionales, default = el actual logueado
  useEffect(() => {
    if (!selectedProUserId && currentUserId) {
      setSelectedProUserId(currentUserId);
    }
  }, [currentUserId, selectedProUserId]);

  const { template, setTemplate, loading: templateLoading, save } = useAvailabilityTemplate(
    businessId,
    selectedProUserId
  );

  const [saving, setSaving] = useState(false);
  const [punctualOpen, setPunctualOpen] = useState(false);
  // Sección "días puntuales": secundaria, arranca colapsada
  const [punctualSectionOpen, setPunctualSectionOpen] = useState(false);
  const [slots, setSlots] = useState<SlotRow[]>([]);
  const [slotsLoading, setSlotsLoading] = useState(true);

  const loadSlots = async () => {
    if (!businessId || !selectedProUserId) return;
    setSlotsLoading(true);
    try {
      const today = new Date().toISOString().slice(0, 10);
      // Solo horarios sueltos: los de la semana tipo ya no se materializan,
      // el motor de disponibilidad los calcula directo desde la plantilla.
      const { data, error } = await (supabase as any)
        .from("availability_slots")
        .select("id, date, start_time, end_time, modality, price, status, notes, professional_user_id, generated_from_template")
        .eq("business_id", businessId)
        .is("generated_from_template", null)
        .or(`professional_user_id.eq.${selectedProUserId},professional_user_id.is.null`)
        .gte("date", today)
        .order("date", { ascending: true })
        .order("start_time", { ascending: true });
      if (error) throw error;
      setSlots(data ?? []);
    } catch (e: any) {
      console.error(e);
      toast({ title: "Error", description: "No se pudieron cargar los horarios", variant: "destructive" });
    } finally {
      setSlotsLoading(false);
    }
  };

  useEffect(() => {
    if (businessId && selectedProUserId) loadSlots();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [businessId, selectedProUserId]);

  const handleSaveTemplate = async () => {
    if (!template) return;
    setSaving(true);
    try {
      // Guardar la semana tipo alcanza: la disponibilidad se calcula en vivo
      // desde la plantilla, sin pregenerar casilleros.
      await save(template);

      toast({
        title: "Semana guardada",
        description: "Tu disponibilidad ya está al día en la web pública y el portal.",
      });
    } catch (e: any) {
      console.error(e);
      toast({ title: "Error", description: e?.message ?? "No se pudo guardar", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const loading = businessLoading || profLoading || templateLoading;
  const showProfessionalSelector = isOwner && professionals.length > 1;
  const selectedPro = useMemo(
    () => professionals.find((p) => p.userId === selectedProUserId),
    [professionals, selectedProUserId]
  );

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
                Horarios
                <HelpTooltip id="schedules" />
              </h1>
              <p className="text-sm text-muted-foreground">
                Definí cuándo atendés — los horarios para reservar se calculan solos.
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

        {loading || !businessId || !selectedProUserId || !template ? (
          <Card>
            <CardContent className="py-16 flex items-center justify-center text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin mr-2" /> Cargando...
            </CardContent>
          </Card>
        ) : (
          <>
            {/* Desktop: semana tipo protagonista (2/3) + panel derecho con
                tipos de sesión y días puntuales (secundario, colapsado) */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
              <div className="order-2 lg:order-1 lg:col-span-2">
                {/* Semana tipo (guardar = agenda generada y mantenida sola) */}
                <WeeklyTemplateEditor
                  template={template}
                  onChange={setTemplate as any}
                  onSave={handleSaveTemplate}
                  saving={saving}
                />
              </div>

              <div className="order-1 lg:order-2 space-y-6">
                {/* Tipos de sesión (qué ofrecés) */}
                <ServicesManager businessId={businessId} />

                {/* Días puntuales: secundario y colapsado — para el sábado
                    excepcional o el horario extra de una semana concreta */}
                <div className="rounded-xl border bg-muted/20">
                  <button
                    type="button"
                    onClick={() => setPunctualSectionOpen((v) => !v)}
                    className="w-full flex items-center justify-between gap-2 p-4 text-left"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-foreground">¿Abrís un día puntual?</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Horarios sueltos fuera de tu semana tipo
                        {slots.length > 0 ? ` · ${slots.length} activo${slots.length !== 1 ? "s" : ""}` : ""}
                      </p>
                    </div>
                    <ChevronDown
                      className={`h-4 w-4 text-muted-foreground shrink-0 transition-transform ${punctualSectionOpen ? "rotate-180" : ""}`}
                    />
                  </button>
                  {punctualSectionOpen && (
                    <div className="px-4 pb-4 space-y-3">
                      <Button variant="outline" size="sm" onClick={() => setPunctualOpen(true)} className="w-full">
                        <Plus className="h-4 w-4 mr-1" /> Agregar horario suelto
                      </Button>
                      {slotsLoading ? (
                        <div className="py-8 flex items-center justify-center text-muted-foreground text-sm">
                          <Loader2 className="h-4 w-4 animate-spin mr-2" /> Cargando...
                        </div>
                      ) : (
                        <SlotsList slots={slots} onChange={loadSlots} />
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Horario suelto (fuera de la semana tipo) */}
            <Dialog open={punctualOpen} onOpenChange={setPunctualOpen}>
              <DialogContent className="sm:max-w-lg">
                <DialogHeader>
                  <DialogTitle>Agregar horario suelto</DialogTitle>
                  <DialogDescription>
                    Un turno puntual fuera de tu semana tipo (por ejemplo, un sábado excepcional).
                  </DialogDescription>
                </DialogHeader>
                <PunctualBlockForm
                  businessId={businessId}
                  professionalUserId={selectedProUserId}
                  onCreated={() => {
                    setPunctualOpen(false);
                    loadSlots();
                  }}
                />
              </DialogContent>
            </Dialog>
          </>
        )}
      </div>
    </div>
  );
};

export default AvailableSlots;
