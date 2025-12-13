import { useState, useEffect, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useBusinessId } from "@/hooks/use-business-id";
import { useProfessionals } from "@/hooks/use-professionals";
import { calculatePaymentStatus, formatCurrency } from "@/lib/payments";
import { format, isSameDay, addDays, startOfWeek, endOfWeek } from "date-fns";
import { es } from "date-fns/locale";
import { toast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  CalendarDays,
  Users,
  CreditCard,
  AlertTriangle,
  Clock,
  Plus,
  ArrowRight,
  CheckCircle2,
  CircleDollarSign,
  TrendingUp,
  Activity,
  Calendar,
  LogOut,
  Settings,
  UserCircle,
} from "lucide-react";

interface Appointment {
  id: string;
  start_at: string;
  status: string;
  patient_id: string | null;
  professional_id: string | null;
  patients: { full_name: string } | null;
  services: { name: string } | null;
}

interface Payment {
  id: string;
  patient_id: string;
  due_date: string;
  paid_at: string | null;
  status: string;
  amount: number;
  patientName?: string;
  calculatedStatus?: string;
}

interface WeekAppointment {
  id: string;
  status: string;
}

export const DesktopDashboard = () => {
  const navigate = useNavigate();
  const { businessId, loading: businessLoading } = useBusinessId();
  const { professionals, loading: professionalsLoading, isOwner } = useProfessionals(businessId);

  // Data state
  const [businessName, setBusinessName] = useState("");
  const [userName, setUserName] = useState("");
  const [userRole, setUserRole] = useState("");
  const [todayAppointments, setTodayAppointments] = useState<Appointment[]>([]);
  const [weekAppointments, setWeekAppointments] = useState<WeekAppointment[]>([]);
  const [pendingPayments, setPendingPayments] = useState<Payment[]>([]);
  const [overdueCount, setOverdueCount] = useState(0);
  const [dueSoonCount, setDueSoonCount] = useState(0);
  const [pendingTodayAmount, setPendingTodayAmount] = useState(0);
  const [pendingWeekAmount, setPendingWeekAmount] = useState(0);
  const [attendedToday, setAttendedToday] = useState(0);
  const [pendingToday, setPendingToday] = useState(0);
  const [dataLoading, setDataLoading] = useState(true);

  // Fetch all data
  const fetchDashboardData = useCallback(async () => {
    if (!businessId) return;

    try {
      setDataLoading(true);

      // Get user info
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: profile } = await supabase
        .from("profiles")
        .select("name")
        .eq("id", user.id)
        .single();

      if (profile) setUserName(profile.name);

      // Get business info
      const { data: business } = await supabase
        .from("businesses")
        .select("name")
        .eq("id", businessId)
        .single();

      if (business) setBusinessName(business.name);

      // Get user role
      const { data: roleData } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .eq("business_id", businessId)
        .maybeSingle();

      if (roleData) {
        const roleMap: Record<string, string> = {
          owner: "Administrador",
          professional: "Profesional",
          super_admin: "Super Admin",
        };
        setUserRole(roleMap[roleData.role] || roleData.role);
      }

      // Fetch today's appointments
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);

      const { data: todayAppts } = await supabase
        .from("appointments")
        .select(`
          id,
          start_at,
          status,
          patient_id,
          professional_id,
          patients (full_name),
          services (name)
        `)
        .eq("business_id", businessId)
        .gte("start_at", today.toISOString())
        .lt("start_at", tomorrow.toISOString())
        .not("status", "in", '("cancelled")')
        .order("start_at", { ascending: true });

      setTodayAppointments(todayAppts || []);
      setAttendedToday((todayAppts || []).filter(a => a.status === "attended").length);
      setPendingToday((todayAppts || []).filter(a => a.status === "pending" || a.status === "confirmed").length);

      // Fetch week appointments for activity
      const weekStart = startOfWeek(new Date(), { weekStartsOn: 1 });
      const weekEnd = endOfWeek(new Date(), { weekStartsOn: 1 });

      const { data: weekAppts } = await supabase
        .from("appointments")
        .select("id, status")
        .eq("business_id", businessId)
        .gte("start_at", weekStart.toISOString())
        .lte("start_at", weekEnd.toISOString())
        .not("status", "in", '("cancelled")');

      setWeekAppointments(weekAppts || []);

      // Fetch pending payments
      const { data: payments } = await supabase
        .from("payments")
        .select("id, patient_id, due_date, paid_at, status, amount")
        .eq("business_id", businessId)
        .neq("status", "cancelled")
        .is("paid_at", null);

      if (payments && payments.length > 0) {
        // Get patient names
        const patientIds = [...new Set(payments.map(p => p.patient_id))];
        const { data: patients } = await supabase
          .from("patients")
          .select("id, full_name")
          .in("id", patientIds);

        const patientMap = new Map(patients?.map(p => [p.id, p.full_name]) || []);

        const paymentsWithNames = payments.map(p => ({
          ...p,
          patientName: patientMap.get(p.patient_id) || "Desconocido",
          calculatedStatus: calculatePaymentStatus(p),
        }));

        setPendingPayments(paymentsWithNames);

        const overdue = paymentsWithNames.filter(p => p.calculatedStatus === "overdue");
        const dueSoon = paymentsWithNames.filter(p => p.calculatedStatus === "due_soon");

        setOverdueCount(overdue.length);
        setDueSoonCount(dueSoon.length);

        // Calculate pending today and week
        const todayPayments = overdue.reduce((sum, p) => sum + (p.amount || 0), 0);
        const weekPayments = [...overdue, ...dueSoon].reduce((sum, p) => sum + (p.amount || 0), 0);

        setPendingTodayAmount(todayPayments);
        setPendingWeekAmount(weekPayments);
      }
    } catch (error) {
      console.error("Error fetching dashboard data:", error);
      toast({
        title: "Error",
        description: "No se pudo cargar la información",
        variant: "destructive",
      });
    } finally {
      setDataLoading(false);
    }
  }, [businessId]);

  useEffect(() => {
    if (businessId) {
      fetchDashboardData();
    }
  }, [businessId, fetchDashboardData]);

  // Get active professionals today
  const activeProfessionalsToday = useMemo(() => {
    const professionalIds = new Set(
      todayAppointments
        .filter(a => a.professional_id)
        .map(a => a.professional_id)
    );
    return professionals.filter(p => professionalIds.has(p.userId));
  }, [todayAppointments, professionals]);

  // Next 3 appointments
  const nextAppointments = useMemo(() => {
    const now = new Date();
    return todayAppointments
      .filter(a => new Date(a.start_at) >= now && a.status !== "attended" && a.status !== "cancelled")
      .slice(0, 3);
  }, [todayAppointments]);

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

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/auth");
  };

  const loading = businessLoading || professionalsLoading;

  if (loading || dataLoading) {
    return (
      <div className="min-h-screen bg-background p-8">
        <div className="max-w-7xl mx-auto space-y-8">
          <Skeleton className="h-20 w-full rounded-2xl" />
          <div className="grid grid-cols-3 gap-6">
            <Skeleton className="h-80 rounded-2xl" />
            <Skeleton className="h-80 rounded-2xl" />
            <Skeleton className="h-80 rounded-2xl" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20">
      {/* Status Header Bar */}
      <header className="border-b bg-card/80 backdrop-blur-xl sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-8 py-4">
          <div className="flex items-center justify-between">
            {/* Left: Business & User Info */}
            <div className="flex items-center gap-6">
              <div>
                <h1 className="text-2xl font-bold text-foreground">{businessName}</h1>
                <div className="flex items-center gap-3 mt-1">
                  <Badge variant="outline" className="text-xs font-normal">
                    {format(new Date(), "EEEE d 'de' MMMM, yyyy", { locale: es })}
                  </Badge>
                  <Badge variant="secondary" className="text-xs">
                    {userRole}
                  </Badge>
                </div>
              </div>
            </div>

            {/* Right: Quick Stats & Actions */}
            <div className="flex items-center gap-6">
              {/* Quick Indicators */}
              <div className="flex items-center gap-4 pr-6 border-r">
                <div className="flex items-center gap-2">
                  <CalendarDays className="h-4 w-4 text-primary" />
                  <span className="text-sm font-medium">{todayAppointments.length} citas hoy</span>
                </div>
                {overdueCount > 0 && (
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-destructive" />
                    <span className="text-sm font-medium text-destructive">{overdueCount} vencidos</span>
                  </div>
                )}
                {dueSoonCount > 0 && overdueCount === 0 && (
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-orange-500" />
                    <span className="text-sm font-medium text-orange-500">{dueSoonCount} por vencer</span>
                  </div>
                )}
              </div>

              {/* User Menu */}
              <div className="flex items-center gap-3">
                <Button variant="ghost" size="icon" onClick={() => navigate("/configuracion")}>
                  <Settings className="h-5 w-5" />
                </Button>
                <Button variant="ghost" size="icon" onClick={handleLogout}>
                  <LogOut className="h-5 w-5" />
                </Button>
                <div className="flex items-center gap-2 pl-3 border-l">
                  <Avatar className="h-8 w-8">
                    <AvatarFallback className="bg-primary/10 text-primary text-xs">
                      {getInitials(userName)}
                    </AvatarFallback>
                  </Avatar>
                  <span className="text-sm font-medium">{userName.split(" ")[0]}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-8 py-8">
        {/* Main Cards Grid */}
        <div className="grid grid-cols-3 gap-6 mb-8">
          {/* Today in the Clinic Card */}
          <Card className="bg-card/80 backdrop-blur border-border/50 shadow-lg hover:shadow-xl transition-all duration-300">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg font-semibold flex items-center gap-2">
                  <Calendar className="h-5 w-5 text-primary" />
                  Hoy en el consultorio
                </CardTitle>
                <Badge variant="outline">{nextAppointments.length} próximas</Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Next Appointments List */}
              <div className="space-y-3">
                {nextAppointments.length === 0 ? (
                  <div className="text-center py-6 text-muted-foreground">
                    <CheckCircle2 className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">No hay citas pendientes</p>
                  </div>
                ) : (
                  nextAppointments.map((apt) => {
                    const professional = professionals.find(p => p.userId === apt.professional_id);
                    return (
                      <div
                        key={apt.id}
                        className="flex items-center gap-3 p-3 rounded-xl bg-muted/50 hover:bg-muted transition-colors"
                      >
                        <div className="flex-shrink-0">
                          <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
                            <span className="text-sm font-bold text-primary">
                              {formatTime(apt.start_at)}
                            </span>
                          </div>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-foreground truncate">
                            {apt.patients?.full_name || "Sin paciente"}
                          </p>
                          <div className="flex items-center gap-2 mt-0.5">
                            {professional && (
                              <div className="flex items-center gap-1">
                                <div
                                  className="w-2 h-2 rounded-full"
                                  style={{ backgroundColor: professional.color || "#00b5b5" }}
                                />
                                <span className="text-xs text-muted-foreground">
                                  {professional.name.split(" ")[0]}
                                </span>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {/* View Full Agenda Button */}
              <Button
                variant="default"
                className="w-full mt-4 gap-2 h-12 text-base font-medium"
                onClick={() => navigate("/agenda")}
              >
                Ver agenda completa
                <ArrowRight className="h-4 w-4" />
              </Button>
            </CardContent>
          </Card>

          {/* Financial Status Card */}
          <Card className="bg-card/80 backdrop-blur border-border/50 shadow-lg hover:shadow-xl transition-all duration-300">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg font-semibold flex items-center gap-2">
                  <CircleDollarSign className="h-5 w-5 text-primary" />
                  Estado financiero
                </CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Payment Stats */}
              <div className="grid grid-cols-2 gap-3">
                <div className="p-4 rounded-xl bg-destructive/10 border border-destructive/20">
                  <p className="text-xs text-muted-foreground mb-1">Pendientes hoy</p>
                  <p className="text-2xl font-bold text-destructive">
                    {formatCurrency(pendingTodayAmount)}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {overdueCount} pago{overdueCount !== 1 ? "s" : ""} vencido{overdueCount !== 1 ? "s" : ""}
                  </p>
                </div>
                <div className="p-4 rounded-xl bg-orange-500/10 border border-orange-500/20">
                  <p className="text-xs text-muted-foreground mb-1">Esta semana</p>
                  <p className="text-2xl font-bold text-orange-500">
                    {formatCurrency(pendingWeekAmount)}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {dueSoonCount} próximo{dueSoonCount !== 1 ? "s" : ""} a vencer
                  </p>
                </div>
              </div>

              {/* Recent Pending Payments */}
              <div className="space-y-2">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Pagos urgentes
                </p>
                <ScrollArea className="h-[100px]">
                  {pendingPayments
                    .filter(p => p.calculatedStatus === "overdue" || p.calculatedStatus === "due_soon")
                    .slice(0, 3)
                    .map((payment) => (
                      <div
                        key={payment.id}
                        className="flex items-center justify-between py-2 px-2 rounded-lg hover:bg-muted/50"
                      >
                        <span className="text-sm truncate max-w-[140px]">{payment.patientName}</span>
                        <Badge
                          variant={payment.calculatedStatus === "overdue" ? "destructive" : "outline"}
                          className="text-xs"
                        >
                          {formatCurrency(payment.amount)}
                        </Badge>
                      </div>
                    ))}
                </ScrollArea>
              </div>

              {/* Manage Payments Button */}
              <Button
                variant="default"
                className="w-full mt-2 gap-2 h-12 text-base font-medium"
                onClick={() => navigate("/pagos")}
              >
                Gestionar pagos
                <ArrowRight className="h-4 w-4" />
              </Button>
            </CardContent>
          </Card>

          {/* Activity Card */}
          <Card className="bg-card/80 backdrop-blur border-border/50 shadow-lg hover:shadow-xl transition-all duration-300">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg font-semibold flex items-center gap-2">
                  <Activity className="h-5 w-5 text-primary" />
                  Actividad
                </CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Activity Stats */}
              <div className="grid grid-cols-2 gap-3">
                <div className="p-4 rounded-xl bg-primary/10 border border-primary/20">
                  <p className="text-xs text-muted-foreground mb-1">Atendidos hoy</p>
                  <p className="text-3xl font-bold text-primary">{attendedToday}</p>
                </div>
                <div className="p-4 rounded-xl bg-muted/50 border border-border/50">
                  <p className="text-xs text-muted-foreground mb-1">Pendientes</p>
                  <p className="text-3xl font-bold text-foreground">{pendingToday}</p>
                </div>
              </div>

              {/* Active Professionals */}
              <div className="space-y-2">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Profesionales activos hoy
                </p>
                <div className="space-y-2">
                  {activeProfessionalsToday.length === 0 ? (
                    <p className="text-sm text-muted-foreground py-2">Sin profesionales con citas</p>
                  ) : (
                    activeProfessionalsToday.slice(0, 3).map((prof) => {
                      const profAppointments = todayAppointments.filter(
                        a => a.professional_id === prof.userId
                      );
                      const attended = profAppointments.filter(a => a.status === "attended").length;
                      return (
                        <div
                          key={prof.id}
                          className="flex items-center justify-between py-2 px-2 rounded-lg hover:bg-muted/50"
                        >
                          <div className="flex items-center gap-2">
                            <div
                              className="w-3 h-3 rounded-full"
                              style={{ backgroundColor: prof.color || "#00b5b5" }}
                            />
                            <span className="text-sm font-medium">{prof.name.split(" ")[0]}</span>
                          </div>
                          <span className="text-xs text-muted-foreground">
                            {attended}/{profAppointments.length} atendidas
                          </span>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              {/* Week Summary */}
              <div className="p-3 rounded-xl bg-muted/30 border border-border/30">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Citas esta semana</span>
                  <span className="text-lg font-bold">{weekAppointments.length}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Quick Actions Row */}
        <div className="grid grid-cols-4 gap-4">
          <Button
            variant="outline"
            className="h-16 flex items-center justify-center gap-3 text-base font-medium bg-card/50 hover:bg-card hover:shadow-md transition-all"
            onClick={() => navigate("/agenda")}
          >
            <CalendarDays className="h-5 w-5 text-primary" />
            Ir a agenda
          </Button>
          <Button
            variant="default"
            className="h-16 flex items-center justify-center gap-3 text-base font-medium hover:shadow-md transition-all"
            onClick={() => navigate("/agenda")}
          >
            <Plus className="h-5 w-5" />
            Nueva cita
          </Button>
          <Button
            variant="outline"
            className="h-16 flex items-center justify-center gap-3 text-base font-medium bg-card/50 hover:bg-card hover:shadow-md transition-all"
            onClick={() => navigate("/pacientes")}
          >
            <Users className="h-5 w-5 text-primary" />
            Ver pacientes
          </Button>
          <Button
            variant="outline"
            className="h-16 flex items-center justify-center gap-3 text-base font-medium bg-card/50 hover:bg-card hover:shadow-md transition-all"
            onClick={() => navigate("/pagos")}
          >
            <CreditCard className="h-5 w-5 text-primary" />
            Pagos
          </Button>
        </div>
      </main>
    </div>
  );
};
