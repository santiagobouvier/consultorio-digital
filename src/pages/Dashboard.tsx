import { useEffect, useState, useRef, lazy, Suspense } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { toast } from "@/hooks/use-toast";
import { Users, CalendarPlus, CalendarDays, UserPlus, Bell, LogOut, Camera, CreditCard, AlertTriangle, Clock, Plus, EyeOff, Eye, Smartphone, Building2, ChevronDown, Shield, Settings, ArrowRight, Palette, MessageCircle, CheckCircle2, User, Video, MapPin, Inbox } from "lucide-react";
import { MonthlyHighlights } from "@/components/MonthlyHighlights";
import LoadingPage from "@/components/LoadingPage";
import { PublicLinkCard } from "@/components/PublicLinkCard";
import { PatientForm } from "@/components/PatientForm";
import { CreateAppointmentModal } from "@/components/CreateAppointmentModal";
import { AppointmentDetailModal } from "@/components/calendar/AppointmentDetailModal";
import { GlobalPaymentForm } from "@/components/GlobalPaymentForm";
import { calculatePaymentStatus, formatCurrency } from "@/lib/payments";
import { useIsMobile } from "@/hooks/use-mobile";
import { InstallPromptCard } from "@/components/pwa/InstallPromptCard";
import { ActivationChecklist } from "@/components/ActivationChecklist";
import { usePendingRequestsCount } from "@/hooks/use-pending-requests-count";
import { openWhatsApp } from "@/lib/whatsapp";
import {
  ActivationCompleteModal,
  wasActivationCelebrated,
} from "@/components/ActivationCompleteModal";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/contexts/AuthContext";
import { useBusinessIdContext } from "@/contexts/BusinessIdContext";
import { HelpTooltip } from "@/components/HelpTooltip";

// Lazy load desktop dashboard (executive view)
const DesktopDashboard = lazy(() => 
  import("@/components/desktop/DesktopDashboard").then(m => ({ default: m.DesktopDashboard }))
);

const PRIVACY_MODE_KEY = "privacy_mode_enabled";

interface Business {
  id: string;
  name: string;
  owner_user_id: string;
}

