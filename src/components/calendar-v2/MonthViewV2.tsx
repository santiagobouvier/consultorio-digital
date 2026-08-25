import { useMemo, useState } from "react";
import {
  format,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  isSameMonth,
  isSameDay,
  isToday,
} from "date-fns";
import { es } from "date-fns/locale";
import { CalendarAppointment, DayPayment, getStatusColor, abbreviatePatientName, getEventHexColor } from "./types";
import type { DayBirthday } from "./BirthdaysStrip";
import { cn } from "@/lib/utils";
import { useIsMobile } from "@/hooks/use-mobile";
import { Plus, AlertCircle, Clock, CreditCard } from "lucide-react";
import { Button } from "@/components/ui/button";
import { calculatePaymentStatus } from "@/lib/payments";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface DayIndicator {
  count: number;
  hasOverdue: boolean;
  hasPending: boolean;
}

interface MonthViewV2Props {
  currentDate: Date;
  appointments: CalendarAppointment[];
  onAppointmentClick: (appointment: CalendarAppointment) => void;
  onDayClick: (date: Date) => void;
  onAddAppointment: () => void;
  showProfessionalColors: boolean;
  // Desktop specific props
  isDesktop?: boolean;
  selectedDay?: Date | null;
  dayIndicators?: Map<string, DayIndicator>;
  // Payments overlay
  paymentsByDay?: Map<string, DayPayment[]>;
  onPaymentClick?: (payment: DayPayment) => void;
}

interface DayIndicator {
  count: number;
  hasOverdue: boolean;
  hasPending: boolean;
}

interface MonthViewV2Props {
  currentDate: Date;
  appointments: CalendarAppointment[];
  onAppointmentClick: (appointment: CalendarAppointment) => void;
  onDayClick: (date: Date) => void;
  onAddAppointment: () => void;
  showProfessionalColors: boolean;
  // Desktop specific props
  isDesktop?: boolean;
  selectedDay?: Date | null;
  dayIndicators?: Map<string, DayIndicator>;
  /** Cumpleaños por día (toDateString): 🎂 en la celda + detalle al abrir. */
  birthdaysByDate?: Map<string, DayBirthday[]>;
  clinicName?: string;
  /** Crear para un día concreto desde el panel del día (mobile). */
  onCreateForDay?: (date: Date) => void;
  onCreatePaymentForDay?: (date: Date) => void;
  onCreatePersonalForDay?: (date: Date) => void;
  onQuickBlockForDay?: (date: Date) => void;
}

