// Grilla horaria del día estilo Google Calendar: bloques sólidos de color
// posicionados por hora, línea de "ahora", solapados lado a lado.
// El color identifica: etiqueta fija (evento personal), profesional
// (agenda compartida) o estado de la cita (consultorio unipersonal).
import { useEffect, useMemo, useRef } from "react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { Coffee, Repeat, Video } from "lucide-react";
import {
  CalendarAppointment,
  getPersonalCategory,
  getPaymentColorInfo,
} from "./types";

const HOUR_H = 64;

// Colores sólidos por estado (cuando no se colorea por profesional)
const STATUS_HEX: Record<string, string> = {
  pending: "#f59e0b",
  reschedule_requested: "#eab308",
  confirmed: "#00b5b5",
  scheduled: "#00b5b5",
  attended: "#94a3b8",
  no_show: "#f87171",
};

const STATUS_CHIP: Record<string, string> = {
  pending: "Pendiente",
  reschedule_requested: "Reprogramación",
  no_show: "Ausente",
};

interface DayTimeGridProps {
  appointments: CalendarAppointment[]; // solo las del día, sin canceladas
  onAppointmentClick: (apt: CalendarAppointment) => void;
  showProfessionalColors: boolean;
  isCurrentDay: boolean;
  nowTick: number;
}

