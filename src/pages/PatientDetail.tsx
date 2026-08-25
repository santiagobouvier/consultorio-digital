import { useEffect, useMemo, useState, type ReactNode } from "react";
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
  Paperclip, Eye, EyeOff,
} from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { format, isAfter, isBefore, differenceInDays } from "date-fns";
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

// ── Piezas visuales del Resumen (bento premium) ──
// Tarjeta de sección con acento de color arriba e ícono tintado.
const SectionCard = ({
  accent,
  icon: Icon,
  title,
  badge,
  className,
  children,
}: {
  accent: string; // "H S% L%" o "var(--primary)"
  icon: typeof UserIcon;
  title: string;
  badge?: ReactNode;
  className?: string;
  children: ReactNode;
}) => (
  <Card className={cn("rounded-2xl border-border/50 overflow-hidden animate-in fade-in slide-in-from-bottom-2 duration-300", className)}>
    <div
      className="h-[3px] w-full"
      style={{ background: `linear-gradient(90deg, hsl(${accent}) 0%, hsl(${accent} / 0.25) 55%, transparent 90%)` }}
      aria-hidden
    />
    <CardContent className="p-4 sm:p-5">
      <div className="flex items-center justify-between gap-2 mb-4 flex-wrap">
        <p className="text-[14px] font-bold flex items-center gap-2.5">
          <span
            className="h-9 w-9 rounded-xl flex items-center justify-center shrink-0"
            style={{ background: `hsl(${accent} / 0.13)` }}
          >
            <Icon className="h-4 w-4" style={{ color: `hsl(${accent})` }} />
          </span>
          {title}
        </p>
        {badge}
      </div>
      {children}
    </CardContent>
  </Card>
);

