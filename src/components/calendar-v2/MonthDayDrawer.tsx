import { useMemo } from "react";
import { format, isSameDay } from "date-fns";
import { es } from "date-fns/locale";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { CalendarAppointment } from "./types";
import { AppointmentCard } from "./AppointmentCard";
import { Calendar, X } from "lucide-react";

interface MonthDayDrawerProps {
  open: boolean;
  onClose: () => void;
  selectedDate: Date;
  appointments: CalendarAppointment[];
  onAppointmentClick: (appointment: CalendarAppointment) => void;
  showProfessionalColors: boolean;
}

export const MonthDayDrawer = ({
  open,
  onClose,
  selectedDate,
  appointments,
  onAppointmentClick,
  showProfessionalColors,
}: MonthDayDrawerProps) => {
  const dayAppointments = useMemo(() => {
    return appointments
      .filter((apt) => isSameDay(new Date(apt.start_at), selectedDate))
      .sort((a, b) => new Date(a.start_at).getTime() - new Date(b.start_at).getTime());
  }, [appointments, selectedDate]);

  return (
    <Drawer open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DrawerContent className="max-h-[85vh]">
        <DrawerHeader className="border-b pb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
                <Calendar className="w-6 h-6 text-primary" />
              </div>
              <div>
                <DrawerTitle className="capitalize text-left text-lg">
                  {format(selectedDate, "EEEE d", { locale: es })}
                </DrawerTitle>
                <p className="text-sm text-muted-foreground">
                  {format(selectedDate, "MMMM yyyy", { locale: es })} · {dayAppointments.length} cita{dayAppointments.length !== 1 ? "s" : ""}
                </p>
              </div>
            </div>
            <Button variant="ghost" size="icon" onClick={onClose} className="rounded-full">
              <X className="w-5 h-5" />
            </Button>
          </div>
        </DrawerHeader>

        <div className="overflow-y-auto p-4 pb-8">
          {dayAppointments.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-muted-foreground">Sin citas programadas</p>
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
        </div>
      </DrawerContent>
    </Drawer>
  );
};
