import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Badge } from "@/components/ui/badge";
import { Loader2, AlertTriangle, Sparkles, CheckCircle2 } from "lucide-react";
import { format, addDays, endOfMonth, startOfMonth } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  templateId: string;
  onGenerated: () => void;
}

type Strategy = "skip" | "replace";

export const GenerateSlotsDialog = ({ open, onOpenChange, templateId, onGenerated }: Props) => {
  const today = new Date();
  const [from, setFrom] = useState(format(today, "yyyy-MM-dd"));
  const [to, setTo] = useState(format(endOfMonth(today), "yyyy-MM-dd"));
  const [strategy, setStrategy] = useState<Strategy>("skip");
  const [preview, setPreview] = useState<{ total: number; conflicts: number; days: number } | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [generating, setGenerating] = useState(false);

  const setQuickRange = (kind: "month" | "next30" | "next7") => {
    if (kind === "month") {
      setFrom(format(startOfMonth(today), "yyyy-MM-dd"));
      setTo(format(endOfMonth(today), "yyyy-MM-dd"));
    } else if (kind === "next30") {
      setFrom(format(today, "yyyy-MM-dd"));
      setTo(format(addDays(today, 30), "yyyy-MM-dd"));
    } else {
      setFrom(format(today, "yyyy-MM-dd"));
      setTo(format(addDays(today, 7), "yyyy-MM-dd"));
    }
  };

  const loadPreview = async () => {
    if (!from || !to || from > to) return;
    setLoadingPreview(true);
    setPreview(null);
    try {
      const { data, error } = await (supabase as any).rpc("preview_template_generation", {
        p_template_id: templateId,
        p_from_date: from,
        p_to_date: to,
      });
      if (error) throw error;
      const row = Array.isArray(data) ? data[0] : data;
      setPreview({
        total: row?.total_slots ?? 0,
        conflicts: row?.conflicts ?? 0,
        days: row?.days_with_slots ?? 0,
      });
    } catch (e: any) {
      console.error(e);
      toast({ title: "Error", description: "No se pudo calcular la previsualización", variant: "destructive" });
    } finally {
      setLoadingPreview(false);
    }
  };

  useEffect(() => {
    if (open && templateId) {
      loadPreview();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, from, to, templateId]);

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      const { data, error } = await (supabase as any).rpc("generate_slots_from_template", {
        p_template_id: templateId,
        p_from_date: from,
        p_to_date: to,
        p_conflict_strategy: strategy,
      });
      if (error) throw error;
      const row = Array.isArray(data) ? data[0] : data;
      toast({
        title: "Horarios generados",
        description: `Creados: ${row?.created ?? 0} · Saltados: ${row?.skipped ?? 0} · Reemplazados: ${row?.replaced ?? 0}`,
      });
      onGenerated();
      onOpenChange(false);
    } catch (e: any) {
      console.error(e);
      toast({ title: "Error", description: e?.message ?? "No se pudieron generar los horarios", variant: "destructive" });
    } finally {
      setGenerating(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            Generar horarios desde la plantilla
          </DialogTitle>
          <DialogDescription>
            El sistema creará los slots según tu semana tipo en el rango elegido.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="outline" onClick={() => setQuickRange("next7")}>Próximos 7 días</Button>
            <Button size="sm" variant="outline" onClick={() => setQuickRange("next30")}>Próximos 30 días</Button>
            <Button size="sm" variant="outline" onClick={() => setQuickRange("month")}>Mes actual</Button>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Desde</Label>
              <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Hasta</Label>
              <Input type="date" value={to} min={from} onChange={(e) => setTo(e.target.value)} />
            </div>
          </div>

          {/* Preview */}
          <div className="rounded-lg border bg-muted/30 p-4">
            {loadingPreview ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Calculando...
              </div>
            ) : preview ? (
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm">
                  <CheckCircle2 className="h-4 w-4 text-primary" />
                  <span className="font-medium">{preview.total}</span> slots a generar en {preview.days} días
                </div>
                {preview.conflicts > 0 && (
                  <div className="flex items-center gap-2 text-sm text-destructive">
                    <AlertTriangle className="h-4 w-4" />
                    <span className="font-medium">{preview.conflicts}</span> conflictos detectados
                    <Badge variant="destructive" className="ml-1">requiere decisión</Badge>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-sm text-muted-foreground">Seleccioná un rango para ver la previsualización</div>
            )}
          </div>

          {/* Estrategia de conflicto */}
          {preview && preview.conflicts > 0 && (
            <div className="space-y-2">
              <Label>¿Qué hacer con los conflictos?</Label>
              <RadioGroup value={strategy} onValueChange={(v) => setStrategy(v as Strategy)}>
                <div className="flex items-start gap-2 p-3 rounded-lg border hover:bg-muted/40 cursor-pointer" onClick={() => setStrategy("skip")}>
                  <RadioGroupItem value="skip" id="skip" className="mt-0.5" />
                  <div className="flex-1">
                    <Label htmlFor="skip" className="font-medium cursor-pointer">Saltar los existentes</Label>
                    <p className="text-xs text-muted-foreground mt-0.5">Los slots ya creados quedan intactos. Solo se crean los nuevos.</p>
                  </div>
                </div>
                <div className="flex items-start gap-2 p-3 rounded-lg border hover:bg-muted/40 cursor-pointer" onClick={() => setStrategy("replace")}>
                  <RadioGroupItem value="replace" id="replace" className="mt-0.5" />
                  <div className="flex-1">
                    <Label htmlFor="replace" className="font-medium cursor-pointer">Reemplazar disponibles</Label>
                    <p className="text-xs text-muted-foreground mt-0.5">Sobrescribe los slots disponibles con los datos de la plantilla. Los reservados no se tocan.</p>
                  </div>
                </div>
              </RadioGroup>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={generating}>Cancelar</Button>
          <Button onClick={handleGenerate} disabled={generating || !preview || preview.total === 0}>
            {generating ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Generando...</> : <><Sparkles className="h-4 w-4 mr-2" /> Generar {preview?.total ?? ""} slots</>}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