const Dashboard = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const isMobile = useIsMobile();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { user, isSuperAdmin, isReady: authReady } = useAuth();
  const { businessId: ctxBusinessId, loading: ctxBusinessLoading } = useBusinessIdContext();
  const [userName, setUserName] = useState("");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [activePatientsCount, setActivePatientsCount] = useState(0);
  const [portalPatientsCount, setPortalPatientsCount] = useState(0);
  const [todayAppointmentsCount, setTodayAppointmentsCount] = useState(0);
  const [todayAppointments, setTodayAppointments] = useState<any[]>([]);
  const [tomorrowAppointments, setTomorrowAppointments] = useState<any[]>([]);
  const [overdueAmount, setOverdueAmount] = useState(0);
  const [overduePayments, setOverduePayments] = useState(0);
  const [dueSoonPayments, setDueSoonPayments] = useState(0);
  const [urgentPayments, setUrgentPayments] = useState<any[]>([]);
  const [monthlyIncome, setMonthlyIncome] = useState(0);
  const [loading, setLoading] = useState(true);
  const [showPatientForm, setShowPatientForm] = useState(false);
  const [showAppointmentModal, setShowAppointmentModal] = useState(false);
  // Cita abierta en el modal de detalle (tocar una fila de 'Tu día')
  const [detailAppointment, setDetailAppointment] = useState<any | null>(null);
  const [showPaymentForm, setShowPaymentForm] = useState(false);
  const [privacyMode, setPrivacyMode] = useState(() => {
    const saved = localStorage.getItem(PRIVACY_MODE_KEY);
    return saved === "true";
  });
  
  // Demo & Super admin state
  const [isDemo, setIsDemo] = useState(false);
  const [allBusinesses, setAllBusinesses] = useState<Business[]>([]);
  const [selectedBusiness, setSelectedBusiness] = useState<Business | null>(null);
  const [showActivationDone, setShowActivationDone] = useState(false);

  const statusMap: Record<string, string> = {
    pending: "pendiente",
    confirmed: "confirmada",
    cancelled: "cancelada",
    attended: "atendida",
    no_show: "ausencia",
  };

  const businessId = ctxBusinessId;
  const userId = user?.id ?? null;
  const pendingRequestsCount = usePendingRequestsCount();

  // Reloj del hero "Ahora": refresca el countdown cada minuto
  const [nowTick, setNowTick] = useState(() => Date.now());
  useEffect(() => {
    const t = window.setInterval(() => setNowTick(Date.now()), 60_000);
    return () => window.clearInterval(t);
  }, []);

  useEffect(() => {
    // Show success toast if coming from MP payment
    if (searchParams.get("subscription") === "success") {
      toast({
        title: "¡Bienvenido!",
        description: "Tu prueba gratuita de 15 días está activa.",
      });
      // Clean up the URL
      searchParams.delete("subscription");
      setSearchParams(searchParams, { replace: true });
    }
  }, []);

  // Fetch data once auth + businessId are resolved
  useEffect(() => {
    if (!authReady || ctxBusinessLoading) return;
    if (!user) return;
    if (!businessId) {
      setLoading(false);
      return;
    }
    fetchDashboardData();
  }, [authReady, ctxBusinessLoading, user?.id, businessId]);

  // Tiempo real: la base avisa (citas/pagos) y el dashboard se refresca solo
  useEffect(() => {
    if (!businessId) return;
    let timer: ReturnType<typeof setTimeout>;
    const scheduleRefetch = () => {
      clearTimeout(timer);
      timer = setTimeout(() => fetchDashboardData(true), 500);
    };
    const channel = supabase
      .channel(`dashboard-mobile-${businessId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "appointments", filter: `business_id=eq.${businessId}` }, scheduleRefetch)
      .on("postgres_changes", { event: "*", schema: "public", table: "payments", filter: `business_id=eq.${businessId}` }, scheduleRefetch)
      .subscribe();
    const onVisible = () => {
      if (document.visibilityState === "visible") scheduleRefetch();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      supabase.removeChannel(channel);
      document.removeEventListener("visibilitychange", onVisible);
      clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [businessId]);

  const fetchDashboardData = async (silent = false) => {
    try {
      if (!silent) setLoading(true);

      if (!user || !businessId) return;

      const currentBusinessId = businessId;
      const isAdmin = isSuperAdmin;

      // ── Parallelizar todas las consultas independientes ──
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);
      const dayAfterTomorrow = new Date(today);
      dayAfterTomorrow.setDate(dayAfterTomorrow.getDate() + 2);
      const monthStart = new Date();
      monthStart.setDate(1);
      monthStart.setHours(0, 0, 0, 0);

      const [
        profileRes,
        bizInfoRes,
        businessInfoRes,
        patientsCountRes,
        portalCountRes,
        appointmentsCountRes,
        appointmentsRes,
        tomorrowApptsRes,
        unpaidRes,
        userRoleRes,
        allBusinessesRes,
      ] = await Promise.all([
        // 0. Profile
        supabase.from("profiles").select("name, avatar_url").eq("id", user.id).single(),
        // 1. Demo check + onboarding
        supabase.from("businesses").select("is_demo, onboarding_completed, owner_user_id, name").eq("id", currentBusinessId).maybeSingle(),
        // 1b. Business name for selectedBusiness
        supabase.from("businesses").select("id, name, owner_user_id").eq("id", currentBusinessId).maybeSingle(),
        // 2. Active patients count
        supabase.from("patients").select("*", { count: "exact", head: true }).eq("business_id", currentBusinessId).eq("is_active", true),
        // 4. Portal patients count
        supabase.from("patients").select("*", { count: "exact", head: true }).eq("business_id", currentBusinessId).not("auth_user_id", "is", null),
        // 5. Today appointments count
        supabase.from("appointments").select("*", { count: "exact", head: true }).eq("business_id", currentBusinessId).gte("start_at", today.toISOString()).lt("start_at", tomorrow.toISOString()).not("status", "in", '("cancelled","no_show")'),
        // 6. Today appointments list (con end_at/modalidad/teléfono para el hero "Ahora")
        supabase.from("appointments").select(`id, start_at, end_at, status, modality, location, payment_status, contact_name, patient_id, service_id, recurrence_group_id, patients (full_name, whatsapp_phone, email, avatar_url)`).eq("business_id", currentBusinessId).gte("start_at", today.toISOString()).lt("start_at", tomorrow.toISOString()).order("start_at", { ascending: true }),
        // 6b. Tomorrow appointments (primera cita de mañana + sin confirmar)
        supabase.from("appointments").select(`id, start_at, status, patients (full_name)`).eq("business_id", currentBusinessId).gte("start_at", tomorrow.toISOString()).lt("start_at", dayAfterTomorrow.toISOString()).not("status", "in", '("cancelled","cancelled_by_patient","no_show")').order("start_at", { ascending: true }),
        // 7. Unpaid payments
        supabase.from("payments").select("*").eq("business_id", currentBusinessId).is("paid_at", null).not("status", "eq", "cancelled"),
        // 8. User role
        supabase.from("user_roles").select("role").eq("user_id", user.id).eq("business_id", currentBusinessId).maybeSingle(),
        // 9. All businesses (for super admin selector)
        isAdmin
          ? supabase.from("businesses").select("id, name, owner_user_id").order("name")
          : Promise.resolve({ data: null }),
      ]);

      // Process profile
      if (profileRes.data) {
        setUserName(profileRes.data.name);
        setAvatarUrl(profileRes.data.avatar_url);
      }

      // Check onboarding for owner
      const bizInfo = bizInfoRes.data;
      if (bizInfo && !isAdmin && !bizInfo.onboarding_completed && bizInfo.owner_user_id === user.id) {
        navigate("/onboarding-consultorio");
        return;
      }

      // Set selected business
      if (businessInfoRes.data) {
        setSelectedBusiness(businessInfoRes.data);
      }

      // Set all businesses for super admin
      if (isAdmin && allBusinessesRes.data) {
        setAllBusinesses(allBusinessesRes.data);
      }

      // Process results
      setIsDemo(bizInfo?.is_demo || false);


      setActivePatientsCount(patientsCountRes.count || 0);
      setPortalPatientsCount(portalCountRes.count || 0);
      setTodayAppointmentsCount(appointmentsCountRes.count || 0);
      setTodayAppointments(appointmentsRes.data || []);
      setTomorrowAppointments(tomorrowApptsRes.data || []);

      // Process unpaid payments
      const unpaidPaymentsData = unpaidRes.data;
      if (unpaidPaymentsData) {
        const paymentsWithStatus = unpaidPaymentsData.map((p: any) => ({
          ...p,
          calculatedStatus: calculatePaymentStatus(p),
        }));

        const overdue = paymentsWithStatus.filter((p: any) => p.calculatedStatus === "overdue");
        const dueSoon = paymentsWithStatus.filter((p: any) => p.calculatedStatus === "due_soon");

        setOverduePayments(overdue.length);
        setDueSoonPayments(dueSoon.length);
        setOverdueAmount(overdue.reduce((s: number, p: any) => s + (Number(p.amount) || 0), 0));

        const urgent = [...overdue, ...dueSoon]
          .sort((a: any, b: any) => new Date(a.due_date).getTime() - new Date(b.due_date).getTime())
          .slice(0, 5);

        if (urgent.length > 0) {
          const patientIds = [...new Set(urgent.map((p: any) => p.patient_id))];
          const { data: patientsForPayments } = await supabase
            .from("patients")
            .select("id, full_name")
            .in("id", patientIds);

          const patientsMap = new Map(
            (patientsForPayments || []).map((p: any) => [p.id, p.full_name])
          );

          setUrgentPayments(
            urgent.map((p: any) => ({
              ...p,
              patientName: patientsMap.get(p.patient_id) || "Desconocido",
            }))
          );
        }
      }

      // Monthly income (depends on userRole result)
      const userRole = userRoleRes.data;
      const isOwnerOrAdmin = isAdmin || userRole?.role === "owner";
      const isProfessional = userRole?.role === "professional";

      if (isOwnerOrAdmin) {
        const { data: paidPaymentsData } = await supabase
          .from("payments")
          .select("amount")
          .eq("business_id", currentBusinessId)
          .not("paid_at", "is", null)
          .gte("paid_at", monthStart.toISOString());

        if (paidPaymentsData) {
          setMonthlyIncome(paidPaymentsData.reduce((sum, p) => sum + (p.amount || 0), 0));
        }
      } else if (isProfessional) {
        const { data: paidPaymentsData } = await supabase
          .from("payments")
          .select("amount, appointment_id")
          .eq("business_id", currentBusinessId)
          .not("paid_at", "is", null)
          .gte("paid_at", monthStart.toISOString());

        if (paidPaymentsData && paidPaymentsData.length > 0) {
          const appointmentIds = paidPaymentsData.filter(p => p.appointment_id).map(p => p.appointment_id);
          if (appointmentIds.length > 0) {
            const { data: professionalAppointments } = await supabase
              .from("appointments")
              .select("id")
              .in("id", appointmentIds)
              .eq("professional_id", user.id);

            const myAppointmentIds = new Set((professionalAppointments || []).map(a => a.id));
            setMonthlyIncome(
              paidPaymentsData
                .filter(p => p.appointment_id && myAppointmentIds.has(p.appointment_id))
                .reduce((sum, p) => sum + (p.amount || 0), 0)
            );
          } else {
            setMonthlyIncome(0);
          }
        } else {
          setMonthlyIncome(0);
        }
      } else {
        setMonthlyIncome(0);
      }
    } catch (error) {
      console.error("Error fetching dashboard data:", error);
      toast({
        title: "Error",
        description: "No se pudo cargar la información del dashboard",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      await supabase.auth.signOut();
      navigate("/auth");
    } catch (error) {
      console.error("Error signing out:", error);
      toast({
        title: "Error",
        description: "No se pudo cerrar sesión",
        variant: "destructive",
      });
    }
  };

  const handleAvatarClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !userId) return;

    // Validate file type
    if (!file.type.startsWith("image/")) {
      toast({
        title: "Error",
        description: "Por favor selecciona una imagen",
        variant: "destructive",
      });
      return;
    }

    // Validate file size (max 2MB)
    if (file.size > 2 * 1024 * 1024) {
      toast({
        title: "Error",
        description: "La imagen debe ser menor a 2MB",
        variant: "destructive",
      });
      return;
    }

    try {
      setUploadingAvatar(true);

      const fileExt = file.name.split(".").pop();
      const fileName = `${userId}/avatar.${fileExt}`;

      // Upload to storage
      const { error: uploadError } = await supabase.storage
        .from("avatars")
        .upload(fileName, file, { upsert: true });

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from("avatars")
        .getPublicUrl(fileName);

      // Add cache buster to URL
      const urlWithCacheBuster = `${publicUrl}?t=${Date.now()}`;

      // Update profile with new avatar URL
      const { error: updateError } = await supabase
        .from("profiles")
        .update({ avatar_url: urlWithCacheBuster })
        .eq("id", userId);

      if (updateError) throw updateError;

      setAvatarUrl(urlWithCacheBuster);
      toast({
        title: "Éxito",
        description: "Foto de perfil actualizada",
      });
    } catch (error) {
      console.error("Error uploading avatar:", error);
      toast({
        title: "Error",
        description: "No se pudo subir la imagen",
        variant: "destructive",
      });
    } finally {
      setUploadingAvatar(false);
      // Reset input
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const formatTime = (datetime: string) => {
    const date = new Date(datetime);
    return date.toLocaleTimeString("es-UY", {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  if (loading) {
    return <LoadingPage />;
  }

  // Desktop: show executive dashboard with cards and quick access
  if (!isMobile) {
    return (
      <Suspense fallback={<LoadingPage />}>
        <DesktopDashboard businessId={businessId!} userName={userName} />
      </Suspense>
    );
  }

  // Mobile: lo urgente arriba (solicitudes, hoy, deuda), lo de sistema abajo.
  return (
      <div className="min-h-screen bg-background">
      <div className="max-w-2xl mx-auto p-4 sm:p-6 space-y-6">
        {businessId && (
          <ActivationCompleteModal
            businessId={businessId}
            open={showActivationDone}
            onClose={() => setShowActivationDone(false)}
          />
        )}
        {/* Super Admin Business Selector */}
        {isSuperAdmin && allBusinesses.length > 0 && (
          <Card className="mobile-card-compact bg-primary/5 border-primary/30">
            <CardContent className="p-3">
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 sm:justify-between">
                <div className="flex items-center gap-2 flex-shrink-0">
                  <Badge variant="default" className="text-[10px] px-1.5">Admin</Badge>
                  <span className="text-[10px] text-muted-foreground">
                    {allBusinesses.length} consultorios
                  </span>
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm" className="gap-1.5 h-8 text-xs w-full sm:w-auto">
                      <Building2 className="h-3.5 w-3.5 flex-shrink-0" />
                      <span className="truncate max-w-[120px] sm:max-w-[150px]">{selectedBusiness?.name || "Seleccionar"}</span>
                      <ChevronDown className="h-3.5 w-3.5 flex-shrink-0" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="max-h-64 overflow-y-auto w-56">
                    {allBusinesses.map((business) => (
                      <DropdownMenuItem
                        key={business.id}
                        onClick={() => {
                          setSelectedBusiness(business);
                          sessionStorage.setItem("saas_selected_business", business.id);
                          window.location.reload();
                        }}
                        className={business.id === selectedBusiness?.id ? "bg-accent" : ""}
                      >
                        <span className="truncate">{business.name}</span>
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </CardContent>
          </Card>
        )}

        {/* ── Banda hero: el cockpit del día, versión bolsillo ── */}
        {(() => {
          const CANCELLED_H = ["cancelled", "cancelled_by_patient", "no_show"];
          const activeH = todayAppointments.filter((a) => !CANCELLED_H.includes(a.status));
          const doneH = activeH.filter(
            (a) => a.status === "attended" || (a.end_at && new Date(a.end_at).getTime() <= nowTick)
          ).length;
          const pct = activeH.length > 0 ? Math.min(1, doneH / activeH.length) : 0;
          const r = 30;
          const c = 2 * Math.PI * r;
          return (
            <div
              className="relative overflow-hidden text-white -mx-4 sm:-mx-6 -mt-4 sm:-mt-6 px-4 sm:px-6 pt-5 pb-6 rounded-b-3xl"
              style={{ background: "linear-gradient(130deg, hsl(182 20% 5%) 0%, hsl(180 32% 8%) 50%, hsl(176 65% 11%) 100%)" }}
            >
              <div
                className="absolute -top-20 -right-12 w-[280px] h-[220px] pointer-events-none"
                style={{ background: "radial-gradient(ellipse at center, hsl(176 90% 45% / 0.22), transparent 65%)" }}
              />
              <div className="relative flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="relative group shrink-0">
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={handleFileChange}
                    />
                    <Avatar
                      className="h-12 w-12 cursor-pointer ring-2 ring-white/20"
                      onClick={handleAvatarClick}
                    >
                      <AvatarImage src={avatarUrl || undefined} alt={userName} />
                      <AvatarFallback className="bg-white/10 text-[#2dd4bf] font-semibold">
                        {getInitials(userName)}
                      </AvatarFallback>
                    </Avatar>
                    <div
                      className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-full opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                      onClick={handleAvatarClick}
                    >
                      {uploadingAvatar ? (
                        <div className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      ) : (
                        <Camera className="h-5 w-5 text-white" />
                      )}
                    </div>
                  </div>
                  <div className="min-w-0">
                    <p className="text-[11px] text-white/55 capitalize">
                      {(() => {
                        const d = new Date(nowTick);
                        const h = d.getHours();
                        const saludo = h < 12 ? "Buenos días" : h < 19 ? "Buenas tardes" : "Buenas noches";
                        return `${saludo} · ${d.toLocaleDateString("es-UY", { weekday: "long", day: "numeric", month: "long" })}`;
                      })()}
                    </p>
                    <h1 className="text-lg font-bold truncate">Hola, {userName.split(" ")[0]} 👋</h1>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={handleLogout}
                  className="text-white/50 hover:text-white hover:bg-white/10 h-10 w-10 shrink-0"
                >
                  <LogOut className="h-5 w-5" />
                </Button>
              </div>

              <div className="relative flex items-center justify-between gap-4 mt-4">
                <div>
                  <p className="text-4xl font-extrabold tabular-nums tracking-tight leading-none">
                    {new Date(nowTick).toLocaleTimeString("es-UY", { hour: "2-digit", minute: "2-digit" })}
                  </p>
                  <p className="text-[11px] text-white/55 mt-1.5">
                    {activeH.length === 0
                      ? "Hoy libre en la agenda"
                      : `${doneH} de ${activeH.length} ${activeH.length === 1 ? "sesión" : "sesiones"} del día`}
                  </p>
                </div>
                {activeH.length > 0 && (
                  <div className="relative h-[68px] w-[68px] shrink-0">
                    <svg viewBox="0 0 72 72" className="h-[68px] w-[68px] -rotate-90">
                      <circle cx="36" cy="36" r={r} fill="none" strokeWidth="6" className="stroke-white/15" />
                      <circle
                        cx="36" cy="36" r={r} fill="none" strokeWidth="6" strokeLinecap="round"
                        className="stroke-[#2dd4bf] transition-[stroke-dashoffset] duration-700"
                        strokeDasharray={c} strokeDashoffset={c * (1 - pct)}
                      />
                    </svg>
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                      <span className="text-base font-bold tabular-nums leading-none">{doneH}</span>
                      <span className="text-[8px] text-white/50 mt-0.5">de {activeH.length}</span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          );
        })()}

        {/* ══════════ 1) AHORA: la próxima sesión, protagonista ══════════ */}
        {(() => {
          const CANCELLED = ["cancelled", "cancelled_by_patient", "no_show"];
          const active = todayAppointments.filter((a) => !CANCELLED.includes(a.status));
          const inSession = active.find(
            (a) =>
              a.status !== "attended" &&
              new Date(a.start_at).getTime() <= nowTick &&
              a.end_at && new Date(a.end_at).getTime() > nowTick
          );
          const nextAppt = active.find((a) => new Date(a.start_at).getTime() > nowTick);
          const tomorrowFirst = tomorrowAppointments[0];
          const overduePatientIds = new Set(
            urgentPayments.filter((p: any) => p.calculatedStatus === "overdue").map((p: any) => p.patient_id)
          );

          const countdownLabel = (iso: string) => {
            const mins = Math.max(0, Math.round((new Date(iso).getTime() - nowTick) / 60000));
            if (mins < 60) return `en ${mins} min`;
            const h = Math.floor(mins / 60);
            const m = mins % 60;
            return m > 0 ? `en ${h} h ${m} min` : `en ${h} h`;
          };
          const tomorrowLine = tomorrowFirst
            ? `Mañana arrancás ${formatTime(tomorrowFirst.start_at)} con ${tomorrowFirst.patients?.full_name?.split(" ")[0] || "un paciente"}`
            : "Mañana no tenés sesiones agendadas";

          // Variante: hay una próxima sesión hoy → hero grande
          if (nextAppt) {
            const name = nextAppt.patients?.full_name || nextAppt.contact_name || "Paciente";
            const phone = nextAppt.patients?.whatsapp_phone || null;
            const debe = nextAppt.patient_id && overduePatientIds.has(nextAppt.patient_id);
            return (
              <Card className="border-primary/25 bg-gradient-to-br from-primary/[0.09] to-transparent shadow-md">
                <CardContent className="p-5 space-y-4">
                  {inSession && (
                    <div className="flex items-center gap-2 text-xs font-medium text-primary">
                      <span className="h-2 w-2 rounded-full bg-primary animate-pulse" />
                      En sesión con {inSession.patients?.full_name?.split(" ")[0] || "un paciente"} hasta {inSession.end_at ? formatTime(inSession.end_at) : ""}
                    </div>
                  )}
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
                      {inSession ? "Después" : "Tu próxima sesión"}
                    </p>
                    <div className="flex items-end justify-between gap-3 mt-1">
                      <p className="text-4xl font-bold tracking-tight text-foreground leading-none">
                        {formatTime(nextAppt.start_at)}
                      </p>
                      <span className="text-sm font-semibold text-primary">{countdownLabel(nextAppt.start_at)}</span>
                    </div>
                    <div className="flex items-center gap-2 mt-2 flex-wrap">
                      <p className="text-base font-semibold text-foreground truncate">{name}</p>
                      <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                        {nextAppt.modality === "online" ? <Video className="h-3 w-3" /> : <MapPin className="h-3 w-3" />}
                        {nextAppt.modality === "online" ? "Online" : "Presencial"}
                      </span>
                      {debe && (
                        <Badge variant="outline" className="text-[10px] rounded-full border-destructive/40 text-destructive bg-destructive/5">
                          Te debe plata
                        </Badge>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    {phone && (
                      <Button
                        variant="outline"
                        className="flex-1 h-10 rounded-xl gap-2"
                        onClick={() => openWhatsApp(phone, "")}
                      >
                        <MessageCircle className="h-4 w-4" />
                        WhatsApp
                      </Button>
                    )}
                    {nextAppt.patient_id && (
                      <Button
                        className="flex-1 h-10 rounded-xl gap-2"
                        onClick={() => navigate(`/patients/${nextAppt.patient_id}`)}
                      >
                        <User className="h-4 w-4" />
                        Ver ficha
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          }

          // Variante: en sesión y no hay más después
          if (inSession) {
            return (
              <Card className="border-primary/25 bg-gradient-to-br from-primary/[0.09] to-transparent">
                <CardContent className="p-5 space-y-1.5">
                  <div className="flex items-center gap-2 text-sm font-semibold text-primary">
                    <span className="h-2 w-2 rounded-full bg-primary animate-pulse" />
                    En sesión con {inSession.patients?.full_name || "un paciente"}
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Hasta {inSession.end_at ? formatTime(inSession.end_at) : ""} · Es tu última de hoy
                  </p>
                  <p className="text-xs text-muted-foreground">{tomorrowLine}</p>
                </CardContent>
              </Card>
            );
          }

          // Variante: día terminado o día libre
          return (
            <Card className="border-border/50">
              <CardContent className="p-5 space-y-2">
                <p className="text-base font-semibold text-foreground">
                  {active.length > 0
                    ? `Terminaste por hoy 🎉 (${active.length} sesi${active.length === 1 ? "ón" : "ones"})`
                    : "Hoy no tenés sesiones"}
                </p>
                <p className="text-sm text-muted-foreground">{tomorrowLine}</p>
                {active.length === 0 && (
                  <Button variant="outline" size="sm" className="rounded-xl gap-2 mt-1" onClick={() => setShowAppointmentModal(true)}>
                    <CalendarPlus className="h-4 w-4" />
                    Agendar cita
                  </Button>
                )}
              </CardContent>
            </Card>
          );
        })()}

        {/* ══════════ 2) NECESITAN DE VOS ══════════ */}
        {(() => {
          const tomorrowUnconfirmed = tomorrowAppointments.filter((a) =>
            ["pending", "scheduled"].includes(a.status)
          );
          const tomorrowIso = (() => {
            const t = new Date();
            t.setDate(t.getDate() + 1);
            return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, "0")}-${String(t.getDate()).padStart(2, "0")}`;
          })();
          const items: { key: string; className: string; icon: JSX.Element; title: string; subtitle: string; to: string }[] = [];
          if (pendingRequestsCount > 0) {
            items.push({
              key: "solicitudes",
              className: "bg-amber-500/[0.07] border-amber-500/30",
              icon: <Inbox className="h-4 w-4 text-amber-500" />,
              title: `${pendingRequestsCount} solicitud${pendingRequestsCount !== 1 ? "es" : ""} esperando respuesta`,
              subtitle: "Tocá para responderlas",
              to: "/solicitudes",
            });
          }
          if (overduePayments > 0) {
            items.push({
              key: "deudas",
              className: "bg-destructive/[0.06] border-destructive/30",
              icon: <AlertTriangle className="h-4 w-4 text-destructive" />,
              title: privacyMode ? `Te deben ${overduePayments} pago${overduePayments !== 1 ? "s" : ""}` : `Te deben ${formatCurrency(overdueAmount, "UYU")}`,
              subtitle: urgentPayments
                .filter((p: any) => p.calculatedStatus === "overdue")
                .slice(0, 3)
                .map((p: any) => (p.patientName || "").split(" ")[0])
                .join(", ") || `${overduePayments} pagos vencidos`,
              to: "/pagos?status=overdue",
            });
          }
          if (tomorrowUnconfirmed.length > 0) {
            items.push({
              key: "unconfirmed",
              className: "bg-primary/[0.06] border-primary/25",
              icon: <CalendarDays className="h-4 w-4 text-primary" />,
              title: `${tomorrowUnconfirmed.length} cita${tomorrowUnconfirmed.length !== 1 ? "s" : ""} de mañana sin confirmar`,
              subtitle: "Abrí el día de mañana y confirmalas",
              to: `/agenda?date=${tomorrowIso}`,
            });
          }
          return (
            <div className="space-y-2">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                Necesitan de vos
              </h3>
              {items.length === 0 ? (
                <div className="flex items-center gap-2.5 rounded-xl border border-emerald-500/25 bg-emerald-500/[0.06] px-4 py-3">
                  <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
                  <p className="text-sm font-medium text-foreground">Todo en orden — nada pendiente</p>
                </div>
              ) : (
                items.map((it) => (
                  <button
                    key={it.key}
                    onClick={() => navigate(it.to)}
                    className={`w-full flex items-center gap-3 rounded-xl border px-4 py-3 text-left active:scale-[0.98] transition-transform ${it.className}`}
                  >
                    <span className="shrink-0">{it.icon}</span>
                    <span className="flex-1 min-w-0">
                      <span className="block text-sm font-semibold text-foreground">{it.title}</span>
                      <span className="block text-xs text-muted-foreground truncate">{it.subtitle}</span>
                    </span>
                    <ArrowRight className="h-4 w-4 text-muted-foreground shrink-0" />
                  </button>
                ))
              )}
            </div>
          );
        })()}

        {/* ══════════ 3) TU DÍA: la tira compacta de hoy ══════════ */}
        <Card className="mobile-card">
          <CardHeader className="pb-3 px-0 pt-0 sm:px-6 sm:pt-6">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base font-bold flex items-center gap-2">
                <CalendarDays className="h-5 w-5 text-primary" />
                Tu día
                {todayAppointmentsCount > 0 && (
                  <span className="text-xs font-normal text-muted-foreground">({todayAppointmentsCount})</span>
                )}
              </CardTitle>
              <Button
                variant="outline"
                size="sm"
                className="text-xs h-8"
                onClick={() => navigate("/agenda")}
              >
                Ver agenda
              </Button>
            </div>
          </CardHeader>
          <CardContent className="px-0 pb-0 sm:px-6 sm:pb-6">
            {todayAppointments.length > 0 ? (
              <div className="space-y-1">
                {todayAppointments.map((appointment) => {
                  const cancelled = ["cancelled", "cancelled_by_patient"].includes(appointment.status);
                  const done =
                    appointment.status === "attended" ||
                    (!cancelled && appointment.end_at && new Date(appointment.end_at).getTime() <= nowTick);
                  const current =
                    !cancelled && !done &&
                    new Date(appointment.start_at).getTime() <= nowTick &&
                    appointment.end_at && new Date(appointment.end_at).getTime() > nowTick;
                  return (
                    <div
                      key={appointment.id}
                      role="button"
                      onClick={() => setDetailAppointment(appointment)}
                      className={`flex items-center gap-3 py-2.5 border-b border-border/60 last:border-0 active:bg-muted/40 rounded-lg transition-colors cursor-pointer ${done || cancelled ? "opacity-55" : ""}`}
                    >
                      <span
                        className={`h-2 w-2 rounded-full shrink-0 ${
                          cancelled
                            ? "bg-muted-foreground/40"
                            : current
                            ? "bg-primary animate-pulse"
                            : done
                            ? "bg-emerald-500"
                            : "border-2 border-primary/50 bg-transparent"
                        }`}
                      />
                      <span className={`text-sm font-bold whitespace-nowrap ${current ? "text-primary" : "text-foreground"}`}>
                        {formatTime(appointment.start_at)}
                      </span>
                      <span className={`text-sm truncate flex-1 ${cancelled ? "line-through" : "text-foreground"}`}>
                        {appointment.patients?.full_name || appointment.contact_name}
                      </span>
                      {done && !cancelled && <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0" />}
                      {current && <span className="text-[10px] font-semibold text-primary shrink-0">AHORA</span>}
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground py-4 text-center">Día libre en la agenda</p>
            )}
          </CardContent>
        </Card>

        {/* ══════════ 4) LOS NÚMEROS: chicos y al final ══════════ */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
              Tu mes
            </h3>
            <Button
              variant="ghost"
              size="sm"
              className="text-xs text-muted-foreground gap-1.5 h-7 -mr-2"
              onClick={() => {
                const newValue = !privacyMode;
                setPrivacyMode(newValue);
                localStorage.setItem(PRIVACY_MODE_KEY, String(newValue));
              }}
            >
              {privacyMode ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
              {privacyMode ? "Mostrar" : "Ocultar"}
            </Button>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => navigate("/pagos?status=paid&period=this_month")}
              className="rounded-xl border border-green-500/30 bg-green-500/5 px-4 py-3 text-left active:scale-[0.98] transition-transform"
            >
              <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground inline-flex items-center gap-1">
                <CreditCard className="h-3 w-3 text-green-600" /> Cobrado
              </p>
              <p className="text-lg font-bold text-green-600 mt-0.5 truncate">
                {privacyMode ? "•••" : formatCurrency(monthlyIncome, "UYU")}
              </p>
            </button>
            <button
              onClick={() => navigate(overduePayments > 0 ? "/pagos?status=overdue" : "/pagos")}
              className={`rounded-xl border px-4 py-3 text-left active:scale-[0.98] transition-transform ${
                overduePayments > 0 ? "border-destructive/30 bg-destructive/5" : "border-border/60"
              }`}
            >
              <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground inline-flex items-center gap-1">
                <AlertTriangle className={`h-3 w-3 ${overduePayments > 0 ? "text-destructive" : "text-muted-foreground"}`} /> Vencidos
              </p>
              <p className={`text-lg font-bold mt-0.5 truncate ${overduePayments > 0 ? "text-destructive" : "text-foreground"}`}>
                {overduePayments > 0 ? (privacyMode ? overduePayments : formatCurrency(overdueAmount, "UYU")) : "0"}
              </p>
            </button>
          </div>
        </div>

        {/* Quick Actions */}
        <div>
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
            Accesos rápidos
          </h3>
          {/* Etiquetas que dicen lo que HACEN (crear/registrar), no sustantivos
              ambiguos que se confunden con listados. */}
          <div className="grid grid-cols-2 gap-2">
            <Button
              variant="outline"
              className="h-14 flex items-center justify-start gap-2.5 rounded-xl px-3.5"
              onClick={() => setShowAppointmentModal(true)}
            >
              <CalendarPlus className="h-5 w-5 text-primary shrink-0" />
              <span className="text-sm font-semibold">Nueva cita</span>
            </Button>
            <Button
              variant="outline"
              className="h-14 flex items-center justify-start gap-2.5 rounded-xl px-3.5"
              onClick={() => setShowPaymentForm(true)}
            >
              <CreditCard className="h-5 w-5 text-primary shrink-0" />
              <span className="text-sm font-semibold">Registrar pago</span>
            </Button>
            <Button
              variant="outline"
              className="h-14 flex items-center justify-start gap-2.5 rounded-xl px-3.5"
              onClick={() => setShowPatientForm(true)}
            >
              <UserPlus className="h-5 w-5 text-primary shrink-0" />
              <span className="text-sm font-semibold">Nuevo paciente</span>
            </Button>
            <Button
              variant="outline"
              className="h-14 flex items-center justify-start gap-2.5 rounded-xl px-3.5 border-primary/30 bg-primary/5"
              onClick={() => navigate("/personalizar-portal")}
            >
              <Smartphone className="h-5 w-5 text-primary shrink-0" />
              <span className="min-w-0 text-left">
                <span className="block text-sm font-semibold leading-tight">Mi portal</span>
                <span className="block text-[10px] text-muted-foreground leading-tight">{portalPatientsCount} paciente{portalPatientsCount !== 1 ? "s" : ""} con acceso</span>
              </span>
            </Button>
          </div>
        </div>

        {isDemo && (
          <Card
            className="mobile-card-compact hover:shadow-md transition-all cursor-pointer group active:scale-[0.98] border-accent bg-accent/10"
            onClick={() => navigate("/portal-paciente/demo")}
          >
            <CardContent className="p-4 flex items-center justify-center gap-2 text-center">
              <Eye className="h-4 w-4 text-accent-foreground" />
              <p className="font-semibold text-sm text-foreground">Ver portal como paciente (demo)</p>
            </CardContent>
          </Card>
        )}

        {/* ── Zona de sistema: útil pero no urgente ──
            Plan y notificaciones viven en Mi consultorio (y la guía de
            activación apunta ahí); acá solo lo que se usa a diario. */}
        {businessId && (
          <ActivationChecklist
            businessId={businessId}
            onAllDone={() => {
              if (!wasActivationCelebrated(businessId)) {
                setShowActivationDone(true);
              }
            }}
          />
        )}
        <PublicLinkCard businessId={businessId} />
        <InstallPromptCard />

        {/* Monthly Highlights - at the bottom */}
        <MonthlyHighlights businessId={businessId} className="mt-2" />

        {/* Admin Panel Link */}
        {isSuperAdmin && (
          <Button
            variant="default"
            className="w-full h-12 rounded-xl font-semibold gap-2"
            onClick={() => navigate("/saas-admin")}
          >
            <Shield className="h-4 w-4" />
            Panel SaaS
          </Button>
        )}
      </div>

      {/* Modals */}
      <PatientForm
        open={showPatientForm}
        onOpenChange={setShowPatientForm}
        businessId={businessId}
        onSuccess={() => {
          setShowPatientForm(false);
          fetchDashboardData();
        }}
      />

      <CreateAppointmentModal
        open={showAppointmentModal}
        onOpenChange={setShowAppointmentModal}
        patientId={null}
        onSuccess={fetchDashboardData}
      />

      {/* Detalle de la cita: cobrar, reprogramar, cancelar — sin salir del dashboard */}
      <AppointmentDetailModal
        appointment={detailAppointment}
        open={!!detailAppointment}
        onClose={() => setDetailAppointment(null)}
        businessId={businessId}
        onPaymentRegistered={() => fetchDashboardData(true)}
      />

      {businessId && (
        <GlobalPaymentForm
          open={showPaymentForm}
          onOpenChange={setShowPaymentForm}
          businessId={businessId}
          onSuccess={() => {
            setShowPaymentForm(false);
            fetchDashboardData();
          }}
        />
      )}
    </div>
  );
};

export default Dashboard;
