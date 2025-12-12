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
import { CalendarAppointment } from "./types";
import { cn } from "@/lib/utils";
import { useIsMobile } from "@/hooks/use-mobile";
import { MonthDayDrawer } from "./MonthDayDrawer";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";

interface MonthViewV2Props {
  currentDate: Date;
  appointments: CalendarAppointment[];
  onAppointmentClick: (appointment: CalendarAppointment) => void;
  onDayClick: (date: Date) => void;
  onAddAppointment: () => void;
  showProfessionalColors: boolean;
}

export const MonthViewV2 = ({
  currentDate,
  appointments,
  onAppointmentClick,
  onDayClick,
  onAddAppointment,
  showProfessionalColors,
}: MonthViewV2Props) => {
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
    return appointments.filter((apt) => isSameDay(new Date(apt.start_at), date));
  };

  const handleDayClick = (day: Date) => {
    if (isMobile) {
      setSelectedDay(day);
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
            const isCurrentMonth = isSameMonth(day, currentDate);
            const isCurrentDay = isToday(day);
            const hasAppointments = dayAppointments.length > 0;

            return (
              <button
                key={index}
                onClick={() => handleDayClick(day)}
                className={cn(
                  "min-h-[60px] md:min-h-[100px] p-1.5 md:p-2 border-b border-r transition-colors text-left",
                  "hover:bg-muted/50 active:bg-muted/70",
                  !isCurrentMonth && "bg-muted/20",
                  index % 7 === 6 && "border-r-0"
                )}
              >
                {/* Day number */}
                <div className="flex items-center justify-between mb-1">
                  <span
                    className={cn(
                      "text-xs md:text-sm font-medium w-6 h-6 md:w-7 md:h-7 flex items-center justify-center rounded-full",
                      !isCurrentMonth && "text-muted-foreground/50",
                      isCurrentDay && "bg-primary text-primary-foreground"
                    )}
                  >
                    {format(day, "d")}
                  </span>
                  {/* Desktop: count badge */}
                  {!isMobile && hasAppointments && (
                    <span className="text-xs text-muted-foreground">
                      {dayAppointments.length}
                    </span>
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

                {/* Desktop: appointment previews */}
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
                          "text-xs p-1 rounded truncate cursor-pointer",
                          "bg-primary/10 hover:bg-primary/20 border-l-2",
                          showProfessionalColors && apt.professional
                            ? ""
                            : "border-l-primary"
                        )}
                        style={{
                          borderLeftColor:
                            showProfessionalColors && apt.professional
                              ? apt.professional.color
                              : undefined,
                        }}
                      >
                        <span className="font-medium">
                          {format(new Date(apt.start_at), "HH:mm")}
                        </span>
                        <span className="ml-1 text-muted-foreground">
                          {apt.patients?.full_name?.split(" ")[0] || "Sin"}
                        </span>
                      </div>
                    ))}
                    {dayAppointments.length > 3 && (
                      <p className="text-[10px] text-muted-foreground text-center">
                        +{dayAppointments.length - 3} más
                      </p>
                    )}
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Mobile: Day drawer */}
      <MonthDayDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        selectedDate={selectedDay || currentDate}
        appointments={appointments}
        onAppointmentClick={(apt) => {
          setDrawerOpen(false);
          onAppointmentClick(apt);
        }}
        showProfessionalColors={showProfessionalColors}
      />

      {/* Mobile: Floating Add button */}
      {isMobile && (
        <div className="fixed bottom-6 right-6 z-40">
          <Button
            onClick={onAddAppointment}
            size="lg"
            className="h-14 w-14 rounded-full shadow-lg"
          >
            <Plus className="h-6 w-6" />
          </Button>
        </div>
      )}
    </>
  );
};
