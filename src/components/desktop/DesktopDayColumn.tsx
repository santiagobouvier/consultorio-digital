import { useMemo } from "react";
import { format, isSameDay, startOfWeek, addDays, eachDayOfInterval, endOfWeek } from "date-fns";
import { es } from "date-fns/locale";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Clock, Video, MapPin, Plus } from "lucide-react";
import { CalendarAppointment, Professional, PaymentColor } from "@/components/calendar-v2/types";

interface DesktopDayColumnProps {
  currentDate: Date;
  viewType: "day" | "week";
  appointments: CalendarAppointment[];
  professionals: Professional[];
  onAppointmentClick: (apt: CalendarAppointment) => void;
  onAddAppointment: () => void;
  showProfessionalColors: boolean;
}

const HOUR_HEIGHT = 60; // px per hour
const START_HOUR = 7;
const END_HOUR = 21;

const paymentColorMap: Record<PaymentColor, string> = {
  green: "bg-success",
  orange: "bg-warning",
  red: "bg-destructive",
  gray: "bg-muted",
};

const TimeSlot = ({ hour }: { hour: number }) => (
  <div className="h-[60px] border-b border-border/30 relative">
    <span className="absolute -top-2.5 left-0 text-[10px] text-muted-foreground font-medium w-10">
      {`${hour.toString().padStart(2, "0")}:00`}
    </span>
  </div>
);

const AppointmentBlock = ({
  apt,
  onClick,
  showProfessionalColor,
}: {
  apt: CalendarAppointment;
  onClick: () => void;
  showProfessionalColor: boolean;
}) => {
  const startDate = new Date(apt.start_at);
  const endDate = new Date(apt.end_at);
  
  const startMinutes = startDate.getHours() * 60 + startDate.getMinutes();
  const endMinutes = endDate.getHours() * 60 + endDate.getMinutes();
  const durationMinutes = endMinutes - startMinutes;
  
  const top = ((startMinutes - START_HOUR * 60) / 60) * HOUR_HEIGHT;
  const height = (durationMinutes / 60) * HOUR_HEIGHT;
  
  const paymentDot = paymentColorMap[apt.paymentColor || "gray"];
  const borderColor = showProfessionalColor 
    ? apt.professional?.color || "#00b5b5"
    : "hsl(var(--primary))";

  const isCompact = height < 45;

  return (
    <div
      onClick={onClick}
      className={cn(
        "absolute left-12 right-2 rounded-lg border-l-4 bg-card shadow-sm cursor-pointer transition-all hover:shadow-md hover:scale-[1.01] overflow-hidden",
        apt.status === "attended" && "opacity-60",
        apt.status === "cancelled" && "opacity-40"
      )}
      style={{
        top: `${top}px`,
        height: `${Math.max(height - 2, 24)}px`,
        borderLeftColor: borderColor,
      }}
    >
      <div className={cn("p-2 h-full flex flex-col", isCompact && "p-1.5")}>
        <div className="flex items-start justify-between gap-1">
          <div className="min-w-0 flex-1">
            <p className={cn(
              "font-medium truncate text-foreground",
              isCompact ? "text-xs" : "text-sm"
            )}>
              {apt.patients?.full_name || "Sin paciente"}
            </p>
            {!isCompact && apt.services?.name && (
              <p className="text-xs text-muted-foreground truncate">
                {apt.services.name}
              </p>
            )}
          </div>
          <div className={cn("shrink-0 w-2 h-2 rounded-full", paymentDot)} />
        </div>
        
        {!isCompact && (
          <div className="mt-auto flex items-center gap-2 text-[10px] text-muted-foreground">
            <span className="flex items-center gap-0.5">
              <Clock className="h-3 w-3" />
              {format(startDate, "HH:mm")} - {format(endDate, "HH:mm")}
            </span>
            {apt.modality === "online" ? (
              <Video className="h-3 w-3" />
            ) : (
              <MapPin className="h-3 w-3" />
            )}
          </div>
        )}
      </div>
    </div>
  );
};

