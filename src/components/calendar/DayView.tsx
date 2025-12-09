import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { format, isSameDay } from "date-fns";
import { es } from "date-fns/locale";
import { type PaymentStatus } from "@/lib/payments";

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
  patientPaymentStatus?: PaymentStatus;
}

interface DayViewProps {
  currentDate: Date;
  appointments: Appointment[];
  onAppointmentClick: (appointment: Appointment) => void;
  selectedPatientId: string | null;
}

export const DayView = ({
  currentDate,
  appointments,
  onAppointmentClick,
  selectedPatientId,
}: DayViewProps) => {
  const dayAppointments = appointments
    .filter((apt) => isSameDay(new Date(apt.start_at), currentDate))
    .sort((a, b) => new Date(a.start_at).getTime() - new Date(b.start_at).getTime());

  const getPaymentBgColor = (color?: string) => {
    switch (color) {
      case "green":
        return "bg-emerald-50 dark:bg-emerald-950/30 border-l-emerald-500";
      case "orange":
        return "bg-amber-50 dark:bg-amber-950/30 border-l-amber-500";
      case "red":
        return "bg-rose-50 dark:bg-rose-950/30 border-l-rose-500";
      default:
        return "bg-card border-l-primary";
    }
  };

  const getPaymentBadgeInfo = (color?: string) => {
    switch (color) {
      case "green":
        return { label: "Al día", bgColor: "bg-green-500" };
      case "orange":
        return { label: "Por vencer", bgColor: "bg-orange-500" };
      case "red":
        return { label: "Vencido", bgColor: "bg-red-500" };
      default:
        return null;
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
    <div className="bg-card rounded-2xl border p-4">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-lg font-bold capitalize">
            {format(currentDate, "EEEE, d 'de' MMMM", { locale: es })}
          </h3>
          <p className="text-sm text-muted-foreground">
            {dayAppointments.length} cita{dayAppointments.length !== 1 ? "s" : ""}
          </p>
        </div>
      </div>

      {dayAppointments.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-muted-foreground">No hay citas programadas para este día</p>
        </div>
      ) : (
        <div className="space-y-3">
          {dayAppointments.map((apt) => {
            const statusInfo = getStatusBadge(apt.status);
            const showPaymentIndicator = apt.patient_id && apt.paymentColor;
            const paymentBadgeInfo = getPaymentBadgeInfo(apt.paymentColor);
            
            return (
              <div
                key={apt.id}
                onClick={() => onAppointmentClick(apt)}
                className={cn(
                  "p-4 rounded-xl cursor-pointer transition-all hover:shadow-md border-l-4 border border-border/50",
                  showPaymentIndicator ? getPaymentBgColor(apt.paymentColor) : "bg-card border-l-primary"
                )}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-lg font-bold text-primary">
                        {formatTime(apt.start_at)} - {formatTime(apt.end_at)}
                      </span>
                    </div>
                    <p className="font-semibold text-foreground truncate">
                      {apt.patients?.full_name || "Sin paciente"}
                    </p>
                    {apt.services?.name && (
                      <p className="text-sm text-muted-foreground mt-1">
                        {apt.services.name}
                      </p>
                    )}
                    {apt.location && (
                      <p className="text-sm text-muted-foreground mt-1">
                        📍 {apt.location}
                      </p>
                    )}
                  </div>
                  <div className="flex flex-col items-end gap-2 shrink-0">
                    <Badge variant={statusInfo.variant} className="rounded-full">
                      {statusInfo.label}
                    </Badge>
                    <Badge variant="outline" className="rounded-full">
                      {apt.modality === "online" ? "Online" : "Presencial"}
                    </Badge>
                    {/* Payment status badge */}
                    {showPaymentIndicator && paymentBadgeInfo && (
                      <Badge variant="outline" className="rounded-full text-xs flex items-center gap-1">
                        <span className={cn("w-1.5 h-1.5 rounded-full", paymentBadgeInfo.bgColor)} />
                        {paymentBadgeInfo.label}
                      </Badge>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
