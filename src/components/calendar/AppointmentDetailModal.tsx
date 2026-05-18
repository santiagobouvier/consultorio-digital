import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { User, Calendar, MapPin, Video, Clock, CreditCard, MessageCircle, AlertCircle, BellRing, Repeat, X, RefreshCw, Check, XCircle } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { PaymentForm } from "@/components/PaymentForm";
import { ReminderModal } from "@/components/ReminderModal";
import { calculatePaymentStatus, type PaymentStatus } from "@/lib/payments";
import { notifyPatient } from "@/lib/push-notifications";

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
  recurrence_group_id?: string | null;
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
  const [cancellingRecurrence, setCancellingRecurrence] = useState(false);
  const [rescheduleRequest, setRescheduleRequest] = useState<any | null>(null);
  const [resolvingRequest, setResolvingRequest] = useState(false);
  const [rejectMode, setRejectMode] = useState(false);
  const [rejectionReason, setRejectionReason] = useState("");
  const [cancellationDetails, setCancellationDetails] = useState<{ reason: string | null; cancelled_at: string | null } | null>(null);

  useEffect(() => {
    if (!appointment || !open) {
      setRescheduleRequest(null);
      setCancellationDetails(null);
      setRejectMode(false);
      setRejectionReason("");
      return;
    }
    if (appointment.status === "reschedule_requested") {
      supabase
        .from("appointment_reschedule_requests")
        .select("id, requested_start_at, requested_end_at, reason, status")
        .eq("original_appointment_id", appointment.id)
        .eq("status", "pending")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle()
        .then(({ data }) => setRescheduleRequest(data || null));
    }
    if (appointment.status === "cancelled_by_patient" || appointment.status === "cancelled") {
      supabase
        .from("appointments")
        .select("cancellation_reason, cancelled_at")
        .eq("id", appointment.id)
        .maybeSingle()
        .then(({ data }) => setCancellationDetails(data ? { reason: data.cancellation_reason, cancelled_at: data.cancelled_at } : null));
    }
  }, [appointment?.id, appointment?.status, open]);

  if (!appointment) return null;

  const getStatusInfo = (status: string) => {
    const statusMap: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline"; className?: string }> = {
      pending: { label: "Programada", variant: "default" },
      scheduled: { label: "Confirmada", variant: "default" },
      confirmed: { label: "Confirmada", variant: "default" },
      attended: { label: "Realizada", variant: "secondary" },
      cancelled: { label: "Cancelada por el profesional", variant: "secondary" },
      cancelled_by_patient: { label: "Cancelada por paciente", variant: "destructive" },
      reschedule_requested: { label: "Reprogramación solicitada", variant: "outline", className: "bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800" },
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

  const handleApproveReschedule = async () => {
    if (!rescheduleRequest) return;
    setResolvingRequest(true);
    try {
      const { data, error } = await supabase.rpc("approve_reschedule_request", { p_request_id: rescheduleRequest.id });
      if (error) throw error;
      if (data && (data as any).ok === false) {
        toast({ title: "No se pudo aprobar", description: (data as any).message || "El horario ya no está disponible.", variant: "destructive" });
        return;
      }
      toast({ title: "Reprogramación aprobada", description: "La cita fue actualizada." });
      onPaymentRegistered?.();
      onClose();
    } catch (err: any) {
      toast({ title: "Error", description: err.message || "No se pudo aprobar la solicitud.", variant: "destructive" });
    } finally {
      setResolvingRequest(false);
    }
  };

  const handleRejectReschedule = async () => {
    if (!rescheduleRequest) return;
    setResolvingRequest(true);
    try {
      const { error } = await supabase.rpc("reject_reschedule_request", {
        p_request_id: rescheduleRequest.id,
        p_rejection_reason: rejectionReason.trim() || null,
      });
      if (error) throw error;
      toast({ title: "Solicitud rechazada", description: "Le avisamos al paciente." });
      onPaymentRegistered?.();
      onClose();
    } catch (err: any) {
      toast({ title: "Error", description: err.message || "No se pudo rechazar la solicitud.", variant: "destructive" });
    } finally {
      setResolvingRequest(false);
    }
  };

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

  const isRecurrent = !!appointment.recurrence_group_id;

  const handleCancelSingle = async () => {
    try {
      const { error } = await supabase
        .from("appointments")
        .update({ status: "cancelled" })
        .eq("id", appointment.id);
      if (error) throw error;
      if (appointment.patient_id) {
        notifyPatient({
          patientId: appointment.patient_id,
          title: "Cita cancelada",
          body: `Tu cita del ${format(new Date(appointment.start_at), "d 'de' MMMM", { locale: es })} fue cancelada.`,
          url: "/portal",
        });
      }
      toast({ title: "Turno cancelado" });
      onPaymentRegistered?.();
      onClose();
    } catch {
      toast({ title: "Error", description: "No se pudo cancelar", variant: "destructive" });
    }
  };

  const handleCancelSeries = async () => {
    if (!appointment.recurrence_group_id) return;
    setCancellingRecurrence(true);
    try {
      const now = new Date().toISOString();
      const { error } = await supabase
        .from("appointments")
        .update({ status: "cancelled" })
        .eq("recurrence_group_id", appointment.recurrence_group_id)
        .gte("start_at", now)
        .in("status", ["pending", "confirmed"]);
      if (error) throw error;
      if (appointment.patient_id) {
        notifyPatient({
          patientId: appointment.patient_id,
          title: "Serie de citas cancelada",
          body: "Se cancelaron tus próximas citas de la serie.",
          url: "/portal",
        });
      }
      toast({ title: "Serie cancelada", description: "Se cancelaron todos los turnos futuros de la serie" });
      onPaymentRegistered?.();
      onClose();
    } catch {
      toast({ title: "Error", description: "No se pudo cancelar la serie", variant: "destructive" });
    } finally {
      setCancellingRecurrence(false);
    }
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
                <Badge variant={statusInfo.variant} className={`rounded-full ${statusInfo.className || ""}`}>{statusInfo.label}</Badge>
                {paymentInfo && (
                  <Badge variant="outline" className="rounded-full text-xs flex items-center gap-1">
                    <span className={`w-1.5 h-1.5 rounded-full ${paymentInfo.bgColor}`} />
                    {paymentInfo.label}
                  </Badge>
                )}
              </div>
            </div>

            {/* Reschedule request panel */}
            {appointment.status === "reschedule_requested" && rescheduleRequest && (
              <div className="rounded-xl border border-amber-300 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-900 p-3 space-y-3">
                <div className="flex items-start gap-2">
                  <RefreshCw className="h-4 w-4 text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
                  <div className="text-sm">
                    <p className="font-semibold text-amber-800 dark:text-amber-300">El paciente pide reprogramar a:</p>
                    <p className="capitalize text-foreground mt-0.5">
                      {format(new Date(rescheduleRequest.requested_start_at), "EEEE d 'de' MMMM, HH:mm", { locale: es })} hs
                    </p>
                    {rescheduleRequest.reason && (
                      <p className="text-xs text-muted-foreground mt-1 italic">"{rescheduleRequest.reason}"</p>
                    )}
                  </div>
                </div>
                {!rejectMode ? (
                  <div className="grid grid-cols-2 gap-2">
                    <Button size="sm" onClick={handleApproveReschedule} disabled={resolvingRequest} className="gap-1.5">
                      <Check className="h-4 w-4" /> Aprobar
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => setRejectMode(true)} disabled={resolvingRequest} className="gap-1.5 text-destructive border-destructive/30 hover:bg-destructive/10 hover:text-destructive">
                      <XCircle className="h-4 w-4" /> Rechazar
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <Textarea
                      placeholder="Motivo del rechazo (opcional) — se lo enviaremos al paciente."
                      value={rejectionReason}
                      onChange={(e) => setRejectionReason(e.target.value)}
                      rows={3}
                      className="resize-none text-sm"
                    />
                    <div className="grid grid-cols-2 gap-2">
                      <Button size="sm" variant="outline" onClick={() => { setRejectMode(false); setRejectionReason(""); }} disabled={resolvingRequest}>
                        Volver
                      </Button>
                      <Button size="sm" variant="destructive" onClick={handleRejectReschedule} disabled={resolvingRequest}>
                        Confirmar rechazo
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Patient cancellation details */}
            {appointment.status === "cancelled_by_patient" && (
              <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-3 text-sm space-y-1">
                <p className="font-semibold text-destructive">Cancelada por el paciente</p>
                {cancellationDetails?.cancelled_at && (
                  <p className="text-xs text-muted-foreground">
                    {format(new Date(cancellationDetails.cancelled_at), "d 'de' MMMM, HH:mm", { locale: es })} hs
                  </p>
                )}
                {cancellationDetails?.reason && (
                  <p className="text-xs italic text-foreground mt-1">"{cancellationDetails.reason}"</p>
                )}
              </div>
            )}

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

            {/* Recurrence badge */}
            {isRecurrent && (
              <div className="flex items-center gap-2 p-3 border rounded-xl bg-primary/5">
                <Repeat className="h-4 w-4 text-primary" />
                <span className="text-sm font-medium text-foreground">Turno recurrente (parte de una serie)</span>
              </div>
            )}

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

              {/* Recurrence cancel actions */}
              {isRecurrent && appointment.status !== "cancelled" && (
                <div className="flex flex-col sm:flex-row gap-2">
                  <Button
                    variant="outline"
                    onClick={handleCancelSingle}
                    className="flex-1 rounded-xl text-destructive border-destructive/30 hover:bg-destructive/10"
                  >
                    <X className="h-4 w-4 mr-2" />
                    Cancelar este turno
                  </Button>
                  <Button
                    variant="outline"
                    onClick={handleCancelSeries}
                    disabled={cancellingRecurrence}
                    className="flex-1 rounded-xl text-destructive border-destructive/30 hover:bg-destructive/10"
                  >
                    <Repeat className="h-4 w-4 mr-2" />
                    {cancellingRecurrence ? "Cancelando..." : "Cancelar toda la serie"}
                  </Button>
                </div>
              )}

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
