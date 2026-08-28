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

const minToHHMM = (min: number) =>
  `${String(Math.floor(min / 60)).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`;

/** La "G" multicolor de Google, para los eventos que vienen de allá. */
const GoogleG = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 48 48" className={className} aria-hidden>
    <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
    <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
    <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
    <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
  </svg>
);

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

  // ═══ REGLA DE ORO: nada se dibuja encima de otra cosa. ═══
  // Citas Y eventos del calendario conectado (Google/iPhone) entran juntos
  // al mismo reparto de columnas por "clusters" de solape (como Google
  // Calendar): lo que se pisa en horario se pone lado a lado, y lo que no
  // se pisa ocupa todo el ancho.
  type PlacedApt = { kind: "apt"; apt: CalendarAppointment; sMin: number; eMin: number; col: number; cols: number };
  type PlacedExt = { kind: "ext"; ext: ExternalBusyBlock; extIdx: number; sMin: number; eMin: number; col: number; cols: number };
  const placed = useMemo(() => {
    type Raw =
      | { kind: "apt"; apt: CalendarAppointment; sMin: number; eMin: number }
      | { kind: "ext"; ext: ExternalBusyBlock; extIdx: number; sMin: number; eMin: number };
    const raw: Raw[] = [];
    for (const apt of appointments) {
      const s = new Date(apt.start_at);
      const e = new Date(apt.end_at);
      const sMin = s.getHours() * 60 + s.getMinutes();
      raw.push({ kind: "apt", apt, sMin, eMin: sMin + Math.max(1, (e.getTime() - s.getTime()) / 60000) });
    }
    externalBusy.forEach((ext, extIdx) => {
      raw.push({ kind: "ext", ext, extIdx, sMin: ext.start, eMin: Math.max(ext.end, ext.start + 1) });
    });
    raw.sort((a, b) => a.sMin - b.sMin || b.eMin - a.eMin);

    const items: Array<PlacedApt | PlacedExt> = [];
    let cluster: Array<Raw & { col: number }> = [];
    let clusterEnd = -Infinity;
    let colEnds: number[] = [];
    const flush = () => {
      const cols = Math.max(colEnds.length, 1);
      for (const it of cluster) items.push({ ...it, cols } as PlacedApt | PlacedExt);
      cluster = [];
      colEnds = [];
      clusterEnd = -Infinity;
    };
    for (const it of raw) {
      if (cluster.length > 0 && it.sMin >= clusterEnd) flush();
      let col = colEnds.findIndex((end) => end <= it.sMin);
      if (col === -1) {
        col = colEnds.length;
        colEnds.push(it.eMin);
      } else {
        colEnds[col] = it.eMin;
      }
      cluster.push({ ...it, col });
      clusterEnd = Math.max(clusterEnd, it.eMin);
    }
    flush();
    return items;
  }, [appointments, externalBusy]);

  // Cupos libres: se les RESTA todo lo ocupado (citas + calendario conectado).
  // Si a un cupo lo tapa un evento, se recorta al hueco que queda de verdad;
  // si no queda hueco útil (≥20 min), no se dibuja. Nunca se superponen.
  const visibleFreeSlots = useMemo(() => {
    const busy: Array<[number, number]> = [];
    for (const apt of appointments) {
      const s = new Date(apt.start_at);
      const e = new Date(apt.end_at);
      const sMin = s.getHours() * 60 + s.getMinutes();
      busy.push([sMin, sMin + Math.max(1, (e.getTime() - s.getTime()) / 60000)]);
    }
    for (const b of externalBusy) busy.push([b.start, Math.max(b.end, b.start + 1)]);

    const out: Array<{ slot: FreeSlot; sMin: number; eMin: number }> = [];
    for (const slot of freeSlots) {
      let segs: Array<[number, number]> = [[timeToMin(slot.start), timeToMin(slot.end)]];
      for (const [bs, be] of busy) {
        const next: Array<[number, number]> = [];
        for (const [s, e] of segs) {
          if (be <= s || bs >= e) {
            next.push([s, e]);
            continue;
          }
          if (bs > s) next.push([s, bs]);
          if (be < e) next.push([be, e]);
        }
        segs = next;
      }
      for (const [s, e] of segs) {
        if (e - s >= 20) out.push({ slot, sMin: s, eMin: e });
      }
    }
    return out;
  }, [freeSlots, appointments, externalBusy]);

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
        {visibleFreeSlots.map(({ slot, sMin, eMin }) => {
          const top = (sMin / 60 - startHour) * HOUR_H;
          const height = Math.max(((eMin - sMin) / 60) * HOUR_H - 3, 24);
          const compact = height < 44;
          return (
            <button
              key={`free-${sMin}-${eMin}`}
              onClick={(e) => {
                e.stopPropagation();
                onFreeSlotClick?.({ ...slot, start: minToHHMM(sMin), end: minToHHMM(eMin) });
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
                  {minToHHMM(sMin)}
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
        {placed.filter((it): it is PlacedExt => it.kind === "ext").map((it) => {
          const b = it.ext;
          const top = (it.sMin / 60 - startHour) * HOUR_H;
          const height = Math.max(((it.eMin - it.sMin) / 60) * HOUR_H - 3, 24);
          const compact = height < 44;
          const widthPct = 100 / it.cols;
          return (
            <div
              key={`ext-${it.extIdx}-${it.sMin}`}
              className="absolute rounded-[10px] border border-dashed border-muted-foreground/40 pointer-events-none overflow-hidden"
              style={{
                top,
                height,
                left: `calc(${it.col * widthPct}% + 3px)`,
                width: `calc(${widthPct}% - 6px)`,
                // Fondo OPACO: si queda un cupo libre debajo, su texto no
                // debe transparentarse (las letras se pisaban).
                background:
                  "linear-gradient(0deg, hsl(var(--muted) / 0.5), hsl(var(--muted) / 0.5)), hsl(var(--background))",
                // Barrita con el color real del evento en Google
                boxShadow: b.color ? `inset 4px 0 0 ${b.color}` : undefined,
              }}
            >
              <div className={cn("flex items-center gap-2 min-w-0 overflow-hidden h-full", compact ? "px-2" : "px-2.5")}>
                <span
                  className={cn(
                    "flex items-center justify-center rounded-full bg-white shadow-sm shrink-0",
                    compact ? "h-[18px] w-[18px]" : "h-6 w-6"
                  )}
                >
                  <GoogleG className={compact ? "h-2.5 w-2.5" : "h-3.5 w-3.5"} />
                </span>
                <span
                  className={cn(
                    "min-w-0 truncate whitespace-nowrap text-muted-foreground",
                    compact ? "text-[10px]" : "text-[11.5px]"
                  )}
                >
                  <span className={cn("font-semibold text-foreground/85", compact ? "text-[10.5px]" : "text-[12px]")}>
                    «{b.title}»
                  </span>
                  {" · "}
                  {b.source} Calendar · {minToHHMM(b.start)} – {minToHHMM(b.end)}
                </span>
              </div>
            </div>
          );
        })}

        {/* Bloques */}
        {placed.filter((it): it is PlacedApt => it.kind === "apt").map(({ apt, col, cols, sMin, eMin }, idx) => {
          const sD = new Date(apt.start_at);
          const eD = new Date(apt.end_at);
          const top = (sMin / 60 - startHour) * HOUR_H;
          const height = Math.max(((eMin - sMin) / 60) * HOUR_H - 3, 28);
          const compact = height < 48;
          const widthPct = 100 / cols;

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
                  {apt.isPersonal &&
                    (apt.personalEvent?.icon ? (
                      /* Réplica del badge de Google: circulito blanco con
                         sombra, mismo tamaño, con el emoji del evento. */
                      <span
                        className={cn(
                          "flex items-center justify-center rounded-full bg-white shadow-sm shrink-0",
                          compact ? "h-[18px] w-[18px] text-[10px]" : "h-6 w-6 text-[13px]"
                        )}
                        style={{ lineHeight: 1 }}
                      >
                        {apt.personalEvent.icon}
                      </span>
                    ) : (
                      <Coffee className="h-3 w-3 shrink-0 opacity-90" />
                    ))}
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
