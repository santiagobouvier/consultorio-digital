import { useMemo } from "react";
import { format, startOfWeek, endOfWeek, eachDayOfInterval, isSameDay, isToday } from "date-fns";
import { es } from "date-fns/locale";
import { CalendarAppointment, DayPayment, getPaymentColorInfo, getEventHexColor } from "./types";
import { AppointmentCard } from "./AppointmentCard";
import { cn } from "@/lib/utils";
import { Plus, CreditCard, Coffee } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { calculatePaymentStatus, formatCurrency } from "@/lib/payments";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface WeekViewV2Props {
  currentDate: Date;
  appointments: CalendarAppointment[];
  onAppointmentClick: (appointment: CalendarAppointment) => void;
  onDayClick: (date: Date) => void;
  onAddAppointment: () => void;
  showProfessionalColors: boolean;
  paymentsByDay?: Map<string, DayPayment[]>;
  onPaymentClick?: (payment: DayPayment) => void;
}

const ProfessionalBadge = ({ appointment, showColor }: { appointment: CalendarAppointment; showColor: boolean }) => {
  if (!showColor || !appointment.professional) return null;

  const initials = appointment.professional.name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <TooltipProvider delayDuration={300}>
      <Tooltip>
        <TooltipTrigger asChild>
          <span
            className="inline-flex items-center justify-center w-5 h-5 rounded-full text-[9px] font-bold text-white shrink-0"
            style={{ backgroundColor: appointment.professional.color }}
          >
            {initials}
          </span>
        </TooltipTrigger>
        <TooltipContent side="top" className="text-xs">
          {appointment.professional.name}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};

