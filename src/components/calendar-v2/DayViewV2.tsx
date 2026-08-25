import { useEffect, useMemo, useState } from "react";
import { format, isSameDay } from "date-fns";
import { es } from "date-fns/locale";
import { CalendarAppointment, Professional, DayPayment } from "./types";
import { DayTimeGrid } from "./DayTimeGrid";
import { DayMiniTimeline } from "./DayMiniTimeline";
import { useDashboardBranding } from "@/contexts/DashboardBrandingContext";
import type { FreeSlot, WeekSlotSummary } from "@/hooks/use-free-slots";
import { CalendarDays, Plus, Clock, AlertTriangle, CreditCard, Check, X, CircleDashed } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { calculatePaymentStatus, formatCurrency } from "@/lib/payments";

// Re-export for backwards compatibility
export type { DayPayment };

interface DayViewV2Props {
  currentDate: Date;
  appointments: CalendarAppointment[];
  onAppointmentClick: (appointment: CalendarAppointment) => void;
  onAddAppointment: () => void;
  showProfessionalColors: boolean;
  professionals?: Professional[];
  dayPayments?: DayPayment[];
  onPaymentClick?: (payment: DayPayment) => void;
  onSlotTap?: (time: string) => void;
  /** Cupos libres del día (lo que ofrece la reserva online). */
  freeSlots?: FreeSlot[];
  onFreeSlotClick?: (slot: FreeSlot) => void;
  /** Resumen de control de la semana: cupos libres vs reservadas. */
  weekSummary?: WeekSlotSummary | null;
}

const CANCELLED_STATUSES = ["cancelled", "cancelled_by_patient"];

const HOUR_HEIGHT = 60;
const START_HOUR = 7;
const END_HOUR = 21;

const AppointmentBlock = ({
  apt,
  onClick,
  professionalColor,
}: {
  apt: CalendarAppointment;
  onClick: () => void;
  professionalColor: string;
}) => {
  const startDate = new Date(apt.start_at);
  const endDate = new Date(apt.end_at);
  const startMinutes = startDate.getHours() * 60 + startDate.getMinutes();
  const endMinutes = endDate.getHours() * 60 + endDate.getMinutes();
  const durationMinutes = endMinutes - startMinutes;
  const top = ((startMinutes - START_HOUR * 60) / 60) * HOUR_HEIGHT;
  const height = Math.max((durationMinutes / 60) * HOUR_HEIGHT - 2, 24);
  const isCompact = height < 45;

  return (
    <div
      onClick={onClick}
      className={cn(
        "absolute left-1 right-1 rounded-lg border-l-4 bg-card shadow-sm cursor-pointer transition-all hover:shadow-md hover:scale-[1.01] overflow-hidden",
        apt.status === "attended" && "opacity-60",
        apt.status === "cancelled" && "opacity-40"
      )}
      style={{
        top: `${top}px`,
        height: `${height}px`,
        borderLeftColor: professionalColor,
      }}
    >
      <div className={cn("p-2 h-full flex flex-col", isCompact && "p-1.5")}>
        <p className={cn("font-medium truncate text-foreground", isCompact ? "text-xs" : "text-sm")}>
          {apt.patients?.full_name || "Sin paciente"}
        </p>
        {!isCompact && (
          <div className="mt-auto flex items-center gap-1 text-[10px] text-muted-foreground">
            <Clock className="h-3 w-3" />
            {format(startDate, "HH:mm")} - {format(endDate, "HH:mm")}
          </div>
        )}
      </div>
    </div>
  );
};

const NowIndicator = () => {
  const now = new Date();
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  const top = ((nowMinutes - START_HOUR * 60) / 60) * HOUR_HEIGHT;
  if (now.getHours() < START_HOUR || now.getHours() >= END_HOUR) return null;

  return (
    <div
      className="absolute left-0 right-0 flex items-center z-20 pointer-events-none"
      style={{ top: `${top}px` }}
    >
      <div className="w-3 h-3 rounded-full bg-destructive" />
      <div className="flex-1 h-0.5 bg-destructive" />
    </div>
  );
};

