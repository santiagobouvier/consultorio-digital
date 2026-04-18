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
import { CalendarAppointment, DayPayment } from "./types";
import { cn } from "@/lib/utils";
import { useIsMobile } from "@/hooks/use-mobile";
import { MonthDayDrawer } from "./MonthDayDrawer";
import { Plus, AlertCircle, Clock, CreditCard } from "lucide-react";
import { Button } from "@/components/ui/button";
import { calculatePaymentStatus } from "@/lib/payments";

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
      <div className="bg-card rounded-2xl border overflow-hidden">
        {/* Week day headers */}
        <div className="grid grid-cols-7 border-b bg-muted/30">
          {weekDays.map((day) => (
            <div
              key={day}
              className="p-2 md:p-3 text-center text-xs md:text-sm font-semibold text-muted-foreground"
            >
              {day}
            </div>
          ))}
        </div>

        {/* Days grid */}
        <div className="grid grid-cols-7">
          {days.map((day, index) => {
            const dayAppointments = getAppointmentsForDay(day);
            const indicator = getDayIndicator(day);
            const isCurrentMonth = isSameMonth(day, currentDate);
            const isCurrentDay = isToday(day);
            const isSelected = selectedDay && isSameDay(day, selectedDay);
            const hasAppointments = dayAppointments.length > 0;

            return (
              <button
                key={index}
                onClick={() => handleDayClick(day)}
                className={cn(
                  "min-h-[70px] md:min-h-[110px] p-1.5 md:p-2 border-b border-r transition-all duration-200 text-left relative group",
                  "hover:bg-muted/50 active:bg-muted/70",
                  !isCurrentMonth && "bg-muted/20",
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
                  {!isMobile && indicator && (
                    <div className="flex items-center gap-1">
                      {indicator.hasOverdue && (
                        <div className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" />
                      )}
                      {indicator.hasPending && !indicator.hasOverdue && (
                        <div className="w-2 h-2 rounded-full bg-amber-500" />
                      )}
                      <span className="text-xs text-muted-foreground font-medium">
                        {indicator.count}
                      </span>
                    </div>
                  )}
                </div>

                {/* Mobile: appointment dots */}
                {isMobile && hasAppointments && (
                  <div className="flex gap-0.5 flex-wrap justify-center">
                    {dayAppointments.slice(0, 4).map((apt) => (
                      <span
                        key={apt.id}
                        className={cn(
                          "w-1.5 h-1.5 rounded-full",
                          showProfessionalColors && apt.professional
                            ? ""
                            : apt.paymentColor === "red" 
                              ? "bg-rose-500"
                              : apt.paymentColor === "orange"
                                ? "bg-amber-500"
                                : "bg-primary"
                        )}
                        style={{
                          backgroundColor:
                            showProfessionalColors && apt.professional
                              ? apt.professional.color
                              : undefined,
                        }}
                      />
                    ))}
                    {dayAppointments.length > 4 && (
                      <span className="text-[8px] text-muted-foreground">
                        +{dayAppointments.length - 4}
                      </span>
                    )}
                  </div>
                )}

                {/* Desktop: appointment previews with payment status */}
                {!isMobile && hasAppointments && (
                  <div className="space-y-0.5 overflow-hidden">
                    {dayAppointments.slice(0, 3).map((apt) => (
                      <div
                        key={apt.id}
                        onClick={(e) => {
                          e.stopPropagation();
                          onAppointmentClick(apt);
                        }}
                        className={cn(
                          "text-xs p-1.5 rounded-lg truncate cursor-pointer transition-all",
                          "hover:scale-[1.02] hover:shadow-sm",
                          apt.paymentColor === "red" 
                            ? "bg-rose-50 dark:bg-rose-500/10 border-l-2 border-l-rose-500"
                            : apt.paymentColor === "orange"
                              ? "bg-amber-50 dark:bg-amber-500/10 border-l-2 border-l-amber-500"
                              : "bg-primary/10 border-l-2 border-l-primary"
                        )}
                        style={{
                          borderLeftColor:
                            showProfessionalColors && apt.professional
                              ? apt.professional.color
                              : undefined,
                        }}
                      >
                        <div className="flex items-center gap-1">
                          <span className="font-medium">
                            {format(new Date(apt.start_at), "HH:mm")}
                          </span>
                          <span className="text-muted-foreground truncate">
                            {apt.patients?.full_name?.split(" ")[0] || "Sin nombre"}
                          </span>
                        </div>
                      </div>
                    ))}
                    {dayAppointments.length > 3 && (
                      <p className="text-[10px] text-muted-foreground text-center py-0.5">
                        +{dayAppointments.length - 3} más
                      </p>
                    )}
                  </div>
                )}

                {/* Desktop: hover indicator for empty days */}
                {!isMobile && !hasAppointments && isCurrentMonth && (
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
          onAppointmentClick={(apt) => {
            setDrawerOpen(false);
            onAppointmentClick(apt);
          }}
          showProfessionalColors={showProfessionalColors}
        />
      )}

      {/* Mobile: Floating Add button */}
      {isMobile && (
        <div className="fixed bottom-6 right-6 z-40">
          <Button
            onClick={onAddAppointment}
            size="lg"
            className="h-14 w-14 rounded-full shadow-lg shadow-primary/25 hover:shadow-xl hover:shadow-primary/30 hover:scale-105 active:scale-95 transition-all duration-200"
          >
            <Plus className="h-6 w-6" />
          </Button>
        </div>
      )}
    </>
  );
};
