import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, eachDayOfInterval, isSameMonth, isSameDay, isToday } from "date-fns";
import { es } from "date-fns/locale";
import { useIsMobile } from "@/hooks/use-mobile";
import { DayDetailDrawer } from "./DayDetailDrawer";

interface Appointment {
  id: string;
  start_at: string;
  end_at: string;
  status: string;
  modality: string | null;
  location: string | null;
  payment_status: string | null;
  patient_id: string | null;
  service_id: string | null;
  patients: { full_name: string } | null;
  services: { name: string } | null;
  paymentColor?: string;
}

interface Payment {
  id: string;
  patient_id: string;
  due_date: string;
  paid_at: string | null;
  status: string;
  amount?: number;
}

interface CalendarGridProps {
  currentDate: Date;
  appointments: Appointment[];
  payments?: Payment[];
  onDateClick: (date: Date) => void;
  onAppointmentClick: (appointment: Appointment) => void;
  selectedPatientId: string | null;
}

export const CalendarGrid = ({
  currentDate,
  appointments,
  payments = [],
  onDateClick,
  onAppointmentClick,
  selectedPatientId,
}: CalendarGridProps) => {
  const isMobile = useIsMobile();
  const [selectedDay, setSelectedDay] = useState<Date | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  
  const days = useMemo(() => {
    const monthStart = startOfMonth(currentDate);
    const monthEnd = endOfMonth(currentDate);
    const calendarStart = startOfWeek(monthStart, { weekStartsOn: 1 });
    const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });
    return eachDayOfInterval({ start: calendarStart, end: calendarEnd });
  }, [currentDate]);

  const getAppointmentsForDay = (date: Date) => {
    return appointments.filter((apt) => {
      const aptDate = new Date(apt.start_at);
      return isSameDay(aptDate, date);
    });
  };

  const getPaymentDotColor = (color?: string) => {
    switch (color) {
      case "green":
        return "bg-emerald-500";
      case "orange":
        return "bg-amber-500";
      case "red":
        return "bg-rose-500";
      default:
        return "bg-primary";
    }
  };

  const getPaymentBorderColor = (color?: string) => {
    switch (color) {
      case "green":
        return "border-l-emerald-500";
      case "orange":
        return "border-l-amber-500";
      case "red":
        return "border-l-rose-500";
      default:
        return "border-l-primary";
    }
  };

  const formatTime = (datetime: string) => {
    return format(new Date(datetime), "HH:mm");
  };

  const handleDayClick = (day: Date) => {
    if (isMobile) {
      setSelectedDay(day);
      setDrawerOpen(true);
    } else {
      onDateClick(day);
    }
  };

  const weekDays = isMobile ? ["L", "M", "X", "J", "V", "S", "D"] : ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];

  // Mobile: Compact calendar with dots + drawer
  if (isMobile) {
    return (
      <>
        <div className="bg-card rounded-2xl border overflow-hidden">
          {/* Header */}
          <div className="grid grid-cols-7 border-b bg-muted/30">
            {weekDays.map((day) => (
              <div
                key={day}
                className="p-2 text-center text-xs font-semibold text-muted-foreground"
              >
                {day}
              </div>
            ))}
          </div>

          {/* Days Grid - Compact for mobile */}
          <div className="grid grid-cols-7">
            {days.map((day, index) => {
              const dayAppointments = getAppointmentsForDay(day);
              const isCurrentMonth = isSameMonth(day, currentDate);
              const isCurrentDay = isToday(day);

              return (
                <div
                  key={index}
                  className={cn(
                    "min-h-[52px] border-b border-r p-1 cursor-pointer transition-colors active:bg-accent/70",
                    !isCurrentMonth && "bg-muted/20",
                    index % 7 === 6 && "border-r-0"
                  )}
                  onClick={() => handleDayClick(day)}
                >
                  <div className="flex flex-col items-center gap-1">
                    <span
                      className={cn(
                        "text-sm font-medium w-7 h-7 flex items-center justify-center rounded-full",
                        !isCurrentMonth && "text-muted-foreground/50",
                        isCurrentDay && "bg-primary text-primary-foreground"
                      )}
                    >
                      {format(day, "d")}
                    </span>
                    
                    {/* Appointment dots */}
                    {dayAppointments.length > 0 && (
                      <div className="flex gap-0.5 flex-wrap justify-center max-w-full">
                        {dayAppointments.slice(0, 3).map((apt) => (
                          <div
                            key={apt.id}
                            className={cn(
                              "w-1.5 h-1.5 rounded-full",
                              selectedPatientId ? getPaymentDotColor(apt.paymentColor) : "bg-primary"
                            )}
                          />
                        ))}
                        {dayAppointments.length > 3 && (
                          <span className="text-[8px] text-muted-foreground ml-0.5">
                            +{dayAppointments.length - 3}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Day Detail Drawer */}
        <DayDetailDrawer
          open={drawerOpen}
          onClose={() => setDrawerOpen(false)}
          selectedDate={selectedDay || currentDate}
          appointments={appointments}
          payments={payments}
          onAppointmentClick={(apt) => {
            setDrawerOpen(false);
            onAppointmentClick(apt);
          }}
          selectedPatientId={selectedPatientId}
        />
      </>
    );
  }

  // Desktop: Full calendar with appointment previews
  return (
    <div className="bg-card rounded-2xl border overflow-hidden">
      {/* Header */}
      <div className="grid grid-cols-7 border-b bg-muted/30">
        {weekDays.map((day) => (
          <div
            key={day}
            className="p-2 text-center text-xs font-semibold text-muted-foreground"
          >
            {day}
          </div>
        ))}
      </div>

      {/* Days Grid */}
      <div className="grid grid-cols-7">
        {days.map((day, index) => {
          const dayAppointments = getAppointmentsForDay(day);
          const isCurrentMonth = isSameMonth(day, currentDate);
          const isCurrentDay = isToday(day);

          return (
            <div
              key={index}
              className={cn(
                "min-h-[120px] border-b border-r p-1.5 cursor-pointer transition-colors hover:bg-accent/50",
                !isCurrentMonth && "bg-muted/20",
                index % 7 === 6 && "border-r-0"
              )}
              onClick={() => onDateClick(day)}
            >
              <div className="flex justify-between items-start mb-1">
                <span
                  className={cn(
                    "text-xs font-medium w-6 h-6 flex items-center justify-center rounded-full",
                    !isCurrentMonth && "text-muted-foreground/50",
                    isCurrentDay && "bg-primary text-primary-foreground"
                  )}
                >
                  {format(day, "d")}
                </span>
                {dayAppointments.length > 0 && (
                  <span className="text-[10px] text-muted-foreground">
                    {dayAppointments.length}
                  </span>
                )}
              </div>

              <div className="space-y-0.5 overflow-hidden">
                {dayAppointments.slice(0, 3).map((apt) => (
                  <div
                    key={apt.id}
                    onClick={(e) => {
                      e.stopPropagation();
                      onAppointmentClick(apt);
                    }}
                    className={cn(
                      "text-xs p-1 rounded bg-primary/10 hover:bg-primary/20 cursor-pointer truncate border-l-2",
                      selectedPatientId && getPaymentBorderColor(apt.paymentColor)
                    )}
                  >
                    <span className="font-medium">{formatTime(apt.start_at)}</span>
                    <span className="ml-1 text-muted-foreground">
                      {apt.patients?.full_name?.split(" ")[0] || "Sin paciente"}
                    </span>
                  </div>
                ))}
                {dayAppointments.length > 3 && (
                  <div className="text-[10px] text-muted-foreground text-center">
                    +{dayAppointments.length - 3} más
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
