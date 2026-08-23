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
import { cn } from "@/lib/utils";
import { useIsMobile } from "@/hooks/use-mobile";
import { MonthDayDrawer } from "./MonthDayDrawer";
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
}: MonthViewV2Props) => {
  const isMobile = useIsMobile();
  const [mobileSelectedDay, setMobileSelectedDay] = useState<Date | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

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

  const handleDayClick = (day: Date) => {
    if (isDesktop) {
      // On desktop, let parent handle via onDayClick
      onDayClick(day);
    } else if (isMobile) {
      setMobileSelectedDay(day);
      setDrawerOpen(true);
    } else {
      onDayClick(day);
    }
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
          className={cn("grid grid-cols-7", isMobile && !isDesktop && "flex-1 auto-rows-fr")}
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

            return (
              <button
                key={index}
                onClick={() => handleDayClick(day)}
                className={cn(
                  "min-h-[86px] md:min-h-[110px] p-1 md:p-2 border-b border-r border-border/40 transition-all duration-200 text-left relative group",
                  "hover:bg-muted/40 active:bg-muted/60",
                  !isCurrentMonth && "opacity-45",
                  index % 7 === 6 && "border-r-0",
                  isSelected && "bg-primary/5 ring-2 ring-primary ring-inset"
                )}
              >
                {/* Day number */}
                <div className="flex items-center justify-between mb-1">
                  <span
                    className={cn(
                      "text-xs md:text-sm font-medium w-6 h-6 md:w-7 md:h-7 flex items-center justify-center rounded-full transition-colors",
                      !isCurrentMonth && "text-muted-foreground/50",
                      isCurrentDay && "bg-primary text-primary-foreground",
                      isSelected && !isCurrentDay && "bg-primary/20 text-primary"
                    )}
                  >
                    {format(day, "d")}
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
                {isMobile && activeApts.length > 0 && (
                  <div className="space-y-[2.5px] overflow-hidden">
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
                {!isMobile && (hasAppointments || hasPayments) && (
                  <div className="space-y-0.5 overflow-hidden">
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

                    {dayPayments.slice(0, Math.max(0, 3 - Math.min(dayAppointments.length, 2))).map((p) => {
                      const st = calculatePaymentStatus(p);
                      return (
                        <div
                          key={`pay-${p.id}`}
                          className={cn(
                            "text-xs p-1.5 rounded-lg truncate transition-all",
                            "flex items-center gap-1",
                            st === "overdue"
                              ? "bg-rose-50 dark:bg-rose-500/10 border-l-2 border-l-rose-500"
                              : st === "due_soon"
                                ? "bg-amber-50 dark:bg-amber-500/10 border-l-2 border-l-amber-500"
                                : "bg-emerald-50 dark:bg-emerald-500/10 border-l-2 border-l-emerald-500"
                          )}
                        >
                          <CreditCard className="h-3 w-3 shrink-0" />
                          <span className="truncate font-medium">
                            ${p.amount.toLocaleString()}
                          </span>
                          <span className="text-muted-foreground truncate">
                            {p.patient_name.split(" ")[0]}
                          </span>
                        </div>
                      );
                    })}

                    {dayAppointments.length > 2 && (
                      <p className="text-[10px] text-muted-foreground text-center py-0.5 font-medium">
                        + {dayAppointments.length - 2} más
                      </p>
                    )}
                  </div>
                )}

                {/* Desktop: hover indicator for empty days */}
                {!isMobile && !hasAppointments && !hasPayments && isCurrentMonth && (
                  <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                    <Plus className="w-5 h-5 text-muted-foreground/40" />
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Mobile: Day drawer (only on mobile) */}
      {isMobile && !isDesktop && (
        <MonthDayDrawer
          open={drawerOpen}
          onClose={() => setDrawerOpen(false)}
          selectedDate={mobileSelectedDay || currentDate}
          appointments={appointments}
          dayPayments={mobileSelectedDay ? getPaymentsForDay(mobileSelectedDay) : []}
          onAppointmentClick={(apt) => {
            setDrawerOpen(false);
            onAppointmentClick(apt);
          }}
          onPaymentClick={(p) => {
            setDrawerOpen(false);
            onPaymentClick?.(p);
          }}
          showProfessionalColors={showProfessionalColors}
        />
      )}

    </>
  );
};
