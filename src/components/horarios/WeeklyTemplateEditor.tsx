import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Save, Plus, X } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import {
  AvailabilityTemplate,
  DAY_KEYS,
  DAY_LABELS,
  DayKey,
  DayConfig,
} from "@/hooks/use-availability-template";

// Horarios cada 30 min (06:00 a 23:30): elegir de una lista prolija es más
// rápido y menos propenso a errores que el input de hora nativo del navegador.
const TIME_OPTIONS: string[] = (() => {
  const out: string[] = [];
  for (let h = 6; h <= 23; h++) {
    for (const m of [0, 30]) out.push(`${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`);
  }
  return out;
})();

const addMinutesCapped = (hhmm: string, mins: number): string => {
  const [h, m] = hhmm.split(":").map(Number);
  const total = Math.min(h * 60 + m + mins, 23 * 60 + 30);
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
};

// Selector de hora: lista desplegable que abre ya posicionada en el valor
// actual. Si el valor guardado no es múltiplo de 30 (ej: 09:15), se agrega
// a la lista para no romper configuraciones existentes.
const TimeSelect = ({ value, onChange }: { value: string | null; onChange: (v: string) => void }) => {
  const options = value && !TIME_OPTIONS.includes(value)
    ? [...TIME_OPTIONS, value].sort()
    : TIME_OPTIONS;
  return (
    <Select value={value ?? ""} onValueChange={onChange}>
      <SelectTrigger className="h-9 w-[100px] tabular-nums font-medium bg-background">
        <SelectValue placeholder="--:--" />
      </SelectTrigger>
      <SelectContent className="max-h-72 min-w-[100px]">
        {options.map((t) => (
          <SelectItem key={t} value={t} className="tabular-nums">
            {t}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
};

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

  // Al cambiar un inicio, si el fin quedó antes o igual, lo empuja 1 hora
  // después: nunca queda un rango imposible a mano.
  const setRangeStart = (key: DayKey, which: 1 | 2, v: string) => {
    const d = template.days[key];
    const end = which === 1 ? d.end1 : d.end2;
    const patch: Partial<DayConfig> = which === 1 ? { start1: v } : { start2: v };
    if (end && v >= end) {
      if (which === 1) (patch as any).end1 = addMinutesCapped(v, 60);
      else (patch as any).end2 = addMinutesCapped(v, 60);
    }
    updateDay(key, patch);
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
                      <TimeSelect value={day.start1} onChange={(v) => setRangeStart(key, 1, v)} />
                      <span className="text-muted-foreground">–</span>
                      <TimeSelect value={day.end1} onChange={(v) => updateDay(key, { end1: v })} />
                    </div>
                    {day.start2 && (
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground w-16">Tarde</span>
                        <TimeSelect value={day.start2} onChange={(v) => setRangeStart(key, 2, v)} />
                        <span className="text-muted-foreground">–</span>
                        <TimeSelect value={day.end2} onChange={(v) => updateDay(key, { end2: v })} />
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
