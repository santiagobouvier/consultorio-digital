import { useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { format, startOfWeek, endOfWeek, eachDayOfInterval, isSameDay, isToday } from "date-fns";
import { es } from "date-fns/locale";

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

interface WeekViewProps {
  currentDate: Date;
  appointments: Appointment[];
  onAppointmentClick: (appointment: Appointment) => void;
  selectedPatientId: string | null;
}

export const WeekView = ({
  currentDate,
  appointments,
  onAppointmentClick,
  selectedPatientId,
}: WeekViewProps) => {
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

  const getPaymentBorderColor = (color?: string) => {
    switch (color) {
      case "green":
        return "border-l-green-500";
      case "orange":
        return "border-l-orange-500";
      case "red":
        return "border-l-red-500";
      default:
        return "border-l-muted-foreground/30";
    }
  };

  const getStatusBadge = (status: string) => {
    const statusMap: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
      pending: { label: "Programada", variant: "default" },
      confirmed: { label: "Confirmada", variant: "default" },
      attended: { label: "Realizada", variant: "secondary" },
      cancelled: { label: "Cancelada", variant: "destructive" },
      no_show: { label: "Ausente", variant: "destructive" },
    };
    return statusMap[status] || { label: status, variant: "outline" as const };
  };

  const formatTime = (datetime: string) => {
    return format(new Date(datetime), "HH:mm");
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-7 gap-3">
      {days.map((day) => {
        const dayAppointments = getAppointmentsForDay(day);
        const isCurrentDay = isToday(day);

        return (
          <div
            key={day.toISOString()}
            className={cn(
              "bg-card rounded-2xl border p-3 min-h-[150px]",
              isCurrentDay && "ring-2 ring-primary"
            )}
          >
            <div className="flex items-center justify-between mb-3">
              <div>
                <div className="text-xs text-muted-foreground capitalize">
                  {format(day, "EEEE", { locale: es })}
                </div>
                <div
                  className={cn(
                    "text-lg font-bold",
                    isCurrentDay && "text-primary"
                  )}
                >
                  {format(day, "d")}
                </div>
              </div>
              {dayAppointments.length > 0 && (
                <Badge variant="secondary" className="rounded-full">
                  {dayAppointments.length}
                </Badge>
              )}
            </div>

            <div className="space-y-2">
              {dayAppointments.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-4">
                  Sin citas
                </p>
              ) : (
                dayAppointments.map((apt) => {
                  const statusInfo = getStatusBadge(apt.status);
                  return (
                    <div
                      key={apt.id}
                      onClick={() => onAppointmentClick(apt)}
                      className={cn(
                        "p-2 rounded-xl bg-accent/50 hover:bg-accent cursor-pointer transition-colors border-l-3",
                        selectedPatientId && getPaymentBorderColor(apt.paymentColor)
                      )}
                    >
                      <div className="flex items-center justify-between gap-1 mb-1">
                        <span className="text-sm font-bold text-primary">
                          {formatTime(apt.start_at)}
                        </span>
                        <Badge
                          variant={statusInfo.variant}
                          className="text-[10px] rounded-full px-1.5 py-0"
                        >
                          {statusInfo.label}
                        </Badge>
                      </div>
                      <p className="text-xs font-medium truncate">
                        {apt.patients?.full_name || "Sin paciente"}
                      </p>
                      {apt.services?.name && (
                        <p className="text-[10px] text-muted-foreground truncate">
                          {apt.services.name}
                        </p>
                      )}
                      <Badge variant="outline" className="text-[10px] rounded-full mt-1">
                        {apt.modality === "online" ? "Online" : "Presencial"}
                      </Badge>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};
