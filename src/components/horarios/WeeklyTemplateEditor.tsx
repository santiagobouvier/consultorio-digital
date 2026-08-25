import { useEffect, useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Save, ChevronDown, Sunrise, Sunset, Eraser, CopyPlus, Plus, X, Minus } from "lucide-react";
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

// Rango real de consultorios acá: 06:00 a 22:00.
const GRID_START = 6 * 60;
const GRID_END = 22 * 60;

const DUR_OPTIONS = [30, 45, 60, 90];

const GROTESK = { fontFamily: "'Space Grotesk', sans-serif" } as const;

const sortSessions = (blocks: TimeBlock[]): TimeBlock[] =>
  blocks.slice().sort((a, b) => toMinutes(a.start) - toMinutes(b.start));

const overlaps = (blocks: TimeBlock[], s: number, e: number): boolean =>
  blocks.some((b) => toMinutes(b.start) < e && toMinutes(b.end) > s);

const summaryText = (blocks: TimeBlock[]): string => {
  if (blocks.length === 0) return "Día libre";
  const ranges = mergeBlocks(blocks)
    .map((b) => `${b.start}–${b.end}`)
    .join(" · ");
  return `${blocks.length} sesi${blocks.length === 1 ? "ón" : "ones"} · ${ranges}`;
};

