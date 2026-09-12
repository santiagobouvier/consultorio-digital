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

  // =============================================
  // PANTALLA ÚNICA — sin pestañas. Todo lo que el paciente necesita, en una
  // sola columna con scroll: próxima cita → reservar → pagos → sesiones →
  // documentos → datos → avisos y contacto. Hipersencillo a propósito.
  // =============================================

  // "Agregar a mi calendario": link de Google + .ics (hora de Uruguay, UTC-3)
  const uyCompact = (iso: string) => {
    const t = new Date(new Date(iso).getTime() - 3 * 3600 * 1000);
    const p = (n: number) => String(n).padStart(2, "0");
    return `${t.getUTCFullYear()}${p(t.getUTCMonth() + 1)}${p(t.getUTCDate())}T${p(t.getUTCHours())}${p(t.getUTCMinutes())}00`;
  };
  const aptCalTitle = (apt: PortalAppointment) => `${apt.service_name || "Sesión"} — ${branding.name}`;
  const googleCalHref = (apt: PortalAppointment) =>
    `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(aptCalTitle(apt))}&dates=${uyCompact(apt.start_at)}/${uyCompact(apt.end_at)}&ctz=America/Montevideo`;
  const downloadAptIcs = (apt: PortalAppointment) => {
    const ics = [
      "BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Consultorio Digital//Portal//ES", "BEGIN:VEVENT",
      `UID:${apt.id}@consultoriodigital.app`,
      `DTSTART:${uyCompact(apt.start_at)}`,
      `DTEND:${uyCompact(apt.end_at)}`,
      `SUMMARY:${aptCalTitle(apt).replace(/([,;\\])/g, "\\$1")}`,
      "END:VEVENT", "END:VCALENDAR",
    ].join("\r\n");
    const blob = new Blob([ics], { type: "text/calendar;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "cita.ics";
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
  };

  // Derivados de la pantalla única
  const nextApt = upcomingAppointments[0] ?? null;
  const laterApts = upcomingAppointments.slice(1);
  const [openSessionId, setOpenSessionId] = useState<string | null>(null);
  const [showAllSessions, setShowAllSessions] = useState(false);
  const [showPaidHistory, setShowPaidHistory] = useState(false);

  const pastSorted = useMemo(
    () => [...pastAppointments].sort((a, b) => +parseISO(b.start_at) - +parseISO(a.start_at)),
    [pastAppointments],
  );
  const visibleSessions = showAllSessions ? pastSorted : pastSorted.slice(0, 6);

  const whenLabel = (iso: string) => {
    const d = parseISO(iso);
    if (isToday(d)) return "Hoy";
    if (isTomorrow(d)) return "Mañana";
    const days = differenceInCalendarDays(d, new Date());
    if (days > 1 && days <= 6) return format(d, "EEEE", { locale: es });
    return format(d, "EEEE d 'de' MMMM", { locale: es });
  };

  const nextPay = nextApt ? paymentByAppointment.get(nextApt.id) : undefined;
  const nextPayable = !!nextPay && isPayablePayment(nextPay.status) && mpConnected;

  const SectionTitle = ({ children }: { children: React.ReactNode }) => (
    <h2 className="text-[12px] font-semibold uppercase tracking-[0.12em] text-muted-foreground mb-2.5">
      {children}
    </h2>
  );

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
          <div className="max-w-2xl mx-auto px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-3 min-w-0">
              {branding.logoUrl ? (
                <img src={branding.logoUrl} className="h-9 w-9 rounded-lg object-cover shrink-0" alt="" />
              ) : (
                <Avatar className="h-9 w-9 shrink-0">
                  <AvatarFallback className="bg-primary/10 text-primary font-bold">
                    {branding.name.substring(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
              )}
              <div className="min-w-0">
                <h1 className="text-base font-bold text-foreground truncate leading-tight">{branding.name}</h1>
                <p className="text-xs text-muted-foreground truncate">{branding.specialty}</p>
              </div>
            </div>
            <div className="flex items-center gap-1.5">
              <Button
                variant="ghost"
                size="icon"
                onClick={onToggleDark}
                className="h-9 w-9 rounded-full"
                title={isDark ? "Cambiar a modo claro" : "Cambiar a modo oscuro"}
              >
                {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
              </Button>
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
          <div className="max-w-2xl mx-auto px-4 pt-3">
            <PWAInstallBanner
              variant="inline"
              storageKey="pwa_install_banner_dismissed_patient"
              autoOpenIOS
            />
          </div>
        )}

        <main className="max-w-2xl mx-auto px-4 py-5 sm:py-7 space-y-7 pb-16">
          {/* Saludo */}
          <div className="flex items-center gap-3">
            <Avatar className="h-11 w-11">
              {patient.avatar_url ? <AvatarImage src={patient.avatar_url} /> : null}
              <AvatarFallback className="bg-primary/10 text-primary font-bold">{initials}</AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <p className="font-bold text-lg text-foreground truncate leading-tight">Hola, {firstName} 👋</p>
              <p className="text-xs text-muted-foreground truncate">
                {totalSessions > 0 ? `Llevás ${totalSessions} ${totalSessions === 1 ? "sesión" : "sesiones"} con ${branding.name}` : `Tu espacio en ${branding.name}`}
              </p>
            </div>
          </div>

          <NotificationsSummaryCard patientId={patient.id} />

          {/* Pagos vencidos: lo primero que se ve si existe */}
          {overdueCount > 0 && (
            <div className="rounded-2xl border border-destructive/30 bg-destructive/[0.06] p-4 flex flex-col sm:flex-row sm:items-center gap-3">
              <div className="flex items-center gap-3 flex-1 min-w-0">
                <div className="h-10 w-10 rounded-full bg-destructive/15 flex items-center justify-center shrink-0">
                  <AlertCircle className="h-5 w-5 text-destructive" />
                </div>
                <p className="text-sm leading-snug m-0">
                  {overdueCount === 1
                    ? <>Tenés 1 pago vencido por <span className="font-bold text-destructive">{formatCurrency(overdueTotal, overdueCurrency)}</span></>
                    : <>Tenés {overdueCount} pagos vencidos por <span className="font-bold text-destructive">{formatCurrency(overdueTotal, overdueCurrency)}</span></>}
                </p>
              </div>
              {mpConnected && onPayPayments && (
                <Button
                  size="sm"
                  variant="destructive"
                  className="gap-2 min-h-11 w-full sm:w-auto shrink-0"
                  onClick={() => onPayPayments(sortedOverdue.map((p) => p.id))}
                  disabled={payingAny}
                >
                  {payingAny ? <Loader2 className="h-4 w-4 animate-spin" /> : <CreditCard className="h-4 w-4" />}
                  {payingAny ? "Procesando..." : "Pagar ahora"}
                </Button>
              )}
            </div>
          )}

          {/* ── Tu próxima cita ── */}
          <section>
            <SectionTitle>Tu próxima cita</SectionTitle>
            {nextApt ? (
              <Card className="rounded-2xl overflow-hidden">
                <CardContent className="p-5 space-y-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-xl font-bold capitalize leading-tight m-0">
                        {whenLabel(nextApt.start_at)} · {format(parseISO(nextApt.start_at), "HH:mm")} hs
                      </p>
                      <p className="text-sm text-muted-foreground mt-1 m-0">
                        {nextApt.service_name || "Sesión"}
                        {" · "}
                        {nextApt.modality === "online" ? "Online" : nextApt.location || "Presencial"}
                      </p>
                    </div>
                    {statusBadge(nextApt.status)}
                  </div>

                  {nextPay && (
                    <div className="flex items-center justify-between gap-3 rounded-xl bg-muted/40 border border-border/60 px-3.5 py-2.5">
                      <span className="text-sm">
                        {formatCurrency(Number(nextPay.amount), nextPay.currency || "UYU")} · {nextPay.status === "paid" ? "sesión paga ✓" : pendingText(nextPay.due_date)}
                      </span>
                      {nextPay.status !== "paid" && nextPayable && (
                        <Button
                          size="sm"
                          className="gap-1.5 shrink-0"
                          onClick={() => paySinglePayment(nextPay)}
                          disabled={isPaymentProcessing(nextPay)}
                        >
                          {isPaymentProcessing(nextPay) ? <Loader2 className="h-4 w-4 animate-spin" /> : <CreditCard className="h-4 w-4" />}
                          Pagar
                        </Button>
                      )}
                    </div>
                  )}

                  {/* Un toque y la cita queda en SU calendario */}
                  <div className="grid grid-cols-2 gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-1.5 min-h-10"
                      onClick={() => window.open(googleCalHref(nextApt), "_blank", "noopener")}
                    >
                      <Calendar className="h-4 w-4" /> Google Calendar
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-1.5 min-h-10"
                      onClick={() => downloadAptIcs(nextApt)}
                    >
                      <Smartphone className="h-4 w-4" /> iPhone / otro
                    </Button>
                  </div>

                  {(onRescheduleAppointment || onCancelAppointment) && (
                    <div className="flex items-center justify-end gap-1 pt-1 border-t border-border/60">
                      {onRescheduleAppointment && (
                        <Button variant="ghost" size="sm" className="gap-1.5 text-muted-foreground" onClick={() => onRescheduleAppointment(nextApt)}>
                          <RefreshCw className="h-3.5 w-3.5" /> Reprogramar
                        </Button>
                      )}
                      {onCancelAppointment && (
                        <Button variant="ghost" size="sm" className="gap-1.5 text-muted-foreground hover:text-destructive" onClick={() => openCancelDialog(nextApt)}>
                          <XCircle className="h-3.5 w-3.5" /> Cancelar
                        </Button>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            ) : (
              <Card className="rounded-2xl">
                <CardContent className="p-6 text-center space-y-3">
                  <div className="w-12 h-12 mx-auto rounded-full bg-primary/10 flex items-center justify-center">
                    <Calendar className="h-6 w-6 text-primary" />
                  </div>
                  <p className="text-sm text-muted-foreground m-0">No tenés ninguna cita agendada.</p>
                </CardContent>
              </Card>
            )}

            {/* Las que vienen después, en una línea cada una */}
            {laterApts.length > 0 && (
              <div className="mt-2.5 space-y-1.5">
                {laterApts.map((apt) => (
                  <div key={apt.id} className="flex items-center gap-3 rounded-xl border border-border/60 bg-card px-3.5 py-2.5">
                    <Clock className="h-4 w-4 text-muted-foreground shrink-0" />
                    <span className="text-sm capitalize truncate">
                      {whenLabel(apt.start_at)} · {format(parseISO(apt.start_at), "HH:mm")} hs
                    </span>
                    <span className="ml-auto shrink-0">{statusBadge(apt.status)}</span>
                  </div>
                ))}
              </div>
            )}

            {onBookAppointment && (
              <Button
                className="w-full min-h-12 mt-3 gap-2 rounded-xl text-[15px] font-semibold"
                variant={nextApt ? "outline" : "default"}
                onClick={onBookAppointment}
              >
                <Plus className="h-4 w-4" />
                Reservar una cita
              </Button>
            )}
          </section>

          {/* ── Pagos ── */}
          {(pendingPayments.length > 0 || paidPayments.length > 0) && (
            <section ref={overdueSectionRef}>
              <SectionTitle>Tus pagos</SectionTitle>
              {pendingPayments.length > 0 ? (
                <div className="space-y-2">
                  {[...sortedOverdue, ...sortedPending].map((p) => (
                    <div key={p.id} className={`flex items-center gap-3 rounded-xl border px-3.5 py-3 bg-card ${p.status === "overdue" ? "border-destructive/40" : "border-border/60"}`}>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold m-0">{formatCurrency(Number(p.amount), p.currency || "UYU")}</p>
                        <p className={`text-xs m-0 ${p.status === "overdue" ? "text-destructive font-medium" : "text-muted-foreground"}`}>
                          {p.recurrence_label || "Sesión"} · {pendingText(p.due_date)}
                        </p>
                      </div>
                      {mpConnected && isPayablePayment(p.status) && (
                        <Button
                          size="sm"
                          variant={p.status === "overdue" ? "destructive" : "default"}
                          className="gap-1.5 shrink-0 min-h-10"
                          onClick={() => paySinglePayment(p)}
                          disabled={isPaymentProcessing(p)}
                        >
                          {isPaymentProcessing(p) ? <Loader2 className="h-4 w-4 animate-spin" /> : <CreditCard className="h-4 w-4" />}
                          Pagar
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex items-center gap-2.5 rounded-xl border border-border/60 bg-card px-3.5 py-3">
                  <CheckCircle2 className="h-4 w-4 text-primary shrink-0" />
                  <span className="text-sm text-muted-foreground">Estás al día con tus pagos.</span>
                </div>
              )}

              {paidPayments.length > 0 && (
                <div className="mt-2">
                  <button
                    onClick={() => setShowPaidHistory((v) => !v)}
                    className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors py-1.5"
                  >
                    <ChevronRight className={`h-3.5 w-3.5 transition-transform ${showPaidHistory ? "rotate-90" : ""}`} />
                    {showPaidHistory ? "Ocultar pagos anteriores" : `Ver pagos anteriores (${paidPayments.length})`}
                  </button>
                  {showPaidHistory && (
                    <div className="space-y-1.5 mt-1">
                      {paidPayments.slice(0, paidHistoryLimit).map((p) => (
                        <div key={p.id} className="flex items-center gap-3 rounded-xl border border-border/60 bg-card px-3.5 py-2.5">
                          <div className="min-w-0 flex-1">
                            <p className="text-sm m-0">{formatCurrency(Number(p.amount), p.currency || "UYU")}</p>
                            <p className="text-xs text-muted-foreground m-0">
                              {formatShort(parseISO(p.paid_at || p.due_date))}
                            </p>
                          </div>
                          {payBadge(p.status)}
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-8 w-8 p-0 rounded-lg text-muted-foreground shrink-0"
                            title="Descargar comprobante"
                            onClick={() => handleDownloadReceipt(p)}
                          >
                            <Download className="h-4 w-4" />
                          </Button>
                        </div>
                      ))}
                      {paidPayments.length > paidHistoryLimit && (
                        <Button variant="ghost" size="sm" className="w-full text-muted-foreground" onClick={() => setPaidHistoryLimit((n) => n + 10)}>
                          Ver más
                        </Button>
                      )}
                    </div>
                  )}
                </div>
              )}
            </section>
          )}

          {/* ── Tus sesiones ── */}
          {pastSorted.length > 0 && (
            <section>
              <SectionTitle>Tus sesiones</SectionTitle>
              <div className="space-y-1.5">
                {visibleSessions.map((apt) => {
                  const docs = sharedDocsByAppointment.get(apt.id) ?? [];
                  const hasDetail = !!apt.notes || docs.length > 0;
                  const openThis = openSessionId === apt.id;
                  return (
                    <div key={apt.id} className="rounded-xl border border-border/60 bg-card overflow-hidden">
                      <button
                        className="w-full flex items-center gap-3 px-3.5 py-3 text-left"
                        onClick={() => hasDetail && setOpenSessionId(openThis ? null : apt.id)}
                        disabled={!hasDetail}
                      >
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium m-0">{formatShort(parseISO(apt.start_at))}</p>
                          <p className="text-xs text-muted-foreground m-0">{apt.service_name || "Sesión"}</p>
                        </div>
                        {statusBadge(apt.status)}
                        {hasDetail && (
                          <ChevronRight className={`h-4 w-4 text-muted-foreground shrink-0 transition-transform ${openThis ? "rotate-90" : ""}`} />
                        )}
                      </button>
                      {openThis && (
                        <div className="px-3.5 pb-3.5 pt-1 border-t border-border/50 space-y-3">
                          {apt.notes && (
                            <div>
                              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">
                                Indicación de tu profesional
                              </p>
                              <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap m-0">{apt.notes}</p>
                            </div>
                          )}
                          {docs.map((doc) => {
                            const { Icon } = resolveDocType(doc.document_type, sharedDocTypes);
                            return (
                              <div key={doc.id} className="flex items-center gap-2 rounded-lg border border-border/60 bg-muted/30 px-2.5 py-2">
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
                    </div>
                  );
                })}
              </div>
              {pastSorted.length > 6 && !showAllSessions && (
                <Button variant="ghost" size="sm" className="w-full mt-1.5 text-muted-foreground" onClick={() => setShowAllSessions(true)}>
                  Ver todas ({pastSorted.length})
                </Button>
              )}
            </section>
          )}

          {/* ── Documentos generales (sin sesión asociada también) ── */}
          {(sharedDocsLoading || sharedDocuments.length > 0) && (
            <section>
              <SectionTitle>Tus documentos</SectionTitle>
              <PortalDocuments
                documents={sharedDocuments}
                customTypes={sharedDocTypes}
                loading={sharedDocsLoading}
                isDemo={isDemo}
              />
            </section>
          )}

          {/* ── Tus datos ── */}
          <section>
            <SectionTitle>Tus datos</SectionTitle>
            <Card className="rounded-2xl">
              <CardContent className="p-5">
                {!isEditingProfile ? (
                  <div className="space-y-3">
                    <div className="flex items-center gap-3">
                      <Avatar className="h-12 w-12">
                        {patient.avatar_url ? <AvatarImage src={patient.avatar_url} /> : null}
                        <AvatarFallback className="bg-primary/10 text-primary font-bold">{initials}</AvatarFallback>
                      </Avatar>
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold text-sm m-0 truncate">{patient.full_name}</p>
                        <p className="text-xs text-muted-foreground m-0 truncate">{patient.email || "Sin email"}</p>
                        <p className="text-xs text-muted-foreground m-0 truncate">{patient.whatsapp_phone || "Sin teléfono"}</p>
                      </div>
                      {onSaveProfile && (
                        <Button variant="outline" size="sm" className="gap-1.5 shrink-0" onClick={startEditing}>
                          <Edit2 className="h-3.5 w-3.5" /> Editar
                        </Button>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="flex items-center gap-3">
                      <button className="relative shrink-0" onClick={() => fileInputRef.current?.click()} title="Cambiar foto">
                        <Avatar className="h-14 w-14">
                          {previewAvatar ? <AvatarImage src={previewAvatar} /> : null}
                          <AvatarFallback className="bg-primary/10 text-primary font-bold">{initials}</AvatarFallback>
                        </Avatar>
                        <span className="absolute -bottom-1 -right-1 h-6 w-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center">
                          <Camera className="h-3 w-3" />
                        </span>
                      </button>
                      <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarChange} />
                      <p className="text-xs text-muted-foreground m-0">Tocá la foto para cambiarla</p>
                    </div>
                    <Input
                      value={editForm.full_name}
                      onChange={(e) => setEditForm((f) => ({ ...f, full_name: e.target.value }))}
                      placeholder="Nombre completo"
                    />
                    <Input
                      value={editForm.email}
                      onChange={(e) => setEditForm((f) => ({ ...f, email: e.target.value }))}
                      placeholder="Email"
                      type="email"
                    />
                    <Input
                      value={editForm.whatsapp_phone}
                      onChange={(e) => setEditForm((f) => ({ ...f, whatsapp_phone: e.target.value }))}
                      placeholder="WhatsApp (ej: 099 123 456)"
                    />
                    <Textarea
                      value={editForm.reason_for_consultation}
                      onChange={(e) => setEditForm((f) => ({ ...f, reason_for_consultation: e.target.value }))}
                      placeholder="Motivo de consulta (opcional)"
                      rows={2}
                      className="resize-none text-sm"
                    />
                    <div className="flex gap-2 justify-end">
                      <Button variant="ghost" size="sm" onClick={cancelEditing} disabled={savingProfile} className="gap-1.5">
                        <X className="h-3.5 w-3.5" /> Cancelar
                      </Button>
                      <Button size="sm" onClick={handleSaveProfile} disabled={savingProfile} className="gap-1.5">
                        {savingProfile ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                        Guardar
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </section>

          {/* ── Avisos + app + contacto ── */}
          <section className="space-y-3">
            <NotificationActivationCard variant="full" audience="patient" />
            <div className="flex flex-col items-center gap-3 pt-2 text-center">
              <InstallAppButton variant="icon-text" clinicName={branding.name} />
              {branding.contactEmail && (
                <p className="text-xs text-muted-foreground m-0 inline-flex items-center gap-1.5">
                  <Mail className="h-3.5 w-3.5" /> {branding.contactEmail}
                </p>
              )}
            </div>
          </section>
        </main>

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
