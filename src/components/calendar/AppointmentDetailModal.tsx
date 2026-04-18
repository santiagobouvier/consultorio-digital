import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { User, Calendar, MapPin, Video, Clock, CreditCard, MessageCircle, AlertCircle, BellRing } from "lucide-react";
import { PaymentForm } from "@/components/PaymentForm";
import { ReminderModal } from "@/components/ReminderModal";
import { calculatePaymentStatus, type PaymentStatus } from "@/lib/payments";

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
  patients: { full_name: string; whatsapp_phone?: string | null; email?: string | null; avatar_url?: string | null } | null;
  services: { name: string } | null;
  paymentColor?: string;
  patientPaymentStatus?: PaymentStatus;
}

interface AppointmentDetailModalProps {
  appointment: Appointment | null;
  open: boolean;
  onClose: () => void;
  businessId: string | null;
  onPaymentRegistered?: () => void;
}

export const AppointmentDetailModal = ({
  appointment,
  open,
  onClose,
  businessId,
  onPaymentRegistered,
}: AppointmentDetailModalProps) => {
  const navigate = useNavigate();
  const [showPaymentForm, setShowPaymentForm] = useState(false);
  const [showReminderModal, setShowReminderModal] = useState(false);

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

  const getPaymentStatusInfo = (color?: string) => {
    switch (color) {
      case "green": return { label: "Al día", bgColor: "bg-green-500", textColor: "text-green-600" };
      case "orange": return { label: "Por vencer", bgColor: "bg-orange-500", textColor: "text-orange-600" };
      case "red": return { label: "Vencido", bgColor: "bg-red-500", textColor: "text-red-600" };
      default: return null;
    }
  };

  const statusInfo = getStatusInfo(appointment.status);
  const paymentInfo = getPaymentStatusInfo(appointment.paymentColor);

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

  const handlePaymentSuccess = () => {
    setShowPaymentForm(false);
    onPaymentRegistered?.();
  };

  const showPaymentReminder = appointment.paymentColor === "orange" || appointment.paymentColor === "red";

  return (
    <>
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
              <Avatar className="h-10 w-10 shrink-0 ring-2 ring-primary/20">
                <AvatarImage src={appointment.patients?.avatar_url || undefined} alt={appointment.patients?.full_name || ""} />
                <AvatarFallback className="bg-primary/10 text-primary text-sm font-semibold">
                  {(appointment.patients?.full_name?.trim().split(/\s+/).map((p) => p[0]).slice(0, 2).join("") || "?").toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-foreground">
                  {appointment.patients?.full_name || "Sin paciente"}
                </p>
                {appointment.services?.name && (
                  <p className="text-sm text-muted-foreground">{appointment.services.name}</p>
                )}
              </div>
              <div className="flex flex-col items-end gap-1 shrink-0">
                <Badge variant={statusInfo.variant} className="rounded-full">{statusInfo.label}</Badge>
                {paymentInfo && (
                  <Badge variant="outline" className="rounded-full text-xs flex items-center gap-1">
                    <span className={`w-1.5 h-1.5 rounded-full ${paymentInfo.bgColor}`} />
                    {paymentInfo.label}
                  </Badge>
                )}
              </div>
            </div>

            {/* Payment Warning */}
            {showPaymentReminder && (
              <div className={`flex items-start gap-3 p-3 rounded-xl ${
                appointment.paymentColor === "red"
                  ? "bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900"
                  : "bg-orange-50 dark:bg-orange-950/30 border border-orange-200 dark:border-orange-900"
              }`}>
                <AlertCircle className={`h-5 w-5 shrink-0 ${
                  appointment.paymentColor === "red" ? "text-red-600" : "text-orange-600"
                }`} />
                <p className={`text-sm font-medium ${
                  appointment.paymentColor === "red" ? "text-red-700 dark:text-red-400" : "text-orange-700 dark:text-orange-400"
                }`}>
                  {appointment.paymentColor === "red"
                    ? "Este paciente tiene un pago vencido"
                    : "Este paciente tiene un pago próximo a vencer"}
                </p>
              </div>
            )}

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
            <div className="space-y-2 pt-2">
              <div className="flex flex-col sm:flex-row gap-2">
                {appointment.patient_id && (
                  <Button onClick={handleViewPatient} className="flex-1 rounded-xl">
                    <User className="h-4 w-4 mr-2" />
                    Ver paciente
                  </Button>
                )}
                <Button variant="outline" onClick={handleViewAppointment} className="flex-1 rounded-xl">
                  <Calendar className="h-4 w-4 mr-2" />
                  Ver citas
                </Button>
              </div>

              <div className="flex flex-col sm:flex-row gap-2">
                {appointment.patient_id && businessId && (
                  <Button variant="secondary" onClick={() => setShowPaymentForm(true)} className="flex-1 rounded-xl">
                    <CreditCard className="h-4 w-4 mr-2" />
                    Registrar pago
                  </Button>
                )}

                {/* Reminder button */}
                {appointment.patient_id && (
                  <Button
                    variant="outline"
                    onClick={() => setShowReminderModal(true)}
                    className="flex-1 rounded-xl"
                  >
                    <BellRing className="h-4 w-4 mr-2" />
                    Enviar recordatorio
                  </Button>
                )}
              </div>

              {showPaymentReminder && appointment.patient_id && (
                <Button
                  variant="outline"
                  onClick={handleViewPatient}
                  className={`w-full rounded-xl ${
                    appointment.paymentColor === "red"
                      ? "text-red-600 hover:text-red-700 border-red-200 hover:border-red-300 hover:bg-red-50"
                      : "text-orange-600 hover:text-orange-700 border-orange-200 hover:border-orange-300 hover:bg-orange-50"
                  }`}
                >
                  <MessageCircle className="h-4 w-4 mr-2" />
                  Recordatorio de pago
                </Button>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Payment Form Modal */}
      {appointment.patient_id && businessId && (
        <PaymentForm
          open={showPaymentForm}
          onOpenChange={setShowPaymentForm}
          patientId={appointment.patient_id}
          businessId={businessId}
          onSuccess={handlePaymentSuccess}
        />
      )}

      {/* Reminder Modal */}
      {appointment.patient_id && (
        <ReminderModal
          open={showReminderModal}
          onOpenChange={setShowReminderModal}
          appointmentId={appointment.id}
          patientId={appointment.patient_id}
          patientName={appointment.patients?.full_name || "Paciente"}
          patientPhone={appointment.patients?.whatsapp_phone || null}
          patientEmail={appointment.patients?.email || null}
          appointmentDate={format(new Date(appointment.start_at), "d 'de' MMMM", { locale: es })}
          appointmentTime={format(new Date(appointment.start_at), "HH:mm")}
          appointmentStartAt={appointment.start_at}
          modality={appointment.modality || "presencial"}
          location={appointment.location || null}
        />
      )}
    </>
  );
};
