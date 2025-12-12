import { format, isSameDay } from "date-fns";
import { es } from "date-fns/locale";
import { CalendarAppointment } from "./types";
import { AppointmentCard } from "./AppointmentCard";
import { CalendarDays, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";

interface DayViewV2Props {
  currentDate: Date;
  appointments: CalendarAppointment[];
  onAppointmentClick: (appointment: CalendarAppointment) => void;
  onAddAppointment: () => void;
  showProfessionalColors: boolean;
}

export const DayViewV2 = ({
  currentDate,
  appointments,
  onAppointmentClick,
  onAddAppointment,
  showProfessionalColors,
}: DayViewV2Props) => {
  const dayAppointments = appointments
    .filter((apt) => isSameDay(new Date(apt.start_at), currentDate))
    .sort((a, b) => new Date(a.start_at).getTime() - new Date(b.start_at).getTime());

  return (
    <div className="space-y-4">
      {/* Day header - Mobile optimized */}
      <div className="flex items-center justify-between p-4 bg-card rounded-2xl border">
        <div>
          <h2 className="text-xl font-bold capitalize">
            {format(currentDate, "EEEE", { locale: es })}
          </h2>
          <p className="text-muted-foreground">
            {format(currentDate, "d 'de' MMMM, yyyy", { locale: es })}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-3xl font-bold text-primary">
            {dayAppointments.length}
          </span>
          <span className="text-sm text-muted-foreground">
            cita{dayAppointments.length !== 1 ? "s" : ""}
          </span>
        </div>
      </div>

      {/* Appointments list */}
      {dayAppointments.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 px-4">
          <div className="w-20 h-20 rounded-full bg-muted/50 flex items-center justify-center mb-4">
            <CalendarDays className="h-10 w-10 text-muted-foreground" />
          </div>
          <h3 className="text-lg font-semibold text-foreground mb-1">
            Sin citas programadas
          </h3>
          <p className="text-muted-foreground text-center mb-6">
            No hay citas para este día
          </p>
          <Button onClick={onAddAppointment} className="rounded-xl gap-2">
            <Plus className="h-4 w-4" />
            Agregar cita
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          {dayAppointments.map((apt) => (
            <AppointmentCard
              key={apt.id}
              appointment={apt}
              onClick={() => onAppointmentClick(apt)}
              showProfessionalColor={showProfessionalColors}
            />
          ))}
        </div>
      )}

      {/* Floating Add button - Mobile */}
      {dayAppointments.length > 0 && (
        <div className="md:hidden fixed bottom-6 right-6 z-40">
          <Button
            onClick={onAddAppointment}
            size="lg"
            className="h-14 w-14 rounded-full shadow-lg"
          >
            <Plus className="h-6 w-6" />
          </Button>
        </div>
      )}
    </div>
  );
};
