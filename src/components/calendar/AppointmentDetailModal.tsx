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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { User, Calendar, MapPin, Video, Clock, CreditCard, MessageCircle, AlertCircle, BellRing, Repeat, X, RefreshCw, Check, XCircle, UserX } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { PaymentForm } from "@/components/PaymentForm";
import { ReminderModal } from "@/components/ReminderModal";
import { RescheduleAppointmentModal } from "@/components/calendar/RescheduleAppointmentModal";
import { PaymentLinkMenu } from "@/components/PaymentLinkMenu";
import { createPaymentLink } from "@/lib/payment-links";
import { calculatePaymentStatus, type PaymentStatus } from "@/lib/payments";
import { notifyPatient } from "@/lib/push-notifications";
import { useDashboardBranding } from "@/contexts/DashboardBrandingContext";
import { SessionNoteSheet } from "@/components/expediente/SessionNoteSheet";

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
  const { displayName: clinicDisplayName } = useDashboardBranding();
  const [showPaymentForm, setShowPaymentForm] = useState(false);
  const [showReminderModal, setShowReminderModal] = useState(false);
  const [showReschedule, setShowReschedule] = useState(false);
  const [cancellingRecurrence, setCancellingRecurrence] = useState(false);
  // Confirmación antes de cancelar (una cita o la serie completa)
  const [cancelConfirm, setCancelConfirm] = useState<"single" | "series" | null>(null);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  // El cobro atado a ESTA cita (lo crea la base automáticamente al agendar).
  const [linkedPayment, setLinkedPayment] = useState<{
    id: string; amount: number; currency: string; status: string; paid_at: string | null;
  } | null>(null);
  const [linkedPaymentChecked, setLinkedPaymentChecked] = useState(false);
  // Mercado Pago conectado: habilita el link de pago del cobro de la sesión
  const [mpConnected, setMpConnected] = useState(false);
  const [cobroConfirm, setCobroConfirm] = useState(false);
  const [markingPaid, setMarkingPaid] = useState(false);
  const [rescheduleRequest, setRescheduleRequest] = useState<any | null>(null);
  const [resolvingRequest, setResolvingRequest] = useState(false);
  const [rejectMode, setRejectMode] = useState(false);
  const [rejectionReason, setRejectionReason] = useState("");
  const [cancellationDetails, setCancellationDetails] = useState<{ reason: string | null; cancelled_at: string | null } | null>(null);
  // Nota de la sesión al marcar "Realizada": el flujo real del día a día
  const [showNoteSheet, setShowNoteSheet] = useState(false);

  // Cargar el cobro ligado a la cita (si existe)
  useEffect(() => {
    if (!appointment || !open) {
      setLinkedPayment(null);
      setLinkedPaymentChecked(false);
      return;
    }
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("payments")
        .select("id, amount, currency, status, paid_at")
        .eq("appointment_id", appointment.id)
        .neq("status", "cancelled")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (!cancelled) {
        setLinkedPayment(data ? { ...data, amount: Number(data.amount) } : null);
        setLinkedPaymentChecked(true);
      }
    })();
    // ¿Mercado Pago conectado? (para ofrecer el link de pago acá mismo)
    if (businessId) {
      (async () => {
        const { data: policy } = await supabase
          .from("payment_policies")
          .select("mp_access_token")
          .eq("business_id", businessId)
          .maybeSingle();
        if (!cancelled) setMpConnected(!!(policy as any)?.mp_access_token);
      })();
    }
    return () => { cancelled = true; };
  }, [appointment?.id, open, businessId]);

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

  const handlePaymentSuccess = () => {
    setShowPaymentForm(false);
    onPaymentRegistered?.();
  };

  const isRecurrent = !!appointment.recurrence_group_id;

  // Mail de cancelación al paciente (además del push): sin esto, un paciente
  // sin notificaciones activadas no se enteraba de que su cita se canceló.
  const sendCancellationEmail = async (seriesCancelled: boolean) => {
    const email = appointment.patients?.email;
    if (!email || !businessId) return;
    const clinic = clinicDisplayName || "tu consultorio";
    const dateStr = format(new Date(appointment.start_at), "EEEE d 'de' MMMM", { locale: es });
    const timeStr = format(new Date(appointment.start_at), "HH:mm");
    const firstName = (appointment.patients?.full_name || "").split(" ")[0] || "Hola";
    try {
      await supabase.functions.invoke("send-resend-email", {
        body: {
          to: email,
          template: "raw",
          businessId,
          data: {
            subject: seriesCancelled
              ? `Tus próximas citas fueron canceladas — ${clinic}`
              : `Tu cita del ${format(new Date(appointment.start_at), "d/M")} fue cancelada — ${clinic}`,
            message: seriesCancelled
              ? `Hola ${firstName},\n\nTe avisamos que ${clinic} canceló tus próximas citas de la serie que tenías agendada.\n\nSi querés reagendar, contactate con el consultorio o entrá a tu portal.\n\n${clinic}`
              : `Hola ${firstName},\n\nTe avisamos que ${clinic} canceló tu cita del ${dateStr} a las ${timeStr}.\n\nSi querés reagendar, contactate con el consultorio o entrá a tu portal.\n\n${clinic}`,
          },
        },
      });
    } catch (err) {
      console.warn("Cancellation email failed:", err);
    }
  };

  // Cobrar el pago atado a la cita (confirmado por diálogo)
  const handleMarkSessionPaid = async () => {
    if (!linkedPayment) return;
    setMarkingPaid(true);
    try {
      const { error } = await supabase
        .from("payments")
        .update({ status: "paid", paid_at: new Date().toISOString() })
        .eq("id", linkedPayment.id);
      if (error) throw error;
      await supabase
        .from("appointments")
        .update({ payment_status: "pagado" })
        .eq("id", appointment.id);
      setLinkedPayment({ ...linkedPayment, status: "paid", paid_at: new Date().toISOString() });
      toast({ title: "Sesión cobrada ✓", description: "El pago quedó registrado." });
      onPaymentRegistered?.();
    } catch {
      toast({ title: "Error", description: "No se pudo registrar el cobro", variant: "destructive" });
    } finally {
      setMarkingPaid(false);
      setCobroConfirm(false);
    }
  };

  // Marcar cómo terminó la sesión: el gesto más frecuente del día a día.
  const handleSetStatus = async (status: "attended" | "no_show") => {
    setUpdatingStatus(true);
    try {
      const { error } = await supabase
        .from("appointments")
        .update({ status })
        .eq("id", appointment.id);
      if (error) throw error;
      onPaymentRegistered?.();
      // Realizada + paciente con ficha: ofrecer la nota de la sesión AHÍ
      // MISMO (la nota en 30 segundos, sin viajar hasta el expediente).
      if (status === "attended" && appointment.patient_id && businessId) {
        toast({ title: "Cita marcada como realizada ✓" });
        setShowNoteSheet(true);
      } else {
        toast({
          title: status === "attended" ? "Cita marcada como realizada ✓" : "Paciente marcado como ausente",
        });
        onClose();
      }
    } catch {
      toast({ title: "Error", description: "No se pudo actualizar la cita", variant: "destructive" });
    } finally {
      setUpdatingStatus(false);
    }
  };

  // Confirmar una cita futura (cierra el círculo del aviso del dashboard
  // "citas de mañana sin confirmar").
  const handleConfirm = async () => {
    setUpdatingStatus(true);
    try {
      const { error } = await supabase
        .from("appointments")
        .update({ status: "confirmed" })
        .eq("id", appointment.id);
      if (error) throw error;
      if (appointment.patient_id) {
        notifyPatient({
          patientId: appointment.patient_id,
          title: "Cita confirmada ✓",
          body: `Tu cita del ${format(new Date(appointment.start_at), "d 'de' MMMM 'a las' HH:mm", { locale: es })} está confirmada.`,
          url: "/portal",
        });
      }
      toast({ title: "Cita confirmada ✓" });
      onPaymentRegistered?.();
      onClose();
    } catch {
      toast({ title: "Error", description: "No se pudo confirmar la cita", variant: "destructive" });
    } finally {
      setUpdatingStatus(false);
    }
  };

  const isFutureAppointment = new Date(appointment.start_at).getTime() > Date.now();

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
      void sendCancellationEmail(false);
      toast({ title: "Cita cancelada", description: "Le avisamos al paciente por email." });
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
      void sendCancellationEmail(true);
      toast({ title: "Serie cancelada", description: "Se cancelaron los turnos futuros y le avisamos al paciente." });
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
        {/* max-h + scroll interno: el detalle creció (reprogramar, link de
            pago) y sin esto se salía de la pantalla en mobile */}
        <DialogContent className="sm:max-w-md max-h-[90dvh] overflow-y-auto">
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

            {/* Cobro de la sesión: el pago que la base creó junto con la cita.
                En pantallas angostas los botones bajan a su propia fila. */}
            {linkedPaymentChecked && linkedPayment && (
              <div className="flex flex-wrap items-center justify-between gap-3 p-3 border rounded-xl">
                <div className="flex items-center gap-3 min-w-0">
                  <CreditCard className="h-5 w-5 text-muted-foreground shrink-0" />
                  <div className="min-w-0">
                    <p className="font-medium">
                      Cobro de la sesión: ${linkedPayment.amount.toLocaleString("es-UY")}
                    </p>
                    <p className={`text-sm ${linkedPayment.status === "paid" ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground"}`}>
                      {linkedPayment.status === "paid"
                        ? `Pagado${linkedPayment.paid_at ? ` el ${format(new Date(linkedPayment.paid_at), "d MMM", { locale: es })}` : ""} ✓`
                        : "Pendiente · vence el día de la sesión"}
                    </p>
                  </div>
                </div>
                {linkedPayment.status !== "paid" && (
                  <div className="flex items-center gap-1.5 ml-auto">
                    {/* Compartir el link de pago de MP sin salir de la cita */}
                    <PaymentLinkMenu
                      patientPhone={appointment.patients?.whatsapp_phone || null}
                      patientName={appointment.patients?.full_name || "Paciente"}
                      getPaymentLink={
                        mpConnected && businessId
                          ? async () => createPaymentLink(businessId, [linkedPayment.id])
                          : undefined
                      }
                    />
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setCobroConfirm(true)}
                      disabled={markingPaid}
                      className="rounded-lg shrink-0 gap-1.5 h-8"
                    >
                      <Check className="h-3.5 w-3.5" />
                      Cobrar
                    </Button>
                  </div>
                )}
              </div>
            )}

            {/* Recurrence badge */}
            {isRecurrent && (
              <div className="flex items-center gap-2 p-3 border rounded-xl bg-primary/5">
                <Repeat className="h-4 w-4 text-primary" />
                <span className="text-sm font-medium text-foreground">Turno recurrente (parte de una serie)</span>
              </div>
            )}

            {/* Acciones, ordenadas por lo que uno viene a hacer:
                1) resolver el estado de la sesión, 2) cobrar/recordar,
                3) ver la ficha, y al final la zona de peligro (cancelar). */}
            <div className="space-y-2 pt-2">
              {/* Cita futura sin confirmar → confirmarla; cita ya pasada →
                  registrar cómo terminó (realizada / ausente). */}
              {isFutureAppointment && ["pending", "scheduled"].includes(appointment.status) && (
                <Button
                  onClick={handleConfirm}
                  disabled={updatingStatus}
                  className="w-full rounded-xl gap-2"
                >
                  <Check className="h-4 w-4" />
                  Confirmar cita
                </Button>
              )}

              {/* Reprogramar: mover la cita de día/hora sin cancelarla.
                  Recordatorios y cobro la siguen solos; se avisa al paciente. */}
              {isFutureAppointment && ["pending", "scheduled", "confirmed"].includes(appointment.status) && (
                <Button
                  variant="secondary"
                  onClick={() => setShowReschedule(true)}
                  className="w-full rounded-xl gap-2"
                >
                  <RefreshCw className="h-4 w-4" />
                  Reprogramar cita
                </Button>
              )}
              {!isFutureAppointment && ["pending", "confirmed", "scheduled"].includes(appointment.status) && (
                <div className="flex flex-col sm:flex-row gap-2">
                  <Button
                    onClick={() => handleSetStatus("attended")}
                    disabled={updatingStatus}
                    className="flex-1 rounded-xl gap-2"
                  >
                    <Check className="h-4 w-4" />
                    Marcar realizada
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => handleSetStatus("no_show")}
                    disabled={updatingStatus}
                    className="flex-1 rounded-xl gap-2"
                  >
                    <UserX className="h-4 w-4" />
                    Ausente
                  </Button>
                </div>
              )}

              <div className="flex flex-col sm:flex-row gap-2">
                {/* Solo si la cita NO tiene su cobro creado (ej: sin tarifa):
                    con cobro ligado, cobrar se hace desde el bloque de arriba
                    y este botón solo invitaba a duplicar pagos. */}
                {appointment.patient_id && businessId && linkedPaymentChecked && !linkedPayment && (
                  <Button variant="secondary" onClick={() => setShowPaymentForm(true)} className="flex-1 rounded-xl">
                    <CreditCard className="h-4 w-4 mr-2" />
                    Registrar pago
                  </Button>
                )}

                {/* Reminder button */}
                {appointment.patient_id && (
                  <Button
                    variant="secondary"
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

              {appointment.patient_id && (
                <Button variant="outline" onClick={handleViewPatient} className="w-full rounded-xl">
                  <User className="h-4 w-4 mr-2" />
                  Ver ficha del paciente
                </Button>
              )}

              {/* Zona de peligro: cancelar, siempre disponible mientras la
                  cita esté viva (antes solo existía para las recurrentes) */}
              {!["cancelled", "cancelled_by_patient", "attended", "no_show"].includes(appointment.status) && (
                <div className="flex flex-col sm:flex-row gap-2 pt-1 border-t border-border/40 mt-1">
                  <Button
                    variant="ghost"
                    onClick={() => setCancelConfirm("single")}
                    className="flex-1 rounded-xl text-destructive hover:bg-destructive/10 hover:text-destructive"
                  >
                    <X className="h-4 w-4 mr-2" />
                    Cancelar cita
                  </Button>
                  {isRecurrent && (
                    <Button
                      variant="ghost"
                      onClick={() => setCancelConfirm("series")}
                      disabled={cancellingRecurrence}
                      className="flex-1 rounded-xl text-destructive hover:bg-destructive/10 hover:text-destructive"
                    >
                      <Repeat className="h-4 w-4 mr-2" />
                      {cancellingRecurrence ? "Cancelando..." : "Cancelar toda la serie"}
                    </Button>
                  )}
                </div>
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

      {/* Confirmación de cobro de la sesión */}
      <AlertDialog open={cobroConfirm} onOpenChange={setCobroConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Registrar el cobro?</AlertDialogTitle>
            <AlertDialogDescription>
              Se marca como pagada la sesión de {appointment.patients?.full_name || "este paciente"} por{" "}
              <strong>${linkedPayment?.amount.toLocaleString("es-UY")}</strong>.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-xl">Volver</AlertDialogCancel>
            <AlertDialogAction onClick={handleMarkSessionPaid} className="rounded-xl">
              Sí, cobrar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Confirmación de cancelación (cita o serie) */}
      <AlertDialog open={!!cancelConfirm} onOpenChange={(o) => !o && setCancelConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {cancelConfirm === "series" ? "¿Cancelar toda la serie?" : "¿Cancelar esta cita?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {cancelConfirm === "series"
                ? "Se cancelan todos los turnos futuros de la serie. "
                : `Se cancela la cita del ${format(new Date(appointment.start_at), "d 'de' MMMM 'a las' HH:mm", { locale: es })}. `}
              Le avisamos al paciente por email{appointment.patients?.email ? "" : " (este paciente no tiene email cargado)"} y
              su recordatorio automático se anula solo.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-xl">Volver</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                const which = cancelConfirm;
                setCancelConfirm(null);
                if (which === "series") void handleCancelSeries();
                else void handleCancelSingle();
              }}
              className="rounded-xl bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Sí, cancelar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Reprogramar cita */}
      <RescheduleAppointmentModal
        appointment={appointment}
        open={showReschedule}
        onClose={() => setShowReschedule(false)}
        businessId={businessId}
        onSuccess={() => {
          onPaymentRegistered?.();
          onClose();
        }}
      />

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

      {/* Nota de la sesión recién realizada (se abre sola al marcar Realizada) */}
      {appointment.patient_id && businessId && (
        <SessionNoteSheet
          open={showNoteSheet}
          onOpenChange={(o) => {
            setShowNoteSheet(o);
            if (!o) onClose();
          }}
          businessId={businessId}
          patientId={appointment.patient_id}
          appointmentId={appointment.id}
          sessionLabel={`${format(new Date(appointment.start_at), "EEEE d 'de' MMMM", { locale: es })} · ${format(new Date(appointment.start_at), "HH:mm")}`}
          note={null}
          defaultDate={format(new Date(appointment.start_at), "yyyy-MM-dd")}
          onSaved={() => onPaymentRegistered?.()}
        />
      )}
    </>
  );
};
