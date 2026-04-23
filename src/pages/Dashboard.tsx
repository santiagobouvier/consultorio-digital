import { useEffect, useState, useRef, lazy, Suspense } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { toast } from "@/hooks/use-toast";
import { Users, CalendarPlus, CalendarDays, UserPlus, Bell, LogOut, Camera, CreditCard, AlertTriangle, Clock, Plus, EyeOff, Eye, Smartphone, Building2, ChevronDown, Shield, Settings, ArrowRight, Palette, Sparkles } from "lucide-react";
import { MonthlyHighlights } from "@/components/MonthlyHighlights";
import LoadingPage from "@/components/LoadingPage";
import { PlanUsageCard } from "@/components/PlanUsageCard";
import { PatientForm } from "@/components/PatientForm";
import { CreateAppointmentModal } from "@/components/CreateAppointmentModal";
import { GlobalPaymentForm } from "@/components/GlobalPaymentForm";
import { calculatePaymentStatus, formatCurrency } from "@/lib/payments";
import { useIsMobile } from "@/hooks/use-mobile";
import { NotificationActivationCard } from "@/components/NotificationActivationCard";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { isCurrentUserSuperAdmin } from "@/lib/admin-access";
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
  const [userName, setUserName] = useState("");
  const [userId, setUserId] = useState<string | null>(null);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [activePatientsCount, setActivePatientsCount] = useState(0);
  const [portalPatientsCount, setPortalPatientsCount] = useState(0);
  const [todayAppointmentsCount, setTodayAppointmentsCount] = useState(0);
  const [todayAppointments, setTodayAppointments] = useState<any[]>([]);
  const [overduePayments, setOverduePayments] = useState(0);
  const [dueSoonPayments, setDueSoonPayments] = useState(0);
  const [urgentPayments, setUrgentPayments] = useState<any[]>([]);
  const [monthlyIncome, setMonthlyIncome] = useState(0);
  const [loading, setLoading] = useState(true);
  const [showPatientForm, setShowPatientForm] = useState(false);
  const [showAppointmentModal, setShowAppointmentModal] = useState(false);
  const [showPaymentForm, setShowPaymentForm] = useState(false);
  const [businessId, setBusinessId] = useState<string | null>(null);
  const [privacyMode, setPrivacyMode] = useState(() => {
    const saved = localStorage.getItem(PRIVACY_MODE_KEY);
    return saved === "true";
  });
  
  // Demo & Super admin state
  const [isDemo, setIsDemo] = useState(false);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [allBusinesses, setAllBusinesses] = useState<Business[]>([]);
  const [selectedBusiness, setSelectedBusiness] = useState<Business | null>(null);
  const [trialEndsAt, setTrialEndsAt] = useState<string | null>(null);

  const statusMap: Record<string, string> = {
    pending: "pendiente",
    confirmed: "confirmada",
    cancelled: "cancelada",
    attended: "atendida",
    no_show: "ausencia",
  };

  useEffect(() => {
    // Show success toast if coming from MP payment
    if (searchParams.get("subscription") === "success") {
      toast({
        title: "¡Bienvenido!",
        description: "Tu prueba gratuita de 7 días está activa.",
      });
      // Clean up the URL
      searchParams.delete("subscription");
      setSearchParams(searchParams, { replace: true });
    }

    // Check if coming from SaaS admin with selected business
    const saasSelectedBusiness = sessionStorage.getItem("saas_selected_business");
    if (saasSelectedBusiness) {
      fetchDashboardData(saasSelectedBusiness);
    } else {
      fetchDashboardData();
    }
  }, []);

  const fetchDashboardData = async (overrideBusinessId?: string) => {
    try {
      setLoading(true);

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        navigate("/auth");
        return;
      }

      setUserId(user.id);

      const { data: profile } = await supabase
        .from("profiles")
        .select("name, avatar_url")
        .eq("id", user.id)
        .single();

      if (profile) {
        setUserName(profile.name);
        setAvatarUrl(profile.avatar_url);
      }

      // Check if user is super_admin
      const isAdmin = await isCurrentUserSuperAdmin(user.id);
      setIsSuperAdmin(isAdmin);

      let currentBusinessId = overrideBusinessId || null;

      if (isAdmin) {
        // Super admin: cargar lista de consultorios para el selector,
        // pero NUNCA seleccionar uno automáticamente. Si no hay un
        // business previamente seleccionado en sessionStorage, redirigir
        // al panel SaaS Admin para que el admin elija explícitamente.
        const { data: businesses } = await supabase
          .from("businesses")
          .select("id, name, owner_user_id")
          .order("name");

        if (businesses && businesses.length > 0) {
          setAllBusinesses(businesses);

          // Resolver business actual SOLO desde override o sessionStorage
          const sessionBusinessId =
            currentBusinessId || sessionStorage.getItem("saas_selected_business");

          const selected = sessionBusinessId
            ? businesses.find((b) => b.id === sessionBusinessId)
            : null;

          if (!selected) {
            // Sin selección explícita: volver al panel SaaS Admin
            sessionStorage.removeItem("saas_selected_business");
            navigate("/saas-admin");
            return;
          }

          setSelectedBusiness(selected);
          currentBusinessId = selected.id;
          sessionStorage.setItem("saas_selected_business", currentBusinessId);
        } else {
          // Super admin sin consultorios en el sistema
          navigate("/saas-admin");
          return;
        }
      } else {
        // Regular user: check for owned or member business
        let { data: business } = await supabase
          .from("businesses")
          .select("id, name, owner_user_id, onboarding_completed, is_demo")
          .eq("owner_user_id", user.id)
          .maybeSingle();

        // Check if this is the owner and onboarding is pending
        if (business && !business.onboarding_completed && business.owner_user_id === user.id) {
          navigate("/onboarding-consultorio");
          return;
        }

        if (!business) {
          // Check if member via user_roles
          const { data: userRole } = await supabase
            .from("user_roles")
            .select("business_id")
            .eq("user_id", user.id)
            .in("role", ["owner", "professional"])
            .maybeSingle();

          if (userRole?.business_id) {
            const { data: memberBusiness } = await supabase
              .from("businesses")
              .select("id, name, owner_user_id, onboarding_completed, is_demo")
              .eq("id", userRole.business_id)
              .single();
            
            business = memberBusiness;
          }
        }

        if (!business) {
          navigate("/configurar-negocio");
          return;
        }

        currentBusinessId = business.id;
        setSelectedBusiness(business);
      }

      if (!currentBusinessId && isAdmin) {
        navigate("/saas-admin", { replace: true });
        return;
      }

      if (!currentBusinessId) {
        navigate("/configurar-negocio");
        return;
      }

      setBusinessId(currentBusinessId);

      // Check if demo business
      const { data: bizInfo } = await supabase
        .from("businesses").select("is_demo").eq("id", currentBusinessId).maybeSingle();
      setIsDemo(bizInfo?.is_demo || false);

      // Check trial status for banner
      if (isAdmin) {
        setTrialEndsAt(null);
      } else {
        const { data: subData } = await supabase
          .from("subscriptions")
          .select("status, trial_ends_at")
          .eq("business_id", currentBusinessId)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (subData?.status === "trial" && subData.trial_ends_at) {
          setTrialEndsAt(subData.trial_ends_at);
        } else {
          setTrialEndsAt(null);
        }
      }

      const { count: patientsCount } = await supabase
        .from("patients")
        .select("*", { count: "exact", head: true })
        .eq("business_id", currentBusinessId)
        .eq("is_active", true);

      setActivePatientsCount(patientsCount || 0);

      // Count patients with portal access
      const { count: portalCount } = await supabase
        .from("patients")
        .select("*", { count: "exact", head: true })
        .eq("business_id", currentBusinessId)
        .not("auth_user_id", "is", null);

      setPortalPatientsCount(portalCount || 0);

      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);

      const { count: appointmentsCount } = await supabase
        .from("appointments")
        .select("*", { count: "exact", head: true })
        .eq("business_id", currentBusinessId)
        .gte("start_at", today.toISOString())
        .lt("start_at", tomorrow.toISOString())
        .not("status", "in", '("cancelled","no_show")');

      setTodayAppointmentsCount(appointmentsCount || 0);

      const { data: appointments } = await supabase
        .from("appointments")
        .select(`
          id,
          start_at,
          status,
          contact_name,
          patient_id,
          patients (full_name)
        `)
        .eq("business_id", currentBusinessId)
        .gte("start_at", today.toISOString())
        .lt("start_at", tomorrow.toISOString())
        .order("start_at", { ascending: true })
        .limit(5);

      setTodayAppointments(appointments || []);

      // Fetch unpaid payments for alerts
      const { data: unpaidPaymentsData } = await supabase
        .from("payments")
        .select("*")
        .eq("business_id", currentBusinessId)
        .is("paid_at", null)
        .not("status", "eq", "cancelled");

      if (unpaidPaymentsData) {
        // Calculate real-time status for each payment
        const paymentsWithStatus = unpaidPaymentsData.map((p) => ({
          ...p,
          calculatedStatus: calculatePaymentStatus(p),
        }));

        const overdue = paymentsWithStatus.filter((p) => p.calculatedStatus === "overdue");
        const dueSoon = paymentsWithStatus.filter((p) => p.calculatedStatus === "due_soon");

        setOverduePayments(overdue.length);
        setDueSoonPayments(dueSoon.length);

        // Get 5 most urgent payments (overdue first, then due_soon, ordered by due_date)
        const urgent = [...overdue, ...dueSoon]
          .sort((a, b) => new Date(a.due_date).getTime() - new Date(b.due_date).getTime())
          .slice(0, 5);

        // Fetch patient names for urgent payments
        if (urgent.length > 0) {
          const patientIds = [...new Set(urgent.map((p) => p.patient_id))];
          const { data: patientsForPayments } = await supabase
            .from("patients")
            .select("id, full_name")
            .in("id", patientIds);

          const patientsMap = new Map(
            (patientsForPayments || []).map((p) => [p.id, p.full_name])
          );

          setUrgentPayments(
            urgent.map((p) => ({
              ...p,
              patientName: patientsMap.get(p.patient_id) || "Desconocido",
            }))
          );
        }
      }

      // Fetch monthly income (paid payments this month)
      const startOfMonth = new Date();
      startOfMonth.setDate(1);
      startOfMonth.setHours(0, 0, 0, 0);

      // Check user role to determine filtering
      const { data: userRole } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .eq("business_id", currentBusinessId)
        .maybeSingle();

      const isOwnerOrAdmin = isAdmin || userRole?.role === "owner";
      const isProfessional = userRole?.role === "professional";

      if (isOwnerOrAdmin) {
        // Owner/Admin: see all payments from the business
        const { data: paidPaymentsData } = await supabase
          .from("payments")
          .select("amount")
          .eq("business_id", currentBusinessId)
          .not("paid_at", "is", null)
          .gte("paid_at", startOfMonth.toISOString());

        if (paidPaymentsData) {
          const totalIncome = paidPaymentsData.reduce((sum, p) => sum + (p.amount || 0), 0);
          setMonthlyIncome(totalIncome);
        }
      } else if (isProfessional) {
        // Professional: only see payments from appointments where they are the professional
        const { data: paidPaymentsData } = await supabase
          .from("payments")
          .select("amount, appointment_id")
          .eq("business_id", currentBusinessId)
          .not("paid_at", "is", null)
          .gte("paid_at", startOfMonth.toISOString());

        if (paidPaymentsData && paidPaymentsData.length > 0) {
          // Get appointment IDs that have payments
          const appointmentIds = paidPaymentsData
            .filter(p => p.appointment_id)
            .map(p => p.appointment_id);

          if (appointmentIds.length > 0) {
            // Get appointments where this professional is assigned
            const { data: professionalAppointments } = await supabase
              .from("appointments")
              .select("id")
              .in("id", appointmentIds)
              .eq("professional_id", user.id);

            const myAppointmentIds = new Set((professionalAppointments || []).map(a => a.id));

            // Sum only payments from my appointments
            const totalIncome = paidPaymentsData
              .filter(p => p.appointment_id && myAppointmentIds.has(p.appointment_id))
              .reduce((sum, p) => sum + (p.amount || 0), 0);

            setMonthlyIncome(totalIncome);
          } else {
            setMonthlyIncome(0);
          }
        } else {
          setMonthlyIncome(0);
        }
      } else {
        // Patient or unknown role: don't show income
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
        <DesktopDashboard />
      </Suspense>
    );
  }

  // Mobile: original dashboard layout
  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-2xl mx-auto p-4 sm:p-6 space-y-6">
        {/* Trial Banner */}
        {!isSuperAdmin && trialEndsAt && (
          <div className="rounded-xl border border-blue-500/20 bg-blue-500/5 p-3 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-blue-400 flex-shrink-0" />
              <p className="text-xs text-blue-300">
                Tu prueba gratuita vence el{" "}
                <span className="font-medium">
                  {new Date(trialEndsAt).toLocaleDateString("es-UY", { day: "numeric", month: "long" })}
                </span>
                . Podés cancelar antes sin costo.
              </p>
            </div>
            <Button
              size="sm"
              variant="ghost"
              className="text-blue-400 hover:text-blue-300 text-xs flex-shrink-0 h-7 px-2"
              onClick={() => navigate("/billing")}
            >
              Ver plan
            </Button>
          </div>
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
                          fetchDashboardData(business.id);
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

        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {/* Avatar with upload */}
            <div className="relative group">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleFileChange}
              />
              <Avatar
                className="h-14 w-14 cursor-pointer ring-2 ring-border group-hover:ring-primary transition-all"
                onClick={handleAvatarClick}
              >
                <AvatarImage src={avatarUrl || undefined} alt={userName} />
                <AvatarFallback className="bg-primary/10 text-primary font-semibold">
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
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-foreground inline-flex items-center gap-2">
                Hola, {userName}
                <HelpTooltip id="dashboard" />
              </h1>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate("/recordatorios-pendientes")}
              className="text-muted-foreground hover:text-foreground h-10 w-10"
            >
              <Bell className="h-5 w-5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={handleLogout}
              className="text-muted-foreground hover:text-destructive h-10 w-10"
            >
              <LogOut className="h-5 w-5" />
            </Button>
          </div>
        </div>

        {/* Push Notification Activation */}
        <NotificationActivationCard variant="full" />

        {/* Plan Usage Card */}
        <PlanUsageCard businessId={businessId} />

        {/* KPI Metrics Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Card className="mobile-card-compact">
            <CardContent className="p-4 text-center">
              <CalendarDays className="h-5 w-5 mx-auto text-primary mb-1" />
              <p className="text-xs text-muted-foreground font-semibold uppercase tracking-wide inline-flex items-center gap-1 justify-center">
                Citas hoy
                <HelpTooltip id="dashboardTodayAppointments" />
              </p>
              <p className="text-2xl font-bold text-foreground mt-1">
                {todayAppointmentsCount}
              </p>
            </CardContent>
          </Card>
          <Card className="mobile-card-compact">
            <CardContent className="p-4 text-center">
              <Users className="h-5 w-5 mx-auto text-primary mb-1" />
              <p className="text-xs text-muted-foreground font-semibold uppercase tracking-wide inline-flex items-center gap-1 justify-center">
                Pacientes
                <HelpTooltip id="dashboardActivePatients" />
              </p>
              <p className="text-2xl font-bold text-foreground mt-1">
                {activePatientsCount}
              </p>
            </CardContent>
          </Card>
          <Card className="mobile-card-compact bg-green-500/5 border-green-500/30">
            <CardContent className="p-4 text-center">
              <CreditCard className="h-5 w-5 mx-auto text-green-600 mb-1" />
              <p className="text-xs text-muted-foreground font-semibold uppercase tracking-wide inline-flex items-center gap-1 justify-center">
                Cobrado mes
                <HelpTooltip id="dashboardMonthlyIncome" />
              </p>
              <p className="text-2xl font-bold text-green-600 mt-1">
                {privacyMode ? "•••" : formatCurrency(monthlyIncome, "UYU")}
              </p>
            </CardContent>
          </Card>
          <Card 
            className={`mobile-card-compact cursor-pointer transition-colors ${overduePayments > 0 ? 'bg-destructive/5 border-destructive/30 hover:bg-destructive/10' : ''}`}
            onClick={() => overduePayments > 0 && navigate("/pagos?status=overdue")}
          >
            <CardContent className="p-4 text-center">
              <AlertTriangle className={`h-5 w-5 mx-auto mb-1 ${overduePayments > 0 ? 'text-destructive' : 'text-muted-foreground'}`} />
              <p className="text-xs text-muted-foreground font-semibold uppercase tracking-wide inline-flex items-center gap-1 justify-center">
                Vencidos
                <HelpTooltip id="dashboardOverduePayments" />
              </p>
              <p className={`text-2xl font-bold mt-1 ${overduePayments > 0 ? 'text-destructive' : 'text-foreground'}`}>
                {overduePayments}
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Privacy Toggle for Income */}
        <div className="flex justify-end -mt-2">
          <Button
            variant="ghost"
            size="sm"
            className="text-xs text-muted-foreground gap-1.5 h-8"
            onClick={() => {
              const newValue = !privacyMode;
              setPrivacyMode(newValue);
              localStorage.setItem(PRIVACY_MODE_KEY, String(newValue));
            }}
          >
            {privacyMode ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
            {privacyMode ? "Mostrar montos" : "Ocultar"}
          </Button>
        </div>

        {/* Today's Appointments Section */}
        <Card className="mobile-card">
          <CardHeader className="pb-3 px-0 pt-0 sm:px-6 sm:pt-6">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base font-bold flex items-center gap-2">
                <CalendarDays className="h-5 w-5 text-primary" />
                Hoy en el consultorio
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
                {todayAppointments.map((appointment) => (
                  <div 
                    key={appointment.id} 
                    className="flex items-center justify-between py-3 border-b border-border last:border-0"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="text-sm font-bold text-primary whitespace-nowrap">
                        {formatTime(appointment.start_at)}
                      </span>
                      <span className="text-sm text-foreground truncate">
                        {appointment.patients?.full_name || appointment.contact_name}
                      </span>
                    </div>
                    <span className="text-xs text-muted-foreground capitalize whitespace-nowrap ml-2 px-2 py-1 bg-muted rounded-full">
                      {statusMap[appointment.status] || appointment.status}
                    </span>
                  </div>
                ))}
                {todayAppointmentsCount > 5 && (
                  <Button 
                    variant="ghost" 
                    className="w-full mt-3 h-10 rounded-xl text-sm"
                    onClick={() => navigate("/agenda")}
                  >
                    Ver todas las {todayAppointmentsCount} citas
                  </Button>
                )}
              </div>
            ) : (
              <div className="py-6 text-center">
                <CalendarDays className="h-8 w-8 mx-auto text-muted-foreground/50 mb-2" />
                <p className="text-sm text-muted-foreground">
                  Hoy no tenés citas agendadas
                </p>
                <Button 
                  variant="outline" 
                  size="sm"
                  className="mt-3"
                  onClick={() => setShowAppointmentModal(true)}
                >
                  <CalendarPlus className="h-4 w-4 mr-2" />
                  Agendar cita
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Payment Alerts Section */}
        {(overduePayments > 0 || dueSoonPayments > 0) && (
          <Card className="mobile-card border-orange-500/30 bg-orange-500/5">
            <CardHeader className="pb-3 px-0 pt-0 sm:px-6 sm:pt-6">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base font-bold flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-orange-500" />
                  Alertas de pagos
                </CardTitle>
                <Button
                  variant="outline"
                  size="sm"
                  className="text-xs h-8"
                  onClick={() => navigate("/pagos")}
                >
                  Ver pagos
                </Button>
              </div>
            </CardHeader>
            <CardContent className="px-0 pb-0 sm:px-6 sm:pb-6">
              {/* Alert Summary */}
              <div className="flex gap-4 mb-4">
                {overduePayments > 0 && (
                  <div 
                    className="flex items-center gap-2 cursor-pointer hover:opacity-80"
                    onClick={() => navigate("/pagos?status=overdue")}
                  >
                    <div className="w-3 h-3 rounded-full bg-destructive" />
                    <span className="text-sm text-foreground">
                      <span className="font-bold">{overduePayments}</span> vencidos
                    </span>
                  </div>
                )}
                {dueSoonPayments > 0 && (
                  <div 
                    className="flex items-center gap-2 cursor-pointer hover:opacity-80"
                    onClick={() => navigate("/pagos?status=due_soon")}
                  >
                    <div className="w-3 h-3 rounded-full bg-orange-500" />
                    <span className="text-sm text-foreground">
                      <span className="font-bold">{dueSoonPayments}</span> por vencer
                    </span>
                  </div>
                )}
              </div>
              
              {/* Top 3 Urgent Payments */}
              {urgentPayments.length > 0 && (
                <div className="space-y-2">
                  {urgentPayments.slice(0, 3).map((payment) => (
                    <div 
                      key={payment.id}
                      className="flex items-center justify-between py-2 px-3 rounded-lg bg-background cursor-pointer hover:bg-muted transition-colors"
                      onClick={() => navigate(`/patients/${payment.patient_id}`)}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${payment.calculatedStatus === 'overdue' ? 'bg-destructive' : 'bg-orange-500'}`} />
                        <span className="text-sm text-foreground truncate font-medium">
                          {payment.patientName}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 ml-2 flex-shrink-0">
                        <span className="text-xs text-muted-foreground">
                          {new Date(payment.due_date).toLocaleDateString('es-UY', { day: 'numeric', month: 'short' })}
                        </span>
                        {!privacyMode && (
                          <Badge variant="outline" className="text-xs">
                            {formatCurrency(payment.amount, payment.currency)}
                          </Badge>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Quick Actions */}
        <div>
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
            Accesos rápidos
          </h3>
          <div className="grid grid-cols-4 gap-2">
            <Button
              variant="outline"
              className="h-20 flex flex-col items-center justify-center gap-1.5 rounded-xl"
              onClick={() => setShowPatientForm(true)}
            >
              <UserPlus className="h-5 w-5 text-primary" />
              <span className="text-xs font-medium">Paciente</span>
            </Button>
            <Button
              variant="outline"
              className="h-20 flex flex-col items-center justify-center gap-1.5 rounded-xl"
              onClick={() => setShowAppointmentModal(true)}
            >
              <CalendarPlus className="h-5 w-5 text-primary" />
              <span className="text-xs font-medium">Cita</span>
            </Button>
            <Button
              variant="outline"
              className="h-20 flex flex-col items-center justify-center gap-1.5 rounded-xl"
              onClick={() => setShowPaymentForm(true)}
            >
              <Plus className="h-5 w-5 text-primary" />
              <span className="text-xs font-medium">Pago</span>
            </Button>
            <Button
              variant="outline"
              className="h-20 flex flex-col items-center justify-center gap-1.5 rounded-xl"
              onClick={() => navigate("/pagos")}
            >
              <CreditCard className="h-5 w-5 text-muted-foreground" />
              <span className="text-xs font-medium">Pagos</span>
            </Button>
          </div>
        </div>

        {/* Main Navigation */}
        <div className="grid grid-cols-2 gap-3">
          <Card 
            className="mobile-card-compact hover:shadow-md transition-all cursor-pointer group active:scale-[0.98]"
            onClick={() => navigate("/patients")}
          >
            <CardContent className="p-4 flex flex-col items-center justify-center text-center min-h-[90px]">
              <div className="w-10 h-10 rounded-full bg-secondary flex items-center justify-center mb-2 group-hover:bg-secondary/80 transition-colors">
                <Users className="h-5 w-5 text-secondary-foreground" />
              </div>
              <p className="font-semibold text-sm text-foreground">Pacientes</p>
            </CardContent>
          </Card>

          <Card 
            className="mobile-card-compact hover:shadow-md transition-all cursor-pointer group active:scale-[0.98]"
            onClick={() => navigate("/agenda")}
          >
            <CardContent className="p-4 flex flex-col items-center justify-center text-center min-h-[90px]">
              <div className="w-10 h-10 rounded-full bg-secondary flex items-center justify-center mb-2 group-hover:bg-secondary/80 transition-colors">
                <CalendarDays className="h-5 w-5 text-secondary-foreground" />
              </div>
              <p className="font-semibold text-sm text-foreground">Agenda</p>
            </CardContent>
          </Card>

          <Card 
            className="mobile-card-compact hover:shadow-md transition-all cursor-pointer group active:scale-[0.98] border-primary/30 bg-primary/5"
            onClick={() => navigate("/patients?portal=true")}
          >
            <CardContent className="p-4 flex flex-col items-center justify-center text-center min-h-[90px]">
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center mb-2 group-hover:bg-primary/20 transition-colors">
                <Smartphone className="h-5 w-5 text-primary" />
              </div>
              <p className="font-semibold text-sm text-foreground">Portal</p>
              <p className="text-xs text-muted-foreground">{portalPatientsCount} activos</p>
            </CardContent>
          </Card>

          <Card 
            className="mobile-card-compact hover:shadow-md transition-all cursor-pointer group active:scale-[0.98]"
            onClick={() => navigate("/mi-consultorio")}
          >
            <CardContent className="p-4 flex flex-col items-center justify-center text-center min-h-[90px]">
              <div className="w-10 h-10 rounded-full bg-secondary flex items-center justify-center mb-2 group-hover:bg-secondary/80 transition-colors">
                <Settings className="h-5 w-5 text-secondary-foreground" />
              </div>
              <p className="font-semibold text-sm text-foreground">Consultorio</p>
            </CardContent>
          </Card>

          {isDemo && (
            <Card 
              className="mobile-card-compact hover:shadow-md transition-all cursor-pointer group active:scale-[0.98] border-accent bg-accent/10 col-span-2 sm:col-span-1"
              onClick={() => navigate("/portal-paciente/demo")}
            >
              <CardContent className="p-4 flex flex-col items-center justify-center text-center min-h-[90px]">
                <div className="w-10 h-10 rounded-full bg-accent/20 flex items-center justify-center mb-2 group-hover:bg-accent/30 transition-colors">
                  <Eye className="h-5 w-5 text-accent-foreground" />
                </div>
                <p className="font-semibold text-sm text-foreground">Demo Paciente</p>
                <p className="text-xs text-muted-foreground">Ver portal</p>
              </CardContent>
            </Card>
          )}

          <Card 
            className="mobile-card-compact hover:shadow-md transition-all cursor-pointer group active:scale-[0.98] border-primary/20 bg-primary/5 col-span-2 sm:col-span-1"
            onClick={() => navigate("/personalizar-portal")}
          >
            <CardContent className="p-4 flex flex-col items-center justify-center text-center min-h-[90px]">
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center mb-2 group-hover:bg-primary/20 transition-colors">
                <Palette className="h-5 w-5 text-primary" />
              </div>
              <p className="font-semibold text-sm text-foreground">Personalizar Portal</p>
              <p className="text-xs text-muted-foreground">Logo y colores</p>
            </CardContent>
          </Card>
        </div>

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
