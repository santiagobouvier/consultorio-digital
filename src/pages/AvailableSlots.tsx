import { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { ArrowLeft, Users, Loader2, Plus, ListChecks } from "lucide-react";
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
      <div className="container mx-auto max-w-5xl p-4 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <Button variant="ghost" onClick={() => navigate("/dashboard")}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Volver
          </Button>
        </div>

        {/* Hero */}
        <div className="rounded-2xl bg-gradient-to-br from-primary/10 via-primary/5 to-transparent border p-6">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <h1 className="text-2xl md:text-3xl font-bold tracking-tight inline-flex items-center gap-2">
                Horarios del consultorio
                <HelpTooltip id="schedules" />
              </h1>
              <p className="text-muted-foreground mt-1 text-sm md:text-base">
                Definí cuándo atendés. Los horarios para reservar se calculan solos según tus tipos de sesión.
              </p>
            </div>
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
          </div>
          {selectedPro && showProfessionalSelector && (
            <div className="mt-3 text-xs text-muted-foreground">
              Editando horarios de <strong>{selectedPro.name}</strong>
            </div>
          )}
        </div>

        {loading || !businessId || !selectedProUserId || !template ? (
          <Card>
            <CardContent className="py-16 flex items-center justify-center text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin mr-2" /> Cargando...
            </CardContent>
          </Card>
        ) : (
          <>
            {/* Tipos de sesión (qué ofrecés) */}
            <ServicesManager businessId={businessId} />

            {/* Semana tipo (guardar = agenda generada y mantenida sola) */}
            <WeeklyTemplateEditor
              template={template}
              onChange={setTemplate as any}
              onSave={handleSaveTemplate}
              saving={saving}
            />

            {/* Horarios sueltos (fuera de la semana tipo) */}
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <h2 className="text-lg font-semibold inline-flex items-center gap-2">
                  <ListChecks className="h-5 w-5 text-primary" />
                  Horarios sueltos
                </h2>
                <Button variant="outline" size="sm" onClick={() => setPunctualOpen(true)}>
                  <Plus className="h-4 w-4 mr-1" /> Horario suelto
                </Button>
              </div>
              {slotsLoading ? (
                <Card>
                  <CardContent className="py-16 flex items-center justify-center text-muted-foreground">
                    <Loader2 className="h-5 w-5 animate-spin mr-2" /> Cargando horarios...
                  </CardContent>
                </Card>
              ) : (
                <SlotsList slots={slots} onChange={loadSlots} />
              )}
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
