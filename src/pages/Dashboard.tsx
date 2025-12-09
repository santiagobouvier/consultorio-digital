import { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { toast } from "@/hooks/use-toast";
import { Users, CalendarPlus, CalendarDays, UserPlus, Bell, LogOut, Camera, CreditCard, AlertTriangle, Clock, Plus, EyeOff, Eye, Smartphone, Building2, ChevronDown, Shield, Settings } from "lucide-react";
import { PlanUsageCard } from "@/components/PlanUsageCard";
import { PatientForm } from "@/components/PatientForm";
import { CreateAppointmentModal } from "@/components/CreateAppointmentModal";
import { GlobalPaymentForm } from "@/components/GlobalPaymentForm";
import { calculatePaymentStatus, formatCurrency } from "@/lib/payments";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";

const PRIVACY_MODE_KEY = "privacy_mode_enabled";

interface Business {
  id: string;
  name: string;
  owner_user_id: string;
}

const Dashboard = () => {
  const navigate = useNavigate();
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
  
  // Super admin state
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [allBusinesses, setAllBusinesses] = useState<Business[]>([]);
  const [selectedBusiness, setSelectedBusiness] = useState<Business | null>(null);

  const statusMap: Record<string, string> = {
    pending: "pendiente",
    confirmed: "confirmada",
    cancelled: "cancelada",
    attended: "atendida",
    no_show: "ausencia",
  };

  useEffect(() => {
    // Check if coming from SaaS admin with selected business
    const saasSelectedBusiness = sessionStorage.getItem("saas_selected_business");
    if (saasSelectedBusiness) {
      sessionStorage.removeItem("saas_selected_business");
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
      const { data: superAdminRole } = await supabase
        .from("user_roles")
        .select("id")
        .eq("user_id", user.id)
        .eq("role", "super_admin")
        .maybeSingle();

      const isAdmin = !!superAdminRole;
      setIsSuperAdmin(isAdmin);

      let currentBusinessId = overrideBusinessId || null;

      if (isAdmin) {
        // Super admin: load all businesses
        const { data: businesses } = await supabase
          .from("businesses")
          .select("id, name, owner_user_id")
          .order("name");

        if (businesses && businesses.length > 0) {
          setAllBusinesses(businesses);
          
          // Use override or first business
          if (!currentBusinessId) {
            currentBusinessId = businesses[0].id;
          }
          
          const selected = businesses.find(b => b.id === currentBusinessId) || businesses[0];
          setSelectedBusiness(selected);
          currentBusinessId = selected.id;
        }
      } else {
        // Regular user: check for owned or member business
        let { data: business } = await supabase
          .from("businesses")
          .select("id, name, owner_user_id")
          .eq("owner_user_id", user.id)
          .maybeSingle();

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
              .select("id, name, owner_user_id")
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

      if (!currentBusinessId) {
        navigate("/configurar-negocio");
        return;
      }

      setBusinessId(currentBusinessId);

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
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <p className="text-muted-foreground">Cargando...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-2xl mx-auto p-4 sm:p-6 space-y-6">
        {/* Super Admin Business Selector */}
        {isSuperAdmin && allBusinesses.length > 0 && (
          <Card className="mobile-card-compact bg-primary/5 border-primary/30">
            <CardContent className="p-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Badge variant="default" className="text-xs">Super Admin</Badge>
                  <span className="text-xs text-muted-foreground">
                    {allBusinesses.length} consultorios
                  </span>
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm" className="gap-2">
                      <Building2 className="h-4 w-4" />
                      <span className="truncate max-w-[150px]">{selectedBusiness?.name || "Seleccionar"}</span>
                      <ChevronDown className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="max-h-64 overflow-y-auto">
                    {allBusinesses.map((business) => (
                      <DropdownMenuItem
                        key={business.id}
                        onClick={() => {
                          setSelectedBusiness(business);
                          fetchDashboardData(business.id);
                        }}
                        className={business.id === selectedBusiness?.id ? "bg-accent" : ""}
                      >
                        {business.name}
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
              <h1 className="text-xl sm:text-2xl font-bold text-foreground">
                Hola, {userName}
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

        {/* Plan Usage Card */}
        <PlanUsageCard businessId={businessId} />

        {/* Metrics */}
        <div className="grid grid-cols-2 gap-3">
          <Card className="mobile-card-compact">
            <CardContent className="p-4 text-center">
              <p className="text-xs text-muted-foreground font-semibold uppercase tracking-wide">
                Pacientes activos
              </p>
              <p className="text-3xl font-bold text-foreground mt-2">
                {activePatientsCount}
              </p>
            </CardContent>
          </Card>
          <Card className="mobile-card-compact">
            <CardContent className="p-4 text-center">
              <p className="text-xs text-muted-foreground font-semibold uppercase tracking-wide">
                Citas de hoy
              </p>
              <p className="text-3xl font-bold text-foreground mt-2">
                {todayAppointmentsCount}
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Payment Alerts */}
        {(overduePayments > 0 || dueSoonPayments > 0) && (
          <div className="grid grid-cols-2 gap-3">
            {overduePayments > 0 && (
              <Card 
                className="mobile-card-compact border-destructive/50 bg-destructive/5 hover:bg-destructive/10 cursor-pointer transition-colors"
                onClick={() => navigate("/pagos?status=overdue")}
              >
                <CardContent className="p-4 text-center">
                  <AlertTriangle className="h-5 w-5 text-destructive mx-auto mb-1" />
                  <p className="text-xs text-destructive font-semibold uppercase tracking-wide">
                    Pagos vencidos
                  </p>
                  <p className="text-2xl font-bold text-destructive mt-1">
                    {overduePayments}
                  </p>
                </CardContent>
              </Card>
            )}
            {dueSoonPayments > 0 && (
              <Card 
                className="mobile-card-compact border-orange-500/50 bg-orange-500/5 hover:bg-orange-500/10 cursor-pointer transition-colors"
                onClick={() => navigate("/pagos?status=due_soon")}
              >
                <CardContent className="p-4 text-center">
                  <Clock className="h-5 w-5 text-orange-500 mx-auto mb-1" />
                  <p className="text-xs text-orange-600 font-semibold uppercase tracking-wide">
                    Por vencer (4 días)
                  </p>
                  <p className="text-2xl font-bold text-orange-600 mt-1">
                    {dueSoonPayments}
                  </p>
                </CardContent>
              </Card>
            )}
          </div>
        )}

        {/* Monthly Income */}
        <Card className="mobile-card-compact bg-green-500/5 border-green-500/30">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground font-semibold uppercase tracking-wide">
                  Ingresos del mes
                </p>
                <p className="text-2xl font-bold text-green-600 mt-1">
                  {privacyMode ? "•••• UYU" : formatCurrency(monthlyIncome, "UYU")}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="icon"
                  className="text-muted-foreground hover:text-foreground h-9 w-9"
                  onClick={() => {
                    const newValue = !privacyMode;
                    setPrivacyMode(newValue);
                    localStorage.setItem(PRIVACY_MODE_KEY, String(newValue));
                  }}
                  title={privacyMode ? "Mostrar montos" : "Ocultar montos"}
                >
                  {privacyMode ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-green-600 hover:bg-green-500/10"
                  onClick={() => navigate("/pagos?status=paid")}
                >
                  Ver pagados
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Register Payment Button */}
        <Button 
          className="w-full h-12 rounded-xl font-semibold gap-2"
          onClick={() => setShowPaymentForm(true)}
        >
          <Plus className="h-5 w-5" />
          Registrar pago
        </Button>

        {/* Main Actions */}
        <div className="grid grid-cols-2 gap-3">
          <Card 
            className="mobile-card-compact hover:shadow-md transition-all cursor-pointer group active:scale-[0.98]"
            onClick={() => setShowPatientForm(true)}
          >
            <CardContent className="p-4 flex flex-col items-center justify-center text-center min-h-[100px]">
              <div className="w-11 h-11 rounded-full bg-primary/10 flex items-center justify-center mb-2 group-hover:bg-primary/20 transition-colors">
                <UserPlus className="h-5 w-5 text-primary" />
              </div>
              <p className="font-semibold text-sm text-foreground">Crear paciente</p>
            </CardContent>
          </Card>

          <Card 
            className="mobile-card-compact hover:shadow-md transition-all cursor-pointer group active:scale-[0.98]"
            onClick={() => setShowAppointmentModal(true)}
          >
            <CardContent className="p-4 flex flex-col items-center justify-center text-center min-h-[100px]">
              <div className="w-11 h-11 rounded-full bg-primary/10 flex items-center justify-center mb-2 group-hover:bg-primary/20 transition-colors">
                <CalendarPlus className="h-5 w-5 text-primary" />
              </div>
              <p className="font-semibold text-sm text-foreground">Crear cita</p>
            </CardContent>
          </Card>

          <Card 
            className="mobile-card-compact hover:shadow-md transition-all cursor-pointer group active:scale-[0.98]"
            onClick={() => navigate("/patients")}
          >
            <CardContent className="p-4 flex flex-col items-center justify-center text-center min-h-[100px]">
              <div className="w-11 h-11 rounded-full bg-secondary flex items-center justify-center mb-2 group-hover:bg-secondary/80 transition-colors">
                <Users className="h-5 w-5 text-secondary-foreground" />
              </div>
              <p className="font-semibold text-sm text-foreground">Ver pacientes</p>
            </CardContent>
          </Card>

          <Card 
            className="mobile-card-compact hover:shadow-md transition-all cursor-pointer group active:scale-[0.98]"
            onClick={() => navigate("/agenda")}
          >
            <CardContent className="p-4 flex flex-col items-center justify-center text-center min-h-[100px]">
              <div className="w-11 h-11 rounded-full bg-secondary flex items-center justify-center mb-2 group-hover:bg-secondary/80 transition-colors">
                <CalendarDays className="h-5 w-5 text-secondary-foreground" />
              </div>
              <p className="font-semibold text-sm text-foreground">Ver agenda</p>
            </CardContent>
          </Card>

          <Card 
            className="mobile-card-compact hover:shadow-md transition-all cursor-pointer group active:scale-[0.98]"
            onClick={() => navigate("/pagos")}
          >
            <CardContent className="p-4 flex flex-col items-center justify-center text-center min-h-[100px]">
              <div className="w-11 h-11 rounded-full bg-secondary flex items-center justify-center mb-2 group-hover:bg-secondary/80 transition-colors">
                <CreditCard className="h-5 w-5 text-secondary-foreground" />
              </div>
              <p className="font-semibold text-sm text-foreground">Ver pagos</p>
            </CardContent>
          </Card>

          <Card 
            className="mobile-card-compact hover:shadow-md transition-all cursor-pointer group active:scale-[0.98] border-primary/30 bg-primary/5"
            onClick={() => navigate("/patients?portal=true")}
          >
            <CardContent className="p-4 flex flex-col items-center justify-center text-center min-h-[100px]">
              <div className="w-11 h-11 rounded-full bg-primary/10 flex items-center justify-center mb-2 group-hover:bg-primary/20 transition-colors">
                <Smartphone className="h-5 w-5 text-primary" />
              </div>
              <p className="font-semibold text-sm text-foreground">Portal pacientes</p>
              <p className="text-xs text-muted-foreground mt-1">{portalPatientsCount} con acceso</p>
            </CardContent>
          </Card>
        </div>

        {/* Today's Appointments */}
        {todayAppointments.length > 0 && (
          <Card className="mobile-card">
            <CardHeader className="pb-3 px-0 pt-0 sm:px-6 sm:pt-6">
              <CardTitle className="text-base font-bold">
                Próximas citas de hoy
              </CardTitle>
            </CardHeader>
            <CardContent className="px-0 pb-0 sm:px-6 sm:pb-6">
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
              </div>
              {todayAppointmentsCount > 5 && (
                <Button 
                  variant="ghost" 
                  className="w-full mt-3 h-11 rounded-xl text-sm font-semibold"
                  onClick={() => navigate("/agenda")}
                >
                  Ver todas las citas
                </Button>
              )}
            </CardContent>
          </Card>
        )}

        {todayAppointments.length === 0 && (
          <Card className="mobile-card">
            <CardContent className="py-8 text-center">
              <CalendarDays className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
              <p className="text-muted-foreground text-sm">
                No hay citas programadas para hoy
              </p>
            </CardContent>
          </Card>
        )}

        {/* Settings Link */}
        <div className="flex gap-3">
          <Button
            variant="outline"
            className="flex-1 h-12 rounded-xl font-semibold"
            onClick={() => navigate("/mi-consultorio")}
          >
            Mi Consultorio
          </Button>
          {isSuperAdmin && (
            <Button
              variant="default"
              className="h-12 rounded-xl font-semibold gap-2"
              onClick={() => navigate("/saas-admin")}
            >
              <Shield className="h-4 w-4" />
              Panel SaaS
            </Button>
          )}
        </div>
      </div>

      {/* Modals */}
      <PatientForm
        open={showPatientForm}
        onOpenChange={setShowPatientForm}
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
