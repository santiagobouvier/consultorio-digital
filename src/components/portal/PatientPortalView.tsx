import { useEffect, useMemo, useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
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
import { PWAInstallBanner } from "@/components/PWAInstallBanner";
import { PortalDocuments } from "@/components/portal/PortalDocuments";
import { InstallAppButton } from "@/components/pwa/InstallAppButton";
import { NotificationActivationCard } from "@/components/NotificationActivationCard";
import { NotificationBell } from "@/components/portal/NotificationBell";
import { NotificationsSummaryCard } from "@/components/portal/NotificationsSummaryCard";
import { format, parseISO, isToday, isTomorrow, differenceInCalendarDays } from "date-fns";
import { es } from "date-fns/locale";
import {
  User, Calendar, CreditCard, Clock, MapPin, Video,
  Phone, Mail, Building2, FileText, FolderOpen,
  LayoutDashboard, Heart, TrendingUp, CalendarCheck,
  ChevronRight, CheckCircle2, AlertCircle, Sun, Moon,
  Download, Smartphone, Camera, Save, Edit2, X, LogOut, Plus,
  Loader2, Star, ArrowLeft, RefreshCw, XCircle,
} from "lucide-react";
import { useSharedDocuments, openSharedDocument } from "@/components/portal/use-shared-documents";
import { resolveDocType } from "@/lib/document-types";
import { formatCurrency } from "@/lib/payments";
import { downloadReceiptPdf, buildReceiptNumber } from "@/lib/receipt-pdf";
import { toast as sonnerToast } from "sonner";

// =============================================
// TYPES
// =============================================

export interface PortalBranding {
  name: string;
  specialty: string;
  contactEmail: string;
  logoUrl: string;
  lightColor: string; // HSL string e.g. "176 100% 32%"
  darkColor: string;
  cancellationHoursNotice?: number;
  lateCancellationMessage?: string | null;
}

export interface PortalPatient {
  id: string;
  full_name: string;
  email: string | null;
  whatsapp_phone: string | null;
  avatar_url: string | null;
  reason_for_consultation: string | null;
  private_notes: string | null;
  created_at: string; // ISO
}

export interface PortalAppointment {
  id: string;
  start_at: string; // ISO
  end_at: string;   // ISO
  status: string;
  modality: string | null;
  location: string | null;
  notes: string | null;
  service_name: string | null;
  payment_status?: string | null;
}

export interface PortalPayment {
  id: string;
  amount: number;
  currency: string;
  due_date: string; // ISO
  status: string;
  paid_at: string | null;
  recurrence_label: string;
  notes: string | null;
  appointment_id?: string | null;
  method?: string | null;
}

export interface ProfileEditData {
  full_name: string;
  email: string;
  whatsapp_phone: string;
  reason_for_consultation: string;
}

export type HeaderActionVariant = "logout" | "back" | "none";

export interface PatientPortalViewProps {
  branding: PortalBranding;
  patient: PortalPatient;
  upcomingAppointments: PortalAppointment[];
  pastAppointments: PortalAppointment[];
  payments: PortalPayment[];
  isDark: boolean;
  onToggleDark: () => void;
  isDemo?: boolean;
  // PWA install
  canInstall?: boolean;
  isInstalled?: boolean;
  onInstallApp?: () => void;
  showPwaBannerTop?: boolean;
  // Header right action
  headerAction?: HeaderActionVariant;
  onLogout?: () => void;
  onBack?: () => void;
  /** Texto del botón "volver" del header (por defecto "Volver"). */
  backLabel?: string;
  // Booking
  onBookAppointment?: () => void;
  /** Patient cancels their own appointment. */
  onCancelAppointment?: (appointmentId: string, reason: string) => Promise<void> | void;
  /** Patient opens reschedule flow for a given appointment. */
  onRescheduleAppointment?: (appointment: PortalAppointment) => void;
  // Profile
  onSaveProfile?: (data: ProfileEditData, avatarFile: File | null) => Promise<void> | void;
  // Pay
  onPaySession?: (appointmentId: string) => Promise<void> | void;
  payingAppointmentId?: string | null;
  /** Pay one or more payment rows in a single MP preference. */
  onPayPayments?: (paymentIds: string[]) => Promise<void> | void;
  /** IDs currently being processed. */
  payingPaymentIds?: string[];
  /** Whether the clinic has Mercado Pago connected. Controls visibility of "pay online" buttons. */
  mpConnected?: boolean;
  /** When set, switch to the "pagos" tab and scroll to the overdue section. The wrapper resets it. */
  focusOverdueTick?: number;
  // Extras rendered by wrapper (e.g. PatientBookingModal)
  extras?: React.ReactNode;
}

// =============================================
// THEME GENERATOR
// =============================================
const generateThemeVars = (primaryColor: string, isDark: boolean) => {
  const vars: Record<string, string> = {};
  if (isDark) {
    vars["--background"] = "220 15% 8%";
    vars["--foreground"] = "220 10% 98%";
    vars["--card"] = "220 12% 11%";
    vars["--card-foreground"] = "220 10% 98%";
    vars["--popover"] = "220 12% 11%";
    vars["--popover-foreground"] = "220 10% 98%";
    vars["--primary"] = primaryColor;
    vars["--primary-foreground"] = "0 0% 100%";
    vars["--secondary"] = "220 12% 16%";
    vars["--secondary-foreground"] = "220 10% 98%";
    vars["--muted"] = "220 12% 16%";
    vars["--muted-foreground"] = "220 8% 65%";
    vars["--accent"] = "220 15% 18%";
    vars["--accent-foreground"] = "220 10% 90%";
    vars["--destructive"] = "0 70% 50%";
    vars["--destructive-foreground"] = "0 0% 100%";
    vars["--border"] = "220 12% 18%";
    vars["--input"] = "220 12% 18%";
    vars["--ring"] = primaryColor;
  } else {
    vars["--background"] = "220 15% 98%";
    vars["--foreground"] = "220 10% 15%";
    vars["--card"] = "0 0% 100%";
    vars["--card-foreground"] = "220 10% 15%";
    vars["--popover"] = "0 0% 100%";
    vars["--popover-foreground"] = "220 10% 15%";
    vars["--primary"] = primaryColor;
    vars["--primary-foreground"] = "0 0% 100%";
    vars["--secondary"] = "220 25% 96%";
    vars["--secondary-foreground"] = "220 10% 25%";
    vars["--muted"] = "220 15% 96%";
    vars["--muted-foreground"] = "220 8% 46%";
    vars["--accent"] = "220 30% 94%";
    vars["--accent-foreground"] = "220 10% 25%";
    vars["--destructive"] = "0 84% 60%";
    vars["--destructive-foreground"] = "0 0% 100%";
    vars["--border"] = "220 10% 90%";
    vars["--input"] = "220 10% 90%";
    vars["--ring"] = primaryColor;
  }
  return vars;
};

const TABS = [
  { id: "resumen", label: "Resumen", icon: LayoutDashboard },
  { id: "citas", label: "Citas", icon: Calendar },
  { id: "historial", label: "Historial", icon: FileText },
  { id: "documentos", label: "Docs", icon: FolderOpen },
  { id: "pagos", label: "Pagos", icon: CreditCard },
  { id: "perfil", label: "Perfil", icon: User },
] as const;
type TabId = (typeof TABS)[number]["id"];

const formatDateLong = (d: Date) =>
  d.toLocaleDateString("es-UY", { weekday: "long", day: "numeric", month: "long" });
const formatShort = (d: Date) =>
  d.toLocaleDateString("es-UY", { day: "numeric", month: "long", year: "numeric" });

const statusBadge = (status: string) => {
  const map: Record<string, { variant: "default" | "secondary" | "destructive" | "outline"; label: string }> = {
    pending: { variant: "secondary", label: "Pendiente" },
    pending_payment: { variant: "secondary", label: "Pago pendiente" },
    confirmed: { variant: "default", label: "Confirmada" },
    scheduled: { variant: "default", label: "Confirmada" },
    completed: { variant: "outline", label: "Completada" },
    cancelled: { variant: "destructive", label: "Cancelada" },
    cancelled_by_patient: { variant: "destructive", label: "Cancelada" },
    reschedule_requested: { variant: "outline", label: "Reprogramación pedida" },
    no_show: { variant: "destructive", label: "Ausente" },
  };
  const c = map[status] || { variant: "secondary" as const, label: status };
  return <Badge variant={c.variant}>{c.label}</Badge>;
};

const payBadge = (status: string) => {
  if (status === "paid") return <Badge className="bg-primary/90 text-primary-foreground hover:bg-primary/90">Pagado</Badge>;
  if (status === "overdue") return <Badge variant="destructive">Vencido</Badge>;
  if (status === "due_soon") return <Badge className="bg-orange-500 text-white hover:bg-orange-500">Por vencer</Badge>;
  if (status === "cancelled") return <Badge variant="outline">Cancelado</Badge>;
  return <Badge className="bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30 hover:bg-amber-500/20">Pendiente</Badge>;
};

// =============================================
// MAIN VIEW COMPONENT
// =============================================
export function PatientPortalView(props: PatientPortalViewProps) {
  const {
    branding, patient, upcomingAppointments, pastAppointments, payments,
    isDark, onToggleDark, isDemo = false,
    canInstall = false, isInstalled = false, onInstallApp,
    showPwaBannerTop = false,
    headerAction = "none", onLogout, onBack, backLabel = "Volver",
    onBookAppointment, onCancelAppointment, onRescheduleAppointment,
    onSaveProfile, onPaySession,
    payingAppointmentId = null,
    onPayPayments, payingPaymentIds = [], mpConnected = false, focusOverdueTick = 0,
    extras,
  } = props;

  const [tab, setTab] = useState<TabId>("resumen");
  const overdueSectionRef = useRef<HTMLDivElement>(null);

  // Documentos compartidos: un solo fetch alimenta la pestaña "Docs" y los
  // adjuntos que se muestran dentro de cada sesión del historial.
  const {
    documents: sharedDocuments,
    customTypes: sharedDocTypes,
    loading: sharedDocsLoading,
  } = useSharedDocuments(patient.id, isDemo);
  const sharedDocsByAppointment = useMemo(() => {
    const map = new Map<string, typeof sharedDocuments>();
    for (const d of sharedDocuments) {
      if (!d.appointment_id) continue;
      const list = map.get(d.appointment_id) ?? [];
      list.push(d);
      map.set(d.appointment_id, list);
    }
    return map;
  }, [sharedDocuments]);
  const [portalDocBusyId, setPortalDocBusyId] = useState<string | null>(null);
  const openSessionDoc = async (doc: (typeof sharedDocuments)[number], download: boolean) => {
    setPortalDocBusyId(doc.id);
    try {
      await openSharedDocument(doc, download, isDemo);
    } finally {
      setPortalDocBusyId(null);
    }
  };

  // Profile editing
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [editForm, setEditForm] = useState<ProfileEditData>({
    full_name: "", email: "", whatsapp_phone: "", reason_for_consultation: "",
  });
  const [previewAvatar, setPreviewAvatar] = useState<string>("");
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [savingProfile, setSavingProfile] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Cancellation flow
  const [cancelTarget, setCancelTarget] = useState<PortalAppointment | null>(null);
  const [cancelReason, setCancelReason] = useState("");
  const [cancelSubmitting, setCancelSubmitting] = useState(false);

  const cancellationHoursNotice = branding.cancellationHoursNotice ?? 24;

  const isLateCancellation = (apt: PortalAppointment) => {
    const hoursUntil = (parseISO(apt.start_at).getTime() - Date.now()) / (1000 * 60 * 60);
    return hoursUntil < cancellationHoursNotice;
  };

  const openCancelDialog = (apt: PortalAppointment) => {
    setCancelTarget(apt);
    setCancelReason("");
  };

  const confirmCancel = async () => {
    if (!cancelTarget || !onCancelAppointment) return;
    setCancelSubmitting(true);
    try {
      await onCancelAppointment(cancelTarget.id, cancelReason.trim());
      setCancelTarget(null);
      setCancelReason("");
    } finally {
      setCancelSubmitting(false);
    }
  };

  // Theme
  const themeStyle = useMemo(() => {
    const color = isDark ? branding.darkColor : branding.lightColor;
    return generateThemeVars(color, isDark) as Record<string, string>;
  }, [isDark, branding.lightColor, branding.darkColor]);

  const totalSessions = pastAppointments.filter(a => a.status === "completed").length;
  const pendingPayments = payments.filter(p => p.status !== "paid" && p.status !== "cancelled");
  const overduePayments = pendingPayments.filter(p => p.status === "overdue");
  const nonOverduePending = pendingPayments.filter(p => p.status !== "overdue");
  const pendingCount = pendingPayments.length;
  const nonOverdueCount = nonOverduePending.length;
  const totalPaid = payments.filter(p => p.status === "paid").reduce((s, p) => s + Number(p.amount), 0);
  const overdueCount = overduePayments.length;
  const overdueTotal = overduePayments.reduce((s, p) => s + Number(p.amount), 0);
  const overdueCurrency = overduePayments[0]?.currency || "UYU";
  const payingAny = payingPaymentIds.length > 0;

  const isPayablePayment = (status: string) =>
    status === "pending" || status === "due_soon" || status === "overdue";

  // Group payments by appointment for inline actions in Historial
  const paymentByAppointment = useMemo(() => {
    const map = new Map<string, PortalPayment>();
    // Prefer paid > overdue > pending > due_soon order for the most relevant one
    const priority = (s: string) => s === "paid" ? 3 : s === "overdue" ? 2 : s === "pending" || s === "due_soon" ? 1 : 0;
    for (const p of payments) {
      if (!p.appointment_id) continue;
      const existing = map.get(p.appointment_id);
      if (!existing || priority(p.status) > priority(existing.status)) {
        map.set(p.appointment_id, p);
      }
    }
    return map;
  }, [payments]);

  // Sort helpers
  const sortedOverdue = useMemo(
    () => [...overduePayments].sort((a, b) => +parseISO(a.due_date) - +parseISO(b.due_date)),
    [overduePayments],
  );
  const sortedPending = useMemo(
    () => [...nonOverduePending].sort((a, b) => +parseISO(a.due_date) - +parseISO(b.due_date)),
    [nonOverduePending],
  );
  const paidPayments = useMemo(
    () => payments
      .filter(p => p.status === "paid")
      .sort((a, b) => +parseISO(b.paid_at || b.due_date) - +parseISO(a.paid_at || a.due_date)),
    [payments],
  );

  const [paidHistoryLimit, setPaidHistoryLimit] = useState(10);

  // Days helpers
  const daysDelta = (iso: string) => {
    const diff = parseISO(iso).getTime() - Date.now();
    return Math.round(diff / (1000 * 60 * 60 * 24));
  };
  const overdueText = (iso: string) => {
    const d = -daysDelta(iso);
    if (d <= 0) return "Vencido hoy";
    if (d === 1) return "Venció hace 1 día";
    return `Venció hace ${d} días`;
  };
  const pendingText = (iso: string) => {
    const d = daysDelta(iso);
    if (d < 0) return overdueText(iso);
    if (d === 0) return "Vence hoy";
    if (d === 1) return "Vence mañana";
    if (d <= 7) return `Vence en ${d} días`;
    return `Vence el ${formatShort(parseISO(iso))}`;
  };

  // Trigger single payment from a PortalPayment row
  const paySinglePayment = (p: PortalPayment) => {
    if (p.appointment_id && onPaySession) {
      onPaySession(p.appointment_id);
    } else if (onPayPayments) {
      onPayPayments([p.id]);
    }
  };

  const isPaymentProcessing = (p: PortalPayment) =>
    p.appointment_id
      ? payingAppointmentId === p.appointment_id
      : payingPaymentIds.includes(p.id);

  const handleDownloadReceipt = async (p: PortalPayment) => {
    try {
      await downloadReceiptPdf({
        payment: {
          id: p.id,
          amount: Number(p.amount),
          currency: p.currency || "UYU",
          paid_at: p.paid_at,
          due_date: p.due_date,
          method: p.method ?? null,
          notes: p.notes,
        },
        patient: { full_name: patient.full_name, email: patient.email },
        clinic: {
          name: branding.name,
          specialty: branding.specialty,
          logoUrl: branding.logoUrl || undefined,
          contactEmail: branding.contactEmail,
        },
      });
    } catch (err) {
      console.error("Receipt PDF error:", err);
      sonnerToast.error("No pudimos generar el comprobante. Intentá de nuevo.");
    }
  };

  const handleBannerPay = () => {
    if (!onPayPayments || overdueCount === 0) return;
    if (overdueCount === 1) {
      onPayPayments([overduePayments[0].id]);
    } else {
      setTab("pagos");
      setTimeout(() => {
        overdueSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 80);
    }
  };

  // External request from wrapper to focus overdue section
  useEffect(() => {
    if (focusOverdueTick && overdueCount > 0) {
      setTab("pagos");
      setTimeout(() => {
        overdueSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 80);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusOverdueTick]);

  const initials = (patient.full_name || "?")
    .split(" ").map(w => w[0]).join("").substring(0, 2).toUpperCase();
  const firstName = patient.full_name?.split(" ")[0] || "";

  const startEditing = () => {
    setEditForm({
      full_name: patient.full_name || "",
      email: patient.email || "",
      whatsapp_phone: patient.whatsapp_phone || "",
      reason_for_consultation: patient.reason_for_consultation || "",
    });
    setPreviewAvatar(patient.avatar_url || "");
    setAvatarFile(null);
    setIsEditingProfile(true);
  };

  const cancelEditing = () => {
    setIsEditingProfile(false);
    setPreviewAvatar("");
    setAvatarFile(null);
  };

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setAvatarFile(file);
    setPreviewAvatar(URL.createObjectURL(file));
  };

  const handleSaveProfile = async () => {
    if (!onSaveProfile) {
      setIsEditingProfile(false);
      return;
    }
    setSavingProfile(true);
    try {
      await onSaveProfile(editForm, avatarFile);
      setIsEditingProfile(false);
      setAvatarFile(null);
    } finally {
      setSavingProfile(false);
    }
  };

  // ========= ResumenTab =========
  const ResumenTab = () => (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 lg:gap-6">
      {/* LEFT (8/12) */}
      <div className="lg:col-span-8 flex flex-col gap-5 lg:gap-6">
        {/* Notificaciones no leídas */}
        <NotificationsSummaryCard patientId={patient.id} />

        {/* Alerta de pagos vencidos */}
        {overdueCount > 0 && (
          <Card className="rounded-2xl border-destructive/30 bg-destructive/5">
            <CardContent className="p-4 lg:p-5 flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
              <div className="flex items-start gap-3 min-w-0 flex-1">
                <div className="h-10 w-10 rounded-full bg-destructive/15 flex items-center justify-center shrink-0">
                  <AlertCircle className="h-5 w-5 text-destructive" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm lg:text-base font-semibold text-destructive">
                    {overdueCount === 1
                      ? "Tenés 1 pago vencido"
                      : `Tenés ${overdueCount} pagos vencidos`}
                  </p>
                  <p className="text-xs lg:text-sm text-muted-foreground mt-0.5">
                    Total: <span className="font-bold text-foreground">{formatCurrency(overdueTotal, overdueCurrency)}</span>
                  </p>
                </div>
              </div>
              {mpConnected && onPayPayments && (
                <Button
                  onClick={handleBannerPay}
                  disabled={payingAny}
                  className="gap-2 min-h-11 sm:w-auto w-full"
                >
                  {payingAny ? <Loader2 className="h-4 w-4 animate-spin" /> : <CreditCard className="h-4 w-4" />}
                  {payingAny ? "Procesando..." : (overdueCount === 1 ? "Pagar ahora" : "Pagar todos")}
                </Button>
              )}
            </CardContent>
          </Card>
        )}

        {/* Hero de marca: el portal se siente SU consultorio desde el primer pixel */}
        <div className="relative overflow-hidden rounded-3xl border border-primary/20 p-5 lg:p-6">
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              background:
                "linear-gradient(120deg, hsl(var(--primary) / 0.16), hsl(var(--primary) / 0.05) 55%, transparent)",
            }}
          />
          <div className="relative flex items-center gap-4">
            {branding.logoUrl ? (
              <img
                src={branding.logoUrl}
                alt={branding.name}
                className="h-14 w-14 lg:h-16 lg:w-16 rounded-2xl object-cover shrink-0 ring-2 ring-primary/30"
                style={{ boxShadow: "0 8px 26px -8px hsl(var(--primary) / 0.5)" }}
              />
            ) : (
              <Avatar className="h-14 w-14 lg:h-16 lg:w-16 border-2 border-primary/30 shadow-lg shadow-primary/10 shrink-0">
                {patient.avatar_url ? <AvatarImage src={patient.avatar_url} /> : null}
                <AvatarFallback className="text-xl font-bold bg-gradient-to-tr from-primary to-primary/70 text-primary-foreground">
                  {initials}
                </AvatarFallback>
              </Avatar>
            )}
            <div className="min-w-0 flex-1">
              <h2 className="text-2xl lg:text-3xl font-bold tracking-tight text-foreground">
                Hola, {firstName} <span className="inline-block">👋</span>
              </h2>
              <p className="text-sm lg:text-base text-muted-foreground truncate">
                Tu espacio en <span className="font-semibold text-foreground">{branding.name}</span>
                {branding.specialty ? ` · ${branding.specialty}` : ""}
              </p>
            </div>
            <Avatar className="hidden sm:block h-11 w-11 border border-border shrink-0">
              {patient.avatar_url ? <AvatarImage src={patient.avatar_url} /> : null}
              <AvatarFallback className="text-sm font-bold bg-muted text-muted-foreground">
                {initials}
              </AvatarFallback>
            </Avatar>
          </div>
        </div>

        {/* Hero: Próxima cita */}
        <Card className="relative overflow-hidden rounded-3xl border-border/60">
          <div className="absolute top-0 right-0 w-64 h-64 bg-primary/10 blur-[100px] pointer-events-none" />
          <CardContent className="relative z-10 p-6 lg:p-8">
            {upcomingAppointments.length === 0 ? (
              <div className="text-center py-6">
                <Calendar className="h-12 w-12 text-muted-foreground/40 mx-auto mb-3" />
                <p className="text-sm text-muted-foreground mb-3">No tenés citas próximas</p>
                {onBookAppointment && (
                  <Button onClick={onBookAppointment} className="gap-2">
                    <Plus className="h-4 w-4" /> Reservar ahora
                  </Button>
                )}
              </div>
            ) : (
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div className="space-y-3 min-w-0">
                  {(() => {
                    const start = parseISO(upcomingAppointments[0].start_at);
                    if (isToday(start)) {
                      return (
                        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary text-primary-foreground text-xs font-bold shadow-md shadow-primary/30">
                          <span className="w-2 h-2 rounded-full bg-primary-foreground animate-pulse" />
                          ¡Tu cita es HOY!
                        </div>
                      );
                    }
                    const label = isTomorrow(start)
                      ? "Próxima cita · mañana"
                      : `Próxima cita · en ${differenceInCalendarDays(start, new Date())} días`;
                    return (
                      <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 border border-primary/20 text-primary text-xs font-medium">
                        <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
                        {label}
                      </div>
                    );
                  })()}
                  <div className="space-y-1">
                    <h3 className="text-xl lg:text-2xl font-bold capitalize">
                      {formatDateLong(parseISO(upcomingAppointments[0].start_at))}
                    </h3>
                    <p className="text-muted-foreground flex items-center gap-2 text-sm">
                      <Clock className="h-4 w-4" />
                      {format(parseISO(upcomingAppointments[0].start_at), "HH:mm")} — {format(parseISO(upcomingAppointments[0].end_at), "HH:mm")} hs
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-3 text-sm">
                    <div className="flex items-center gap-2 text-muted-foreground">
                      {upcomingAppointments[0].modality === "online" || upcomingAppointments[0].modality === "virtual"
                        ? <Video className="h-4 w-4 text-primary shrink-0" />
                        : <MapPin className="h-4 w-4 shrink-0" />}
                      <span className="truncate">
                        {upcomingAppointments[0].modality === "online" || upcomingAppointments[0].modality === "virtual"
                          ? (upcomingAppointments[0].location || "Sesión online")
                          : (upcomingAppointments[0].location || "Presencial")}
                      </span>
                    </div>
                    {upcomingAppointments[0].service_name && (
                      <div className="flex items-center gap-2 text-primary">
                        <CheckCircle2 className="h-4 w-4 shrink-0" />
                        <span>{upcomingAppointments[0].service_name}</span>
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex flex-col gap-2 md:w-56 shrink-0">
                  {(upcomingAppointments[0].modality === "online" || upcomingAppointments[0].modality === "virtual") && upcomingAppointments[0].location && (
                    <Button asChild className="gap-2 shadow-lg shadow-primary/20">
                      <a href={upcomingAppointments[0].location} target="_blank" rel="noopener noreferrer">
                        <Video className="h-4 w-4" /> Unirme a la sesión
                      </a>
                    </Button>
                  )}
                  {upcomingAppointments[0].status !== "reschedule_requested" && (onRescheduleAppointment || onCancelAppointment) && (
                    <>
                      <div className={`grid gap-2 ${onRescheduleAppointment && onCancelAppointment && !isLateCancellation(upcomingAppointments[0]) ? "grid-cols-2" : "grid-cols-1"}`}>
                        {onRescheduleAppointment && (
                          <Button variant="outline" size="sm" onClick={() => onRescheduleAppointment(upcomingAppointments[0])} className="gap-1.5">
                            <RefreshCw className="h-3.5 w-3.5" /> Reprogramar
                          </Button>
                        )}
                        {onCancelAppointment && !isLateCancellation(upcomingAppointments[0]) && (
                          <Button variant="outline" size="sm" onClick={() => openCancelDialog(upcomingAppointments[0])} className="gap-1.5 text-destructive border-destructive/30 hover:bg-destructive/10 hover:text-destructive">
                            <XCircle className="h-3.5 w-3.5" /> Cancelar
                          </Button>
                        )}
                      </div>
                      {onCancelAppointment && isLateCancellation(upcomingAppointments[0]) && (
                        <p className="text-[11px] text-muted-foreground">
                          Para cancelar con menos de {cancellationHoursNotice} horas de anticipación,
                          contactá directamente a tu profesional.
                        </p>
                      )}
                    </>
                  )}
                  <Button variant="ghost" size="sm" onClick={() => setTab("citas")} className="gap-1 text-xs">
                    Ver todas <ChevronRight className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Notas del profesional: solo si hay algo que decir */}
        {patient.private_notes && (
          <Card className="hover:shadow-md transition-all">
            <CardHeader className="pb-3">
              <CardTitle className="text-base lg:text-lg flex items-center gap-2">
                <Heart className="h-5 w-5 text-primary" /> Notas de tu profesional
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="rounded-xl bg-muted/50 p-4 lg:p-5">
                <p className="text-sm lg:text-base text-muted-foreground leading-relaxed whitespace-pre-wrap italic">
                  "{patient.private_notes}"
                </p>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* RIGHT (4/12) */}
      <div className="lg:col-span-4 flex flex-col gap-4 lg:gap-5">
        {/* CTA principal: reservar siempre a mano (cuando no hay citas, el
            hero de la izquierda ya muestra el botón grande) */}
        {onBookAppointment && upcomingAppointments.length > 0 && (
          <button
            onClick={onBookAppointment}
            className="group relative overflow-hidden rounded-2xl p-5 text-left transition-all hover:shadow-lg hover:-translate-y-0.5 active:scale-[0.99]"
            style={{
              background:
                "linear-gradient(135deg, hsl(var(--primary)), hsl(var(--primary) / 0.82))",
              boxShadow: "0 10px 30px -10px hsl(var(--primary) / 0.55)",
            }}
          >
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-base font-bold text-primary-foreground">Reservar una cita</p>
                <p className="text-xs text-primary-foreground/80 mt-0.5">
                  Elegí día y horario en un minuto
                </p>
              </div>
              <span className="h-10 w-10 rounded-xl bg-white/20 flex items-center justify-center shrink-0 transition-transform group-hover:scale-110">
                <Plus className="h-5 w-5 text-primary-foreground" />
              </span>
            </div>
          </button>
        )}

        {/* Stats compactos — "Pendientes" cuenta solo los no vencidos (los vencidos los muestra la card alerta grande) */}
        <div className="grid grid-cols-3 gap-2 lg:gap-3">
          {[
            { value: upcomingAppointments.length, label: "Próximas", icon: Calendar, tone: "neutral" as const },
            { value: totalSessions, label: "Sesiones", icon: CalendarCheck, tone: "neutral" as const },
            {
              value: nonOverdueCount,
              label: "Pendientes",
              icon: Clock,
              tone: (nonOverdueCount > 0 ? "warning" : "neutral") as "warning" | "neutral",
            },
          ].map((stat, i) => (
            <div
              key={i}
              className={`rounded-2xl border p-3 lg:p-4 text-center transition-all hover:shadow-md ${
                stat.tone === "warning"
                  ? "border-amber-500/30 bg-amber-500/5"
                  : "border-border/60 bg-card"
              }`}
            >
              <stat.icon
                className={`h-4 w-4 mx-auto mb-1 ${
                  stat.tone === "warning" ? "text-amber-600 dark:text-amber-400" : "text-primary/70"
                }`}
              />
              <p className={`text-2xl lg:text-3xl font-bold ${
                stat.tone === "warning" ? "text-amber-600 dark:text-amber-400" : "text-primary"
              }`}>
                {stat.value}
              </p>
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold mt-1">
                {stat.label}
              </p>
            </div>
          ))}
        </div>

        {/* Pago pendiente (no vencido) — los vencidos los muestra la card alerta grande arriba */}
        {nonOverdueCount > 0 && nonOverduePending[0] ? (
          <button
            onClick={() => setTab("pagos")}
            className="w-full text-left rounded-2xl border border-amber-500/30 bg-amber-500/5 p-4 lg:p-5 flex items-center justify-between gap-3 group hover:bg-amber-500/10 transition-colors"
          >
            <div className="flex items-center gap-3 min-w-0">
              <div className="h-10 w-10 rounded-full bg-amber-500/15 flex items-center justify-center shrink-0">
                <AlertCircle className="h-5 w-5 text-amber-600 dark:text-amber-400" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-amber-700 dark:text-amber-300">
                  {nonOverdueCount === 1 ? "Pago pendiente" : `${nonOverdueCount} pagos pendientes`}
                </p>
                <p className="text-xs text-muted-foreground truncate">
                  Vence {formatShort(parseISO(nonOverduePending[0].due_date))}
                </p>
              </div>
            </div>
            <span className="text-sm font-bold text-foreground shrink-0">
              {formatCurrency(Number(nonOverduePending[0].amount), nonOverduePending[0].currency || "UYU")}
            </span>
          </button>
        ) : overdueCount === 0 && (
          <div className="w-full rounded-2xl border border-border/60 bg-card p-4 lg:p-5 flex items-center gap-3 text-muted-foreground">
            <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
              <Heart className="h-5 w-5 text-primary" />
            </div>
            <p className="text-sm font-medium">Al día ✓</p>
          </div>
        )}

        {/* Configuración rápida agrupada */}
        <Card className="hover:shadow-md transition-all">
          <CardContent className="p-5 flex flex-col gap-5">
            <h3 className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
              Configuración rápida
            </h3>

            {!isInstalled && (
              <>
                <div className="flex items-start gap-3">
                  <div className="mt-0.5 text-primary">
                    <Smartphone className="h-5 w-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">Instalar aplicación</p>
                    <p className="text-xs text-muted-foreground">Accedé más rápido desde tu inicio</p>
                    {onInstallApp && (
                      <Button
                        variant="link"
                        size="sm"
                        onClick={onInstallApp}
                        className="px-0 h-auto mt-2 text-xs font-bold text-primary"
                      >
                        Agregar a inicio
                      </Button>
                    )}
                  </div>
                </div>
                <div className="h-px bg-border" />
              </>
            )}

            <NotificationActivationCard variant="full" audience="patient" />
          </CardContent>
        </Card>
      </div>
    </div>
  );

  // ========= CitasTab =========
  const CitasTab = () => (
    <div className="space-y-4 lg:space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg lg:text-xl font-bold flex items-center gap-2">
          <Calendar className="h-5 w-5 text-primary" /> Próximas citas
        </h2>
        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="text-xs">{upcomingAppointments.length} programadas</Badge>
          {onBookAppointment && (
            <Button size="sm" onClick={onBookAppointment} className="gap-2">
              <Plus className="h-4 w-4" /> Reservar
            </Button>
          )}
        </div>
      </div>

      {upcomingAppointments.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Calendar className="h-12 w-12 text-muted-foreground/40 mx-auto mb-3" />
            <p className="text-muted-foreground font-medium">No tenés citas próximas</p>
            <p className="text-xs text-muted-foreground mt-1">
              {onBookAppointment ? "Reservá una con tu profesional cuando quieras." : "Tu profesional agendará tu próxima sesión."}
            </p>
            {onBookAppointment && (
              <Button variant="outline" size="sm" onClick={onBookAppointment} className="mt-4 gap-2">
                <Plus className="h-4 w-4" /> Reservar ahora
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {upcomingAppointments.map(apt => (
            <Card key={apt.id} className="hover:shadow-md transition-all overflow-hidden group">
              <div className="h-1 bg-primary group-hover:h-1.5 transition-all" />
              <CardContent className="p-4 lg:p-6 space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold text-sm lg:text-base capitalize">
                      {formatDateLong(parseISO(apt.start_at))}
                    </p>
                    <p className="text-sm text-muted-foreground mt-0.5">
                      {format(parseISO(apt.start_at), "HH:mm")} - {format(parseISO(apt.end_at), "HH:mm")} hs
                    </p>
                  </div>
                  {statusBadge(apt.status)}
                </div>
                <Separator />
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    {apt.modality === "online" || apt.modality === "virtual"
                      ? <Video className="h-4 w-4 text-primary shrink-0" />
                      : <MapPin className="h-4 w-4 shrink-0" />}
                    <span>
                      {apt.modality === "online" || apt.modality === "virtual"
                        ? "Sesión online"
                        : apt.location || "Presencial"}
                    </span>
                  </div>
                  {apt.service_name && (
                    <div className="flex items-center gap-2 text-sm text-primary">
                      <CheckCircle2 className="h-4 w-4 shrink-0" />
                      <span>{apt.service_name}</span>
                    </div>
                  )}
                </div>
                {apt.notes && (
                  <div className="rounded-xl bg-muted/50 p-3 text-xs text-muted-foreground flex items-start gap-2">
                    <span className="shrink-0">💡</span>
                    <span>{apt.notes}</span>
                  </div>
                )}
                {mpConnected && onPaySession && (apt.payment_status === "pendiente" || apt.status === "pending_payment") && (
                  <>
                    <Separator />
                    <Button
                      size="sm"
                      className="w-full gap-2 min-h-11"
                      onClick={() => onPaySession(apt.id)}
                      disabled={payingAppointmentId === apt.id}
                    >
                      {payingAppointmentId === apt.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <CreditCard className="h-4 w-4" />
                      )}
                      {payingAppointmentId === apt.id ? "Procesando..." : "Pagar sesión"}
                    </Button>
                  </>
                )}
                {apt.status !== "reschedule_requested" && (onRescheduleAppointment || onCancelAppointment) && (
                  <>
                    <Separator />
                    <div className={`grid gap-2 ${onRescheduleAppointment && onCancelAppointment && !isLateCancellation(apt) ? "grid-cols-2" : "grid-cols-1"}`}>
                      {onRescheduleAppointment && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => onRescheduleAppointment(apt)}
                          className="gap-1.5 h-10"
                        >
                          <RefreshCw className="h-3.5 w-3.5" /> Reprogramar
                        </Button>
                      )}
                      {onCancelAppointment && !isLateCancellation(apt) && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => openCancelDialog(apt)}
                          className="gap-1.5 h-10 text-destructive border-destructive/30 hover:bg-destructive/10 hover:text-destructive"
                        >
                          <XCircle className="h-3.5 w-3.5" /> Cancelar
                        </Button>
                      )}
                    </div>
                    {/* Cancelación tardía: el botón no aparece; el candado real
                        está también en la base (trigger) */}
                    {onCancelAppointment && isLateCancellation(apt) && (
                      <p className="text-[11px] text-muted-foreground">
                        Para cancelar con menos de {cancellationHoursNotice} horas de anticipación,
                        contactá directamente a tu profesional.
                      </p>
                    )}
                  </>
                )}
                {apt.status === "reschedule_requested" && (
                  <div className="rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/60 p-3 text-xs flex items-start gap-2">
                    <RefreshCw className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                    <span className="text-amber-700 dark:text-amber-300">
                      Tu pedido de reprogramación está esperando confirmación del profesional.
                    </span>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );

  // ========= HistorialTab =========
  // (Los documentos tienen su propia pestaña "Docs"; acá cada sesión muestra
  // los suyos, anclados a la tarjeta.)
  const HistorialTab = () => (
    <div className="space-y-4 lg:space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg lg:text-xl font-bold flex items-center gap-2">
          <FileText className="h-5 w-5 text-primary" /> Historial de sesiones
        </h2>
        <Badge variant="secondary" className="text-xs">{pastAppointments.length} sesiones</Badge>
      </div>

      {pastAppointments.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <FileText className="h-12 w-12 text-muted-foreground/40 mx-auto mb-3" />
            <p className="text-muted-foreground font-medium">Aún no tenés historial</p>
            <p className="text-xs text-muted-foreground mt-1">Tus sesiones realizadas aparecerán acá.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="relative space-y-0">
          {pastAppointments.map((apt, idx) => {
            const linkedPayment = paymentByAppointment.get(apt.id);
            const isProcessing = linkedPayment ? isPaymentProcessing(linkedPayment) : false;
            return (
            <div key={apt.id} className="relative flex gap-4 lg:gap-6">
              <div className="flex flex-col items-center">
                <div className={`h-3 w-3 rounded-full shrink-0 mt-5 ${
                  apt.status === "completed" ? "bg-primary"
                  : apt.status === "no_show" ? "bg-destructive"
                  : "bg-muted-foreground"
                }`} />
                {idx < pastAppointments.length - 1 && <div className="w-px flex-1 bg-border min-h-[2rem]" />}
              </div>

              <Card className={`flex-1 mb-3 hover:shadow-md transition-all ${apt.status === "no_show" ? "opacity-60" : ""}`}>
                <CardContent className="p-4 lg:p-5">
                  <div className="flex flex-col sm:flex-row sm:items-start gap-2 sm:gap-4">
                    <div className="sm:w-40 shrink-0">
                      <p className="font-semibold text-sm">{formatShort(parseISO(apt.start_at))}</p>
                      <p className="text-xs text-muted-foreground">
                        {format(parseISO(apt.start_at), "HH:mm")} - {format(parseISO(apt.end_at), "HH:mm")} hs
                      </p>
                      <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                        {statusBadge(apt.status)}
                        {apt.modality && (
                          <Badge variant="outline" className="text-[10px] gap-1">
                            {apt.modality === "online" || apt.modality === "virtual"
                              ? <><Video className="h-2.5 w-2.5" /> Online</>
                              : <><MapPin className="h-2.5 w-2.5" /> Presencial</>}
                          </Badge>
                        )}
                        {linkedPayment && linkedPayment.status === "paid" && (
                          <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30 text-[10px]">
                            Pagada
                          </Badge>
                        )}
                        {linkedPayment && linkedPayment.status === "overdue" && (
                          <Badge variant="destructive" className="text-[10px]">Pago vencido</Badge>
                        )}
                        {linkedPayment && (linkedPayment.status === "pending" || linkedPayment.status === "due_soon") && (
                          <Badge className="bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30 text-[10px]">
                            Pendiente de pago
                          </Badge>
                        )}
                      </div>
                    </div>
                    <div className="flex-1 min-w-0">
                      {apt.service_name && <p className="text-xs text-primary font-medium mb-1.5">{apt.service_name}</p>}
                      {/* apt.notes acá es patient_note: lo que el profesional
                          escribió PARA el paciente (las notas internas nunca
                          llegan al portal) */}
                      {apt.notes ? (
                        <div className="rounded-xl bg-muted/40 p-3">
                          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">
                            Indicación de tu profesional
                          </p>
                          <p className="text-xs lg:text-sm text-foreground leading-relaxed whitespace-pre-wrap">{apt.notes}</p>
                        </div>
                      ) : (
                        <p className="text-xs text-muted-foreground italic">Sin indicaciones para esta sesión</p>
                      )}
                      {/* Documentos de ESTA sesión (los mismos de la pestaña Docs) */}
                      {(sharedDocsByAppointment.get(apt.id) ?? []).length > 0 && (
                        <div className="mt-3 space-y-1.5">
                          {(sharedDocsByAppointment.get(apt.id) ?? []).map((doc) => {
                            const { Icon } = resolveDocType(doc.document_type, sharedDocTypes);
                            return (
                              <div
                                key={doc.id}
                                className="flex items-center gap-2 rounded-lg border border-border/60 bg-muted/30 px-2.5 py-2"
                              >
                                <Icon className="h-3.5 w-3.5 text-primary shrink-0" />
                                <button
                                  onClick={() => void openSessionDoc(doc, false)}
                                  disabled={portalDocBusyId === doc.id}
                                  className="text-xs font-medium truncate flex-1 text-left hover:text-primary transition-colors"
                                  title={doc.file_name}
                                >
                                  {doc.file_name}
                                </button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  title="Descargar"
                                  className="h-7 w-7 p-0 rounded-lg shrink-0 text-muted-foreground"
                                  onClick={() => void openSessionDoc(doc, true)}
                                  disabled={portalDocBusyId === doc.id}
                                >
                                  {portalDocBusyId === doc.id
                                    ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                    : <Download className="h-3.5 w-3.5" />}
                                </Button>
                              </div>
                            );
                          })}
                        </div>
                      )}
                      {linkedPayment && (
                        <div className="mt-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                          <span className="text-xs text-muted-foreground">
                            {formatCurrency(Number(linkedPayment.amount), linkedPayment.currency || "UYU")}
                          </span>
                          {linkedPayment.status === "paid" ? (
                            <Button
                              size="sm"
                              variant="outline"
                              className="gap-1.5 min-h-11 sm:min-h-9 w-full sm:w-auto"
                              onClick={() => handleDownloadReceipt(linkedPayment)}
                            >
                              <Download className="h-3.5 w-3.5" /> Comprobante
                            </Button>
                          ) : mpConnected && isPayablePayment(linkedPayment.status) ? (
                            <Button
                              size="sm"
                              variant={linkedPayment.status === "overdue" ? "destructive" : "default"}
                              className="gap-1.5 min-h-11 sm:min-h-9 w-full sm:w-auto"
                              onClick={() => paySinglePayment(linkedPayment)}
                              disabled={isProcessing || payingAny}
                            >
                              {isProcessing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CreditCard className="h-3.5 w-3.5" />}
                              {isProcessing ? "Procesando..." : "Pagar"}
                            </Button>
                          ) : null}
                        </div>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
            );
          })}
        </div>
      )}
    </div>
  );

  // ========= PagosTab =========
  const PagosTab = () => {
    const empty = payments.length === 0;
    const paidToShow = paidPayments.slice(0, paidHistoryLimit);
    const linkedAppt = (paymentId: string) => {
      const p = payments.find(pp => pp.id === paymentId);
      if (!p?.appointment_id) return null;
      return [...upcomingAppointments, ...pastAppointments].find(a => a.id === p.appointment_id) || null;
    };

    const renderPayableCard = (p: PortalPayment, tone: "overdue" | "pending") => {
      const isProcessing = isPaymentProcessing(p);
      const apt = linkedAppt(p.id);
      const toneStyles = tone === "overdue"
        ? { border: "border-destructive/30", bg: "bg-destructive/5", amount: "text-destructive", subtext: "text-destructive/80", btnVariant: "destructive" as const }
        : { border: "border-amber-500/30", bg: "bg-amber-500/5", amount: "text-amber-600 dark:text-amber-400", subtext: "text-amber-700 dark:text-amber-400", btnVariant: "default" as const };
      return (
        <Card key={p.id} className={`rounded-2xl ${toneStyles.border} ${toneStyles.bg}`}>
          <CardContent className="p-4 lg:p-5">
            <div className="flex flex-col sm:flex-row sm:items-center gap-4">
              <div className="flex-1 min-w-0">
                <p className="text-sm lg:text-base font-semibold text-foreground truncate">
                  {p.notes?.trim() || (apt ? "Sesión" : p.recurrence_label || "Pago")}
                </p>
                {apt && (
                  <p className="text-xs text-muted-foreground mt-1 flex items-center gap-2 flex-wrap">
                    <Calendar className="h-3.5 w-3.5 shrink-0" />
                    {formatShort(parseISO(apt.start_at))} · {format(parseISO(apt.start_at), "HH:mm")} hs
                    {apt.modality && (
                      <span className="inline-flex items-center gap-1 ml-1">
                        {apt.modality === "online" || apt.modality === "virtual"
                          ? <><Video className="h-3 w-3" />Online</>
                          : <><MapPin className="h-3 w-3" />Presencial</>}
                      </span>
                    )}
                  </p>
                )}
                <div className="mt-2 flex items-baseline gap-3 flex-wrap">
                  <span className={`text-xl lg:text-2xl font-bold ${toneStyles.amount}`}>
                    {formatCurrency(Number(p.amount), p.currency || "UYU")}
                  </span>
                  <span className={`text-xs font-medium ${toneStyles.subtext}`}>
                    {tone === "overdue" ? overdueText(p.due_date) : pendingText(p.due_date)}
                  </span>
                </div>
              </div>
              {(onPayPayments || onPaySession) && (
                <Button
                  variant={toneStyles.btnVariant}
                  className={`gap-2 min-h-11 w-full sm:w-auto sm:min-w-[140px] ${tone === "pending" ? "bg-amber-500 text-white hover:bg-amber-500/90" : ""}`}
                  onClick={() => paySinglePayment(p)}
                  disabled={isProcessing || payingAny}
                >
                  {isProcessing ? <Loader2 className="h-4 w-4 animate-spin" /> : <CreditCard className="h-4 w-4" />}
                  {isProcessing ? "Procesando..." : (p.appointment_id ? "Pagar sesión" : "Pagar online")}
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      );
    };

    return (
      <div className="space-y-6 lg:space-y-8">
        {empty && (
          <Card>
            <CardContent className="py-14 text-center">
              <CreditCard className="h-12 w-12 text-muted-foreground/40 mx-auto mb-3" />
              <p className="text-muted-foreground font-medium">Todavía no tenés pagos registrados</p>
              <p className="text-xs text-muted-foreground mt-1">Acá vas a ver pagos pendientes, vencidos y tu historial.</p>
            </CardContent>
          </Card>
        )}

        {/* Vencidos */}
        {overdueCount > 0 && (
          <section ref={overdueSectionRef} className="space-y-3">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <h2 className="text-base lg:text-lg font-bold flex items-center gap-2 text-destructive">
                <AlertCircle className="h-5 w-5" />
                Pagos vencidos
                <Badge variant="destructive" className="ml-1">{overdueCount}</Badge>
              </h2>
              <p className="text-xs lg:text-sm text-muted-foreground">
                Total: <span className="font-bold text-foreground">{formatCurrency(overdueTotal, overdueCurrency)}</span>
              </p>
            </div>
            {overdueCount >= 2 && onPayPayments && (
              <Button
                variant="destructive"
                className="w-full sm:w-auto gap-2 min-h-11"
                onClick={() => onPayPayments(sortedOverdue.map(p => p.id))}
                disabled={payingAny}
              >
                {payingAny ? <Loader2 className="h-4 w-4 animate-spin" /> : <CreditCard className="h-4 w-4" />}
                Pagar todos los vencidos
              </Button>
            )}
            <div className="space-y-3">
              {sortedOverdue.map(p => renderPayableCard(p, "overdue"))}
            </div>
          </section>
        )}

        {/* Pendientes */}
        {nonOverdueCount > 0 && (
          <section className="space-y-3">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <h2 className="text-base lg:text-lg font-bold flex items-center gap-2 text-amber-600 dark:text-amber-400">
                <Clock className="h-5 w-5" />
                Pagos pendientes
                <Badge className="ml-1 bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30 hover:bg-amber-500/20">
                  {nonOverdueCount}
                </Badge>
              </h2>
            </div>
            {nonOverdueCount >= 2 && onPayPayments && (
              <Button
                className="w-full sm:w-auto gap-2 min-h-11 bg-amber-500 text-white hover:bg-amber-500/90"
                onClick={() => onPayPayments(sortedPending.map(p => p.id))}
                disabled={payingAny}
              >
                {payingAny ? <Loader2 className="h-4 w-4 animate-spin" /> : <CreditCard className="h-4 w-4" />}
                Pagar todos los pendientes
              </Button>
            )}
            <div className="space-y-3">
              {sortedPending.map(p => renderPayableCard(p, "pending"))}
            </div>
          </section>
        )}

        {/* Historial */}
        {paidPayments.length > 0 && (
          <section className="space-y-3">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <h2 className="text-base lg:text-lg font-bold flex items-center gap-2 text-foreground">
                <CheckCircle2 className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                Historial
                <Badge variant="secondary" className="ml-1">{paidPayments.length}</Badge>
              </h2>
              <p className="text-xs text-muted-foreground">
                Total pagado: <span className="font-bold text-foreground">{formatCurrency(totalPaid, paidPayments[0]?.currency || "UYU")}</span>
              </p>
            </div>
            <div className="space-y-2">
              {paidToShow.map(p => {
                const apt = linkedAppt(p.id);
                return (
                  <Card key={p.id} className="rounded-xl hover:shadow-sm transition-shadow">
                    <CardContent className="p-3 lg:p-4">
                      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-sm font-semibold text-foreground truncate">
                              {p.notes?.trim() || (apt ? "Sesión" : p.recurrence_label || "Pago")}
                            </span>
                            <span className="font-bold text-sm text-foreground shrink-0">
                              {formatCurrency(Number(p.amount), p.currency || "UYU")}
                            </span>
                          </div>
                          <p className="text-xs text-muted-foreground mt-1">
                            {apt && (<>Cita {formatShort(parseISO(apt.start_at))} · </>)}
                            Pagado el {p.paid_at ? formatShort(parseISO(p.paid_at)) : "—"}
                            {" · "}
                            {(() => {
                              const m = p.method ? (p.method === "mercadopago" ? "mercado_pago" : p.method) : null;
                              const found = m ? [{value:"efectivo",label:"Efectivo"},{value:"transferencia",label:"Transferencia"},{value:"mercado_pago",label:"Mercado Pago"},{value:"tarjeta",label:"Tarjeta"},{value:"otro",label:"Otro"}].find(x=>x.value===m) : null;
                              return found?.label || "Sin método";
                            })()}
                            {" · "}
                            <span className="font-mono">{buildReceiptNumber(p.id)}</span>
                          </p>
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          className="gap-1.5 min-h-11 sm:min-h-9 w-full sm:w-auto"
                          onClick={() => handleDownloadReceipt(p)}
                        >
                          <Download className="h-3.5 w-3.5" /> Comprobante
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
            {paidPayments.length > paidHistoryLimit && (
              <div className="flex justify-center pt-2">
                <Button variant="ghost" size="sm" onClick={() => setPaidHistoryLimit(l => l + 10)}>
                  Ver más
                </Button>
              </div>
            )}
          </section>
        )}
      </div>
    );
  };

  // ========= PerfilTab =========
  const PerfilTab = () => (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-6">
      <Card className="hover:shadow-md transition-all">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base lg:text-lg flex items-center gap-2">
              <User className="h-4 w-4 lg:h-5 lg:w-5 text-primary" /> Mi perfil
            </CardTitle>
            {onSaveProfile && (!isEditingProfile ? (
              <Button variant="ghost" size="sm" className="gap-2 text-xs" onClick={startEditing}>
                <Edit2 className="h-3.5 w-3.5" /> Editar
              </Button>
            ) : (
              <div className="flex items-center gap-1">
                <Button variant="ghost" size="sm" className="gap-1 text-xs" onClick={cancelEditing} disabled={savingProfile}>
                  <X className="h-3.5 w-3.5" /> Cancelar
                </Button>
                <Button size="sm" className="gap-1 text-xs" onClick={handleSaveProfile} disabled={savingProfile}>
                  <Save className="h-3.5 w-3.5" /> {savingProfile ? "Guardando..." : "Guardar"}
                </Button>
              </div>
            ))}
          </div>
        </CardHeader>
        <CardContent className="space-y-4 lg:space-y-5">
          {/* Avatar + name */}
          <div className="flex items-center gap-4 pb-4 border-b">
            <div className="relative group">
              <Avatar className="h-16 w-16 lg:h-20 lg:w-20 border-4 border-primary/20 shadow-md">
                {(isEditingProfile ? previewAvatar : patient.avatar_url) ? (
                  <AvatarImage src={isEditingProfile ? previewAvatar : (patient.avatar_url || "")} />
                ) : null}
                <AvatarFallback className="text-xl lg:text-2xl font-bold bg-primary/10 text-primary">{initials}</AvatarFallback>
              </Avatar>
              {isEditingProfile && (
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="absolute inset-0 flex items-center justify-center bg-foreground/40 rounded-full opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                >
                  <Camera className="h-5 w-5 text-primary-foreground" />
                </button>
              )}
              <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarChange} />
            </div>
            <div className="min-w-0">
              {isEditingProfile ? (
                <Input
                  value={editForm.full_name}
                  onChange={e => setEditForm(f => ({ ...f, full_name: e.target.value }))}
                  className="h-9 text-base font-bold"
                  placeholder="Nombre completo"
                />
              ) : (
                <p className="font-bold text-base lg:text-lg truncate">{patient.full_name}</p>
              )}
              {patient.created_at && (
                <p className="text-xs lg:text-sm text-muted-foreground mt-1">
                  Paciente desde {format(parseISO(patient.created_at), "MMMM yyyy", { locale: es })}
                </p>
              )}
            </div>
          </div>

          {/* Fields */}
          <div className="space-y-4">
            <div className="flex items-center gap-3 text-sm">
              <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center shrink-0">
                <Mail className="h-4 w-4 text-muted-foreground" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs text-muted-foreground">Email</p>
                {isEditingProfile ? (
                  <Input
                    value={editForm.email}
                    onChange={e => setEditForm(f => ({ ...f, email: e.target.value }))}
                    className="h-8 mt-1 text-sm"
                    placeholder="tu@email.com"
                    type="email"
                  />
                ) : (
                  <p className="font-medium truncate">{patient.email || <span className="text-muted-foreground italic">Sin especificar</span>}</p>
                )}
              </div>
            </div>

            <div className="flex items-center gap-3 text-sm">
              <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center shrink-0">
                <Phone className="h-4 w-4 text-muted-foreground" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs text-muted-foreground">WhatsApp</p>
                {isEditingProfile ? (
                  <Input
                    value={editForm.whatsapp_phone}
                    onChange={e => setEditForm(f => ({ ...f, whatsapp_phone: e.target.value }))}
                    className="h-8 mt-1 text-sm"
                    placeholder="+598 99 ..."
                  />
                ) : (
                  <p className="font-medium">{patient.whatsapp_phone || <span className="text-muted-foreground italic">Sin especificar</span>}</p>
                )}
              </div>
            </div>

            <Separator />

            <div>
              <p className="text-xs text-muted-foreground mb-2">Motivo de consulta <span className="text-muted-foreground/60">(opcional)</span></p>
              {isEditingProfile ? (
                <Textarea
                  value={editForm.reason_for_consultation}
                  onChange={e => setEditForm(f => ({ ...f, reason_for_consultation: e.target.value }))}
                  className="text-sm min-h-[80px]"
                  placeholder="Contale a tu profesional tu motivo de consulta..."
                />
              ) : (
                <div className="rounded-xl bg-muted/40 p-3 lg:p-4">
                  <p className="text-sm lg:text-base leading-relaxed">
                    {patient.reason_for_consultation || <span className="text-muted-foreground italic">Sin especificar</span>}
                  </p>
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="hover:shadow-md transition-all">
        <CardHeader className="pb-3">
          <CardTitle className="text-base lg:text-lg flex items-center gap-2">
            <Building2 className="h-4 w-4 lg:h-5 lg:w-5 text-primary" /> Mi consultorio
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 lg:space-y-5">
          <div className="flex items-center gap-4 pb-4 border-b">
            {branding.logoUrl ? (
              <img src={branding.logoUrl} className="h-16 w-16 lg:h-20 lg:w-20 rounded-xl object-cover shadow-md" alt="" />
            ) : (
              <div className="h-16 w-16 lg:h-20 lg:w-20 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                <Building2 className="h-8 w-8 lg:h-10 lg:w-10 text-primary" />
              </div>
            )}
            <div className="min-w-0">
              <p className="font-bold text-base lg:text-lg truncate">{branding.name}</p>
              <p className="text-sm text-muted-foreground capitalize truncate">{branding.specialty}</p>
            </div>
          </div>
          {branding.contactEmail && (
            <div className="flex items-center gap-3 text-sm">
              <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center shrink-0">
                <Mail className="h-4 w-4 text-muted-foreground" />
              </div>
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground">Contacto</p>
                <p className="font-medium truncate">{branding.contactEmail}</p>
              </div>
            </div>
          )}
          <Separator />
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-xl bg-muted/40 p-4 text-center">
              <p className="text-xl font-bold text-primary">{totalSessions}</p>
              <p className="text-xs text-muted-foreground mt-1">Sesiones</p>
            </div>
            <div className="rounded-xl bg-muted/40 p-4 text-center">
              <p className="text-xl font-bold">{upcomingAppointments.length + pastAppointments.length}</p>
              <p className="text-xs text-muted-foreground mt-1">Total citas</p>
            </div>
          </div>
          {headerAction === "logout" && onLogout && (
            <>
              <Separator />
              <Button variant="outline" className="w-full gap-2" onClick={onLogout}>
                <LogOut className="h-4 w-4" /> Cerrar sesión
              </Button>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );

  const tabContent: Record<TabId, JSX.Element> = {
    resumen: <ResumenTab />,
    citas: <CitasTab />,
    historial: <HistorialTab />,
    documentos: (
      <PortalDocuments
        documents={sharedDocuments}
        customTypes={sharedDocTypes}
        loading={sharedDocsLoading}
        isDemo={isDemo}
      />
    ),
    pagos: <PagosTab />,
    perfil: <PerfilTab />,
  };

  return (
    <div className="min-h-screen" style={themeStyle as any}>
      <div className="min-h-screen bg-background text-foreground transition-colors duration-300">
        {/* Demo banner */}
        {isDemo && (
          <div className="bg-primary text-primary-foreground text-center py-2 px-4 text-sm font-medium">
            <Star className="inline h-4 w-4 mr-1 -mt-0.5" />
            Demo — Así ve un paciente su portal personal
          </div>
        )}

        {/* Header */}
        <header className="border-b border-border bg-card sticky top-0 z-20">
          <div className="px-4 lg:px-8 py-3 lg:py-4 flex items-center justify-between">
            <div className="flex items-center gap-3 lg:gap-4 min-w-0">
              {branding.logoUrl ? (
                <img src={branding.logoUrl} className="h-9 w-9 lg:h-10 lg:w-10 rounded-lg object-cover shrink-0" alt="" />
              ) : (
                <Avatar className="h-9 w-9 lg:h-10 lg:w-10 shrink-0">
                  <AvatarFallback className="bg-primary/10 text-primary font-bold">
                    {branding.name.substring(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
              )}
              <div className="min-w-0">
                <h1 className="text-lg lg:text-xl font-bold text-foreground truncate">{branding.name}</h1>
                <p className="text-xs lg:text-sm text-muted-foreground truncate">{branding.specialty}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="icon"
                onClick={onToggleDark}
                className="h-9 w-9 rounded-full"
                title={isDark ? "Cambiar a modo claro" : "Cambiar a modo oscuro"}
              >
                {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
              </Button>
              <InstallAppButton variant="icon-only" className="md:hidden" clinicName={branding.name} />
              <InstallAppButton variant="icon-text" className="hidden md:inline-flex" clinicName={branding.name} />
              <NotificationBell patientId={patient.id} />
              {headerAction === "logout" && onLogout && (
                <Button variant="outline" size="sm" onClick={onLogout} aria-label="Salir" className="gap-2">
                  <LogOut className="h-4 w-4" />
                  <span className="hidden sm:inline">Salir</span>
                </Button>
              )}
              {headerAction === "back" && onBack && (
                <Button variant="outline" size="sm" onClick={onBack} aria-label={backLabel} className="gap-2">
                  <ArrowLeft className="h-4 w-4" />
                  <span className="hidden sm:inline">{backLabel}</span>
                </Button>
              )}
            </div>
          </div>
        </header>

        {/* Optional install banner */}
        {showPwaBannerTop && (
          <div className="px-4 lg:px-8 pt-3">
            <PWAInstallBanner
              variant="inline"
              storageKey="pwa_install_banner_dismissed_patient"
              autoOpenIOS
            />
          </div>
        )}

        {/* Overdue banner — solo en tabs donde no hay otra señal (oculto en Resumen y Pagos) */}
        {overdueCount > 0 && tab !== "resumen" && tab !== "pagos" && (
          <div className="bg-destructive/[0.06] border-b border-destructive/30">
            <div className="px-4 lg:px-8 py-4 lg:py-5 flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-5">
              <div className="flex items-center gap-3 flex-1 min-w-0">
                <div className="h-10 w-10 rounded-full bg-destructive/15 flex items-center justify-center shrink-0">
                  <AlertCircle className="h-5 w-5 text-destructive" />
                </div>
                <p className="text-sm lg:text-base text-foreground leading-snug">
                  {overdueCount === 1
                    ? <>Tenés 1 pago vencido por <span className="font-bold text-destructive">{formatCurrency(overdueTotal, overdueCurrency)}</span></>
                    : <>Tenés {overdueCount} pagos vencidos por un total de <span className="font-bold text-destructive">{formatCurrency(overdueTotal, overdueCurrency)}</span></>}
                </p>
              </div>
              {mpConnected && onPayPayments && (
                <Button
                  size="sm"
                  variant="destructive"
                  className="gap-2 min-h-11 w-full sm:w-auto shrink-0"
                  onClick={handleBannerPay}
                  disabled={payingAny}
                >
                  {payingAny ? <Loader2 className="h-4 w-4 animate-spin" /> : <CreditCard className="h-4 w-4" />}
                  {payingAny ? "Procesando..." : "Pagar ahora"}
                </Button>
              )}
            </div>
          </div>
        )}

        <div className="lg:flex lg:gap-0 min-h-[calc(100vh-6rem)]">
          {/* Desktop Sidebar */}
          <aside className="hidden lg:flex lg:flex-col w-72 shrink-0 border-r border-border bg-card/80 backdrop-blur-sm sticky top-16 self-start h-[calc(100vh-4rem)]">
            <nav className="p-4 space-y-1">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider px-3 mb-3">Navegación</p>
              {TABS.map(t => {
                const Icon = t.icon;
                const isActive = tab === t.id;
                return (
                  <button
                    key={t.id}
                    onClick={() => setTab(t.id)}
                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all ${
                      isActive
                        ? "bg-primary/10 text-primary shadow-sm"
                        : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
                    }`}
                  >
                    <Icon className={`h-5 w-5 ${isActive ? "text-primary" : ""}`} />
                    {t.label}
                    {t.id === "pagos" && pendingCount > 0 && (
                      <span className="ml-auto bg-destructive text-destructive-foreground text-xs rounded-full h-5 w-5 flex items-center justify-center">
                        {pendingCount}
                      </span>
                    )}
                  </button>
                );
              })}
            </nav>

            <div className="mt-auto p-4 border-t border-border">
              <div className="flex items-center gap-3">
                <Avatar className="h-10 w-10">
                  {patient.avatar_url ? <AvatarImage src={patient.avatar_url} /> : null}
                  <AvatarFallback className="bg-primary/10 text-primary font-bold text-sm">{initials}</AvatarFallback>
                </Avatar>
                <div className="min-w-0">
                  <p className="font-medium text-sm truncate text-foreground">{patient.full_name}</p>
                  <p className="text-xs text-muted-foreground truncate">{patient.email || ""}</p>
                </div>
              </div>
            </div>
          </aside>

          {/* Mobile Bottom Nav */}
          <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-50 border-t border-border bg-card/95 backdrop-blur-xl safe-area-bottom">
            <div className="flex justify-around items-end px-1 pt-1.5 pb-2">
              {TABS.map(t => {
                const Icon = t.icon;
                const isActive = tab === t.id;
                return (
                  <button
                    key={t.id}
                    onClick={() => setTab(t.id)}
                    className={`relative flex flex-col items-center gap-0.5 px-3 py-1 text-[10px] font-medium transition-all ${
                      isActive ? "text-primary scale-105" : "text-muted-foreground"
                    }`}
                  >
                    <div className={`p-1.5 rounded-xl transition-colors ${isActive ? "bg-primary/12" : ""}`}>
                      <Icon className={`h-5 w-5 ${isActive ? "text-primary" : ""}`} />
                    </div>
                    <span>{t.label}</span>
                    {t.id === "pagos" && pendingCount > 0 && (
                      <span className="absolute top-0 right-0 bg-destructive text-destructive-foreground text-[9px] rounded-full h-4 w-4 flex items-center justify-center font-bold">
                        {pendingCount}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </nav>

          {/* Main */}
          <main className="flex-1 min-w-0 px-4 lg:px-8 xl:px-10 py-4 lg:py-8 pb-24 lg:pb-8 max-w-[1440px]">
            {/* Mobile welcome */}
            <div className="lg:hidden flex items-center gap-3 mb-4">
              <Avatar className="h-10 w-10">
                {patient.avatar_url ? <AvatarImage src={patient.avatar_url} /> : null}
                <AvatarFallback className="bg-primary/10 text-primary font-bold text-sm">{initials}</AvatarFallback>
              </Avatar>
              <div className="min-w-0">
                <p className="font-semibold text-sm text-foreground truncate">Hola, {firstName} 👋</p>
                <p className="text-xs text-muted-foreground truncate">{branding.name}</p>
              </div>
            </div>

            {tabContent[tab]}
          </main>
        </div>

        {extras}

        {/* Cancel confirmation dialog */}
        <AlertDialog open={!!cancelTarget} onOpenChange={(o) => !o && setCancelTarget(null)}>
          <AlertDialogContent className="max-w-md">
            <AlertDialogHeader>
              <AlertDialogTitle>¿Cancelar esta cita?</AlertDialogTitle>
              <AlertDialogDescription asChild>
                {/* Dentro del plazo: confirmación normal. Fuera del plazo (por
                    si el diálogo quedó abierto justo en el borde): sin botón de
                    confirmar — la base además lo rechaza (trigger). */}
                {cancelTarget && isLateCancellation(cancelTarget) ? (
                  <div className="space-y-3">
                    <div className="rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/60 p-3 text-sm text-amber-700 dark:text-amber-300">
                      {branding.lateCancellationMessage?.trim() ||
                        `Faltan menos de ${cancellationHoursNotice} horas para tu cita, así que ya no se puede cancelar desde acá.`}
                    </div>
                    <p>
                      Para cancelar con menos de {cancellationHoursNotice} horas de anticipación,
                      contactá directamente a tu profesional.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <p>
                      Si necesitás reprogramarla, podés usar el botón "Reprogramar" en lugar de cancelar.
                    </p>
                    <div className="space-y-1.5">
                      <label className="text-xs font-medium text-foreground">
                        ¿Querés contarle al profesional el motivo? (opcional)
                      </label>
                      <Textarea
                        value={cancelReason}
                        onChange={(e) => setCancelReason(e.target.value)}
                        placeholder="Motivo de la cancelación..."
                        rows={3}
                        className="resize-none text-sm"
                      />
                    </div>
                  </div>
                )}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter className="gap-2 sm:gap-2">
              <AlertDialogCancel disabled={cancelSubmitting} className="mt-0">
                {cancelTarget && isLateCancellation(cancelTarget) ? "Entendido" : "Volver"}
              </AlertDialogCancel>
              {!(cancelTarget && isLateCancellation(cancelTarget)) && (
                <AlertDialogAction
                  onClick={(e) => { e.preventDefault(); confirmCancel(); }}
                  disabled={cancelSubmitting}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  {cancelSubmitting ? "Cancelando..." : "Confirmar cancelación"}
                </AlertDialogAction>
              )}
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
}

export default PatientPortalView;