export const MonthViewV2 = ({
  currentDate,
  appointments,
  onAppointmentClick,
  onDayClick,
  onAddAppointment,
  showProfessionalColors,
  isDesktop = false,
  selectedDay = null,
  dayIndicators,
  paymentsByDay,
  onPaymentClick,
  birthdaysByDate,
  clinicName,
  onCreateForDay,
  onCreatePaymentForDay,
  onCreatePersonalForDay,
  onQuickBlockForDay,
}: MonthViewV2Props) => {
  const isMobile = useIsMobile();

  const getPaymentsForDay = (date: Date): DayPayment[] => {
    if (!paymentsByDay) return [];
    return paymentsByDay.get(date.toDateString()) || [];
  };

  const days = useMemo(() => {
    const monthStart = startOfMonth(currentDate);
    const monthEnd = endOfMonth(currentDate);
    const calendarStart = startOfWeek(monthStart, { weekStartsOn: 1 });
    const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });
    return eachDayOfInterval({ start: calendarStart, end: calendarEnd });
  }, [currentDate]);

  const getAppointmentsForDay = (date: Date) => {
    return appointments.filter((apt) => isSameDay(new Date(apt.start_at), date));
  };

  const getDayIndicator = (date: Date): DayIndicator | undefined => {
    if (dayIndicators) {
      return dayIndicators.get(date.toDateString());
    }
    // Fallback: calculate from appointments
    const dayApts = getAppointmentsForDay(date);
    if (dayApts.length === 0) return undefined;
    return {
      count: dayApts.length,
      hasOverdue: dayApts.some(apt => apt.paymentColor === "red"),
      hasPending: dayApts.some(apt => apt.paymentColor === "orange"),
    };
  };

  // Tocar un día abre SIEMPRE su desglose: en mobile navega a la vista día
  // (todas las horas, como Google Calendar); en desktop el padre abre el
  // modal del día completo.
  const handleDayClick = (day: Date) => {
    onDayClick(day);
  };

  const weekDays = isMobile
    ? ["L", "M", "X", "J", "V", "S", "D"]
    : ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];

  return (
    <>
      <div
        className={cn(
          "bg-card overflow-hidden",
          isMobile && !isDesktop
            ? "-mx-4 sm:-mx-6 border-y flex flex-col"
            : "rounded-2xl border"
        )}
      >
        {/* Week day headers */}
        <div className="grid grid-cols-7 border-b border-border/50">
          {weekDays.map((day) => (
            <div
              key={day}
              className="py-2 md:py-3 text-center text-[10px] md:text-xs font-semibold uppercase tracking-wider text-muted-foreground/60"
            >
              {day}
            </div>
          ))}
        </div>

        {/* Days grid: en mobile las filas se reparten el alto de la pantalla
            (como Google Calendar), en desktop mantienen su altura propia */}
        <div
          className={cn(
            "grid grid-cols-7 gap-1 p-1 md:gap-1.5 md:p-1.5",
            isMobile && !isDesktop && "flex-1 auto-rows-fr"
          )}
          style={isMobile && !isDesktop ? { minHeight: "calc(100dvh - 300px)" } : undefined}
        >
          {days.map((day, index) => {
            const dayAppointments = getAppointmentsForDay(day);
            const dayPayments = getPaymentsForDay(day);
            const indicator = getDayIndicator(day);
            const isCurrentMonth = isSameMonth(day, currentDate);
            const isCurrentDay = isToday(day);
            const isSelected = selectedDay && isSameDay(day, selectedDay);
            const hasAppointments = dayAppointments.length > 0;
            const hasPayments = dayPayments.length > 0;
            const totalEvents = dayAppointments.length + dayPayments.length;
            // Mobile: barritas solo de eventos vigentes (las canceladas no ensucian)
            const activeApts = dayAppointments.filter(
              (a) => a.status !== "cancelled" && a.status !== "cancelled_by_patient"
            );
            const dayBdays = birthdaysByDate?.get(day.toDateString()) ?? [];

            return (
              <button
                key={index}
                onClick={() => handleDayClick(day)}
                className={cn(
                  "min-h-[86px] md:min-h-[110px] p-1 md:p-1.5 rounded-lg md:rounded-xl border transition-all duration-200 text-left relative group",
                  "hover:bg-muted/40 active:bg-muted/60",
                  isCurrentDay
                    ? "border-primary/60 bg-primary/[0.06]"
                    : "border-border/40 bg-background/40",
                  !isCurrentMonth && "opacity-45",
                  isSelected && "ring-2 ring-primary ring-inset"
                )}
              >
                {/* Day number + chip HOY */}
                <div className="flex items-center justify-between mb-1">
                  <span className="flex items-center gap-1 min-w-0">
                    <span
                      className={cn(
                        "text-xs md:text-sm font-semibold px-0.5 transition-colors",
                        !isCurrentMonth && "text-muted-foreground/50",
                        isCurrentDay && "text-primary",
                        isSelected && !isCurrentDay && "text-primary"
                      )}
                    >
                      {format(day, "d")}
                    </span>
                    {isCurrentDay && (
                      <span className="text-[8px] font-bold uppercase tracking-wide bg-primary text-primary-foreground rounded-full px-1.5 py-px shrink-0">
                        Hoy
                      </span>
                    )}
                  </span>

                  {/* Desktop: Payment indicators */}
                  {!isMobile && (indicator || hasPayments) && (
                    <div className="flex items-center gap-1.5">
                      {totalEvents > 0 && (
                        <span className="text-[11px] text-muted-foreground font-medium tabular-nums">
                          {totalEvents}
                        </span>
                      )}
                      {indicator?.hasOverdue && (
                        <TooltipProvider delayDuration={150}>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span
                                className="w-2 h-2 rounded-full bg-rose-500 animate-pulse"
                                aria-label="Pagos vencidos"
                              />
                            </TooltipTrigger>
                            <TooltipContent side="top" className="text-xs">
                              Pagos vencidos este día
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      )}
                    </div>
                  )}
                </div>

                {/* Mobile: mini-chips minimalistas — fondo translúcido del
                    color del evento y texto en ese color. Sin ruido extra:
                    los pagos viven en el panel del día. */}
                {isMobile && (activeApts.length > 0 || dayBdays.length > 0) && (
                  <div className="space-y-[2.5px] overflow-hidden">
                    {dayBdays.slice(0, 1).map((b) => (
                      <div
                        key={`bd-${b.id}`}
                        className="h-[15px] rounded-[5px] px-[4px] flex items-center overflow-hidden"
                        style={{ backgroundColor: "rgba(236, 72, 153, 0.16)" }}
                      >
                        <span className="text-[9px] font-semibold truncate text-pink-500 dark:text-pink-300">
                          🎂 {b.name.split(" ")[0]}
                        </span>
                      </div>
                    ))}
                    {activeApts.slice(0, 3).map((apt) => {
                      const c = getEventHexColor(apt, showProfessionalColors);
                      return (
                        <div
                          key={apt.id}
                          className="h-[15px] rounded-[5px] px-[4px] flex items-center overflow-hidden"
                          style={{
                            backgroundColor: `${c}2b`,
                            opacity: apt.status === "attended" ? 0.5 : 1,
                          }}
                        >
                          <span
                            className="text-[9px] font-semibold truncate leading-none"
                            style={{ color: c }}
                          >
                            {apt.isPersonal
                              ? apt.personalEvent?.title || "Personal"
                              : (apt.patients?.full_name || "Cita").split(" ")[0]}
                          </span>
                        </div>
                      );
                    })}
                    {activeApts.length > 3 && (
                      <span className="block px-0.5 text-[8.5px] leading-none text-muted-foreground/70 font-semibold tabular-nums">
                        +{activeApts.length - 3}
                      </span>
                    )}
                  </div>
                )}

                {/* Desktop: appointment + payment previews.
                    Son SOLO visuales: el click en cualquier parte del casillero
                    abre el panel del día (ahí se toca la cita puntual con
                    botones grandes). Evita abrir el detalle por error. */}
                {!isMobile && (hasAppointments || hasPayments || dayBdays.length > 0) && (
                  <div className="space-y-0.5 overflow-hidden">
                    {dayBdays.slice(0, 1).map((b) => (
                      <div
                        key={`bd-${b.id}`}
                        className="text-xs px-1.5 py-1 rounded-md overflow-hidden"
                        style={{ backgroundColor: "rgba(236, 72, 153, 0.14)" }}
                        title={`Cumpleaños de ${b.name}`}
                      >
                        <span className="font-semibold text-pink-500 dark:text-pink-300 truncate block">
                          🎂 {b.name.split(" ")[0]} {b.name.trim().split(/\s+/)[1]?.charAt(0).toUpperCase() ?? ""}.
                        </span>
                      </div>
                    ))}
                    {dayAppointments.slice(0, 2).map((apt) => {
                      const sc = getStatusColor(apt.status);
                      const label = abbreviatePatientName(apt.patients?.full_name);
                      return (
                        <div
                          key={apt.id}
                          className={cn(
                            "text-xs px-1.5 py-1 rounded-md transition-all",
                            "border-l-[3px] overflow-hidden",
                            sc.bgTint,
                            sc.border
                          )}
                          style={{
                            borderLeftColor: apt.isPersonal
                              ? getEventHexColor(apt, showProfessionalColors)
                              : showProfessionalColors && apt.professional
                                ? apt.professional.color
                                : undefined,
                          }}
                          title={`${format(new Date(apt.start_at), "HH:mm")} · ${apt.patients?.full_name ?? ""}`}
                        >
                          <div className="flex items-center gap-1 whitespace-nowrap overflow-hidden">
                            <span className="font-semibold tabular-nums shrink-0">
                              {format(new Date(apt.start_at), "HH:mm")}
                            </span>
                            <span className="text-foreground/80 overflow-hidden">
                              {label}
                            </span>
                          </div>
                        </div>
                      );
                    })}

                    {/* Los cobros NO se muestran en el mes: ensuciaban y se
                        confundían con citas. Viven al abrir el día. */}
                    {dayAppointments.length > 2 && (
                      <p className="text-[10px] text-muted-foreground text-center py-0.5 font-medium">
                        + {dayAppointments.length - 2} más
                      </p>
                    )}
                  </div>
                )}

                {/* Desktop: hover indicator for empty days */}
                {!isMobile && !hasAppointments && !hasPayments && dayBdays.length === 0 && isCurrentMonth && (
                  <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                    <Plus className="w-5 h-5 text-muted-foreground/40" />
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Leyenda de colores */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 pt-2.5 pb-1 text-[11px] text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-primary" />
          Cita confirmada
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
          Pendiente
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-pink-500" />
          Cumpleaños
        </span>
      </div>
    </>
  );
};