const DaySingleColumn = ({
  date,
  appointments,
  onAppointmentClick,
  onAddAppointment,
  showProfessionalColors,
}: {
  date: Date;
  appointments: CalendarAppointment[];
  onAppointmentClick: (apt: CalendarAppointment) => void;
  onAddAppointment: () => void;
  showProfessionalColors: boolean;
}) => {
  const dayAppointments = appointments.filter((apt) =>
    isSameDay(new Date(apt.start_at), date)
  );

  const hours = Array.from({ length: END_HOUR - START_HOUR }, (_, i) => START_HOUR + i);
  const isToday = isSameDay(date, new Date());

  // Current time indicator
  const now = new Date();
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  const nowTop = ((nowMinutes - START_HOUR * 60) / 60) * HOUR_HEIGHT;
  const showNowLine = isToday && now.getHours() >= START_HOUR && now.getHours() < END_HOUR;

  return (
    <div className="relative">
      {/* Time grid */}
      <div className="pl-12">
        {hours.map((hour) => (
          <TimeSlot key={hour} hour={hour} />
        ))}
      </div>

      {/* Appointments */}
      {dayAppointments.map((apt) => (
        <AppointmentBlock
          key={apt.id}
          apt={apt}
          onClick={() => onAppointmentClick(apt)}
          showProfessionalColor={showProfessionalColors}
        />
      ))}

      {/* Current time indicator */}
      {showNowLine && (
        <div
          className="absolute left-10 right-0 flex items-center z-20 pointer-events-none"
          style={{ top: `${nowTop}px` }}
        >
          <div className="w-3 h-3 rounded-full bg-destructive" />
          <div className="flex-1 h-0.5 bg-destructive" />
        </div>
      )}

      {/* Empty state */}
      {dayAppointments.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="text-center text-muted-foreground pointer-events-auto">
            <p className="text-sm mb-2">Sin citas</p>
            <Button size="sm" variant="outline" onClick={onAddAppointment} className="gap-1">
              <Plus className="h-3 w-3" />
              Agregar
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};

export const DesktopDayColumn = ({
  currentDate,
  viewType,
  appointments,
  professionals,
  onAppointmentClick,
  onAddAppointment,
  showProfessionalColors,
}: DesktopDayColumnProps) => {
  const weekDays = useMemo(() => {
    if (viewType === "day") return [currentDate];
    
    const start = startOfWeek(currentDate, { weekStartsOn: 1 });
    const end = endOfWeek(currentDate, { weekStartsOn: 1 });
    return eachDayOfInterval({ start, end }).slice(0, 6); // Mon-Sat
  }, [currentDate, viewType]);

  if (viewType === "day") {
    return (
      <div className="bg-card rounded-xl border p-4 overflow-auto max-h-[calc(100vh-220px)]">
        <DaySingleColumn
          date={currentDate}
          appointments={appointments}
          onAppointmentClick={onAppointmentClick}
          onAddAppointment={onAddAppointment}
          showProfessionalColors={showProfessionalColors}
        />
      </div>
    );
  }

  // Week view
  return (
    <div className="bg-card rounded-xl border overflow-hidden">
      {/* Week header */}
      <div className="grid grid-cols-6 border-b">
        {weekDays.map((day) => {
          const isDayToday = isSameDay(day, new Date());
          const dayAppointments = appointments.filter((apt) =>
            isSameDay(new Date(apt.start_at), day)
          );
          
          return (
            <div
              key={day.toISOString()}
              className={cn(
                "py-2 px-3 text-center border-r last:border-r-0",
                isDayToday && "bg-primary/5"
              )}
            >
              <p className="text-xs text-muted-foreground uppercase">
                {format(day, "EEE", { locale: es })}
              </p>
              <p className={cn(
                "text-lg font-bold",
                isDayToday ? "text-primary" : "text-foreground"
              )}>
                {format(day, "d")}
              </p>
              {dayAppointments.length > 0 && (
                <Badge variant="secondary" className="text-[10px] mt-1">
                  {dayAppointments.length} citas
                </Badge>
              )}
            </div>
          );
        })}
      </div>

      {/* Week grid */}
      <div className="grid grid-cols-6 overflow-auto max-h-[calc(100vh-300px)]">
        {weekDays.map((day) => {
          const isDayToday = isSameDay(day, new Date());
          
          return (
            <div
              key={day.toISOString()}
              className={cn(
                "border-r last:border-r-0 min-h-[500px] relative",
                isDayToday && "bg-primary/5"
              )}
            >
              <DaySingleColumn
                date={day}
                appointments={appointments}
                onAppointmentClick={onAppointmentClick}
                onAddAppointment={onAddAppointment}
                showProfessionalColors={showProfessionalColors}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
};
