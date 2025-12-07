import { useNavigate } from "react-router-dom";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { User, Calendar, MapPin, Video, Clock } from "lucide-react";

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

interface AppointmentDetailModalProps {
  appointment: Appointment | null;
  open: boolean;
  onClose: () => void;
}

export const AppointmentDetailModal = ({
  appointment,
  open,
  onClose,
}: AppointmentDetailModalProps) => {
  const navigate = useNavigate();

  if (!appointment) return null;

  const getStatusInfo = (status: string) => {
    const statusMap: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
      pending: { label: "Programada", variant: "default" },
      confirmed: { label: "Confirmada", variant: "default" },
      attended: { label: "Realizada", variant: "secondary" },
      cancelled: { label: "Cancelada", variant: "destructive" },
      no_show: { label: "Ausente", variant: "destructive" },
    };
    return statusMap[status] || { label: status, variant: "outline" as const };
  };

  const statusInfo = getStatusInfo(appointment.status);

  const handleViewPatient = () => {
    if (appointment.patient_id) {
      navigate(`/patients/${appointment.patient_id}`);
      onClose();
    }
  };

  const handleViewAppointment = () => {
    navigate(`/appointments`);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5 text-primary" />
            Detalle de la cita
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Patient Info */}
          <div className="flex items-start gap-3 p-3 bg-accent/50 rounded-xl">
            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
              <User className="h-5 w-5 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-foreground">
                {appointment.patients?.full_name || "Sin paciente"}
              </p>
              {appointment.services?.name && (
                <p className="text-sm text-muted-foreground">
                  {appointment.services.name}
                </p>
              )}
            </div>
            <Badge variant={statusInfo.variant} className="rounded-full shrink-0">
              {statusInfo.label}
            </Badge>
          </div>

          {/* Date & Time */}
          <div className="flex items-center gap-3 p-3 border rounded-xl">
            <Clock className="h-5 w-5 text-muted-foreground" />
            <div>
              <p className="font-medium capitalize">
                {format(new Date(appointment.start_at), "EEEE, d 'de' MMMM 'de' yyyy", { locale: es })}
              </p>
              <p className="text-sm text-muted-foreground">
                {format(new Date(appointment.start_at), "HH:mm")} - {format(new Date(appointment.end_at), "HH:mm")}
              </p>
            </div>
          </div>

          {/* Modality */}
          <div className="flex items-center gap-3 p-3 border rounded-xl">
            {appointment.modality === "online" ? (
              <Video className="h-5 w-5 text-muted-foreground" />
            ) : (
              <MapPin className="h-5 w-5 text-muted-foreground" />
            )}
            <div>
              <p className="font-medium">
                {appointment.modality === "online" ? "Consulta online" : "Consulta presencial"}
              </p>
              {appointment.location && (
                <p className="text-sm text-muted-foreground">{appointment.location}</p>
              )}
            </div>
          </div>

          {/* Actions */}
          <div className="flex flex-col sm:flex-row gap-2 pt-2">
            {appointment.patient_id && (
              <Button onClick={handleViewPatient} className="flex-1 rounded-xl">
                <User className="h-4 w-4 mr-2" />
                Ver paciente
              </Button>
            )}
            <Button
              variant="outline"
              onClick={handleViewAppointment}
              className="flex-1 rounded-xl"
            >
              <Calendar className="h-4 w-4 mr-2" />
              Ver citas
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
