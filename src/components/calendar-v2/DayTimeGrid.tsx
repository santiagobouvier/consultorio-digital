// Grilla horaria del día estilo Google Calendar: bloques sólidos de color
// posicionados por hora, línea de "ahora", solapados lado a lado.
// El color identifica: etiqueta fija (evento personal), profesional
// (agenda compartida) o estado de la cita (consultorio unipersonal).
import { useEffect, useMemo, useRef } from "react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { Coffee, Repeat, Video, Sparkles } from "lucide-react";
import {
  CalendarAppointment,
  getPersonalLabel,
  getPaymentColorInfo,
  getEventHexColor,
} from "./types";
import type { FreeSlot } from "@/hooks/use-free-slots";
import type { ExternalBusyBlock } from "@/hooks/use-external-busy";

const HOUR_H = 64;

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
  /** Tocar un hueco libre de la grilla: crea una cita a esa hora (redondeada
   *  a la media hora, como Google Calendar). */
  onSlotTap?: (time: string) => void;
  /** Cupos que la reserva online está ofreciendo: se dibujan punteados. */
  freeSlots?: FreeSlot[];
  onFreeSlotClick?: (slot: FreeSlot) => void;
  /** Eventos del calendario personal conectado (Google/iPhone): se dibujan
   *  como bloques grises de fondo — informan, no se tocan. */
  externalBusy?: ExternalBusyBlock[];
}

const timeToMin = (hhmm: string) => {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
};

