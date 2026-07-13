import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Save, Plus, X } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import {
  AvailabilityTemplate,
  DAY_KEYS,
  DAY_LABELS,
  DayKey,
  DayConfig,
} from "@/hooks/use-availability-template";

interface Props {
  template: AvailabilityTemplate;
  onChange: (t: AvailabilityTemplate) => void;
  onSave: () => Promise<void>;
  saving: boolean;
}

export const WeeklyTemplateEditor = ({ template, onChange, onSave, saving }: Props) => {
  const updateDay = (key: DayKey, patch: Partial<DayConfig>) => {
    onChange({
      ...template,
      days: { ...template.days, [key]: { ...template.days[key], ...patch } },
    });
  };

  const toggleDay = (key: DayKey, enabled: boolean) => {
    const current = template.days[key];
    updateDay(key, {
      enabled,
      start1: enabled ? current.start1 || "09:00" : current.start1,
      end1: enabled ? current.end1 || "13:00" : current.end1,
    });
  };

  const addSecondRange = (key: DayKey) => {
    updateDay(key, { start2: "15:00", end2: "19:00" });
  };

  const removeSecondRange = (key: DayKey) => {
    updateDay(key, { start2: null, end2: null });
  };

  const handleSave = async () => {
    // Validar rangos
    for (const k of DAY_KEYS) {
      const d = template.days[k];
      if (!d.enabled) continue;
      if (!d.start1 || !d.end1 || d.start1 >= d.end1) {
        toast({ title: "Rango inválido", description: `${DAY_LABELS[k]}: el horario de inicio debe ser anterior al de fin.`, variant: "destructive" });
        return;
      }
      if (d.start2 && d.end2) {
        if (d.start2 >= d.end2) {
          toast({ title: "Rango inválido", description: `${DAY_LABELS[k]}: el segundo rango es inválido.`, variant: "destructive" });
          return;
        }
        if (d.start2 < d.end1) {
          toast({ title: "Rangos solapados", description: `${DAY_LABELS[k]}: el segundo rango debe empezar después del primero.`, variant: "destructive" });
          return;
        }
      }
    }
    await onSave();
  };

  return (
    <div className="space-y-6">
      {/* Días de la semana. La duración, modalidad y precio ya no van acá:
          viven en los tipos de sesión (ServicesManager). */}
      <Card>
        <CardHeader>
          <CardTitle>Semana tipo</CardTitle>
          <CardDescription>Definí en qué días y horarios atendés. Podés agregar pausa para almuerzo (segundo rango).</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {DAY_KEYS.map((key) => {
            const day = template.days[key];
            return (
              <div key={key} className="border rounded-lg p-4 bg-card transition-colors">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <Switch checked={day.enabled} onCheckedChange={(v) => toggleDay(key, v)} />
                    <span className={`font-medium ${day.enabled ? "" : "text-muted-foreground"}`}>{DAY_LABELS[key]}</span>
                  </div>
                  {day.enabled && !day.start2 && (
                    <Button size="sm" variant="ghost" onClick={() => addSecondRange(key)}>
                      <Plus className="h-3.5 w-3.5 mr-1" /> Agregar pausa
                    </Button>
                  )}
                </div>

                {day.enabled && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground w-16">Mañana</span>
                      <Input
                        type="time"
                        value={day.start1 ?? ""}
                        onChange={(e) => updateDay(key, { start1: e.target.value })}
                        className="h-9"
                      />
                      <span className="text-muted-foreground">-</span>
                      <Input
                        type="time"
                        value={day.end1 ?? ""}
                        onChange={(e) => updateDay(key, { end1: e.target.value })}
                        className="h-9"
                      />
                    </div>
                    {day.start2 && (
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground w-16">Tarde</span>
                        <Input
                          type="time"
                          value={day.start2 ?? ""}
                          onChange={(e) => updateDay(key, { start2: e.target.value })}
                          className="h-9"
                        />
                        <span className="text-muted-foreground">-</span>
                        <Input
                          type="time"
                          value={day.end2 ?? ""}
                          onChange={(e) => updateDay(key, { end2: e.target.value })}
                          className="h-9"
                        />
                        <Button size="icon" variant="ghost" className="h-9 w-9" onClick={() => removeSecondRange(key)}>
                          <X className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </CardContent>
      </Card>

      <div className="sticky bottom-4 space-y-1.5">
        <Button onClick={handleSave} disabled={saving} size="lg" className="w-full">
          <Save className="h-4 w-4 mr-2" />
          {saving ? "Guardando..." : "Guardar semana tipo"}
        </Button>
        <p className="text-center text-xs text-muted-foreground">
          Al guardar, tu disponibilidad queda al día en la web pública y el portal.
        </p>
      </div>
    </div>
  );
};
