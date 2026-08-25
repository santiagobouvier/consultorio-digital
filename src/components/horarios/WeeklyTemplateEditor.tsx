import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Save, ChevronDown, Sunrise, Sunset, Eraser, CopyPlus } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import {
  AvailabilityTemplate,
  DAY_KEYS,
  DAY_LABELS,
  DayKey,
  TimeBlock,
  mergeBlocks,
  toMinutes,
  toHHMM,
} from "@/hooks/use-availability-template";

// La grilla de fichas va de 07:00 a 22:00 (rango real de consultorios acá).
const GRID_START = 7 * 60;
const GRID_END = 22 * 60;

const STEP_OPTIONS = [30, 45, 60, 90];

const GROTESK = { fontFamily: "'Space Grotesk', sans-serif" } as const;

// ── Operaciones de cobertura (en minutos) ──────────────────────────────

/** ¿El intervalo [s, e) está completamente dentro de algún bloque? */
const isCovered = (blocks: TimeBlock[], s: number, e: number): boolean =>
  blocks.some((b) => toMinutes(b.start) <= s && toMinutes(b.end) >= e);

/** Suma el intervalo [s, e) a la cobertura del día. */
const addInterval = (blocks: TimeBlock[], s: number, e: number): TimeBlock[] =>
  mergeBlocks([...blocks, { start: toHHMM(s), end: toHHMM(e) }]);

/** Resta el intervalo [s, e) de la cobertura del día. */
const subtractInterval = (blocks: TimeBlock[], s: number, e: number): TimeBlock[] => {
  const out: TimeBlock[] = [];
  for (const b of blocks) {
    const bs = toMinutes(b.start);
    const be = toMinutes(b.end);
    if (be <= s || bs >= e) {
      out.push(b);
      continue;
    }
    if (bs < s) out.push({ start: toHHMM(bs), end: toHHMM(s) });
    if (be > e) out.push({ start: toHHMM(e), end: toHHMM(be) });
  }
  return out;
};

/** Fichas del día: la grilla estándar más los inicios fuera de grilla ya guardados. */
const chipStarts = (blocks: TimeBlock[], step: number): number[] => {
  const set = new Set<number>();
  for (let t = GRID_START; t + step <= GRID_END; t += step) set.add(t);
  for (const b of blocks) {
    const s = toMinutes(b.start);
    if (s + step <= GRID_END && !set.has(s)) set.add(s);
  }
  return [...set].sort((a, b) => a - b);
};

/** Cantidad de sesiones que entran en los bloques del día. */
const sessionCount = (blocks: TimeBlock[], step: number): number =>
  mergeBlocks(blocks).reduce(
    (sum, b) => sum + Math.floor((toMinutes(b.end) - toMinutes(b.start)) / step),
    0
  );

const summaryText = (blocks: TimeBlock[], step: number): string => {
  const merged = mergeBlocks(blocks);
  if (merged.length === 0) return "Día libre";
  const n = sessionCount(merged, step);
  const ranges = merged.map((b) => `${b.start}–${b.end}`).join(" · ");
  return `${n} sesi${n === 1 ? "ón" : "ones"} · ${ranges}`;
};

/** Mini línea del día: barra 07–22 con los bloques pintados. */
const DayBar = ({ blocks }: { blocks: TimeBlock[] }) => (
  <div className="relative h-2 w-20 sm:w-32 rounded-full bg-muted overflow-hidden shrink-0">
    {mergeBlocks(blocks).map((b, i) => {
      const s = Math.max(0, (toMinutes(b.start) - GRID_START) / (GRID_END - GRID_START));
      const e = Math.min(1, (toMinutes(b.end) - GRID_START) / (GRID_END - GRID_START));
      if (e <= s) return null;
      return (
        <span
          key={i}
          className="absolute top-0 bottom-0 rounded-full bg-primary"
          style={{ left: `${s * 100}%`, width: `${(e - s) * 100}%` }}
        />
      );
    })}
  </div>
);

interface Props {
  template: AvailabilityTemplate;
  onChange: (t: AvailabilityTemplate) => void;
  onSave: () => Promise<void>;
  saving: boolean;
}

