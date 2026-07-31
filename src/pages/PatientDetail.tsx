import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { invalidatePaymentData } from "@/lib/data-sync";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { toast } from "@/hooks/use-toast";
import {
  ArrowLeft, Mail, Phone, Calendar, FileText, CreditCard, Plus, Check,
  RefreshCw, Pencil, Trash2, UserPlus, User as UserIcon, MessageCircle,
  CalendarPlus, MoreHorizontal, Clock, AlertTriangle, Video, MapPin, Lock,
} from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { format, isAfter, isBefore } from "date-fns";
import { es } from "date-fns/locale";
import { PaymentForm } from "@/components/PaymentForm";
import { PatientForm } from "@/components/PatientForm";
import { PatientInviteModal } from "@/components/PatientInviteModal";
import { CreateAppointmentModal } from "@/components/CreateAppointmentModal";
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
import { PaymentWhatsAppMenu } from "@/components/PaymentWhatsAppMenu";
import { PaymentLinkMenu } from "@/components/PaymentLinkMenu";
import { ConfirmPaymentDialog } from "@/components/ConfirmPaymentDialog";
import { createPaymentLink } from "@/lib/payment-links";
import LoadingPage from "@/components/LoadingPage";
import { PatientRecord } from "@/components/PatientRecord";
import { PatientDocuments } from "@/components/PatientDocuments";
import { cn } from "@/lib/utils";
import {
  calculatePaymentStatus,
  getPaymentStatusColor,
  getPaymentStatusLabel,
  formatCurrency,
  calculateNextDueDate,
  getRecurrenceTypeLabel,
  type PaymentStatus,
  type RecurrenceType,
} from "@/lib/payments";
import {
  AGREED_FREQUENCY_LABELS,
  PAYMENT_TYPE_LABELS,
  TREATMENT_STATUS_LABELS,
  computeAge,
  isMinor,
  type AgreedFrequency,
  type PaymentType,
  type TreatmentStatus,
} from "@/lib/patient-profile";

interface Patient {
  id: string;
  business_id: string;
  full_name: string;
  email: string | null;
  whatsapp_phone: string | null;
  reason_for_consultation: string | null;
  private_notes: string | null;
  is_active: boolean;
  avatar_url: string | null;
  created_at: string;
  auth_user_id: string | null;
  // Perfil v2 — todos opcionales; vacío no se muestra
  birth_date: string | null;
  document_id: string | null;
  emergency_contact_name: string | null;
  emergency_contact_relationship: string | null;
  emergency_contact_phone: string | null;
  guardian_name: string | null;
  guardian_relationship: string | null;
  guardian_phone: string | null;
  guardian_email: string | null;
  health_insurance: string | null;
  payment_type: string | null;
  first_consultation_date: string | null;
  referred_by: string | null;
  agreed_frequency: string | null;
}

interface Appointment {
  id: string;
  start_at: string;
  end_at: string;
  status: string;
  modality: string | null;
  source: string;
}

interface Payment {
  id: string;
  amount: number;
  currency: string;
  due_date: string;
  status: PaymentStatus;
  paid_at: string | null;
  method: string | null;
  notes: string | null;
  recurrence_type: RecurrenceType;
  anchor_day: number | null;
}

const statusLabels: Record<string, string> = {
  pending: "Pendiente",
  confirmed: "Confirmada",
  scheduled: "Confirmada",
  cancelled: "Cancelada",
  cancelled_by_patient: "Cancelada por paciente",
  reschedule_requested: "Reprogramación pedida",
  attended: "Realizada",
  no_show: "No asistió",
};

const CANCELLED_STATUSES = ["cancelled", "cancelled_by_patient"];

// Color del badge de estado del tratamiento (clínico, distinto del
// activo/inactivo administrativo que gobierna el límite del plan).
const TREATMENT_BADGE_CLASS: Record<TreatmentStatus, string> = {
  activo: "bg-emerald-600 text-white",
  en_pausa: "bg-amber-500 text-white",
  alta: "bg-sky-600 text-white",
  abandono: "bg-muted text-muted-foreground",
};

const PatientDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [patient, setPatient] = useState<Patient | null>(null);
  const [treatmentStatus, setTreatmentStatus] = useState<TreatmentStatus | null>(null);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [paymentsError, setPaymentsError] = useState(false);
  const [showPaymentForm, setShowPaymentForm] = useState(false);
  const [editingPayment, setEditingPayment] = useState<Payment | null>(null);
  const [deletingPaymentId, setDeletingPaymentId] = useState<string | null>(null);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [showEditPatient, setShowEditPatient] = useState(false);
  const [showDeletePatient, setShowDeletePatient] = useState(false);
  const [deletingPatient, setDeletingPatient] = useState(false);
  const [showCreateAppointment, setShowCreateAppointment] = useState(false);

  useEffect(() => {
    if (id) {
      fetchData();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const fetchData = async () => {
    if (!id) return;

    try {
      setLoading(true);

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        navigate("/auth");
        return;
      }

      const { data: patientData, error: patientError } = await supabase
        .from("patients")
        .select("*")
        .eq("id", id)
        .maybeSingle();

      if (patientError) {
        console.error("Error fetching patient:", patientError);
        toast({
          title: "Error",
          description: "No se pudo cargar el paciente",
          variant: "destructive",
        });
        return;
      }

      if (!patientData) {
        setPatient(null);
        setLoading(false);
        return;
      }

      setPatient(patientData as Patient);

      // Estado clínico (tabla aparte, solo visible para el profesional):
      // acá solo se usa el estado del tratamiento para el badge de la ficha.
      const { data: clinicalData } = await supabase
        .from("patient_clinical_status")
        .select("treatment_status")
        .eq("patient_id", id)
        .maybeSingle();
      setTreatmentStatus((clinicalData?.treatment_status as TreatmentStatus | null) ?? null);

      const { data: appointmentsData } = await supabase
        .from("appointments")
        .select("id, start_at, end_at, status, modality, source")
        .eq("patient_id", id)
        .order("start_at", { ascending: false });

      setAppointments(appointmentsData || []);

      try {
        const { data: paymentsData, error: payError } = await supabase
          .from("payments")
          .select("id, amount, currency, due_date, status, paid_at, method, notes, recurrence_type, anchor_day")
          .eq("patient_id", id)
          .order("due_date", { ascending: false });

        if (payError) {
          console.error("Error fetching payments:", payError);
          setPaymentsError(true);
        } else {
          const paymentsWithStatus = (paymentsData || []).map((payment) => ({
            ...payment,
            status: calculatePaymentStatus(payment),
            recurrence_type: (payment.recurrence_type || "one_time") as RecurrenceType,
          })) as Payment[];
          setPayments(paymentsWithStatus);
        }
      } catch {
        setPaymentsError(true);
      }
    } catch (error) {
      console.error("Error fetching data:", error);
      toast({
        title: "Error",
        description: "No se pudo cargar la información",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    return format(new Date(dateString), "d MMM yyyy", { locale: es });
  };

  const formatDateTime = (dateString: string) => {
    return format(new Date(dateString), "d MMM yyyy, HH:mm", { locale: es });
  };

  // ── Resumen calculado ──
  const now = new Date();
  const nextAppointment = useMemo(
    () =>
      [...appointments]
        .filter((a) => !CANCELLED_STATUSES.includes(a.status) && isAfter(new Date(a.start_at), now))
        .sort((a, b) => a.start_at.localeCompare(b.start_at))[0] ?? null,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [appointments]
  );
  const pastSessions = useMemo(
    () =>
      appointments.filter(
        (a) =>
          isBefore(new Date(a.start_at), now) &&
          !CANCELLED_STATUSES.includes(a.status) &&
          a.status !== "no_show"
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [appointments]
  );
  const lastSession = pastSessions[0] ?? null; // appointments viene ordenado desc
  const unpaid = useMemo(
    () => payments.filter((p) => !p.paid_at && p.status !== "cancelled"),
    [payments]
  );
  const debt = unpaid.reduce((s, p) => s + p.amount, 0);
  const hasOverdue = unpaid.some((p) => p.status === "overdue");
  const upcomingAppointments = useMemo(
    () =>
      [...appointments]
        .filter((a) => !CANCELLED_STATUSES.includes(a.status) && isAfter(new Date(a.start_at), now))
        .sort((a, b) => a.start_at.localeCompare(b.start_at))
        .slice(0, 3),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [appointments]
  );

  const hasPortal = !!patient?.auth_user_id;

  // Sirve para el paciente y también para el contacto de emergencia / adulto
  // responsable: misma normalización de número en todos lados.
  const openWhatsAppNumber = (raw?: string | null) => {
    if (!raw) return;
    const digits = raw.replace(/\D/g, "");
    const phone = digits.startsWith("0")
      ? "598" + digits.slice(1)
      : digits.startsWith("598") || digits.length > 9
        ? digits
        : "598" + digits;
    window.open(`https://wa.me/${phone}`, "_blank");
  };
  const openWhatsApp = () => openWhatsAppNumber(patient?.whatsapp_phone);

  // Cobrar pide confirmación (igual que en el módulo Pagos): un toque
  // accidental no debe marcar nada como pagado.
  const [confirmPaymentData, setConfirmPaymentData] = useState<Payment | null>(null);

  // ¿El consultorio tiene Mercado Pago conectado? Habilita el link de cobro.
  const [mpConnected, setMpConnected] = useState(false);
  useEffect(() => {
    if (!patient?.business_id) return;
    (async () => {
      const { data } = await supabase
        .from("payment_policies")
        .select("mp_access_token")
        .eq("business_id", patient.business_id)
        .maybeSingle();
      setMpConnected(!!(data as any)?.mp_access_token);
    })();
  }, [patient?.business_id]);

  const queryClient = useQueryClient();

  const handleMarkAsPaid = async (payment: Payment) => {
    try {
      const { error } = await supabase
        .from("payments")
        .update({ paid_at: new Date().toISOString(), status: "paid" })
        .eq("id", payment.id);

      if (error) throw error;
      invalidatePaymentData(queryClient);

      // El vencimiento siguiente de un pago recurrente lo genera la base de
      // datos (trigger generate_next_recurring_payment) — no el navegador.
      if (payment.recurrence_type !== "one_time") {
        const nextDueDate = calculateNextDueDate(
          new Date(payment.due_date),
          payment.recurrence_type,
          payment.anchor_day
        );
        toast({
          title: "Éxito",
          description: `Pago cobrado. Próximo vencimiento: ${formatDate(nextDueDate.toISOString())}`,
        });
      } else {
        toast({ title: "Éxito", description: "Pago marcado como cobrado" });
      }

      fetchData();
    } catch (error) {
      console.error("Error marking payment as paid:", error);
      toast({
        title: "Error",
        description: "No se pudo actualizar el pago",
        variant: "destructive",
      });
    }
  };

  const handleDeletePayment = async () => {
    if (!deletingPaymentId) return;

    try {
      const { error } = await supabase
        .from("payments")
        .delete()
        .eq("id", deletingPaymentId);

      if (error) throw error;

      invalidatePaymentData(queryClient);
      toast({ title: "Éxito", description: "Pago eliminado correctamente" });
      setDeletingPaymentId(null);
      fetchData();
    } catch (error) {
      console.error("Error deleting payment:", error);
      toast({
        title: "Error",
        description: "No se pudo eliminar el pago",
        variant: "destructive",
      });
    }
  };

  const handleDeletePatient = async () => {
    if (!patient) return;
    try {
      setDeletingPatient(true);
      const { error } = await supabase
        .from("patients")
        .delete()
        .eq("id", patient.id);

      if (error) throw error;

      toast({
        title: "Paciente eliminado",
        description: "El paciente fue eliminado correctamente",
      });
      navigate("/patients", { replace: true });
    } catch (error: any) {
      console.error("Error eliminando paciente:", error);
      toast({
        title: "No se pudo eliminar",
        description: error?.message || "Intentá de nuevo",
        variant: "destructive",
      });
      setDeletingPatient(false);
      setShowDeletePatient(false);
    }
  };

  if (loading) {
    return <LoadingPage />;
  }

  if (!patient) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4 gap-4">
        <p className="text-muted-foreground text-lg">Paciente no encontrado</p>
        <Link to="/patients">
          <Button variant="outline" className="rounded-xl">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Volver al listado
          </Button>
        </Link>
      </div>
    );
  }

  const initials =
    patient.full_name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2) || "P";

  const AppointmentRow = ({ a }: { a: Appointment }) => {
    const isCancelled = CANCELLED_STATUSES.includes(a.status);
    return (
      <div
        className={cn(
          // flex-wrap: los estados largos ("Reprogramación pedida") bajan de
          // línea en mobile en vez de desbordar la tarjeta
          "flex flex-wrap items-center justify-between gap-2 p-3 rounded-xl border bg-card",
          isCancelled && "opacity-60"
        )}
      >
        <div className="min-w-0">
          <p className="font-medium text-sm text-foreground">{formatDateTime(a.start_at)}</p>
          <p className="text-xs text-muted-foreground mt-0.5 inline-flex items-center gap-1">
            {a.modality === "online" ? <Video className="h-3 w-3" /> : <MapPin className="h-3 w-3" />}
            {a.modality === "online" ? "Online" : "Presencial"}
          </p>
        </div>
        <Badge
          variant={a.status === "attended" || a.status === "scheduled" || a.status === "confirmed" ? "default" : "secondary"}
          className={cn("rounded-full text-xs shrink-0", isCancelled && "bg-muted text-muted-foreground")}
        >
          {statusLabels[a.status] || a.status}
        </Badge>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Desktop: carnet + números fijos a la izquierda (como una ficha
          clínica de verdad) y el contenido de las pestañas a lo ancho.
          Mobile/tablet: mismo orden apilado de siempre. */}
      <div className="mx-auto w-full max-w-[1500px] p-4 sm:p-6 lg:px-8 lg:py-8">
        <div className="grid grid-cols-1 lg:grid-cols-[minmax(340px,390px)_1fr] gap-5 lg:gap-6 items-start">
        <div className="space-y-5 lg:sticky lg:top-6">

        {/* ── Cabecera "carnet" ──
            Desktop (riel): tarjeta vertical centrada, con el nombre COMPLETO
            (envuelve, nunca se corta). Mobile: fila horizontal como siempre. */}
        <div className="relative rounded-2xl border bg-gradient-to-br from-primary/10 via-primary/5 to-transparent p-4 sm:p-6">
          <div className="flex items-start gap-3 sm:gap-4 lg:flex-col lg:items-center lg:gap-3 lg:pt-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate("/patients")}
              className="shrink-0 -ml-2 lg:absolute lg:left-3 lg:top-3 lg:ml-0"
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>

            <Avatar className="h-16 w-16 sm:h-20 sm:w-20 lg:h-24 lg:w-24 rounded-2xl shrink-0 ring-2 ring-primary/20">
              {patient.avatar_url && (
                <AvatarImage src={patient.avatar_url} alt={patient.full_name} className="object-cover" />
              )}
              <AvatarFallback className="rounded-2xl bg-primary/10 text-primary font-bold text-xl lg:text-2xl">
                {initials || <UserIcon className="h-7 w-7" />}
              </AvatarFallback>
            </Avatar>

            <div className="min-w-0 flex-1 lg:flex-none lg:w-full lg:text-center">
              <h1 className="text-xl sm:text-2xl font-bold text-foreground break-words leading-tight">
                {patient.full_name}
              </h1>
              {/* Chips que cuentan la historia en 2 segundos */}
              <div className="flex items-center gap-1.5 mt-2 flex-wrap lg:justify-center">
                <Badge
                  variant={patient.is_active ? "default" : "secondary"}
                  className="rounded-full text-xs"
                >
                  {patient.is_active ? "Activo" : "Inactivo"}
                </Badge>
                {!paymentsError && (
                  hasOverdue ? (
                    <Badge className="rounded-full text-xs bg-destructive text-destructive-foreground gap-1">
                      <AlertTriangle className="h-3 w-3" />
                      Debe {formatCurrency(debt, "UYU")}
                    </Badge>
                  ) : unpaid.length > 0 ? (
                    <Badge className="rounded-full text-xs bg-amber-500 text-white">
                      Pagos pendientes
                    </Badge>
                  ) : payments.length > 0 ? (
                    <Badge className="rounded-full text-xs bg-emerald-600 text-white">
                      Al día
                    </Badge>
                  ) : null
                )}
                {hasPortal ? (
                  <Badge variant="outline" className="rounded-full text-xs gap-1 border-primary/30 text-primary">
                    <Check className="h-3 w-3" />
                    Portal activo
                  </Badge>
                ) : (
                  <Badge variant="secondary" className="rounded-full text-xs text-muted-foreground">
                    Sin portal
                  </Badge>
                )}
                {computeAge(patient.birth_date) !== null && (
                  <Badge variant="outline" className="rounded-full text-xs text-muted-foreground">
                    {computeAge(patient.birth_date)} años
                  </Badge>
                )}
                {isMinor(patient.birth_date) && (
                  <Badge className="rounded-full text-xs bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30">
                    Menor de edad
                  </Badge>
                )}
              </div>
            </div>

            {/* Menú ⋯ (acciones sensibles escondidas del camino) */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="shrink-0 rounded-xl lg:absolute lg:right-3 lg:top-3">
                  <MoreHorizontal className="h-5 w-5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="rounded-xl">
                <DropdownMenuItem onClick={() => setShowInviteModal(true)} className="gap-2 cursor-pointer">
                  <UserPlus className="h-4 w-4" />
                  Invitar al portal
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => setShowDeletePatient(true)}
                  className="gap-2 cursor-pointer text-destructive focus:text-destructive"
                >
                  <Trash2 className="h-4 w-4" />
                  Eliminar paciente
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {/* Acciones principales */}
          {/* Mobile: "Agendar cita" (e "Invitar") a lo ancho y el resto en dos
              columnas — tres botones en una fila de 360px se desbordaban.
              Desktop: fila (sm) o grilla 2x2 en el riel (lg), como siempre. */}
          <div className="grid grid-cols-2 sm:flex lg:grid lg:grid-cols-2 gap-2 mt-4 sm:pl-[4.5rem] lg:pl-0">
            <Button
              onClick={() => setShowCreateAppointment(true)}
              className="rounded-xl gap-2 h-10 col-span-2 lg:col-span-1"
            >
              <CalendarPlus className="h-4 w-4" />
              <span className="text-xs sm:text-sm">Agendar cita</span>
            </Button>
            {/* Sin portal: invitar es la acción que más valor agrega — bien visible */}
            {!hasPortal && (
              <Button
                variant="outline"
                onClick={() => setShowInviteModal(true)}
                className="rounded-xl gap-2 h-10 col-span-2 lg:col-span-1 border-primary/50 text-primary hover:bg-primary/10 hover:text-primary"
              >
                <UserPlus className="h-4 w-4" />
                <span className="text-xs sm:text-sm">Invitar al portal</span>
              </Button>
            )}
            <Button
              variant="outline"
              onClick={openWhatsApp}
              disabled={!patient.whatsapp_phone}
              className="rounded-xl gap-2 h-10"
            >
              <MessageCircle className="h-4 w-4" />
              <span className="text-xs sm:text-sm">WhatsApp</span>
            </Button>
            <Button variant="outline" onClick={() => setShowEditPatient(true)} className="rounded-xl gap-2 h-10">
              <Pencil className="h-4 w-4" />
              <span className="text-xs sm:text-sm">Editar</span>
            </Button>
          </div>
        </div>

        {/* ── 4 números clave (2x2 en el riel de desktop) ── */}
        <div className="grid grid-cols-2 gap-3">
          <Card className="rounded-2xl border-border/50">
            <CardContent className="p-3.5">
              <p className="text-xs text-muted-foreground inline-flex items-center gap-1.5">
                <Calendar className="h-3.5 w-3.5" /> Próxima cita
              </p>
              {nextAppointment ? (
                <p className="text-sm font-bold mt-1">
                  {format(new Date(nextAppointment.start_at), "EEE d MMM · HH:mm", { locale: es })}
                </p>
              ) : (
                <p className="text-sm font-bold mt-1 text-amber-500">Sin agendar</p>
              )}
            </CardContent>
          </Card>
          <Card className="rounded-2xl border-border/50">
            <CardContent className="p-3.5">
              <p className="text-xs text-muted-foreground inline-flex items-center gap-1.5">
                <Check className="h-3.5 w-3.5" /> Sesiones
              </p>
              <p className="text-sm font-bold mt-1">{pastSessions.length}</p>
            </CardContent>
          </Card>
          <Card className="rounded-2xl border-border/50">
            <CardContent className="p-3.5">
              <p className="text-xs text-muted-foreground inline-flex items-center gap-1.5">
                <CreditCard className="h-3.5 w-3.5" /> Pendiente de pago
              </p>
              <p className={cn("text-sm font-bold mt-1", hasOverdue && "text-destructive")}>
                {paymentsError ? "—" : debt > 0 ? formatCurrency(debt, "UYU") : "$ 0"}
              </p>
            </CardContent>
          </Card>
          <Card className="rounded-2xl border-border/50">
            <CardContent className="p-3.5">
              <p className="text-xs text-muted-foreground inline-flex items-center gap-1.5">
                <Clock className="h-3.5 w-3.5" /> Última sesión
              </p>
              <p className="text-sm font-bold mt-1">
                {lastSession ? formatDate(lastSession.start_at) : "—"}
              </p>
            </CardContent>
          </Card>
        </div>

        {/* ── Datos de contacto: solo en el riel de desktop. En mobile es
            redundante — el Resumen muestra lo mismo justo abajo. ── */}
        <Card className="rounded-2xl border-border/50 hidden lg:block">
          <CardContent className="p-4 space-y-2.5">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Contacto</p>
            <div className="flex items-center gap-2.5 text-sm min-w-0">
              <MessageCircle className="h-4 w-4 text-primary shrink-0" />
              {patient.whatsapp_phone ? (
                <span className="tabular-nums">{patient.whatsapp_phone}</span>
              ) : (
                <span className="text-muted-foreground">Sin WhatsApp cargado</span>
              )}
            </div>
            <div className="flex items-center gap-2.5 text-sm min-w-0">
              <Mail className="h-4 w-4 text-primary shrink-0" />
              {patient.email ? (
                <span className="truncate">{patient.email}</span>
              ) : (
                <span className="text-muted-foreground">Sin email cargado</span>
              )}
            </div>
            <div className="flex items-center gap-2.5 text-sm">
              <Calendar className="h-4 w-4 text-primary shrink-0" />
              <span className="text-muted-foreground">
                Paciente desde {format(new Date(patient.created_at), "MMMM yyyy", { locale: es })}
              </span>
            </div>
          </CardContent>
        </Card>
        </div>

        {/* ── Pestañas (columna principal en desktop) ── */}
        <div className="min-w-0">
        <Tabs defaultValue="resumen" className="w-full">
          {/* En mobile las 5 pestañas comparten 360px: padding mínimo y tipografía
              apenas menor para que "Expediente" nunca se corte ni desborde. */}
          <TabsList className="grid grid-cols-5 w-full h-11 rounded-xl">
            <TabsTrigger value="resumen" className="rounded-lg px-1 sm:px-3 text-[11px] sm:text-sm">Resumen</TabsTrigger>
            <TabsTrigger value="notes" className="rounded-lg px-1 sm:px-3 text-[11px] sm:text-sm">Expediente</TabsTrigger>
            <TabsTrigger value="payments" className="rounded-lg px-1 sm:px-3 text-[11px] sm:text-sm gap-1">
              Pagos
              {unpaid.length > 0 && (
                <span className={cn("w-1.5 h-1.5 rounded-full shrink-0", hasOverdue ? "bg-destructive" : "bg-amber-500")} />
              )}
            </TabsTrigger>
            <TabsTrigger value="appointments" className="rounded-lg px-1 sm:px-3 text-[11px] sm:text-sm">Citas</TabsTrigger>
            <TabsTrigger value="docs" className="rounded-lg px-1 sm:px-3 text-[11px] sm:text-sm">Docs</TabsTrigger>
          </TabsList>

          {/* Resumen: secciones del perfil. Campo vacío no se renderiza. */}
          <TabsContent value="resumen" className="mt-4 space-y-4">
            {/* ── Datos personales ── */}
            <Card className="rounded-2xl border-border/50">
              <CardHeader className="pb-3">
                <CardTitle className="text-base font-bold flex items-center gap-2.5">
                  <span className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                    <UserIcon className="h-4 w-4 text-primary" />
                  </span>
                  Datos personales
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="flex items-start gap-3">
                    <Mail className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                    <div className="min-w-0">
                      <p className="text-xs text-muted-foreground uppercase tracking-wide">Email</p>
                      <p className="text-sm font-medium text-foreground break-all">
                        {patient.email || "No registrado"}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <Phone className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                    <div className="min-w-0">
                      <p className="text-xs text-muted-foreground uppercase tracking-wide">WhatsApp</p>
                      <p className="text-sm font-medium text-foreground break-all">
                        {patient.whatsapp_phone || "No registrado"}
                      </p>
                    </div>
                  </div>
                  {patient.birth_date && (
                    <div className="flex items-start gap-3">
                      <Calendar className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                      <div className="min-w-0">
                        <p className="text-xs text-muted-foreground uppercase tracking-wide">Nacimiento</p>
                        <p className="text-sm font-medium text-foreground">
                          {format(new Date(`${patient.birth_date}T00:00:00`), "d MMM yyyy", { locale: es })}
                          {computeAge(patient.birth_date) !== null && (
                            <span className="text-muted-foreground font-normal">
                              {" "}· {computeAge(patient.birth_date)} años
                            </span>
                          )}
                        </p>
                      </div>
                    </div>
                  )}
                  {patient.document_id && (
                    <div className="flex items-start gap-3">
                      <FileText className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                      <div className="min-w-0">
                        <p className="text-xs text-muted-foreground uppercase tracking-wide">Documento</p>
                        <p className="text-sm font-medium text-foreground break-all">{patient.document_id}</p>
                      </div>
                    </div>
                  )}
                </div>

                {patient.private_notes && (
                  <div className="rounded-xl bg-muted/40 border border-border/50 p-3">
                    <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1 inline-flex items-center gap-1">
                      <Lock className="h-3 w-3" /> Notas privadas
                    </p>
                    <p className="text-sm text-foreground whitespace-pre-line">{patient.private_notes}</p>
                  </div>
                )}

                <p className="text-xs text-muted-foreground pt-2 border-t border-border">
                  Paciente desde el {formatDate(patient.created_at)}
                </p>
              </CardContent>
            </Card>

            {/* ── Adulto responsable: solo si es menor de 18 ── */}
            {isMinor(patient.birth_date) && (
              <Card className="rounded-2xl border-amber-500/30 bg-amber-500/[0.04]">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base font-bold flex items-center gap-2.5">
                    <span className="h-8 w-8 rounded-lg bg-amber-500/15 flex items-center justify-center shrink-0">
                      <AlertTriangle className="h-4 w-4 text-amber-500" />
                    </span>
                    Adulto responsable
                  </CardTitle>
                  <p className="text-xs text-muted-foreground mt-1">
                    Paciente menor de edad — los recordatorios se envían al adulto responsable.
                  </p>
                </CardHeader>
                <CardContent>
                  {patient.guardian_name || patient.guardian_phone || patient.guardian_email ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {patient.guardian_name && (
                        <div className="min-w-0">
                          <p className="text-xs text-muted-foreground uppercase tracking-wide">Nombre</p>
                          <p className="text-sm font-medium text-foreground">
                            {patient.guardian_name}
                            {patient.guardian_relationship && (
                              <span className="text-muted-foreground font-normal"> · {patient.guardian_relationship}</span>
                            )}
                          </p>
                        </div>
                      )}
                      {patient.guardian_phone && (
                        <div className="min-w-0">
                          <p className="text-xs text-muted-foreground uppercase tracking-wide">Teléfono</p>
                          <button
                            onClick={() => openWhatsAppNumber(patient.guardian_phone)}
                            className="text-sm font-medium text-primary inline-flex items-center gap-1.5 hover:underline"
                          >
                            <MessageCircle className="h-3.5 w-3.5" />
                            {patient.guardian_phone}
                          </button>
                        </div>
                      )}
                      {patient.guardian_email && (
                        <div className="min-w-0">
                          <p className="text-xs text-muted-foreground uppercase tracking-wide">Email</p>
                          <p className="text-sm font-medium text-foreground break-all">{patient.guardian_email}</p>
                        </div>
                      )}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      Sin datos del adulto responsable — completalos desde "Editar".
                    </p>
                  )}
                </CardContent>
              </Card>
            )}

            {/* ── Contacto de emergencia: solo si hay algo cargado ── */}
            {(patient.emergency_contact_name || patient.emergency_contact_phone) && (
              <Card className="rounded-2xl border-border/50">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base font-bold flex items-center gap-2.5">
                    <span className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                      <Phone className="h-4 w-4 text-primary" />
                    </span>
                    Contacto de emergencia
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {patient.emergency_contact_name && (
                      <div className="min-w-0">
                        <p className="text-xs text-muted-foreground uppercase tracking-wide">Nombre</p>
                        <p className="text-sm font-medium text-foreground">
                          {patient.emergency_contact_name}
                          {patient.emergency_contact_relationship && (
                            <span className="text-muted-foreground font-normal"> · {patient.emergency_contact_relationship}</span>
                          )}
                        </p>
                      </div>
                    )}
                    {patient.emergency_contact_phone && (
                      <div className="min-w-0">
                        <p className="text-xs text-muted-foreground uppercase tracking-wide">Teléfono</p>
                        <button
                          onClick={() => openWhatsAppNumber(patient.emergency_contact_phone)}
                          className="text-sm font-medium text-primary inline-flex items-center gap-1.5 hover:underline"
                        >
                          <MessageCircle className="h-3.5 w-3.5" />
                          {patient.emergency_contact_phone}
                        </button>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* ── Tratamiento ── */}
            {(treatmentStatus || patient.reason_for_consultation || patient.first_consultation_date || patient.referred_by || patient.agreed_frequency) && (
              <Card className="rounded-2xl border-border/50">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <CardTitle className="text-base font-bold flex items-center gap-2.5">
                      <span className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                        <FileText className="h-4 w-4 text-primary" />
                      </span>
                      Tratamiento
                    </CardTitle>
                    {treatmentStatus && (
                      <Badge className={cn("rounded-full text-xs", TREATMENT_BADGE_CLASS[treatmentStatus])}>
                        {TREATMENT_STATUS_LABELS[treatmentStatus]}
                      </Badge>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {patient.reason_for_consultation && (
                    <div>
                      <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">
                        Motivo de consulta inicial
                      </p>
                      <p className="text-sm text-foreground whitespace-pre-line">{patient.reason_for_consultation}</p>
                    </div>
                  )}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {patient.first_consultation_date && (
                      <div className="min-w-0">
                        <p className="text-xs text-muted-foreground uppercase tracking-wide">Primera consulta</p>
                        <p className="text-sm font-medium text-foreground">
                          {format(new Date(`${patient.first_consultation_date}T00:00:00`), "d MMM yyyy", { locale: es })}
                        </p>
                      </div>
                    )}
                    {patient.agreed_frequency && (
                      <div className="min-w-0">
                        <p className="text-xs text-muted-foreground uppercase tracking-wide">Frecuencia acordada</p>
                        <p className="text-sm font-medium text-foreground">
                          {AGREED_FREQUENCY_LABELS[patient.agreed_frequency as AgreedFrequency] ?? patient.agreed_frequency}
                        </p>
                      </div>
                    )}
                    {patient.referred_by && (
                      <div className="min-w-0">
                        <p className="text-xs text-muted-foreground uppercase tracking-wide">Derivado por</p>
                        <p className="text-sm font-medium text-foreground">{patient.referred_by}</p>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* ── Administrativo: solo si hay algo cargado ── */}
            {(patient.health_insurance || patient.payment_type) && (
              <Card className="rounded-2xl border-border/50">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base font-bold flex items-center gap-2.5">
                    <span className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                      <CreditCard className="h-4 w-4 text-primary" />
                    </span>
                    Administrativo
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {patient.health_insurance && (
                      <div className="min-w-0">
                        <p className="text-xs text-muted-foreground uppercase tracking-wide">Mutualista u obra social</p>
                        <p className="text-sm font-medium text-foreground">{patient.health_insurance}</p>
                      </div>
                    )}
                    {patient.payment_type && (
                      <div className="min-w-0">
                        <p className="text-xs text-muted-foreground uppercase tracking-wide">Tipo de atención</p>
                        <p className="text-sm font-medium text-foreground">
                          {PAYMENT_TYPE_LABELS[patient.payment_type as PaymentType] ?? patient.payment_type}
                        </p>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}

            <Card className="rounded-2xl border-border/50">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between gap-2">
                  <CardTitle className="text-base font-bold flex items-center gap-2.5">
                    <span className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                      <Calendar className="h-4 w-4 text-primary" />
                    </span>
                    Próximas citas
                  </CardTitle>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowCreateAppointment(true)}
                    className="rounded-xl gap-1.5 h-8"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Agendar
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {upcomingAppointments.length === 0 ? (
                  <p className="text-muted-foreground text-sm text-center py-4">
                    Sin citas agendadas. Usá "Agendar" para crear la próxima.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {upcomingAppointments.map((a) => (
                      <AppointmentRow key={a.id} a={a} />
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Expediente: historia clínica organizada por sesión */}
          <TabsContent value="notes" className="mt-4">
            <PatientRecord
              patientId={patient.id}
              businessId={patient.business_id}
              reasonForConsultation={patient.reason_for_consultation}
            />
          </TabsContent>

          {/* Pagos */}
          <TabsContent value="payments" className="mt-4">
            <Card className="rounded-2xl border-border/50">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between gap-2">
                  <CardTitle className="text-base font-bold flex items-center gap-2.5">
                    <span className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                      <CreditCard className="h-4 w-4 text-primary" />
                    </span>
                    Pagos y vencimientos
                    {payments.length > 0 && (
                      <Badge variant="secondary" className="rounded-full ml-1">{payments.length}</Badge>
                    )}
                  </CardTitle>
                  {!paymentsError && (
                    <Button
                      onClick={() => setShowPaymentForm(true)}
                      size="sm"
                      className="rounded-xl gap-1.5 h-8"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      Registrar
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                {paymentsError ? (
                  <p className="text-muted-foreground text-sm text-center py-6">
                    Pagos no disponibles en este momento.
                  </p>
                ) : payments.length === 0 ? (
                  <p className="text-muted-foreground text-sm text-center py-6">
                    Sin pagos registrados.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {payments.map((payment) => (
                      // Mismo patrón que el módulo Pagos: en desktop las acciones
                      // van inline; en mobile, barra propia abajo — así nunca se
                      // desbordan de la tarjeta en pantallas chicas.
                      <div key={payment.id} className="p-3 rounded-xl border bg-card">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <p className="font-bold text-foreground">
                                {formatCurrency(payment.amount, payment.currency)}
                              </p>
                              <Badge className={`${getPaymentStatusColor(payment.status)} rounded-full text-xs`}>
                                {getPaymentStatusLabel(payment.status)}
                              </Badge>
                              {payment.recurrence_type !== "one_time" && (
                                <Badge variant="outline" className="rounded-full text-xs gap-1">
                                  <RefreshCw className="h-3 w-3" />
                                  {getRecurrenceTypeLabel(payment.recurrence_type)}
                                </Badge>
                              )}
                            </div>
                            <p className="text-xs text-muted-foreground mt-0.5">
                              {payment.paid_at
                                ? `Pagado el ${formatDate(payment.paid_at)}${payment.method ? ` · ${payment.method}` : ""}`
                                : `Vence: ${formatDate(payment.due_date)}${payment.method ? ` · ${payment.method}` : ""}`}
                            </p>
                          </div>

                          <div className="flex items-center gap-1 shrink-0">
                            {payment.status !== "paid" && payment.status !== "cancelled" && (
                              <div className="hidden sm:flex items-center gap-1">
                                <PaymentLinkMenu
                                  patientPhone={patient.whatsapp_phone}
                                  patientName={patient.full_name}
                                  getPaymentLink={mpConnected ? async () => {
                                    const url = await createPaymentLink(patient.business_id, [payment.id]);
                                    fetchData();
                                    return url;
                                  } : undefined}
                                />
                                <PaymentWhatsAppMenu
                                  patientPhone={patient.whatsapp_phone}
                                  patientName={patient.full_name}
                                  businessId={patient.business_id}
                                  amount={payment.amount}
                                  currency={payment.currency}
                                  getPaymentLink={mpConnected ? async () => {
                                    const url = await createPaymentLink(patient.business_id, [payment.id]);
                                    fetchData();
                                    return url;
                                  } : undefined}
                                />
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => setConfirmPaymentData(payment)}
                                  className="rounded-lg h-8 gap-1.5"
                                >
                                  <Check className="h-3.5 w-3.5" />
                                  Cobrar
                                </Button>
                              </div>
                            )}
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setEditingPayment(payment)}
                              className="rounded-lg h-8 px-2"
                              title="Editar pago"
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setDeletingPaymentId(payment.id)}
                              className="rounded-lg h-8 px-2 text-destructive hover:text-destructive"
                              title="Eliminar pago"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>

                        {/* Acciones mobile: cómodas, a lo ancho, sin apretujar */}
                        {payment.status !== "paid" && payment.status !== "cancelled" && (
                          <div className="flex sm:hidden items-center gap-2 mt-3 pt-3 border-t border-border/40">
                            <PaymentLinkMenu
                              patientPhone={patient.whatsapp_phone}
                              patientName={patient.full_name}
                              getPaymentLink={mpConnected ? async () => {
                                const url = await createPaymentLink(patient.business_id, [payment.id]);
                                fetchData();
                                return url;
                              } : undefined}
                            />
                            <PaymentWhatsAppMenu
                              patientPhone={patient.whatsapp_phone}
                              patientName={patient.full_name}
                              businessId={patient.business_id}
                              amount={payment.amount}
                              currency={payment.currency}
                              getPaymentLink={mpConnected ? async () => {
                                const url = await createPaymentLink(patient.business_id, [payment.id]);
                                fetchData();
                                return url;
                              } : undefined}
                            />
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setConfirmPaymentData(payment)}
                              className="rounded-lg h-8 gap-1.5 flex-1"
                            >
                              <Check className="h-3.5 w-3.5" />
                              Cobrar
                            </Button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Citas */}
          <TabsContent value="appointments" className="mt-4">
            <Card className="rounded-2xl border-border/50">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between gap-2">
                  <CardTitle className="text-base font-bold flex items-center gap-2.5">
                    <span className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                      <Calendar className="h-4 w-4 text-primary" />
                    </span>
                    Historial de citas
                    {appointments.length > 0 && (
                      <Badge variant="secondary" className="rounded-full ml-1">{appointments.length}</Badge>
                    )}
                  </CardTitle>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowCreateAppointment(true)}
                    className="rounded-xl gap-1.5 h-8"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Agendar
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {appointments.length === 0 ? (
                  <p className="text-muted-foreground text-sm text-center py-6">
                    Este paciente todavía no tiene citas registradas.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {appointments.map((a) => (
                      <AppointmentRow key={a.id} a={a} />
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Documentos */}
          <TabsContent value="docs" className="mt-4">
            <PatientDocuments patientId={patient.id} businessId={patient.business_id} />
          </TabsContent>
        </Tabs>
        </div>
        </div>
      </div>

      {/* Agendar cita (asistente con este paciente preseleccionado) */}
      <CreateAppointmentModal
        open={showCreateAppointment}
        onOpenChange={setShowCreateAppointment}
        patientId={patient.id}
        onSuccess={fetchData}
      />

      {/* Payment Form Modal - Create */}
      <PaymentForm
        open={showPaymentForm}
        onOpenChange={setShowPaymentForm}
        patientId={patient.id}
        businessId={patient.business_id}
        onSuccess={fetchData}
      />

      {/* Payment Form Modal - Edit */}
      {editingPayment && (
        <PaymentForm
          open={!!editingPayment}
          onOpenChange={(open) => !open && setEditingPayment(null)}
          patientId={patient.id}
          businessId={patient.business_id}
          paymentId={editingPayment.id}
          initialData={{
            amount: editingPayment.amount,
            due_date: editingPayment.due_date,
            method: editingPayment.method,
            notes: editingPayment.notes,
            recurrence_type: editingPayment.recurrence_type,
            anchor_day: editingPayment.anchor_day,
          }}
          onSuccess={() => {
            setEditingPayment(null);
            fetchData();
          }}
        />
      )}

      {/* Confirm "Cobrar" (evita cobros por toque accidental) */}
      {confirmPaymentData && (
        <ConfirmPaymentDialog
          open={!!confirmPaymentData}
          onOpenChange={(isOpen) => {
            if (!isOpen) setConfirmPaymentData(null);
          }}
          patientName={patient.full_name}
          amount={confirmPaymentData.amount}
          onConfirm={async () => {
            await handleMarkAsPaid(confirmPaymentData);
            setConfirmPaymentData(null);
          }}
        />
      )}

      {/* Delete Payment Confirmation */}
      <AlertDialog open={!!deletingPaymentId} onOpenChange={(open) => !open && setDeletingPaymentId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar pago?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción no se puede deshacer. El pago será eliminado permanentemente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-xl">Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeletePayment} className="rounded-xl bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Patient Invite Modal */}
      <PatientInviteModal
        open={showInviteModal}
        onOpenChange={setShowInviteModal}
        patientId={patient.id}
        patientName={patient.full_name}
        patientEmail={patient.email}
      />

      {/* Edit Patient Modal */}
      <PatientForm
        open={showEditPatient}
        onOpenChange={setShowEditPatient}
        patientId={patient.id}
        businessId={patient.business_id}
        initialData={{
          full_name: patient.full_name,
          email: patient.email || "",
          whatsapp_phone: patient.whatsapp_phone || "",
          birth_date: patient.birth_date || "",
          document_id: patient.document_id || "",
          emergency_contact_name: patient.emergency_contact_name || "",
          emergency_contact_relationship: patient.emergency_contact_relationship || "",
          emergency_contact_phone: patient.emergency_contact_phone || "",
          guardian_name: patient.guardian_name || "",
          guardian_relationship: patient.guardian_relationship || "",
          guardian_phone: patient.guardian_phone || "",
          guardian_email: patient.guardian_email || "",
          reason_for_consultation: patient.reason_for_consultation || "",
          first_consultation_date: patient.first_consultation_date || "",
          referred_by: patient.referred_by || "",
          treatment_status: treatmentStatus || "",
          agreed_frequency: patient.agreed_frequency || "",
          health_insurance: patient.health_insurance || "",
          payment_type: patient.payment_type || "",
          private_notes: patient.private_notes || "",
          is_active: patient.is_active,
          avatar_url: patient.avatar_url,
        }}
        onSuccess={() => {
          setShowEditPatient(false);
          fetchData();
        }}
      />

      {/* Delete Patient Confirmation */}
      <AlertDialog
        open={showDeletePatient}
        onOpenChange={(open) => {
          if (!deletingPatient) setShowDeletePatient(open);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar paciente?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción no se puede deshacer. Se eliminarán los datos del paciente
              de forma permanente. Las citas y pagos asociados podrían quedar huérfanos.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-xl" disabled={deletingPatient}>
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                handleDeletePatient();
              }}
              disabled={deletingPatient}
              className="rounded-xl bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deletingPatient ? "Eliminando..." : "Eliminar paciente"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default PatientDetail;
