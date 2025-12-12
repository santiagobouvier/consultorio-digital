import { useMemo } from "react";
import { format, startOfWeek, endOfWeek, eachDayOfInterval, isSameDay, isToday } from "date-fns";
import { es } from "date-fns/locale";
import { CalendarAppointment } from "./types";
import { AppointmentCard } from "./AppointmentCard";
import { cn } from "@/lib/utils";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";

interface WeekViewV2Props {
  currentDate: Date;
  appointments: CalendarAppointment[];
  onAppointmentClick: (appointment: CalendarAppointment) => void;
  onDayClick: (date: Date) => void;
  onAddAppointment: () => void;
  showProfessionalColors: boolean;
}

export const WeekViewV2 = ({
  currentDate,
  appointments,
  onAppointmentClick,
  onDayClick,
  onAddAppointment,
  showProfessionalColors,
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

  return (
    <>
      {/* Mobile Week View - Vertical scroll */}
      <div className="md:hidden space-y-3">
        {days.map((day) => {
          const dayAppointments = getAppointmentsForDay(day);
          const isCurrentDay = isToday(day);

          return (
            <div
              key={day.toISOString()}
              className={cn(
                "bg-card rounded-2xl border overflow-hidden",
                isCurrentDay && "ring-2 ring-primary"
              )}
            >
              {/* Day header - Tappable */}
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
                    <span className="text-lg font-bold leading-none">
                      {format(day, "d")}
                    </span>
                  </div>
                  <div className="text-left">
                    <p className={cn("font-semibold capitalize", isCurrentDay && "text-primary")}>
                      {format(day, "EEEE", { locale: es })}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {dayAppointments.length} cita{dayAppointments.length !== 1 ? "s" : ""}
                    </p>
                  </div>
                </div>
              </button>

              {/* Appointments preview */}
              {dayAppointments.length > 0 && (
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
                  {dayAppointments.length > 3 && (
                    <button
                      onClick={() => onDayClick(day)}
                      className="w-full py-2 text-sm text-primary font-medium hover:underline"
                    >
                      +{dayAppointments.length - 3} más
                    </button>
                  )}
                </div>
              )}
            </div>
          );
        })}

        {/* Floating Add button */}
        <div className="fixed bottom-6 right-6 z-40">
          <Button
            onClick={onAddAppointment}
            size="lg"
            className="h-14 w-14 rounded-full shadow-lg"
          >
            <Plus className="h-6 w-6" />
          </Button>
        </div>
      </div>

      {/* Desktop Week View - Grid */}
      <div className="hidden md:grid grid-cols-7 gap-3">
        {days.map((day) => {
          const dayAppointments = getAppointmentsForDay(day);
          const isCurrentDay = isToday(day);

          return (
            <div
              key={day.toISOString()}
              className={cn(
                "bg-card rounded-2xl border p-3 min-h-[200px] flex flex-col",
                isCurrentDay && "ring-2 ring-primary"
              )}
            >
              {/* Day header */}
              <button
                onClick={() => onDayClick(day)}
                className="flex items-center justify-between mb-3 hover:bg-muted/50 -mx-1 px-1 py-1 rounded-lg transition-colors"
              >
                <div>
                  <p className="text-xs text-muted-foreground capitalize">
                    {format(day, "EEEE", { locale: es })}
                  </p>
                  <p
                    className={cn(
                      "text-xl font-bold",
                      isCurrentDay && "text-primary"
                    )}
                  >
                    {format(day, "d")}
                  </p>
                </div>
                {dayAppointments.length > 0 && (
                  <span className="text-sm text-muted-foreground">
                    {dayAppointments.length}
                  </span>
                )}
              </button>

              {/* Appointments */}
              <div className="flex-1 space-y-2 overflow-y-auto">
                {dayAppointments.length === 0 ? (
                  <p className="text-xs text-muted-foreground text-center py-4">
                    Sin citas
                  </p>
                ) : (
                  dayAppointments.map((apt) => (
                    <AppointmentCard
                      key={apt.id}
                      appointment={apt}
                      onClick={() => onAppointmentClick(apt)}
                      showProfessionalColor={showProfessionalColors}
                      compact
                    />
                  ))
                )}
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
};