export const DayTimeGrid = ({
  appointments,
  onAppointmentClick,
  showProfessionalColors,
  isCurrentDay,
  nowTick,
  onSlotTap,
  freeSlots = [],
  onFreeSlotClick,
  externalBusy = [],
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
    for (const slot of freeSlots) {
      s = Math.min(s, Math.floor(timeToMin(slot.start) / 60));
      e = Math.max(e, Math.ceil(timeToMin(slot.end) / 60));
    }
    for (const b of externalBusy) {
      s = Math.min(s, Math.floor(b.start / 60));
      e = Math.max(e, Math.ceil(b.end / 60));
    }
    return { startHour: s, endHour: Math.min(e, 24) };
  }, [appointments, freeSlots, externalBusy]);

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
      {/* Eje de horas: también las medias horas, para acertarle a las 16:30 */}
      <div className="relative w-12 shrink-0 border-r bg-muted/20" style={{ height: bodyHeight }}>
        {hours.map((h, i) => (
          <span key={h}>
            <span
              className="absolute right-1.5 text-[10px] text-muted-foreground font-medium tabular-nums"
              style={{ top: i * HOUR_H - (i === 0 ? 0 : 7) }}
            >
              {`${String(h).padStart(2, "0")}:00`}
            </span>
            <span
              className="absolute right-1.5 text-[9px] text-muted-foreground/50 tabular-nums"
              style={{ top: i * HOUR_H + HOUR_H / 2 - 6 }}
            >
              {`${String(h).padStart(2, "0")}:30`}
            </span>
          </span>
        ))}
      </div>

      {/* Lienzo del día */}
      <div
        className="relative flex-1 min-w-0"
        style={{ height: bodyHeight }}
        onClick={(e) => {
          if (!onSlotTap) return;
          const rect = e.currentTarget.getBoundingClientRect();
          const minutes = startHour * 60 + ((e.clientY - rect.top) / HOUR_H) * 60;
          const snapped = Math.floor(minutes / 30) * 30;
          const h = Math.floor(snapped / 60);
          const m = snapped % 60;
          if (h < 0 || h > 23) return;
          onSlotTap(`${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`);
        }}
      >
        {/* Líneas de hora y media hora */}
        {hours.map((h, i) => (
          <div key={h}>
            <div
              className="absolute inset-x-0 border-t border-border/60"
              style={{ top: i * HOUR_H }}
              aria-hidden
            />
            <div
              className="absolute inset-x-0 border-t border-dashed border-border/50"
              style={{ top: i * HOUR_H + HOUR_H / 2 }}
              aria-hidden
            />
          </div>
        ))}

        {/* Cupos libres: lo que la reserva online está ofreciendo ahora.
            Se dibujan punteados detrás de las citas; tocarlos abre acciones
            (agendar, cerrar el cupo, compartirlo por WhatsApp). */}
        {freeSlots.map((slot) => {
          const sMin = timeToMin(slot.start);
          const eMin = timeToMin(slot.end);
          const top = (sMin / 60 - startHour) * HOUR_H;
          const height = Math.max(((eMin - sMin) / 60) * HOUR_H - 3, 24);
          const compact = height < 44;
          return (
            <button
              key={`free-${slot.start}`}
              onClick={(e) => {
                e.stopPropagation();
                onFreeSlotClick?.(slot);
              }}
              className={cn(
                "absolute left-[3px] right-[3px] rounded-[10px] border-2 border-dashed text-left transition-colors",
                slot.freed
                  ? "border-amber-500/60 bg-amber-500/[0.07] hover:bg-amber-500/15"
                  : "border-emerald-500/40 bg-emerald-500/[0.05] hover:bg-emerald-500/10"
              )}
              style={{ top, height }}
            >
              <div className={cn("flex items-center gap-1.5 min-w-0", compact ? "px-2 py-0.5" : "px-2.5 py-1.5")}>
                {slot.freed && <Sparkles className="h-3 w-3 shrink-0 text-amber-500" />}
                <span
                  className={cn(
                    "font-semibold tabular-nums",
                    compact ? "text-[10.5px]" : "text-[12px]",
                    slot.freed
                      ? "text-amber-600 dark:text-amber-400"
                      : "text-emerald-600 dark:text-emerald-400"
                  )}
                >
                  {slot.start}
                </span>
                <span
                  className={cn(
                    "font-medium truncate",
                    compact ? "text-[10px]" : "text-[11px]",
                    slot.freed
                      ? "text-amber-600/90 dark:text-amber-400/90"
                      : "text-emerald-600/80 dark:text-emerald-400/80"
                  )}
                >
                  {slot.freed ? "¡Se liberó!" : "Libre"}
                </span>
              </div>
            </button>
          );
        })}

        {/* Tu calendario personal (Google/iPhone): bloques grises de fondo.
            Informan que esa hora es tuya — no se tocan ni bloquean nada. */}
        {externalBusy.map((b, i) => {
          const top = (b.start / 60 - startHour) * HOUR_H;
          const height = Math.max(((b.end - b.start) / 60) * HOUR_H - 3, 24);
          const compact = height < 44;
          return (
            <div
              key={`ext-${i}-${b.start}`}
              className="absolute left-[3px] right-[3px] rounded-[10px] border border-dashed border-muted-foreground/40 bg-muted/50 pointer-events-none overflow-hidden"
              style={{ top, height }}
            >
              <div className={cn("flex items-center gap-1.5 min-w-0 overflow-hidden", compact ? "px-2 py-0.5" : "px-2.5 py-1.5")}>
                <span className={cn("shrink-0", compact ? "text-[10px]" : "text-[11px]")}>📅</span>
                <span
                  className={cn(
                    "font-medium text-foreground/70 truncate min-w-0 whitespace-nowrap",
                    compact ? "text-[10px]" : "text-[11.5px]"
                  )}
                >
                  {b.label}
                </span>
              </div>
            </div>
          );
        })}

        {/* Bloques */}
        {placed.items.map(({ apt, col }, idx) => {
          const sD = new Date(apt.start_at);
          const eD = new Date(apt.end_at);
          const top = ((sD.getHours() * 60 + sD.getMinutes()) / 60 - startHour) * HOUR_H;
          const height = Math.max(((eD.getTime() - sD.getTime()) / 3600000) * HOUR_H - 3, 28);
          const compact = height < 48;
          const widthPct = 100 / placed.cols;

          const cat = apt.isPersonal ? getPersonalLabel(apt.personalEvent) : null;
          const color = getEventHexColor(apt, showProfessionalColors);
          const dimmed = apt.status === "attended";
          const statusChip = !apt.isPersonal ? STATUS_CHIP[apt.status] : null;
          const payInfo = !apt.isPersonal ? getPaymentColorInfo(apt.paymentColor) : null;
          const inProgress =
            isCurrentDay && !apt.isPersonal && !dimmed &&
            sD.getTime() <= nowTick && nowTick < eD.getTime();

          return (
            <button
              key={apt.id}
              onClick={(e) => {
                e.stopPropagation();
                onAppointmentClick(apt);
              }}
              className={cn(
                "absolute rounded-[10px] text-left text-white overflow-hidden transition-all",
                "hover:z-20 hover:-translate-y-px active:scale-[0.99]",
                "animate-in fade-in slide-in-from-bottom-1",
                dimmed && "opacity-55",
                inProgress && "ring-2 ring-white/70 z-10"
              )}
              style={{
                top,
                height,
                left: `calc(${col * widthPct}% + 3px)`,
                width: `calc(${widthPct}% - 6px)`,
                backgroundImage: `linear-gradient(160deg, ${color} 0%, ${color} 60%, rgba(0,0,0,0.22) 165%)`,
                backgroundColor: color,
                boxShadow: `0 6px 18px -8px ${color}cc, 0 1px 2px rgba(0,0,0,0.18)`,
                animationDelay: `${Math.min(idx * 30, 300)}ms`,
                animationDuration: "350ms",
                animationFillMode: "both",
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
                  {apt.isPersonal && apt.personalEvent && apt.personalEvent.recurrence !== "none" && (
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
