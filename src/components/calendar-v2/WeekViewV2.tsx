import { useMemo } from "react";
import { format, startOfWeek, endOfWeek, eachDayOfInterval, isSameDay, isToday } from "date-fns";
import { es } from "date-fns/locale";
import { CalendarAppointment, DayPayment } from "./types";
import { AppointmentCard } from "./AppointmentCard";
import { cn } from "@/lib/utils";
import { Plus, CreditCard } from "lucide-react";
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
          "w-full text-left rounded-lg border-l-2 transition-all hover:shadow-sm hover:scale-[1.01] flex items-center gap-1.5",
          compact ? "p-1.5 text-xs" : "p-2 text-xs",
          st === "overdue" && "bg-rose-50 dark:bg-rose-500/10 border-l-rose-500",
          st === "due_soon" && "bg-amber-50 dark:bg-amber-500/10 border-l-amber-500",
          st !== "overdue" && st !== "due_soon" && "bg-emerald-50 dark:bg-emerald-500/10 border-l-emerald-500"
        )}
      >
        <CreditCard className="h-3 w-3 shrink-0" />
        <span className="font-medium">{formatCurrency(p.amount, p.currency)}</span>
        <span className="text-muted-foreground truncate">{p.patient_name.split(" ")[0]}</span>
      </button>
    );
  };

  return (
    <>
      {/* Mobile Week View - Vertical scroll */}
      <div className="md:hidden space-y-3">
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

      {/* Desktop Week View - Grid */}
      <div className="hidden md:grid grid-cols-7 gap-3">
        {days.map((day) => {
          const dayAppointments = getAppointmentsForDay(day);
          const dayPayments = getPaymentsForDay(day);
          const isCurrentDay = isToday(day);
          const totalCount = dayAppointments.length + dayPayments.length;

          return (
            <div
              key={day.toISOString()}
              className={cn(
                "bg-card rounded-2xl border p-3 min-h-[200px] flex flex-col",
                isCurrentDay && "ring-2 ring-primary"
              )}
            >
              <button
                onClick={() => onDayClick(day)}
                className="flex items-center justify-between mb-3 hover:bg-muted/50 -mx-1 px-1 py-1 rounded-lg transition-colors"
              >
                <div>
                  <p className="text-xs text-muted-foreground capitalize">
                    {format(day, "EEEE", { locale: es })}
                  </p>
                  <p className={cn("text-xl font-bold", isCurrentDay && "text-primary")}>
                    {format(day, "d")}
                  </p>
                </div>
                {totalCount > 0 && (
                  <span className="text-sm text-muted-foreground">{totalCount}</span>
                )}
              </button>

              <div className="flex-1 space-y-2 overflow-y-auto">
                {totalCount === 0 ? (
                  <p className="text-xs text-muted-foreground text-center py-4">Sin actividad</p>
                ) : (
                  <>
                    {dayAppointments.map((apt) => (
                      <div key={apt.id} className="relative">
                        <div className="flex items-center gap-1">
                          <ProfessionalBadge appointment={apt} showColor={showProfessionalColors} />
                          <div className="flex-1 min-w-0">
                            <AppointmentCard
                              appointment={apt}
                              onClick={() => onAppointmentClick(apt)}
                              showProfessionalColor={showProfessionalColors}
                              compact
                            />
                          </div>
                        </div>
                      </div>
                    ))}
                    {dayPayments.map((p) => (
                      <PaymentChip key={`pay-${p.id}`} p={p} compact />
                    ))}
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
};