export const WeeklyTemplateEditor = ({ template, onChange, onSave, saving }: Props) => {
  // Un día expandido a la vez: menos ruido, foco total en lo que se edita.
  const [openDay, setOpenDay] = useState<DayKey | null>(null);

  const step = template.slot_duration_minutes || 60;

  const setDayBlocks = (key: DayKey, blocks: TimeBlock[]) => {
    onChange({
      ...template,
      days: { ...template.days, [key]: { blocks: mergeBlocks(blocks) } },
    });
  };

  const toggleChip = (key: DayKey, start: number) => {
    const blocks = template.days[key].blocks;
    const end = start + step;
    setDayBlocks(
      key,
      isCovered(blocks, start, end)
        ? subtractInterval(blocks, start, end)
        : addInterval(blocks, start, end)
    );
  };

  const copyToWeekdays = (from: DayKey) => {
    const src = template.days[from].blocks;
    const weekdays: DayKey[] = ["monday", "tuesday", "wednesday", "thursday", "friday"];
    onChange({
      ...template,
      days: {
        ...template.days,
        ...weekdays.reduce(
          (acc, k) => ({ ...acc, [k]: { blocks: src.map((b) => ({ ...b })) } }),
          {} as Partial<Record<DayKey, { blocks: TimeBlock[] }>>
        ),
      },
    });
    toast({
      title: "Semana copiada",
      description: `Lunes a viernes ahora atienden igual que el ${DAY_LABELS[from].toLowerCase()}. Guardá para confirmar.`,
    });
  };

  const totalWeek = DAY_KEYS.reduce((sum, k) => sum + sessionCount(template.days[k].blocks, step), 0);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="pb-4">
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div>
              <CardTitle>Tu semana, sesión por sesión</CardTitle>
              <CardDescription className="mt-1">
                Tocá las fichas para prender o apagar cada sesión. Nada de rangos ni relojes.
              </CardDescription>
            </div>
            {totalWeek > 0 && (
              <div className="text-right shrink-0">
                <p className="text-2xl font-bold leading-none text-primary" style={GROTESK}>
                  {totalWeek}
                </p>
                <p className="text-[10px] text-muted-foreground uppercase tracking-wide mt-0.5">
                  sesiones/semana
                </p>
              </div>
            )}
          </div>

          {/* Ritmo: cuánto dura cada ficha */}
          <div className="mt-3">
            <p className="text-xs font-medium text-muted-foreground mb-2">Cada sesión dura</p>
            <div className="grid grid-cols-4 gap-2">
              {STEP_OPTIONS.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => onChange({ ...template, slot_duration_minutes: s })}
                  className={`h-11 rounded-xl text-sm font-semibold tabular-nums transition-colors border ${
                    step === s
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-muted/40 text-muted-foreground border-border hover:bg-muted"
                  }`}
                  style={GROTESK}
                >
                  {s} min
                </button>
              ))}
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-2.5">
          {DAY_KEYS.map((key) => {
            const blocks = template.days[key].blocks;
            const isOpen = openDay === key;
            const hasSessions = blocks.length > 0;
            return (
              <div
                key={key}
                className={`border rounded-2xl bg-card transition-colors ${
                  isOpen ? "border-primary/40" : hasSessions ? "border-border" : "border-border/60"
                }`}
              >
                {/* Cabecera del día: resumen + barrita, todo tocable */}
                <button
                  type="button"
                  onClick={() => setOpenDay(isOpen ? null : key)}
                  className="w-full flex items-center gap-3 p-4 text-left min-h-[64px]"
                >
                  <div className="flex-1 min-w-0">
                    <p className={`font-semibold text-[15px] ${hasSessions ? "" : "text-muted-foreground"}`}>
                      {DAY_LABELS[key]}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5 truncate tabular-nums">
                      {summaryText(blocks, step)}
                    </p>
                  </div>
                  <DayBar blocks={blocks} />
                  <ChevronDown
                    className={`h-4 w-4 text-muted-foreground shrink-0 transition-transform ${isOpen ? "rotate-180" : ""}`}
                  />
                </button>

                {isOpen && (
                  <div className="px-4 pb-4 space-y-3">
                    {/* Atajos: armar el día en un toque */}
                    <div className="flex flex-wrap gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-10 rounded-xl gap-1.5"
                        onClick={() => setDayBlocks(key, addInterval(blocks, 9 * 60, 13 * 60))}
                      >
                        <Sunrise className="h-4 w-4 text-primary" /> Mañana 9–13
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-10 rounded-xl gap-1.5"
                        onClick={() => setDayBlocks(key, addInterval(blocks, 15 * 60, 19 * 60))}
                      >
                        <Sunset className="h-4 w-4 text-primary" /> Tarde 15–19
                      </Button>
                      {hasSessions && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-10 rounded-xl gap-1.5 text-muted-foreground"
                          onClick={() => setDayBlocks(key, [])}
                        >
                          <Eraser className="h-4 w-4" /> Vaciar
                        </Button>
                      )}
                    </div>

                    {/* Las fichas: una por sesión posible */}
                    <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
                      {chipStarts(blocks, step).map((t) => {
                        const on = isCovered(blocks, t, t + step);
                        return (
                          <button
                            key={t}
                            type="button"
                            onClick={() => toggleChip(key, t)}
                            aria-pressed={on}
                            className={`h-12 rounded-xl text-[15px] font-semibold tabular-nums transition-all active:scale-[0.96] border ${
                              on
                                ? "bg-primary text-primary-foreground border-primary shadow-sm"
                                : "bg-muted/30 text-muted-foreground border-border/70 hover:bg-muted/60"
                            }`}
                            style={GROTESK}
                          >
                            {toHHMM(t)}
                          </button>
                        );
                      })}
                    </div>

                    {hasSessions && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-10 rounded-xl gap-1.5 w-full sm:w-auto"
                        onClick={() => copyToWeekdays(key)}
                      >
                        <CopyPlus className="h-4 w-4 text-primary" /> Copiar a lunes–viernes
                      </Button>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </CardContent>
      </Card>

      <div className="sticky bottom-4 space-y-1.5">
        <Button onClick={() => onSave()} disabled={saving} size="lg" className="w-full h-12 rounded-xl">
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