export const DayTimeGrid = ({
  appointments,
  onAppointmentClick,
  showProfessionalColors,
  isCurrentDay,
  nowTick,
}: DayTimeGridProps) => {
  const nowRef = useRef<HTMLDivElement>(null);

  // Rango horario dinámico: siempre cubre 7-21 y se estira si hay eventos afuera
  const { startHour, endHour } = useMemo(() => {
    let s = 7;
    let e = 21;
    for (const apt of appointments) {
      const sD = new Date(apt.start_at);
      const eD = new Date(apt.end_at);
      s = Math.min(s, sD.getHours());
      e = Math.max(e, eD.getMinutes() > 0 ? eD.getHours() + 1 : eD.getHours());
    }
    return { startHour: s, endHour: Math.min(e, 24) };
  }, [appointments]);

  const hours = useMemo(() => {
    const out: number[] = [];
    for (let h = startHour; h < endHour; h++) out.push(h);
    return out;
  }, [startHour, endHour]);
  const bodyHeight = hours.length * HOUR_H;

  // Solapados lado a lado (mismo algoritmo que la semana desktop)
  const placed = useMemo(() => {
    const sorted = [...appointments].sort(
      (a, b) => new Date(a.start_at).getTime() - new Date(b.start_at).getTime()
    );
    const colEnds: number[] = [];
    const out = sorted.map((apt) => {
      const sMs = new Date(apt.start_at).getTime();
      const eMs = new Date(apt.end_at).getTime();
      let col = colEnds.findIndex((end) => end <= sMs);
      if (col === -1) {
        col = colEnds.length;
        colEnds.push(eMs);
      } else {
        colEnds[col] = eMs;
      }
      return { apt, col };
    });
    return { items: out, cols: Math.max(colEnds.length, 1) };
  }, [appointments]);

  const nowDate = new Date(nowTick);
  const nowTop = ((nowDate.getHours() * 60 + nowDate.getMinutes()) / 60 - startHour) * HOUR_H;
  const nowVisible = isCurrentDay && nowTop >= 0 && nowTop <= bodyHeight;

  // Al abrir HOY, centrar la vista en la línea de "ahora" (como Google)
  useEffect(() => {
    if (!nowVisible || !nowRef.current) return;
    const t = window.setTimeout(() => {
      nowRef.current?.scrollIntoView({ block: "center", behavior: "instant" as ScrollBehavior });
    }, 80);
    return () => window.clearTimeout(t);
    // Solo al montar / cambiar de día
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nowVisible]);

  return (
    <div className="flex bg-card">
      {/* Eje de horas */}
      <div className="relative w-12 shrink-0 border-r bg-muted/20" style={{ height: bodyHeight }}>
        {hours.map((h, i) => (
          <span
            key={h}
            className="absolute right-1.5 text-[10px] text-muted-foreground font-medium tabular-nums"
            style={{ top: i * HOUR_H - (i === 0 ? 0 : 7) }}
          >
            {`${String(h).padStart(2, "0")}:00`}
          </span>
        ))}
      </div>

      {/* Lienzo del día */}
      <div className="relative flex-1 min-w-0" style={{ height: bodyHeight }}>
        {/* Líneas de hora y media hora */}
        {hours.map((h, i) => (
          <div key={h}>
            <div
              className="absolute inset-x-0 border-t border-border/60"
              style={{ top: i * HOUR_H }}
              aria-hidden
            />
            <div
              className="absolute inset-x-0 border-t border-dashed border-border/30"
              style={{ top: i * HOUR_H + HOUR_H / 2 }}
              aria-hidden
            />
          </div>
        ))}

        {/* Bloques */}
        {placed.items.map(({ apt, col }) => {
          const sD = new Date(apt.start_at);
          const eD = new Date(apt.end_at);
          const top = ((sD.getHours() * 60 + sD.getMinutes()) / 60 - startHour) * HOUR_H;
          const height = Math.max(((eD.getTime() - sD.getTime()) / 3600000) * HOUR_H - 3, 28);
          const compact = height < 48;
          const widthPct = 100 / placed.cols;

          const cat = apt.isPersonal ? getPersonalCategory(apt.personalEvent?.category) : null;
          const color = cat
            ? cat.color
            : showProfessionalColors && apt.professional
              ? apt.professional.color
              : STATUS_HEX[apt.status] ?? "#00b5b5";
          const dimmed = apt.status === "attended";
          const statusChip = !apt.isPersonal ? STATUS_CHIP[apt.status] : null;
          const payInfo = !apt.isPersonal ? getPaymentColorInfo(apt.paymentColor) : null;
          const inProgress =
            isCurrentDay && !apt.isPersonal && !dimmed &&
            sD.getTime() <= nowTick && nowTick < eD.getTime();

          return (
            <button
              key={apt.id}
              onClick={() => onAppointmentClick(apt)}
              className={cn(
                "absolute rounded-lg text-left text-white shadow-sm overflow-hidden transition-all",
                "hover:shadow-lg hover:z-20 active:scale-[0.99]",
                dimmed && "opacity-55",
                inProgress && "ring-2 ring-white/70 z-10 shadow-lg"
              )}
              style={{
                top,
                height,
                left: `calc(${col * widthPct}% + 3px)`,
                width: `calc(${widthPct}% - 6px)`,
                backgroundColor: color,
              }}
            >
              {/* Franja sutil para eventos personales (se distinguen de citas) */}
              {apt.isPersonal && (
                <div
                  className="absolute inset-0 opacity-[0.14] pointer-events-none"
                  style={{
                    backgroundImage:
                      "repeating-linear-gradient(45deg, #fff 0 5px, transparent 5px 11px)",
                  }}
                  aria-hidden
                />
              )}
              <div className={cn("relative h-full flex flex-col", compact ? "px-2 py-1" : "px-2.5 py-1.5")}>
                <div className="flex items-center gap-1.5 min-w-0">
                  {apt.isPersonal && <Coffee className="h-3 w-3 shrink-0 opacity-90" />}
                  {apt.modality === "online" && !apt.isPersonal && (
                    <Video className="h-3 w-3 shrink-0 opacity-90" />
                  )}
                  <p className={cn("font-semibold truncate leading-tight", compact ? "text-[11.5px]" : "text-[13px]")}>
                    {apt.isPersonal
                      ? apt.personalEvent?.title || "Personal"
                      : apt.patients?.full_name || "Sin paciente"}
                  </p>
                  {apt.isPersonal && apt.personalEvent?.recurrence === "weekly" && (
                    <Repeat className="h-2.5 w-2.5 shrink-0 opacity-80" />
                  )}
                  {payInfo && (
                    <span className={cn("w-2 h-2 rounded-full shrink-0 ml-auto ring-1 ring-white/60", payInfo.className)} />
                  )}
                </div>
                {!compact && (
                  <p className="text-[10.5px] opacity-90 tabular-nums leading-tight mt-0.5">
                    {format(sD, "HH:mm")} – {format(eD, "HH:mm")}
                    {!apt.isPersonal && apt.services?.name ? ` · ${apt.services.name}` : ""}
                  </p>
                )}
                {/* Etiquetas al pie: estado / etiqueta personal */}
                {!compact && (statusChip || cat || inProgress) && (
                  <div className="mt-auto flex items-center gap-1 pt-0.5">
                    {inProgress && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-white/25 px-1.5 py-px text-[9px] font-bold uppercase tracking-wide">
                        <span className="w-1 h-1 rounded-full bg-white animate-pulse" />
                        En curso
                      </span>
                    )}
                    {statusChip && (
                      <span className="inline-flex rounded-full bg-black/20 px-1.5 py-px text-[9px] font-semibold">
                        {statusChip}
                      </span>
                    )}
                    {cat && (
                      <span className="inline-flex rounded-full bg-black/20 px-1.5 py-px text-[9px] font-semibold">
                        {cat.label}
                      </span>
                    )}
                  </div>
                )}
              </div>
            </button>
          );
        })}

        {/* Línea de AHORA */}
        {nowVisible && (
          <div
            ref={nowRef}
            className="absolute inset-x-0 z-30 pointer-events-none flex items-center"
            style={{ top: nowTop }}
          >
            <span className="rounded-full bg-destructive text-white text-[9px] font-bold tabular-nums px-1.5 py-px -ml-1 shadow">
              {format(nowDate, "HH:mm")}
            </span>
            <span className="flex-1 h-[2px] bg-destructive" />
          </div>
        )}
      </div>
    </div>
  );
};