export const DayViewV2 = ({
  currentDate,
  appointments,
  onAppointmentClick,
  onAddAppointment,
  showProfessionalColors,
  professionals = [],
  dayPayments = [],
  onPaymentClick,
  onSlotTap,
  freeSlots = [],
  onFreeSlotClick,
  weekSummary = null,
}: DayViewV2Props) => {
  const dayAppointments = useMemo(
    () =>
      appointments
        .filter((apt) => isSameDay(new Date(apt.start_at), currentDate))
        .sort((a, b) => new Date(a.start_at).getTime() - new Date(b.start_at).getTime()),
    [appointments, currentDate]
  );

  const isCurrentDay = isSameDay(currentDate, new Date());
  const useMultiColumn = showProfessionalColors && professionals.length > 1;
  const activeAppointments = useMemo(
    () => dayAppointments.filter((a) => !CANCELLED_STATUSES.includes(a.status)),
    [dayAppointments]
  );
  const cancelledAppointments = useMemo(
    () => dayAppointments.filter((a) => CANCELLED_STATUSES.includes(a.status)),
    [dayAppointments]
  );
  const hours = Array.from({ length: END_HOUR - START_HOUR }, (_, i) => START_HOUR + i);

  // Reloj para la línea de "ahora" y el estado EN CURSO (se mueve solo)
  const [nowTick, setNowTick] = useState(() => Date.now());
  useEffect(() => {
    if (!isCurrentDay) return;
    const t = window.setInterval(() => setNowTick(Date.now()), 60_000);
    return () => window.clearInterval(t);
  }, [isCurrentDay]);

  // Resumen del día para el encabezado
  const dayStats = useMemo(() => {
    const active = dayAppointments.filter((a) => !CANCELLED_STATUSES.includes(a.status));
    const done = dayAppointments.filter((a) => a.status === "attended").length;
    const cancelled = dayAppointments.length - active.length;
    const first = active[0] ? format(new Date(active[0].start_at), "HH:mm") : null;
    const last = active.length
      ? format(new Date(active[active.length - 1].end_at), "HH:mm")
      : null;
    const occupiedMin = active.reduce(
      (acc, a) => acc + Math.max(0, (new Date(a.end_at).getTime() - new Date(a.start_at).getTime()) / 60000),
      0
    );
    return { activeCount: active.length, done, cancelled, first, last, occupiedMin };
  }, [dayAppointments]);

  const { primaryColor } = useDashboardBranding();
  const formatOccupied = (min: number) => {
    const h = Math.floor(min / 60);
    const m = Math.round(min % 60);
    if (h === 0) return `${m} min`;
    return m === 0 ? `${h} h` : `${h} h ${m}`;
  };

  // Marcar cupos que se liberaron por una cancelación del día: oportunidad
  const decoratedFreeSlots = useMemo(() => {
    if (freeSlots.length === 0) return freeSlots;
    const cancelledRanges = cancelledAppointments.map((a) => {
      const s = new Date(a.start_at);
      const e = new Date(a.end_at);
      return {
        start: s.getHours() * 60 + s.getMinutes(),
        end: e.getHours() * 60 + e.getMinutes(),
      };
    });
    if (cancelledRanges.length === 0) return freeSlots;
    const toMin = (t: string) => {
      const [h, m] = t.split(":").map(Number);
      return h * 60 + m;
    };
    return freeSlots.map((slot) => {
      const s = toMin(slot.start);
      const e = toMin(slot.end);
      const freed = cancelledRanges.some((r) => r.start < e && r.end > s);
      return freed ? { ...slot, freed: true } : slot;
    });
  }, [freeSlots, cancelledAppointments]);

  // Group appointments by professional for multi-column view
  const columnData = useMemo(() => {
    if (!useMultiColumn) return null;
    return professionals.map((prof) => ({
      professional: prof,
      appointments: dayAppointments.filter((apt) => apt.professional_id === prof.userId),
    }));
  }, [useMultiColumn, professionals, dayAppointments]);

  return (
    <div className="space-y-4">
      {/* Cabecera del día: bloque de fecha con color de marca, contador,
          el día en miniatura y chips de métricas. */}
      <div
        className="relative overflow-hidden rounded-2xl border border-border/60 p-4 sm:p-5"
        style={{
          background: `linear-gradient(135deg, hsla(${primaryColor}, 0.13) 0%, hsla(${primaryColor}, 0.04) 55%, transparent 85%)`,
        }}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div
              className={cn(
                "w-14 h-14 rounded-2xl flex flex-col items-center justify-center shrink-0",
                !isCurrentDay && "bg-card border border-border/70"
              )}
              style={
                isCurrentDay
                  ? {
                      background: `hsl(${primaryColor})`,
                      color: "#fff",
                      boxShadow: `0 10px 24px -10px hsla(${primaryColor}, 0.65)`,
                    }
                  : undefined
              }
            >
              <span className="text-[10px] font-bold uppercase tracking-wide leading-none opacity-80">
                {format(currentDate, "EEE", { locale: es })}
              </span>
              <span className="text-[22px] font-extrabold leading-none mt-1">
                {format(currentDate, "d")}
              </span>
            </div>
            <div className="min-w-0">
              <h2 className="text-lg sm:text-xl font-bold capitalize leading-tight truncate">
                {format(currentDate, "EEEE", { locale: es })}
                {isCurrentDay && (
                  <span className="ml-2 align-middle inline-flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-primary bg-primary/10 border border-primary/20 rounded-full px-2 py-0.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
                    Hoy
                  </span>
                )}
              </h2>
              <p className="text-muted-foreground text-sm">
                {format(currentDate, "d 'de' MMMM, yyyy", { locale: es })}
              </p>
            </div>
          </div>
          <div className="text-right shrink-0">
            <span className="text-3xl font-extrabold text-primary tabular-nums leading-none">
              {dayStats.activeCount}
            </span>
            <span className="block text-[11px] text-muted-foreground mt-0.5">
              sesion{dayStats.activeCount !== 1 ? "es" : ""}
            </span>
          </div>
        </div>

        {/* El día en miniatura */}
        <DayMiniTimeline
          appointments={dayAppointments}
          showProfessionalColors={showProfessionalColors}
          isCurrentDay={isCurrentDay}
          className="mt-4"
        />

        {(dayStats.first || dayStats.done > 0 || dayStats.cancelled > 0 || weekSummary || freeSlots.length > 0) && (
          <div className="mt-3 flex flex-wrap items-center gap-1.5">
            {freeSlots.length > 0 && (
              <span className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 rounded-full px-2.5 py-1 tabular-nums">
                <CircleDashed className="h-3 w-3" />
                {freeSlots.length} cupo{freeSlots.length !== 1 ? "s" : ""} libre{freeSlots.length !== 1 ? "s" : ""}
              </span>
            )}
            {weekSummary && (weekSummary.free > 0 || weekSummary.booked > 0) && (
              <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground bg-background/60 border border-border/50 rounded-full px-2.5 py-1 tabular-nums">
                Semana: {weekSummary.booked} reservada{weekSummary.booked !== 1 ? "s" : ""} · {weekSummary.free} libre{weekSummary.free !== 1 ? "s" : ""}
              </span>
            )}
            {dayStats.first && dayStats.last && (
              <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground bg-background/60 border border-border/50 rounded-full px-2.5 py-1 tabular-nums">
                <Clock className="h-3 w-3" />
                {dayStats.first} → {dayStats.last}
              </span>
            )}
            {dayStats.occupiedMin > 0 && (
              <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground bg-background/60 border border-border/50 rounded-full px-2.5 py-1 tabular-nums">
                {formatOccupied(dayStats.occupiedMin)} de atención
              </span>
            )}
            {dayStats.done > 0 && (
              <span className="inline-flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 rounded-full px-2.5 py-1">
                <Check className="h-3 w-3" />
                {dayStats.done} realizada{dayStats.done !== 1 ? "s" : ""}
              </span>
            )}
            {dayStats.cancelled > 0 && (
              <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground bg-background/60 border border-border/50 rounded-full px-2.5 py-1">
                <X className="h-3 w-3" />
                {dayStats.cancelled} cancelada{dayStats.cancelled !== 1 ? "s" : ""}
              </span>
            )}
          </div>
        )}
      </div>

      {/* Multi-column time grid (desktop, 2+ professionals) */}
      {useMultiColumn && columnData ? (
        <div className="hidden md:block bg-card rounded-2xl border overflow-hidden">
          {/* Column headers */}
          <div className="grid border-b" style={{ gridTemplateColumns: `48px repeat(${columnData.length}, 1fr)` }}>
            <div className="border-r" />
            {columnData.map(({ professional }) => (
              <div
                key={professional.id}
                className="py-3 px-2 text-center border-r last:border-r-0 flex items-center justify-center gap-2"
              >
                <div
                  className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0"
                  style={{ backgroundColor: professional.color }}
                >
                  {professional.name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase()}
                </div>
                <span className="text-sm font-semibold truncate">{professional.name}</span>
              </div>
            ))}
          </div>

          {/* Time grid */}
          <div className="overflow-auto max-h-[calc(100vh-320px)]">
            <div
              className="grid relative"
              style={{ gridTemplateColumns: `48px repeat(${columnData.length}, 1fr)` }}
            >
              {/* Time labels */}
              <div>
                {hours.map((hour) => (
                  <div key={hour} className="h-[60px] border-b border-border/30 relative">
                    <span className="absolute -top-2.5 left-1 text-[10px] text-muted-foreground font-medium">
                      {`${hour.toString().padStart(2, "0")}:00`}
                    </span>
                  </div>
                ))}
              </div>

              {/* Professional columns */}
              {columnData.map(({ professional, appointments: profApts }) => (
                <div key={professional.id} className="border-r last:border-r-0 relative">
                  {/* Hour lines */}
                  {hours.map((hour) => (
                    <div key={hour} className="h-[60px] border-b border-border/30" />
                  ))}
                  {/* Appointments */}
                  {profApts.map((apt) => (
                    <AppointmentBlock
                      key={apt.id}
                      apt={apt}
                      onClick={() => onAppointmentClick(apt)}
                      professionalColor={professional.color}
                    />
                  ))}
                  {/* Now indicator */}
                  {isCurrentDay && <NowIndicator />}
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : null}

      {/* Grilla horaria del día, estilo Google Calendar. En mobile ocupa
          TODO el ancho de la pantalla; con varios profesionales en desktop
          se usa la grilla multi-columna de arriba. */}
      <div className={cn(useMultiColumn && "md:hidden")}>
        {dayAppointments.length === 0 && decoratedFreeSlots.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 px-4">
            <div className="w-20 h-20 rounded-full bg-muted/50 flex items-center justify-center mb-4">
              <CalendarDays className="h-10 w-10 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-semibold text-foreground mb-1">Sin citas programadas</h3>
            <p className="text-muted-foreground text-center mb-6">No hay citas para este día</p>
            <Button onClick={onAddAppointment} className="rounded-xl gap-2">
              <Plus className="h-4 w-4" />
              Agregar cita
            </Button>
          </div>
        ) : (
          <>
            <div className="-mx-4 sm:-mx-6 md:mx-0 border-y md:border md:rounded-2xl overflow-hidden">
              <DayTimeGrid
                appointments={activeAppointments}
                onAppointmentClick={onAppointmentClick}
                showProfessionalColors={showProfessionalColors}
                isCurrentDay={isCurrentDay}
                nowTick={nowTick}
                onSlotTap={onSlotTap}
                freeSlots={decoratedFreeSlots}
                onFreeSlotClick={onFreeSlotClick}
              />
            </div>

            {/* Canceladas del día: fuera de la grilla para no ensuciar */}
            {cancelledAppointments.length > 0 && (
              <div className="mt-3 flex flex-wrap items-center gap-1.5">
                {cancelledAppointments.map((apt) => (
                  <button
                    key={apt.id}
                    onClick={() => onAppointmentClick(apt)}
                    className="inline-flex items-center gap-1.5 rounded-full border border-border/70 bg-muted/40 px-2.5 py-1 text-xs text-muted-foreground transition-colors hover:text-foreground"
                  >
                    <X className="h-3 w-3 text-rose-400" />
                    <span className="tabular-nums">{format(new Date(apt.start_at), "HH:mm")}</span>
                    <span className="line-through truncate max-w-[10rem]">
                      {apt.patients?.full_name || "Sin paciente"}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {/* Pending payments for this day */}
      {dayPayments.length > 0 && (
        <div className="bg-card rounded-2xl border p-4 space-y-3">
          <div className="flex items-center gap-2">
            <CreditCard className="h-4 w-4 text-muted-foreground" />
            <h3 className="text-sm font-semibold">
              Pagos del día ({dayPayments.length})
            </h3>
          </div>
          {dayPayments.map((payment) => {
            const payStatus = calculatePaymentStatus({
              due_date: payment.due_date,
              paid_at: payment.paid_at,
              status: payment.status,
            });
            const isOverdue = payStatus === "overdue";
            const isDueSoon = payStatus === "due_soon";
            
            return (
              <div
                key={payment.id}
                onClick={() => onPaymentClick?.(payment)}
                className={cn(
                  "p-3 rounded-xl border-l-4 cursor-pointer transition-all hover:shadow-md",
                  isOverdue && "bg-rose-50 dark:bg-rose-950/30 border-l-rose-500",
                  isDueSoon && "bg-amber-50 dark:bg-amber-950/30 border-l-amber-500",
                  !isOverdue && !isDueSoon && "bg-emerald-50 dark:bg-emerald-950/30 border-l-emerald-500"
                )}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-sm">{payment.patient_name}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      ${payment.amount.toLocaleString()}
                    </p>
                  </div>
                  <Badge
                    variant="outline"
                    className={cn(
                      "rounded-full text-xs",
                      isOverdue && "border-rose-300 text-rose-700 dark:text-rose-400",
                      isDueSoon && "border-amber-300 text-amber-700 dark:text-amber-400"
                    )}
                  >
                    <AlertTriangle className="h-3 w-3 mr-1" />
                    {isOverdue ? "Vencido" : isDueSoon ? "Por vencer" : "Pendiente"}
                  </Badge>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