export const WeekViewV2 = ({
  currentDate,
  appointments,
  onAppointmentClick,
  onDayClick,
  onAddAppointment,
  showProfessionalColors,
  paymentsByDay,
  onPaymentClick,
}: WeekViewV2Props) => {
  const days = useMemo(() => {
    const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 });
    const weekEnd = endOfWeek(currentDate, { weekStartsOn: 1 });
    return eachDayOfInterval({ start: weekStart, end: weekEnd });
  }, [currentDate]);

  const getAppointmentsForDay = (date: Date) => {
    return appointments
      .filter((apt) => isSameDay(new Date(apt.start_at), date))
      .sort((a, b) => new Date(a.start_at).getTime() - new Date(b.start_at).getTime());
  };

  const getPaymentsForDay = (date: Date): DayPayment[] => {
    if (!paymentsByDay) return [];
    return paymentsByDay.get(date.toDateString()) || [];
  };

  const PaymentChip = ({ p, compact = false }: { p: DayPayment; compact?: boolean }) => {
    const st = calculatePaymentStatus(p);
    return (
      <button
        onClick={(e) => {
          e.stopPropagation();
          onPaymentClick?.(p);
        }}
        className={cn(
          "w-full text-left rounded-lg border-l-2 transition-all hover:shadow-sm hover:scale-[1.01] flex items-center gap-1.5 overflow-hidden",
          compact ? "p-1.5 text-xs" : "p-2 text-xs",
          st === "overdue" && "bg-rose-50 dark:bg-rose-500/10 border-l-rose-500",
          st === "due_soon" && "bg-amber-50 dark:bg-amber-500/10 border-l-amber-500",
          st !== "overdue" && st !== "due_soon" && "bg-emerald-50 dark:bg-emerald-500/10 border-l-emerald-500"
        )}
      >
        <CreditCard className="h-3 w-3 shrink-0" />
        <span className="font-medium shrink-0">{formatCurrency(p.amount, p.currency)}</span>
        <span className="text-muted-foreground truncate min-w-0">{p.patient_name.split(" ")[0]}</span>
      </button>
    );
  };

  return (
    <>
      {/* Mobile/tablet Week View: tarjetas por día (1 columna en mobile,
          2 en tablet). La grilla de 7 columnas es solo para desktop real. */}
      <div className="xl:hidden space-y-3 md:space-y-0 md:grid md:grid-cols-2 md:gap-3">
        {days.map((day, dayIndex) => {
          const dayAppointments = getAppointmentsForDay(day);
          const dayPayments = getPaymentsForDay(day);
          const isCurrentDay = isToday(day);
          const totalCount = dayAppointments.length + dayPayments.length;

          return (
            <div
              key={day.toISOString()}
              className={cn(
                "bg-card rounded-2xl border overflow-hidden animate-fade-in",
                isCurrentDay && "ring-2 ring-primary"
              )}
              style={{ animationDelay: `${dayIndex * 60}ms`, animationFillMode: "both" }}
            >
              <button
                onClick={() => onDayClick(day)}
                className="w-full p-4 flex items-center justify-between bg-muted/30 active:bg-muted/50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div
                    className={cn(
                      "w-12 h-12 rounded-xl flex flex-col items-center justify-center",
                      isCurrentDay ? "bg-primary text-primary-foreground" : "bg-background"
                    )}
                  >
                    <span className="text-xs uppercase font-medium opacity-70">
                      {format(day, "EEE", { locale: es })}
                    </span>
                    <span className="text-lg font-bold leading-none">{format(day, "d")}</span>
                  </div>
                  <div className="text-left">
                    <p className={cn("font-semibold capitalize", isCurrentDay && "text-primary")}>
                      {format(day, "EEEE", { locale: es })}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {dayAppointments.length} cita{dayAppointments.length !== 1 ? "s" : ""}
                      {dayPayments.length > 0 && ` · ${dayPayments.length} pago${dayPayments.length !== 1 ? "s" : ""}`}
                    </p>
                  </div>
                </div>
              </button>

              {totalCount > 0 && (
                <div className="p-3 space-y-2">
                  {dayAppointments.slice(0, 3).map((apt) => (
                    <AppointmentCard
                      key={apt.id}
                      appointment={apt}
                      onClick={() => onAppointmentClick(apt)}
                      showProfessionalColor={showProfessionalColors}
                      compact
                    />
                  ))}
                  {dayPayments.slice(0, 2).map((p) => (
                    <PaymentChip key={`pay-${p.id}`} p={p} />
                  ))}
                  {totalCount > 5 && (
                    <button
                      onClick={() => onDayClick(day)}
                      className="w-full py-2 text-sm text-primary font-medium hover:underline"
                    >
                      +{totalCount - 5} más
                    </button>
                  )}
                </div>
              )}
            </div>
          );
        })}

      </div>

      {/* ── Desktop Week: grilla horaria real (xl+), estilo Google Calendar ── */}
      <div className="hidden xl:block">
        {(() => {
          const HOUR_H = 56;
          // Rango horario dinámico: cubre todas las citas de la semana
          let startHour = 8;
          let endHour = 20;
          for (const apt of appointments) {
            const sD = new Date(apt.start_at);
            const eD = new Date(apt.end_at);
            if (days.some((d) => isSameDay(sD, d))) {
              startHour = Math.min(startHour, sD.getHours());
              endHour = Math.max(endHour, eD.getMinutes() > 0 ? eD.getHours() + 1 : eD.getHours());
            }
          }
          const hours: number[] = [];
          for (let h = startHour; h < endHour; h++) hours.push(h);
          const bodyHeight = hours.length * HOUR_H;
          const now = new Date();
          const nowTop = ((now.getHours() * 60 + now.getMinutes()) / 60 - startHour) * HOUR_H;

          // Distribución lado a lado cuando dos citas se pisan en el mismo día
          const layoutDay = (dayAppts: CalendarAppointment[]) => {
            const sorted = [...dayAppts].sort(
              (a, b) => new Date(a.start_at).getTime() - new Date(b.start_at).getTime(),
            );
            const colEnds: number[] = [];
            const placed = sorted.map((apt) => {
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
            return { placed, cols: Math.max(colEnds.length, 1) };
          };

          const gridCols = { gridTemplateColumns: "3.25rem repeat(7, minmax(0, 1fr))" };

          return (
            <div className="bg-card rounded-2xl border overflow-hidden">
              {/* Encabezado de días */}
              <div className="grid border-b" style={gridCols}>
                <div className="bg-muted/30 border-r" />
                {days.map((day) => {
                  const count = getAppointmentsForDay(day).filter(
                    (a) => a.status !== "cancelled" && a.status !== "cancelled_by_patient",
                  ).length;
                  const isCurrentDay = isToday(day);
                  return (
                    <button
                      key={day.toISOString()}
                      onClick={() => onDayClick(day)}
                      className={cn(
                        "py-2.5 text-center border-r last:border-r-0 transition-colors hover:bg-muted/40",
                        isCurrentDay && "bg-primary/[0.06]",
                      )}
                    >
                      <p className="text-[10px] uppercase font-semibold text-muted-foreground">
                        {format(day, "EEE", { locale: es })}
                      </p>
                      <p
                        className={cn(
                          "text-lg font-bold leading-tight inline-flex items-center justify-center",
                          isCurrentDay && "text-primary-foreground bg-primary rounded-full w-8 h-8 mt-0.5",
                        )}
                      >
                        {format(day, "d")}
                      </p>
                      <p className="text-[10px] text-muted-foreground h-3.5">
                        {count > 0 ? `${count} cita${count !== 1 ? "s" : ""}` : ""}
                      </p>
                    </button>
                  );
                })}
              </div>

              {/* Strip de cobros del día (si hay) */}
              {paymentsByDay && days.some((d) => getPaymentsForDay(d).length > 0) && (
                <div className="grid border-b bg-muted/20" style={gridCols}>
                  <div className="border-r flex items-center justify-center py-1.5">
                    <CreditCard className="h-3 w-3 text-muted-foreground" />
                  </div>
                  {days.map((day) => {
                    const pays = getPaymentsForDay(day);
                    return (
                      <div key={day.toISOString()} className="border-r last:border-r-0 p-1 space-y-1 min-w-0">
                        {pays.slice(0, 2).map((p) => (
                          <PaymentChip key={p.id} p={p} compact />
                        ))}
                        {pays.length > 2 && (
                          <button
                            onClick={() => onDayClick(day)}
                            className="w-full text-[10px] text-primary font-medium hover:underline"
                          >
                            +{pays.length - 2} más
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Cuerpo: eje horario + columnas por día */}
              <div className="overflow-y-auto max-h-[62vh]">
                <div className="grid" style={gridCols}>
                  {/* Eje de horas (con las medias horas, como la vista del día) */}
                  <div className="relative border-r bg-muted/20" style={{ height: bodyHeight }}>
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
                  {days.map((day) => {
                    const { placed, cols } = layoutDay(getAppointmentsForDay(day));
                    const isCurrentDay = isToday(day);
                    return (
                      <div
                        key={day.toISOString()}
                        className={cn("relative border-r last:border-r-0", isCurrentDay && "bg-primary/[0.03]")}
                        style={{ height: bodyHeight }}
                        onClick={() => onDayClick(day)}
                      >
                        {/* Líneas de hora y media hora (mismo lenguaje que el día) */}
                        {hours.map((h, i) => (
                          <div key={h}>
                            <div
                              className="absolute inset-x-0 border-t border-border/60"
                              style={{ top: i * HOUR_H }}
                              aria-hidden
                            />
                            <div
                              className="absolute inset-x-0 border-t border-dashed border-border/40"
                              style={{ top: i * HOUR_H + HOUR_H / 2 }}
                              aria-hidden
                            />
                          </div>
                        ))}

                        {/* Bloques de citas: color sólido de la etiqueta/estado,
                            como en la vista del día */}
                        {placed.map(({ apt, col }) => {
                          const sD = new Date(apt.start_at);
                          const eD = new Date(apt.end_at);
                          const top = ((sD.getHours() * 60 + sD.getMinutes()) / 60 - startHour) * HOUR_H;
                          const height = Math.max(((eD.getTime() - sD.getTime()) / 3600000) * HOUR_H - 3, 26);
                          const compact = height < 44;
                          const color = getEventHexColor(apt, showProfessionalColors);
                          const payInfo = getPaymentColorInfo(apt.paymentColor);
                          const widthPct = 100 / cols;
                          const isCancelled = apt.status === "cancelled" || apt.status === "cancelled_by_patient";
                          const inProgress =
                            isCurrentDay && !apt.isPersonal && !isCancelled &&
                            sD.getTime() <= now.getTime() && now.getTime() < eD.getTime();
                          return (
                            <div
                              key={apt.id}
                              onClick={(e) => {
                                e.stopPropagation();
                                onAppointmentClick(apt);
                              }}
                              className={cn(
                                "absolute rounded-[10px] text-white cursor-pointer overflow-hidden transition-all hover:z-20 hover:-translate-y-px",
                                apt.status === "attended" && "opacity-55",
                                isCancelled && "opacity-40",
                                inProgress && "ring-2 ring-white/70 z-10",
                              )}
                              style={{
                                top,
                                height,
                                left: `calc(${col * widthPct}% + 3px)`,
                                width: `calc(${widthPct}% - 6px)`,
                                backgroundImage: `linear-gradient(160deg, ${color} 0%, ${color} 60%, rgba(0,0,0,0.22) 165%)`,
                                backgroundColor: color,
                                boxShadow: `0 5px 14px -7px ${color}cc, 0 1px 2px rgba(0,0,0,0.18)`,
                              }}
                            >
                              {/* Franja sutil para eventos personales */}
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
                              <div className={cn("relative h-full flex flex-col", compact ? "px-1.5 py-0.5" : "p-1.5")}>
                                <div className="flex items-center gap-1 min-w-0">
                                  {apt.isPersonal &&
                                    (apt.personalEvent?.icon ? (
                                      <span className="text-[10px] leading-none shrink-0">{apt.personalEvent.icon}</span>
                                    ) : (
                                      <Coffee className="h-2.5 w-2.5 shrink-0 opacity-90" />
                                    ))}
                                  {showProfessionalColors && apt.professional && !apt.isPersonal && (
                                    <span
                                      className="w-2 h-2 rounded-full shrink-0 ring-1 ring-white/60"
                                      style={{ backgroundColor: apt.professional.color }}
                                    />
                                  )}
                                  <p className={cn("font-semibold truncate text-[11px] leading-tight", isCancelled && "line-through")}>
                                    {apt.isPersonal
                                      ? apt.personalEvent?.title || "Evento"
                                      : apt.patients?.full_name || "Sin paciente"}
                                  </p>
                                  {payInfo && <span className={cn("w-1.5 h-1.5 rounded-full shrink-0 ml-auto ring-1 ring-white/50", payInfo.className)} />}
                                </div>
                                {!compact && (
                                  <p className="text-[10px] text-white/75 tabular-nums mt-auto">
                                    {format(sD, "HH:mm")} – {format(eD, "HH:mm")}
                                  </p>
                                )}
                              </div>
                            </div>
                          );
                        })}

                        {/* Línea de AHORA (solo hoy) */}
                        {isCurrentDay && nowTop >= 0 && nowTop <= bodyHeight && (
                          <div
                            className="absolute inset-x-0 z-10 pointer-events-none flex items-center"
                            style={{ top: nowTop }}
                          >
                            <span className="w-2 h-2 rounded-full bg-destructive -ml-1" />
                            <span className="flex-1 h-[2px] bg-destructive/80" />
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          );
        })()}
      </div>
    </>
  );
};