/** Mini línea del día: barra 06–22 con las sesiones pintadas. */
export const DayBar = ({ blocks }: { blocks: TimeBlock[] }) => (
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

// ── Riel de horas: elegir la hora deslizando, con ajuste fino de ±15 ───

const RAIL_TIMES: number[] = (() => {
  const out: number[] = [];
  for (let t = GRID_START; t <= GRID_END - 30; t += 30) out.push(t);
  return out;
})();

export const TimeRail = ({ value, onChange }: { value: number; onChange: (v: number) => void }) => {
  const railRef = useRef<HTMLDivElement>(null);
  // El valor puede quedar fuera de grilla por el ajuste fino (ej: 09:15)
  const times = RAIL_TIMES.includes(value)
    ? RAIL_TIMES
    : [...RAIL_TIMES, value].sort((a, b) => a - b);

  useEffect(() => {
    const el = railRef.current?.querySelector<HTMLButtonElement>("[data-selected='true']");
    el?.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
  }, [value]);

  return (
    <div
      ref={railRef}
      className="flex gap-1.5 overflow-x-auto snap-x pb-1 -mx-1 px-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
    >
      {times.map((t) => {
        const on = t === value;
        return (
          <button
            key={t}
            type="button"
            data-selected={on}
            onClick={() => onChange(t)}
            className={`h-11 px-3.5 rounded-xl text-sm font-semibold tabular-nums shrink-0 snap-center transition-colors border ${
              on
                ? "bg-primary text-primary-foreground border-primary"
                : "bg-muted/30 text-muted-foreground border-border/70"
            }`}
            style={GROTESK}
          >
            {toHHMM(t)}
          </button>
        );
      })}
    </div>
  );
};

interface Props {
  template: AvailabilityTemplate;
  onChange: (t: AvailabilityTemplate) => void;
  onSave: () => Promise<void>;
  saving: boolean;
}

export const WeeklyTemplateEditor = ({ template, onChange, onSave, saving }: Props) => {
  // Un día expandido a la vez: menos ruido, foco total en lo que se edita.
  const [openDay, setOpenDay] = useState<DayKey | null>(null);
  // Hora y duración elegidas para "agregar sesión" del día abierto
  const [pickTime, setPickTime] = useState<number>(9 * 60);
  const [pickDur, setPickDur] = useState<number>(template.slot_duration_minutes || 60);

  const setDayBlocks = (key: DayKey, blocks: TimeBlock[]) => {
    onChange({
      ...template,
      // Se recuerda la última duración usada (y los cupos de la agenda la usan)
      slot_duration_minutes: pickDur,
      days: { ...template.days, [key]: { blocks: sortSessions(blocks) } },
    });
  };

  const openDayPanel = (key: DayKey) => {
    const next = openDay === key ? null : key;
    setOpenDay(next);
    if (next) {
      // Sugerencia: después de la última sesión del día, o 09:00
      const sessions = sortSessions(template.days[key].blocks);
      const last = sessions[sessions.length - 1];
      setPickTime(last ? Math.min(toMinutes(last.end), GRID_END - pickDur) : 9 * 60);
    }
  };

  const addSession = (key: DayKey) => {
    const blocks = template.days[key].blocks;
    const end = Math.min(pickTime + pickDur, GRID_END);
    if (overlaps(blocks, pickTime, end)) {
      toast({
        title: "Ese horario ya está ocupado",
        description: "Se pisa con otra sesión del día. Elegí otra hora o sacá la que está.",
        variant: "destructive",
      });
      return;
    }
    setDayBlocks(key, [...blocks, { start: toHHMM(pickTime), end: toHHMM(end) }]);
    // Deja el riel listo para la próxima: encadena sesiones sin pensar
    setPickTime(Math.min(end, GRID_END - pickDur));
  };

  const removeSession = (key: DayKey, session: TimeBlock) => {
    setDayBlocks(
      key,
      template.days[key].blocks.filter((b) => !(b.start === session.start && b.end === session.end))
    );
  };

  /** Preset: agrega sesiones encadenadas de `pickDur` entre from y to, salteando ocupadas. */
  const addPreset = (key: DayKey, from: number, to: number) => {
    let blocks = template.days[key].blocks;
    for (let t = from; t + pickDur <= to; t += pickDur) {
      if (!overlaps(blocks, t, t + pickDur)) {
        blocks = [...blocks, { start: toHHMM(t), end: toHHMM(t + pickDur) }];
      }
    }
    setDayBlocks(key, blocks);
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

  const totalWeek = DAY_KEYS.reduce((sum, k) => sum + template.days[k].blocks.length, 0);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="pb-4">
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div>
              <CardTitle>Tus cupos de la semana</CardTitle>
              <CardDescription className="mt-1">
                Agregá cada sesión que das en el día — como las das de verdad, sin rangos.
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
        </CardHeader>

        <CardContent className="space-y-2.5">
          {DAY_KEYS.map((key) => {
            const sessions = sortSessions(template.days[key].blocks);
            const isOpen = openDay === key;
            const hasSessions = sessions.length > 0;
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
                  onClick={() => openDayPanel(key)}
                  className="w-full flex items-center gap-3 p-4 text-left min-h-[64px]"
                >
                  <div className="flex-1 min-w-0">
                    <p className={`font-semibold text-[15px] ${hasSessions ? "" : "text-muted-foreground"}`}>
                      {DAY_LABELS[key]}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5 truncate tabular-nums">
                      {summaryText(sessions)}
                    </p>
                  </div>
                  <DayBar blocks={sessions} />
                  <ChevronDown
                    className={`h-4 w-4 text-muted-foreground shrink-0 transition-transform ${isOpen ? "rotate-180" : ""}`}
                  />
                </button>

                {isOpen && (
                  <div className="px-4 pb-4 space-y-3.5">
                    {/* Las sesiones del día, con su horario completo */}
                    {hasSessions ? (
                      <div className="flex flex-wrap gap-2">
                        {sessions.map((s) => (
                          <span
                            key={`${s.start}-${s.end}`}
                            className="inline-flex items-center gap-1 h-12 pl-3.5 pr-1.5 rounded-xl bg-primary/10 border border-primary/30 text-sm font-semibold tabular-nums text-foreground"
                            style={GROTESK}
                          >
                            {s.start}–{s.end}
                            <button
                              type="button"
                              onClick={() => removeSession(key, s)}
                              aria-label={`Sacar la sesión de ${s.start}`}
                              className="h-8 w-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                            >
                              <X className="h-4 w-4" />
                            </button>
                          </span>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground">
                        Sin sesiones este día. Agregá la primera acá abajo 👇
                      </p>
                    )}

                    {/* Agregar sesión: hora + duración de ESTA sesión */}
                    <div className="rounded-xl border border-border/70 bg-muted/20 p-3 space-y-2.5">
                      <TimeRail value={pickTime} onChange={setPickTime} />
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs text-muted-foreground shrink-0">Dura</span>
                        <div className="flex gap-1.5 flex-1">
                          {DUR_OPTIONS.map((d) => (
                            <button
                              key={d}
                              type="button"
                              onClick={() => setPickDur(d)}
                              className={`h-10 flex-1 rounded-xl text-[13px] font-semibold tabular-nums transition-colors border ${
                                pickDur === d
                                  ? "bg-primary/15 text-primary border-primary/50"
                                  : "bg-background text-muted-foreground border-border"
                              }`}
                              style={GROTESK}
                            >
                              {d}’
                            </button>
                          ))}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          aria-label="15 minutos antes"
                          onClick={() => setPickTime(Math.max(GRID_START, pickTime - 15))}
                          className="h-11 w-11 rounded-xl border border-border bg-background flex items-center justify-center text-muted-foreground active:scale-95 transition-transform shrink-0"
                        >
                          <Minus className="h-4 w-4" />
                        </button>
                        <Button
                          type="button"
                          className="flex-1 h-11 rounded-xl gap-2 text-[15px] font-bold"
                          onClick={() => addSession(key)}
                        >
                          <Plus className="h-4 w-4" />
                          Agregar {toHHMM(pickTime)}–{toHHMM(Math.min(pickTime + pickDur, GRID_END))}
                        </Button>
                        <button
                          type="button"
                          aria-label="15 minutos después"
                          onClick={() => setPickTime(Math.min(GRID_END - pickDur, pickTime + 15))}
                          className="h-11 w-11 rounded-xl border border-border bg-background flex items-center justify-center text-muted-foreground active:scale-95 transition-transform shrink-0"
                        >
                          <Plus className="h-4 w-4" />
                        </button>
                      </div>
                    </div>

                    {/* Atajos: armar o limpiar el día en un toque */}
                    <div className="flex flex-wrap gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-10 rounded-xl gap-1.5"
                        onClick={() => addPreset(key, 9 * 60, 13 * 60)}
                      >
                        <Sunrise className="h-4 w-4 text-primary" /> Mañana 9–13
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-10 rounded-xl gap-1.5"
                        onClick={() => addPreset(key, 15 * 60, 19 * 60)}
                      >
                        <Sunset className="h-4 w-4 text-primary" /> Tarde 15–19
                      </Button>
                      {hasSessions && (
                        <>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="h-10 rounded-xl gap-1.5"
                            onClick={() => copyToWeekdays(key)}
                          >
                            <CopyPlus className="h-4 w-4 text-primary" /> Copiar a lun–vie
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-10 rounded-xl gap-1.5 text-muted-foreground"
                            onClick={() => setDayBlocks(key, [])}
                          >
                            <Eraser className="h-4 w-4" /> Vaciar
                          </Button>
                        </>
                      )}
                    </div>
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