// Dato con etiqueta chica y valor GRANDE (legible para cualquier vista).
const InfoRow = ({ label, value }: { label: string; value: ReactNode }) => (
  <div className="min-w-0">
    <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
    <div className="text-[15px] font-semibold text-foreground break-words leading-snug mt-1">{value}</div>
  </div>
);

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
  // Modo privado: enmascara los montos como "$ ••••" (para compartir pantalla)
  const [modoPrivado, setModoPrivado] = useState(false);
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

  // Chip de estado del hero: verde en tratamiento, ámbar pausa, azul alta
  const heroStatus = (() => {
    if (treatmentStatus === "en_pausa")
      return { label: "En pausa", bg: "rgba(251,191,36,0.13)", border: "rgba(251,191,36,0.3)", color: "#fcd34d" };
    if (treatmentStatus === "alta")
      return { label: "Alta", bg: "rgba(148,197,255,0.1)", border: "rgba(148,197,255,0.3)", color: "#a9ccf5" };
    if (treatmentStatus === "abandono")
      return { label: "Abandono", bg: "rgba(251,113,133,0.1)", border: "rgba(251,113,133,0.25)", color: "#fda4af" };
    if (treatmentStatus === "activo" || patient.is_active)
      return { label: treatmentStatus === "activo" ? "En tratamiento" : "Activo", bg: "rgba(52,211,153,0.13)", border: "rgba(52,211,153,0.3)", color: "#6ee7b7" };
    return { label: "Inactivo", bg: "rgba(140,200,170,0.08)", border: "rgba(140,200,170,0.14)", color: "#a9c4b7" };
  })();

  const money = (n: number) => (modoPrivado ? "$ ••••" : formatCurrency(n, "UYU"));
  const sessionsPct = Math.min(
    Math.round((pastSessions.length / Math.max(pastSessions.length + upcomingAppointments.length, 1)) * 100),
    100
  );
  const ghostBtn =
    "inline-flex items-center justify-center gap-2 rounded-[14px] border text-[14px] font-semibold transition-colors hover:bg-[rgba(140,200,170,0.15)] active:scale-[0.98] disabled:opacity-40 disabled:pointer-events-none";
  const ghostBtnStyle = {
    background: "rgba(140,200,170,0.08)",
    borderColor: "rgba(140,200,170,0.16)",
    color: "#c8dbd1",
  } as const;

  return (
    <div className="dark min-h-screen" style={{ background: "#070d0a", fontFamily: "'Instrument Sans', 'Plus Jakarta Sans', sans-serif" }}>
      <style>{`
        @keyframes fichaDrift {
          0%, 100% { transform: translate(0, 0) scale(1); }
          50% { transform: translate(40px, -30px) scale(1.15); }
        }
        @media (prefers-reduced-motion: reduce) {
          .ficha-glow { animation: none !important; }
        }
      `}</style>

      <div className="mx-auto w-full max-w-[1500px] flex flex-col gap-[18px]" style={{ padding: "clamp(14px, 2.2vw, 28px)" }}>

        {/* ── Top bar: volver + breadcrumb + acciones ── */}
        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={() => navigate("/patients")}
            className="flex h-[38px] w-[38px] items-center justify-center rounded-xl border transition-colors hover:bg-[rgba(140,200,170,0.14)]"
            style={{ background: "rgba(140,200,170,0.07)", borderColor: "rgba(140,200,170,0.12)", color: "#a9c4b7" }}
            aria-label="Volver a pacientes"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <p className="text-[13px] min-w-0 truncate" style={{ color: "#5f7a6d" }}>
            Pacientes <span className="mx-1 opacity-60">/</span>
            <span style={{ color: "#a9c4b7" }}>{patient.full_name}</span>
          </p>
          <div className="ml-auto flex items-center gap-2">
            <button
              onClick={() => setModoPrivado((v) => !v)}
              className="flex h-[38px] w-[38px] items-center justify-center rounded-xl border transition-colors hover:bg-[rgba(140,200,170,0.14)]"
              style={{
                background: modoPrivado ? "rgba(52,211,153,0.13)" : "rgba(140,200,170,0.07)",
                borderColor: modoPrivado ? "rgba(52,211,153,0.3)" : "rgba(140,200,170,0.12)",
                color: modoPrivado ? "#6ee7b7" : "#a9c4b7",
              }}
              aria-label={modoPrivado ? "Mostrar montos" : "Ocultar montos (modo privado)"}
              title={modoPrivado ? "Mostrar montos" : "Modo privado: oculta los montos"}
            >
              {modoPrivado ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
            <button
              onClick={() => setShowEditPatient(true)}
              className="flex h-[38px] items-center gap-2 rounded-xl border px-3.5 text-[13px] font-semibold transition-colors hover:bg-[rgba(140,200,170,0.14)]"
              style={{ background: "rgba(140,200,170,0.07)", borderColor: "rgba(140,200,170,0.12)", color: "#c8dbd1" }}
            >
              <Pencil className="h-3.5 w-3.5" />
              Editar
            </button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  className="flex h-[38px] w-[38px] items-center justify-center rounded-xl border transition-colors hover:bg-[rgba(140,200,170,0.14)]"
                  style={{ background: "rgba(140,200,170,0.07)", borderColor: "rgba(140,200,170,0.12)", color: "#a9c4b7" }}
                  aria-label="Más acciones"
                >
                  <MoreHorizontal className="h-4 w-4" />
                </button>
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
        </div>

        {/* ── Hero card ── */}
        <div
          className="relative overflow-hidden"
          style={{
            borderRadius: 26,
            border: "1px solid rgba(140,200,170,0.14)",
            background: "linear-gradient(160deg, #0e1d15, #0a1410 55%, #081009)",
          }}
        >
          <div
            className="ficha-glow pointer-events-none absolute -top-24 -left-12 h-72 w-72 rounded-full"
            style={{
              background: "radial-gradient(circle, rgba(52,211,153,0.22), transparent 70%)",
              filter: "blur(10px)",
              animation: "fichaDrift 14s ease-in-out infinite",
            }}
            aria-hidden
          />
          <div
            className="ficha-glow pointer-events-none absolute -bottom-28 -right-16 h-80 w-80 rounded-full"
            style={{
              background: "radial-gradient(circle, rgba(20,184,166,0.14), transparent 70%)",
              filter: "blur(10px)",
              animation: "fichaDrift 18s ease-in-out infinite reverse",
            }}
            aria-hidden
          />

          <div className="relative flex flex-wrap items-center" style={{ gap: "clamp(20px, 3vw, 36px)", padding: "clamp(22px, 4vw, 40px)" }}>
            {/* Avatar con anillo gradiente + dot de presencia */}
            <div className="relative shrink-0">
              <div
                className="rounded-full"
                style={{ padding: 3, background: "linear-gradient(135deg, #34d399, #14b8a6 60%, transparent)" }}
              >
                <Avatar className="h-[106px] w-[106px] rounded-full" style={{ border: "3px solid #0a1410" }}>
                  {patient.avatar_url && (
                    <AvatarImage src={patient.avatar_url} alt={patient.full_name} className="object-cover" />
                  )}
                  <AvatarFallback
                    className="rounded-full text-3xl font-bold"
                    style={{ background: "rgba(52,211,153,0.13)", color: "#6ee7b7", fontFamily: "'Space Grotesk', sans-serif" }}
                  >
                    {initials || <UserIcon className="h-8 w-8" />}
                  </AvatarFallback>
                </Avatar>
              </div>
              <span
                className="absolute bottom-1 right-1 h-[18px] w-[18px] rounded-full"
                style={{ background: patient.is_active ? "#34d399" : "#5f7a6d", border: "3px solid #0a1410" }}
                aria-hidden
              />
            </div>

            {/* Identidad */}
            <div className="min-w-0" style={{ flex: "1 1 260px" }}>
              <p
                className="uppercase"
                style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 600, fontSize: 11, letterSpacing: "0.22em", color: "#34d399" }}
              >
                Paciente · Ficha clínica
              </p>
              <h1
                className="mt-1.5 break-words"
                style={{
                  fontFamily: "'Space Grotesk', sans-serif",
                  fontWeight: 700,
                  fontSize: "clamp(30px, 5vw, 46px)",
                  lineHeight: 1.05,
                  letterSpacing: "-0.02em",
                  color: "#eaf3ee",
                }}
              >
                {patient.full_name}
              </h1>

              {/* Chips */}
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <span
                  className="inline-flex items-center gap-1.5 rounded-full px-3 py-[5px] text-[12px] font-semibold border"
                  style={{ background: heroStatus.bg, borderColor: heroStatus.border, color: heroStatus.color }}
                >
                  <span className="h-1.5 w-1.5 rounded-full" style={{ background: "currentColor" }} />
                  {heroStatus.label}
                </span>
                {!paymentsError && debt > 0 && (
                  <span
                    className="inline-flex items-center gap-1.5 rounded-full px-3 py-[5px] text-[12px] font-semibold border"
                    style={{ background: "rgba(251,113,133,0.1)", borderColor: "rgba(251,113,133,0.25)", color: "#fda4af" }}
                  >
                    <AlertTriangle className="h-3 w-3" />
                    Debe {money(debt)}
                  </span>
                )}
                {computeAge(patient.birth_date) !== null && (
                  <span
                    className="inline-flex items-center rounded-full px-3 py-[5px] text-[12px] font-semibold border"
                    style={{ background: "rgba(140,200,170,0.08)", borderColor: "rgba(140,200,170,0.14)", color: "#a9c4b7" }}
                  >
                    {computeAge(patient.birth_date)} años
                  </span>
                )}
                {isMinor(patient.birth_date) && (
                  <span
                    className="inline-flex items-center rounded-full px-3 py-[5px] text-[12px] font-semibold border"
                    style={{ background: "rgba(251,191,36,0.13)", borderColor: "rgba(251,191,36,0.3)", color: "#fcd34d" }}
                  >
                    Menor de edad
                  </span>
                )}
                {hasPortal && (
                  <span
                    className="inline-flex items-center gap-1 rounded-full px-3 py-[5px] text-[12px] font-semibold border"
                    style={{ background: "rgba(140,200,170,0.08)", borderColor: "rgba(140,200,170,0.14)", color: "#a9c4b7" }}
                  >
                    <Check className="h-3 w-3" />
                    Portal activo
                  </span>
                )}
              </div>

              {/* Meta */}
              <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[13px]" style={{ color: "#7e988b" }}>
                {patient.email && (
                  <span className="inline-flex items-center gap-1.5 min-w-0">
                    <Mail className="h-[13px] w-[13px] shrink-0" />
                    <span className="truncate">{patient.email}</span>
                  </span>
                )}
                {patient.whatsapp_phone && (
                  <button onClick={openWhatsApp} className="inline-flex items-center gap-1.5 hover:underline" style={{ color: "#7e988b" }}>
                    <Phone className="h-[13px] w-[13px]" />
                    {patient.whatsapp_phone}
                  </button>
                )}
                <span className="inline-flex items-center gap-1.5">
                  <Calendar className="h-[13px] w-[13px]" />
                  Paciente desde {format(new Date(patient.created_at), "MMMM yyyy", { locale: es })}
                </span>
              </div>
            </div>

            {/* Acciones */}
            <div className="grid w-full grid-cols-2 gap-[9px] sm:max-w-[340px]" style={{ flex: "1 1 220px" }}>
              <button
                onClick={() => setShowCreateAppointment(true)}
                className="col-span-2 inline-flex items-center justify-center gap-2 transition hover:brightness-110 active:scale-[0.98]"
                style={{
                  background: "linear-gradient(135deg, #34d399, #14b8a6)",
                  color: "#04150d",
                  borderRadius: 14,
                  padding: "13px 18px",
                  fontWeight: 600,
                  fontSize: 14,
                  boxShadow: "0 8px 24px rgba(52,211,153,0.25)",
                }}
              >
                <CalendarPlus className="h-4 w-4" />
                Agendar cita
              </button>
              <button
                onClick={openWhatsApp}
                disabled={!patient.whatsapp_phone}
                className={ghostBtn}
                style={{ ...ghostBtnStyle, padding: "12px 14px" }}
              >
                <MessageCircle className="h-4 w-4" />
                WhatsApp
              </button>
              {!hasPortal ? (
                <button
                  onClick={() => setShowInviteModal(true)}
                  className={ghostBtn}
                  style={{ ...ghostBtnStyle, padding: "12px 14px" }}
                >
                  <UserPlus className="h-4 w-4" />
                  Invitar al portal
                </button>
              ) : (
                <button
                  onClick={() => setShowEditPatient(true)}
                  className={ghostBtn}
                  style={{ ...ghostBtnStyle, padding: "12px 14px" }}
                >
                  <Pencil className="h-4 w-4" />
                  Editar
                </button>
              )}
            </div>
          </div>
        </div>

        {/* ── Stats strip ── */}
        <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(165px, 1fr))" }}>
          {/* Próxima cita */}
          <div
            style={{ borderRadius: 18, padding: "18px 20px", background: "linear-gradient(180deg, #101a14, #0b130e)", border: "1px solid rgba(140,200,170,0.1)" }}
          >
            <p className="uppercase" style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 600, fontSize: 10.5, letterSpacing: "0.14em", color: "#5f7a6d" }}>
              Próxima cita
            </p>
            {nextAppointment ? (
              <p className="mt-2 capitalize" style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 600, fontSize: 19, color: "#eaf3ee" }}>
                {format(new Date(nextAppointment.start_at), "EEE d MMM · HH:mm", { locale: es })}
              </p>
            ) : (
              <>
                <p className="mt-2" style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 600, fontSize: 19, color: "#eaf3ee" }}>
                  Sin agendar
                </p>
                <p className="mt-1 text-[12px]" style={{ color: "#f0a9b2" }}>Requiere acción</p>
              </>
            )}
          </div>

          {/* Sesiones */}
          <div
            style={{ borderRadius: 18, padding: "18px 20px", background: "linear-gradient(180deg, #101a14, #0b130e)", border: "1px solid rgba(140,200,170,0.1)" }}
          >
            <p className="uppercase" style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 600, fontSize: 10.5, letterSpacing: "0.14em", color: "#5f7a6d" }}>
              Sesiones
            </p>
            <p className="mt-2" style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 600, fontSize: 19, color: "#eaf3ee" }}>
              {pastSessions.length} realizada{pastSessions.length !== 1 ? "s" : ""}
            </p>
            <div className="mt-2.5 h-1 w-full rounded-full overflow-hidden" style={{ background: "rgba(140,200,170,0.12)" }}>
              <div
                className="h-full rounded-full transition-all duration-700"
                style={{ width: `${sessionsPct}%`, background: "linear-gradient(90deg, #34d399, #14b8a6)" }}
              />
            </div>
          </div>

          {/* Pendiente de pago (variante warning) */}
          <div
            style={{
              borderRadius: 18,
              padding: "18px 20px",
              background: debt > 0 ? "linear-gradient(180deg, #1a1410, #130e0b)" : "linear-gradient(180deg, #101a14, #0b130e)",
              border: debt > 0 ? "1px solid rgba(251,191,36,0.18)" : "1px solid rgba(140,200,170,0.1)",
            }}
          >
            <p className="uppercase" style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 600, fontSize: 10.5, letterSpacing: "0.14em", color: debt > 0 ? "#a08657" : "#5f7a6d" }}>
              Pendiente de pago
            </p>
            <p className="mt-2" style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: 26, color: paymentsError ? "#7e988b" : debt > 0 ? "#fcd34d" : "#6ee7b7" }}>
              {paymentsError ? "—" : debt > 0 ? money(debt) : "$ 0"}
            </p>
            {!paymentsError && (
              <p className="mt-0.5 text-[12px]" style={{ color: hasOverdue ? "#f0a9b2" : "#7e988b" }}>
                {hasOverdue ? "Tiene vencidos" : debt > 0 ? "Por cobrar" : "Al día"}
              </p>
            )}
          </div>

          {/* Última sesión */}
          <div
            style={{ borderRadius: 18, padding: "18px 20px", background: "linear-gradient(180deg, #101a14, #0b130e)", border: "1px solid rgba(140,200,170,0.1)" }}
          >
            <p className="uppercase" style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 600, fontSize: 10.5, letterSpacing: "0.14em", color: "#5f7a6d" }}>
              Última sesión
            </p>
            <p className="mt-2" style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 600, fontSize: 19, color: "#eaf3ee" }}>
              {lastSession ? formatDate(lastSession.start_at) : "—"}
            </p>
            {lastSession && (
              <p className="mt-1 text-[12px]" style={{ color: "#7e988b" }}>
                hace {differenceInDays(new Date(), new Date(lastSession.start_at))} días
                {patient.agreed_frequency && AGREED_FREQUENCY_LABELS[patient.agreed_frequency as AgreedFrequency]
                  ? ` · ${AGREED_FREQUENCY_LABELS[patient.agreed_frequency as AgreedFrequency].toLowerCase()}`
                  : ""}
              </p>
            )}
          </div>
        </div>
        <Tabs defaultValue="resumen" className="w-full">
          {/* Pestañas píldora (handoff): scrollables en móvil, activa clara */}
          <TabsList
            className="flex w-full h-auto justify-start gap-1.5 rounded-2xl p-[5px] overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
            style={{ background: "rgba(140,200,170,0.05)", border: "1px solid rgba(140,200,170,0.1)" }}
          >
            <TabsTrigger value="resumen" className="shrink-0 rounded-xl px-5 py-2.5 text-[13.5px] font-medium text-[#7e988b] gap-1.5 data-[state=active]:bg-[#eaf3ee] data-[state=active]:text-[#0a120e] data-[state=active]:font-semibold data-[state=active]:shadow-none">
              <UserIcon className="h-4 w-4 shrink-0 hidden sm:block" />
              Resumen
            </TabsTrigger>
            <TabsTrigger value="notes" className="shrink-0 rounded-xl px-5 py-2.5 text-[13.5px] font-medium text-[#7e988b] gap-1.5 data-[state=active]:bg-[#eaf3ee] data-[state=active]:text-[#0a120e] data-[state=active]:font-semibold data-[state=active]:shadow-none">
              <FileText className="h-4 w-4 shrink-0 hidden sm:block" />
              Expediente
            </TabsTrigger>
            <TabsTrigger value="payments" className="shrink-0 rounded-xl px-5 py-2.5 text-[13.5px] font-medium text-[#7e988b] gap-1.5 data-[state=active]:bg-[#eaf3ee] data-[state=active]:text-[#0a120e] data-[state=active]:font-semibold data-[state=active]:shadow-none">
              <CreditCard className="h-4 w-4 shrink-0 hidden sm:block" />
              Pagos
              {unpaid.length > 0 && (
                <span className="h-1.5 w-1.5 rounded-full shrink-0 animate-pulse" style={{ background: "#fb7185" }} />
              )}
            </TabsTrigger>
            <TabsTrigger value="appointments" className="shrink-0 rounded-xl px-5 py-2.5 text-[13.5px] font-medium text-[#7e988b] gap-1.5 data-[state=active]:bg-[#eaf3ee] data-[state=active]:text-[#0a120e] data-[state=active]:font-semibold data-[state=active]:shadow-none">
              <Calendar className="h-4 w-4 shrink-0 hidden sm:block" />
              Citas
            </TabsTrigger>
            <TabsTrigger value="docs" className="shrink-0 rounded-xl px-5 py-2.5 text-[13.5px] font-medium text-[#7e988b] gap-1.5 data-[state=active]:bg-[#eaf3ee] data-[state=active]:text-[#0a120e] data-[state=active]:font-semibold data-[state=active]:shadow-none">
              <Paperclip className="h-4 w-4 shrink-0 hidden sm:block" />
              Docs
            </TabsTrigger>
          </TabsList>

          {/* Resumen: bento premium — la historia del paciente de un vistazo,
              con acento de color por sección y valores grandes y legibles. */}
          <TabsContent value="resumen" className="mt-4">
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 items-start">

              {/* ── Tratamiento: la tarjeta protagonista, a lo ancho ── */}
              {(treatmentStatus || patient.reason_for_consultation || patient.first_consultation_date || patient.referred_by || patient.agreed_frequency) && (
                <SectionCard
                  accent="var(--primary)"
                  icon={FileText}
                  title="Tratamiento"
                  className="xl:col-span-2"
                  badge={treatmentStatus ? (
                    <Badge className={cn("rounded-full text-xs", TREATMENT_BADGE_CLASS[treatmentStatus])}>
                      {TREATMENT_STATUS_LABELS[treatmentStatus]}
                    </Badge>
                  ) : undefined}
                >
                  <div className="space-y-4">
                    {patient.reason_for_consultation && (
                      <div className="rounded-xl bg-primary/[0.05] border border-primary/15 p-3.5">
                        <p className="text-[11px] font-semibold uppercase tracking-wider text-primary mb-1">
                          Motivo de consulta inicial
                        </p>
                        <p className="text-[15px] text-foreground whitespace-pre-line leading-relaxed">
                          {patient.reason_for_consultation}
                        </p>
                      </div>
                    )}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      {patient.first_consultation_date && (
                        <InfoRow
                          label="Primera consulta"
                          value={format(new Date(`${patient.first_consultation_date}T00:00:00`), "d MMM yyyy", { locale: es })}
                        />
                      )}
                      {patient.agreed_frequency && (
                        <InfoRow
                          label="Frecuencia acordada"
                          value={AGREED_FREQUENCY_LABELS[patient.agreed_frequency as AgreedFrequency] ?? patient.agreed_frequency}
                        />
                      )}
                      {patient.referred_by && <InfoRow label="Derivado por" value={patient.referred_by} />}
                    </div>
                  </div>
                </SectionCard>
              )}

              {/* ── Datos personales ── */}
              <SectionCard accent="210 90% 60%" icon={UserIcon} title="Datos personales">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <InfoRow
                    label="Email"
                    value={patient.email || <span className="text-muted-foreground font-normal">No registrado</span>}
                  />
                  <InfoRow
                    label="WhatsApp"
                    value={patient.whatsapp_phone || <span className="text-muted-foreground font-normal">No registrado</span>}
                  />
                  {patient.birth_date && (
                    <InfoRow
                      label="Nacimiento"
                      value={
                        <>
                          {format(new Date(`${patient.birth_date}T00:00:00`), "d MMM yyyy", { locale: es })}
                          {computeAge(patient.birth_date) !== null && (
                            <span className="text-muted-foreground font-normal"> · {computeAge(patient.birth_date)} años</span>
                          )}
                        </>
                      }
                    />
                  )}
                  {patient.document_id && <InfoRow label="Documento" value={patient.document_id} />}
                </div>
                {patient.private_notes && (
                  <div className="rounded-xl bg-muted/40 border border-border/50 p-3.5 mt-4">
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-1 inline-flex items-center gap-1">
                      <Lock className="h-3 w-3" /> Notas privadas
                    </p>
                    <p className="text-[14px] text-foreground whitespace-pre-line leading-relaxed">{patient.private_notes}</p>
                  </div>
                )}
                <p className="text-xs text-muted-foreground pt-3 mt-4 border-t border-border/60">
                  Paciente desde el {formatDate(patient.created_at)}
                </p>
              </SectionCard>

              {/* ── Columna: responsable / emergencia / administrativo ── */}
              <div className="space-y-4">
                {isMinor(patient.birth_date) && (
                  <SectionCard
                    accent="38 92% 55%"
                    icon={AlertTriangle}
                    title="Adulto responsable"
                    badge={
                      <Badge variant="outline" className="rounded-full text-[11px] text-amber-600 dark:text-amber-400 border-amber-500/40">
                        Menor de edad
                      </Badge>
                    }
                  >
                    {patient.guardian_name || patient.guardian_phone || patient.guardian_email ? (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {patient.guardian_name && (
                          <InfoRow
                            label="Nombre"
                            value={
                              <>
                                {patient.guardian_name}
                                {patient.guardian_relationship && (
                                  <span className="text-muted-foreground font-normal"> · {patient.guardian_relationship}</span>
                                )}
                              </>
                            }
                          />
                        )}
                        {patient.guardian_phone && (
                          <InfoRow
                            label="Teléfono"
                            value={
                              <button
                                onClick={() => openWhatsAppNumber(patient.guardian_phone)}
                                className="text-primary inline-flex items-center gap-1.5 hover:underline"
                              >
                                <MessageCircle className="h-4 w-4" />
                                {patient.guardian_phone}
                              </button>
                            }
                          />
                        )}
                        {patient.guardian_email && <InfoRow label="Email" value={patient.guardian_email} />}
                      </div>
                    ) : (
                      <p className="text-[14px] text-muted-foreground">
                        Sin datos del adulto responsable — completalos desde "Editar".
                      </p>
                    )}
                    <p className="text-xs text-muted-foreground mt-3">
                      Los recordatorios se envían al adulto responsable.
                    </p>
                  </SectionCard>
                )}

                {(patient.emergency_contact_name || patient.emergency_contact_phone) && (
                  <SectionCard accent="0 72% 60%" icon={Phone} title="Contacto de emergencia">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {patient.emergency_contact_name && (
                        <InfoRow
                          label="Nombre"
                          value={
                            <>
                              {patient.emergency_contact_name}
                              {patient.emergency_contact_relationship && (
                                <span className="text-muted-foreground font-normal"> · {patient.emergency_contact_relationship}</span>
                              )}
                            </>
                          }
                        />
                      )}
                      {patient.emergency_contact_phone && (
                        <InfoRow
                          label="Teléfono"
                          value={
                            <button
                              onClick={() => openWhatsAppNumber(patient.emergency_contact_phone)}
                              className="text-primary inline-flex items-center gap-1.5 hover:underline"
                            >
                              <MessageCircle className="h-4 w-4" />
                              {patient.emergency_contact_phone}
                            </button>
                          }
                        />
                      )}
                    </div>
                  </SectionCard>
                )}

                {(patient.health_insurance || patient.payment_type) && (
                  <SectionCard accent="262 80% 66%" icon={CreditCard} title="Administrativo">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {patient.health_insurance && (
                        <InfoRow label="Mutualista u obra social" value={patient.health_insurance} />
                      )}
                      {patient.payment_type && (
                        <InfoRow
                          label="Tipo de atención"
                          value={PAYMENT_TYPE_LABELS[patient.payment_type as PaymentType] ?? patient.payment_type}
                        />
                      )}
                    </div>
                  </SectionCard>
                )}
              </div>

              {/* ── Próximas citas: a lo ancho ── */}
              <SectionCard
                accent="190 85% 50%"
                icon={Calendar}
                title="Próximas citas"
                className="xl:col-span-2"
                badge={
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowCreateAppointment(true)}
                    className="rounded-xl gap-1.5 h-9"
                  >
                    <Plus className="h-4 w-4" />
                    Agendar
                  </Button>
                }
              >
                {upcomingAppointments.length === 0 ? (
                  <p className="text-muted-foreground text-[14px] text-center py-4">
                    Sin citas agendadas. Usá "Agendar" para crear la próxima.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {upcomingAppointments.map((a) => (
                      <AppointmentRow key={a.id} a={a} />
                    ))}
                  </div>
                )}
              </SectionCard>
            </div>
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
