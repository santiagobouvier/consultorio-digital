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
import { NotificationActivationCard } from "@/components/NotificationActivationCard";
import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import {
  User, Calendar, CreditCard, Clock, MapPin, Video,
  Phone, Mail, Building2, FileText,
  LayoutDashboard, Heart, TrendingUp, CalendarCheck,
  ChevronRight, CheckCircle2, AlertCircle, Sun, Moon,
  Download, Smartphone, Camera, Save, Edit2, X, LogOut, Plus,
  Loader2, Star, ArrowLeft, RefreshCw, XCircle,
} from "lucide-react";
import { formatCurrency } from "@/lib/payments";

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
  return <Badge variant="secondary">Pendiente</Badge>;
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
    headerAction = "none", onLogout, onBack,
    onBookAppointment, onCancelAppointment, onRescheduleAppointment,
    onSaveProfile, onPaySession,
    payingAppointmentId = null,
    onPayPayments, payingPaymentIds = [], mpConnected = false, focusOverdueTick = 0,
    extras,
  } = props;

  const [tab, setTab] = useState<TabId>("resumen");
  const overdueSectionRef = useRef<HTMLDivElement>(null);

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

        {/* Welcome (desktop, inline) */}
        <div className="flex items-center gap-4">
          <Avatar className="h-14 w-14 lg:h-16 lg:w-16 border-2 border-primary/30 shadow-lg shadow-primary/10">
            {patient.avatar_url ? <AvatarImage src={patient.avatar_url} /> : null}
            <AvatarFallback className="text-xl font-bold bg-gradient-to-tr from-primary to-primary/70 text-primary-foreground">
              {initials}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <h2 className="text-2xl lg:text-3xl font-bold tracking-tight text-foreground">
              Hola, {firstName} <span className="inline-block">👋</span>
            </h2>
            <p className="text-sm lg:text-base text-muted-foreground">
              Bienvenido/a a tu portal de {branding.name}.
            </p>
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
                  <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 border border-primary/20 text-primary text-xs font-medium">
                    <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
                    Próxima cita
                  </div>
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
                  {onBookAppointment && (
                    <Button variant="outline" onClick={onBookAppointment} className="gap-2">
                      <Plus className="h-4 w-4" /> Reservar otra cita
                    </Button>
                  )}
                  {upcomingAppointments[0].status !== "reschedule_requested" && (onRescheduleAppointment || onCancelAppointment) && (
                    <div className="grid grid-cols-2 gap-2">
                      {onRescheduleAppointment && (
                        <Button variant="outline" size="sm" onClick={() => onRescheduleAppointment(upcomingAppointments[0])} className="gap-1.5">
                          <RefreshCw className="h-3.5 w-3.5" /> Reprogramar
                        </Button>
                      )}
                      {onCancelAppointment && (
                        <Button variant="outline" size="sm" onClick={() => openCancelDialog(upcomingAppointments[0])} className="gap-1.5 text-destructive border-destructive/30 hover:bg-destructive/10 hover:text-destructive">
                          <XCircle className="h-3.5 w-3.5" /> Cancelar
                        </Button>
                      )}
                    </div>
                  )}
                  <Button variant="ghost" size="sm" onClick={() => setTab("citas")} className="gap-1 text-xs">
                    Ver todas <ChevronRight className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Notas del profesional */}
        <Card className="hover:shadow-md transition-all">
          <CardHeader className="pb-3">
            <CardTitle className="text-base lg:text-lg flex items-center gap-2">
              <Heart className="h-5 w-5 text-primary" /> Notas de tu profesional
            </CardTitle>
          </CardHeader>
          <CardContent>
            {patient.private_notes ? (
              <div className="rounded-xl bg-muted/50 p-4 lg:p-5">
                <p className="text-sm lg:text-base text-muted-foreground leading-relaxed whitespace-pre-wrap italic">
                  "{patient.private_notes}"
                </p>
              </div>
            ) : (
              <div className="text-center py-6">
                <Heart className="h-10 w-10 text-muted-foreground/40 mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">Aún no hay notas para mostrar</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* RIGHT (4/12) */}
      <div className="lg:col-span-4 flex flex-col gap-4 lg:gap-5">
        {/* Stats compactos — "Pendientes" cuenta solo los no vencidos (los vencidos los muestra la card alerta grande) */}
        <div className="grid grid-cols-3 gap-2 lg:gap-3">
          {[
            { value: upcomingAppointments.length, label: "Próximas", tone: "neutral" as const },
            { value: totalSessions, label: "Sesiones", tone: "neutral" as const },
            {
              value: nonOverdueCount,
              label: "Pendientes",
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

            <NotificationActivationCard variant="full" />
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
                    <div className="grid grid-cols-2 gap-2">
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
                      {onCancelAppointment && (
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
          {pastAppointments.map((apt, idx) => (
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
                      </div>
                    </div>
                    <div className="flex-1 min-w-0">
                      {apt.service_name && <p className="text-xs text-primary font-medium mb-1.5">{apt.service_name}</p>}
                      {apt.notes ? (
                        <div className="rounded-xl bg-muted/40 p-3">
                          <p className="text-xs lg:text-sm text-foreground leading-relaxed whitespace-pre-wrap">{apt.notes}</p>
                        </div>
                      ) : (
                        <p className="text-xs text-muted-foreground italic">Sin notas para esta sesión</p>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  // ========= PagosTab =========
  const PagosTab = () => (
    <div className="space-y-4 lg:space-y-6">
      {/* Sección de vencidos */}
      {overdueCount > 0 && mpConnected && onPayPayments && (
        <div ref={overdueSectionRef}>
          <Card className="border-destructive/30 bg-destructive/5 rounded-2xl">
            <CardContent className="p-4 lg:p-5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="h-10 w-10 rounded-full bg-destructive/15 flex items-center justify-center shrink-0">
                    <AlertCircle className="h-5 w-5 text-destructive" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm lg:text-base font-bold text-destructive">
                      Pagos vencidos ({overdueCount})
                    </p>
                    <p className="text-xs lg:text-sm text-muted-foreground">
                      Total: <span className="font-bold text-foreground">{formatCurrency(overdueTotal, overdueCurrency)}</span>
                    </p>
                  </div>
                </div>
                <Button
                  onClick={() => onPayPayments(overduePayments.map(p => p.id))}
                  disabled={payingAny}
                  className="gap-2 min-h-11 sm:w-auto w-full"
                >
                  {payingAny ? <Loader2 className="h-4 w-4 animate-spin" /> : <CreditCard className="h-4 w-4" />}
                  {payingAny ? "Procesando..." : (overdueCount === 1 ? "Pagar ahora" : "Pagar todos")}
                </Button>
              </div>
              <ul className="text-xs lg:text-sm text-muted-foreground space-y-1 pl-1">
                {overduePayments.map(p => (
                  <li key={p.id} className="flex items-center justify-between gap-2">
                    <span className="truncate">{p.notes || p.recurrence_label} · vence {formatShort(parseISO(p.due_date))}</span>
                    <span className="font-semibold text-foreground shrink-0">{formatCurrency(Number(p.amount), p.currency || "UYU")}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </div>
      )}

      {payments.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <CreditCard className="h-12 w-12 text-muted-foreground/40 mx-auto mb-3" />
            <p className="text-muted-foreground font-medium">No hay pagos registrados</p>
            <p className="text-xs text-muted-foreground mt-1">Tu historial de pagos aparecerá acá.</p>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Desktop table */}
          <div className="hidden lg:block">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  <CreditCard className="h-5 w-5 text-primary" /> Detalle de pagos
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="border rounded-xl overflow-hidden">
                  <div className="grid grid-cols-5 gap-4 px-5 py-3 bg-muted/50 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    <span>Concepto</span><span>Monto</span><span>Vencimiento</span><span>Estado</span><span>Fecha de pago</span>
                  </div>
                  {payments.map((p, i) => {
                    const hasAppt = !!p.appointment_id;
                    const isProcessing = hasAppt
                      ? payingAppointmentId === p.appointment_id
                      : payingPaymentIds.includes(p.id);
                    const showPay = mpConnected && isPayablePayment(p.status)
                      && (hasAppt ? !!onPaySession : !!onPayPayments);
                    const handleClick = () => {
                      if (hasAppt && onPaySession) onPaySession(p.appointment_id!);
                      else if (onPayPayments) onPayPayments([p.id]);
                    };
                    return (
                      <div key={p.id} className={`grid grid-cols-5 gap-4 px-5 py-4 items-center text-sm ${i !== payments.length - 1 ? "border-b" : ""} hover:bg-muted/30 transition-colors`}>
                        <span className="font-medium">{p.notes || p.recurrence_label}</span>
                        <span className="font-semibold">{formatCurrency(Number(p.amount), p.currency || "UYU")}</span>
                        <span className="text-muted-foreground">{formatShort(parseISO(p.due_date))}</span>
                        <span className="flex items-center gap-2">
                          {payBadge(p.status)}
                          {showPay && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-8 px-3 gap-1.5"
                              onClick={handleClick}
                              disabled={isProcessing || payingAny}
                            >
                              {isProcessing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CreditCard className="h-3.5 w-3.5" />}
                              {isProcessing ? "..." : (hasAppt ? "Pagar sesión" : "Pagar online")}
                            </Button>
                          )}
                        </span>
                        <span className="text-muted-foreground">{p.paid_at ? formatShort(parseISO(p.paid_at)) : "—"}</span>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Mobile cards */}
          <div className="lg:hidden space-y-3">
            <h3 className="text-base font-bold flex items-center gap-2">
              <CreditCard className="h-4 w-4 text-primary" /> Detalle de pagos
            </h3>
            {payments.map(p => (
              <Card key={p.id} className="hover:shadow-md transition-all overflow-hidden">
                <div className={`h-0.5 ${p.status === "paid" ? "bg-primary" : p.status === "overdue" ? "bg-destructive" : "bg-muted-foreground"}`} />
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div>
                      <p className="font-bold text-base">{formatCurrency(Number(p.amount), p.currency || "UYU")}</p>
                      <p className="text-xs font-medium text-foreground/80 mt-0.5">{p.notes || p.recurrence_label}</p>
                    </div>
                    {payBadge(p.status)}
                  </div>
                  <Separator className="my-2" />
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>Vence: {formatShort(parseISO(p.due_date))}</span>
                    {p.paid_at && <span className="text-primary">✓ Pagado: {formatShort(parseISO(p.paid_at))}</span>}
                  </div>
                  {mpConnected && isPayablePayment(p.status) && (() => {
                    const hasAppt = !!p.appointment_id;
                    const isProcessing = hasAppt
                      ? payingAppointmentId === p.appointment_id
                      : payingPaymentIds.includes(p.id);
                    const disabled = isProcessing || payingAny;
                    const handleClick = () => {
                      if (hasAppt && onPaySession) onPaySession(p.appointment_id!);
                      else if (onPayPayments) onPayPayments([p.id]);
                    };
                    if (hasAppt ? !onPaySession : !onPayPayments) return null;
                    return (
                      <Button
                        size="sm"
                        className="w-full gap-2 mt-3 min-h-11"
                        onClick={handleClick}
                        disabled={disabled}
                      >
                        {isProcessing ? <Loader2 className="h-4 w-4 animate-spin" /> : <CreditCard className="h-4 w-4" />}
                        {isProcessing ? "Procesando..." : (hasAppt ? "Pagar sesión" : "Pagar online")}
                      </Button>
                    );
                  })()}
                </CardContent>
              </Card>
            ))}
          </div>
        </>
      )}
    </div>
  );

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
              {headerAction === "logout" && onLogout && (
                <Button variant="outline" size="sm" onClick={onLogout} className="gap-2">
                  <LogOut className="h-4 w-4" />
                  <span className="hidden sm:inline">Salir</span>
                </Button>
              )}
              {headerAction === "back" && onBack && (
                <Button variant="outline" size="sm" onClick={onBack} className="gap-2">
                  <ArrowLeft className="h-4 w-4" />
                  <span className="hidden sm:inline">Volver</span>
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

        {/* Persistent overdue banner — visible on all tabs */}
        {overdueCount > 0 && (
          <div className="px-4 lg:px-8 pt-3">
            <div className="rounded-xl border border-destructive/30 bg-destructive/10 text-destructive px-4 py-3 flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
              <div className="flex items-start sm:items-center gap-2 flex-1 min-w-0">
                <AlertCircle className="h-5 w-5 shrink-0 mt-0.5 sm:mt-0" />
                <p className="text-sm font-medium leading-snug">
                  {overdueCount === 1
                    ? <>Tenés <strong>1 pago vencido</strong> por <strong>{formatCurrency(overdueTotal, overdueCurrency)}</strong>.</>
                    : <>Tenés <strong>{overdueCount} pagos vencidos</strong> por un total de <strong>{formatCurrency(overdueTotal, overdueCurrency)}</strong>.</>}
                </p>
              </div>
              {mpConnected && onPayPayments && (
                <Button
                  size="sm"
                  variant="destructive"
                  className="gap-2 min-h-11 sm:min-h-9 sm:w-auto w-full shrink-0"
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
                <div className="space-y-3">
                  <p>
                    Si necesitás reprogramarla, podés usar el botón "Reprogramar" en lugar de cancelar.
                  </p>
                  {cancelTarget && isLateCancellation(cancelTarget) && (
                    <div className="rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/60 p-3 text-sm text-amber-700 dark:text-amber-300">
                      {branding.lateCancellationMessage?.trim() ||
                        `Faltan menos de ${cancellationHoursNotice} horas para tu cita. La cancelación tardía puede tener cargo según la política del consultorio.`}
                    </div>
                  )}
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
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter className="gap-2 sm:gap-2">
              <AlertDialogCancel disabled={cancelSubmitting} className="mt-0">
                Volver
              </AlertDialogCancel>
              <AlertDialogAction
                onClick={(e) => { e.preventDefault(); confirmCancel(); }}
                disabled={cancelSubmitting}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                {cancelSubmitting ? "Cancelando..." : "Confirmar cancelación"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
}

export default PatientPortalView;