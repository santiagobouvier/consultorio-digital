import { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowLeft, CalendarRange, Calendar, ListChecks, Users, Loader2 } from "lucide-react";
import { useBusinessId } from "@/hooks/use-business-id";
import { useProfessionals } from "@/hooks/use-professionals";
import { useAvailabilityTemplate } from "@/hooks/use-availability-template";
import { WeeklyTemplateEditor } from "@/components/horarios/WeeklyTemplateEditor";
import { GenerateSlotsDialog } from "@/components/horarios/GenerateSlotsDialog";
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

  const { template, setTemplate, loading: templateLoading, save, reload } = useAvailabilityTemplate(
    businessId,
    selectedProUserId
  );

  const [saving, setSaving] = useState(false);
  const [generatorOpen, setGeneratorOpen] = useState(false);
  const [slots, setSlots] = useState<SlotRow[]>([]);
  const [slotsLoading, setSlotsLoading] = useState(true);

  const loadSlots = async () => {
    if (!businessId || !selectedProUserId) return;
    setSlotsLoading(true);
    try {
      const { data, error } = await (supabase as any)
        .from("availability_slots")
        .select("id, date, start_time, end_time, modality, price, status, notes, professional_user_id, generated_from_template")
        .eq("business_id", businessId)
        .or(`professional_user_id.eq.${selectedProUserId},professional_user_id.is.null`)
        .order("date", { ascending: false })
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
      await save(template);
      toast({ title: "Plantilla guardada", description: "Ahora podés generar los horarios del mes." });
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
                Configurá tu semana tipo una vez y generá los horarios del mes en segundos.
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
          <Tabs defaultValue="template" className="w-full">
            <div className="flex items-center gap-3 flex-wrap">
              <TabsList className="grid grid-cols-3 w-full max-w-md">
                <TabsTrigger value="template" className="gap-2">
                  <CalendarRange className="h-4 w-4" /> Plantilla
                </TabsTrigger>
                <TabsTrigger value="punctual" className="gap-2">
                  <Calendar className="h-4 w-4" /> Bloque puntual
                </TabsTrigger>
                <TabsTrigger value="list" className="gap-2">
                  <ListChecks className="h-4 w-4" /> Lista
                </TabsTrigger>
              </TabsList>
              <TabsContent value="template" className="m-0">
                <HelpTooltip id="schedulesTemplate" />
              </TabsContent>
              <TabsContent value="punctual" className="m-0">
                <HelpTooltip id="schedulesPunctual" />
              </TabsContent>
              <TabsContent value="list" className="m-0">
                <HelpTooltip id="schedulesList" />
              </TabsContent>
            </div>

            <TabsContent value="template" className="mt-6">
              <WeeklyTemplateEditor
                template={template}
                onChange={setTemplate as any}
                onSave={handleSaveTemplate}
                saving={saving}
                onOpenGenerator={() => setGeneratorOpen(true)}
                canGenerate={!!template.id}
              />
            </TabsContent>

            <TabsContent value="punctual" className="mt-6">
              <PunctualBlockForm
                businessId={businessId}
                professionalUserId={selectedProUserId}
                onCreated={loadSlots}
              />
            </TabsContent>

            <TabsContent value="list" className="mt-6">
              {slotsLoading ? (
                <Card>
                  <CardContent className="py-16 flex items-center justify-center text-muted-foreground">
                    <Loader2 className="h-5 w-5 animate-spin mr-2" /> Cargando horarios...
                  </CardContent>
                </Card>
              ) : (
                <SlotsList slots={slots} onChange={loadSlots} />
              )}
            </TabsContent>
          </Tabs>
        )}

        {template?.id && (
          <GenerateSlotsDialog
            open={generatorOpen}
            onOpenChange={setGeneratorOpen}
            templateId={template.id}
            onGenerated={loadSlots}
          />
        )}
      </div>
    </div>
  );
};

export default AvailableSlots;
