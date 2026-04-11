import { useState, useEffect, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useBusinessId } from "@/hooks/use-business-id";
import { useProfessionals } from "@/hooks/use-professionals";
import { calculatePaymentStatus, formatCurrency } from "@/lib/payments";
import { format, startOfMonth, endOfMonth, addDays, isToday, isTomorrow } from "date-fns";
import { es } from "date-fns/locale";
import { toast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { MonthlyHighlights } from "@/components/MonthlyHighlights";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  CalendarDays,
  Users,
  CreditCard,
  AlertTriangle,
  Clock,
  Plus,
  ArrowRight,
  DollarSign,
  UserPlus,
  TrendingUp,
  Building2,
  CalendarCheck,
  AlertCircle,
  Eye,
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

export const DesktopDashboard = () => {
  const navigate = useNavigate();
  const { businessId, loading: businessLoading } = useBusinessId();
  const { professionals, loading: professionalsLoading, isOwner } = useProfessionals(businessId);

  // Data state
  const [businessName, setBusinessName] = useState("");
  const [userName, setUserName] = useState("");
  const [isDemo, setIsDemo] = useState(false);
  const [selectedProfessionalId, setSelectedProfessionalId] = useState<string>("all");
  
  // KPIs
  const [todayAppointmentsCount, setTodayAppointmentsCount] = useState(0);
  const [activePatientsCount, setActivePatientsCount] = useState(0);
  const [collectedThisMonth, setCollectedThisMonth] = useState(0);
  const [overduePaymentsCount, setOverduePaymentsCount] = useState(0);
  const [overdueAmount, setOverdueAmount] = useState(0);
  
  // Lists
  const [upcomingAppointments, setUpcomingAppointments] = useState<Appointment[]>([]);
  const [pendingPayments, setPendingPayments] = useState<Payment[]>([]);
  const [todayAppointments, setTodayAppointments] = useState<Appointment[]>([]);
  
  const [dataLoading, setDataLoading] = useState(true);

  const fetchDashboardData = useCallback(async () => {
    if (!businessId) return;

    try {
      setDataLoading(true);

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: profile } = await supabase
        .from("profiles")
        .select("name")
        .eq("id", user.id)
        .single();

      if (profile) setUserName(profile.name);

      const { data: business } = await supabase
        .from("businesses")
        .select("name, is_demo")
        .eq("id", businessId)
        .single();

      if (business) {
        setBusinessName(business.name);
        setIsDemo(business.is_demo || false);
      }

      // Today's appointments count
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);

      const { data: todayAppts, count: todayCount } = await supabase
        .from("appointments")
        .select(`
          id,
          start_at,
          status,
          patient_id,
          professional_id,
          patients (full_name),
          services (name)
        `, { count: 'exact' })
        .eq("business_id", businessId)
        .gte("start_at", today.toISOString())
        .lt("start_at", tomorrow.toISOString())
        .not("status", "in", '("cancelled")')
        .order("start_at", { ascending: true });

      setTodayAppointmentsCount(todayCount || 0);
      setTodayAppointments(todayAppts || []);

      // Upcoming appointments (today + tomorrow, max 5, not attended)
      const dayAfterTomorrow = addDays(today, 2);
      const { data: upcomingAppts } = await supabase
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
        .gte("start_at", new Date().toISOString())
        .lt("start_at", dayAfterTomorrow.toISOString())
        .not("status", "in", '("cancelled","attended")')
        .order("start_at", { ascending: true })
        .limit(5);

      setUpcomingAppointments(upcomingAppts || []);

      // Active patients count
      const { count: patientsCount } = await supabase
        .from("patients")
        .select("id", { count: 'exact', head: true })
        .eq("business_id", businessId)
        .eq("is_active", true);

      setActivePatientsCount(patientsCount || 0);

      // Collected this month
      const monthStart = startOfMonth(new Date());
      const monthEnd = endOfMonth(new Date());

      const { data: paidPayments } = await supabase
        .from("payments")
        .select("amount")
        .eq("business_id", businessId)
        .not("paid_at", "is", null)
        .gte("paid_at", monthStart.toISOString())
        .lte("paid_at", monthEnd.toISOString());

      const totalCollected = paidPayments?.reduce((sum, p) => sum + (p.amount || 0), 0) || 0;
      setCollectedThisMonth(totalCollected);

      // Pending/overdue payments
      const { data: payments } = await supabase
        .from("payments")
        .select("id, patient_id, due_date, paid_at, status, amount")
        .eq("business_id", businessId)
        .neq("status", "cancelled")
        .is("paid_at", null);

      if (payments && payments.length > 0) {
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
        setOverduePaymentsCount(overdue.length);
        setOverdueAmount(overdue.reduce((sum, p) => sum + (p.amount || 0), 0));
      } else {
        setPendingPayments([]);
        setOverduePaymentsCount(0);
        setOverdueAmount(0);
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

  // Active professionals today
  const activeProfessionalsToday = useMemo(() => {
    const professionalIds = new Set(
      todayAppointments
        .filter(a => a.professional_id)
        .map(a => a.professional_id)
    );
    return professionals.filter(p => professionalIds.has(p.userId));
  }, [todayAppointments, professionals]);

  // Agenda occupation (% of day with appointments)
  const agendaOccupation = useMemo(() => {
    const totalSlots = 8; // assume 8 hour work day
    const occupiedSlots = todayAppointmentsCount;
    return Math.min(Math.round((occupiedSlots / totalSlots) * 100), 100);
  }, [todayAppointmentsCount]);

  const formatTime = (datetime: string) => {
    return format(new Date(datetime), "HH:mm", { locale: es });
  };

  const getDateLabel = (datetime: string) => {
    const date = new Date(datetime);
    if (isToday(date)) return "Hoy";
    if (isTomorrow(date)) return "Mañana";
    return format(date, "EEE d", { locale: es });
  };

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return "Buenos días";
    if (hour < 19) return "Buenas tardes";
    return "Buenas noches";
  };

  const loading = businessLoading || professionalsLoading;

  if (loading || dataLoading) {
    return (
      <div className="min-h-screen bg-background p-10">
        <div className="max-w-[1400px] mx-auto space-y-10">
          <Skeleton className="h-24 w-full rounded-2xl" />
          <div className="grid grid-cols-4 gap-6">
            {[...Array(4)].map((_, i) => (
              <Skeleton key={i} className="h-36 rounded-2xl" />
            ))}
          </div>
          <div className="grid grid-cols-2 gap-8">
            <Skeleton className="h-96 rounded-2xl" />
            <Skeleton className="h-96 rounded-2xl" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/30">
      {/* Header Superior */}
      <header className="border-b border-border/50 bg-card/50 backdrop-blur-sm">
        <div className="max-w-[1400px] mx-auto px-10 py-6">
          <div className="flex items-center justify-between">
            {/* Left: Clinic Icon + Greeting + Clinic Name */}
            <div className="flex items-center gap-4">
              <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center">
                <Building2 className="h-6 w-6 text-primary" />
              </div>
              <div>
                <p className="text-muted-foreground text-sm font-medium">
                  {getGreeting()}, {userName.split(" ")[0]}
                </p>
                <h1 className="text-xl font-bold text-foreground tracking-tight">
                  {businessName}
                </h1>
              </div>
            </div>

            {/* Center: Professional Selector (if multiple) */}
            {professionals.length > 1 && (
              <div className="flex items-center gap-3">
                <span className="text-sm text-muted-foreground">Ver como:</span>
                <Select value={selectedProfessionalId} onValueChange={setSelectedProfessionalId}>
                  <SelectTrigger className="w-[200px] h-11">
                    <SelectValue placeholder="Todos los profesionales" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos los profesionales</SelectItem>
                    {professionals.map((prof) => (
                      <SelectItem key={prof.id} value={prof.userId}>
                        <div className="flex items-center gap-2">
                          <div
                            className="w-2.5 h-2.5 rounded-full"
                            style={{ backgroundColor: prof.color || "#00b5b5" }}
                          />
                          {prof.name}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Right: Primary CTA */}
            <Button
              size="lg"
              className="h-12 px-8 gap-3 text-base font-semibold shadow-lg shadow-primary/20 hover:shadow-xl hover:shadow-primary/30 transition-all"
              onClick={() => navigate("/agenda")}
            >
              <CalendarDays className="h-5 w-5" />
              Ver agenda
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-[1400px] mx-auto px-10 py-10 space-y-10">
        
        {/* KPIs Row - 4 Large Cards */}
        <div className="grid grid-cols-4 gap-6">
          {/* Citas hoy */}
          <Card className="desktop-card p-6 relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full -translate-y-1/2 translate-x-1/2 group-hover:scale-110 transition-transform" />
            <div className="relative">
              <div className="flex items-center gap-3 mb-4">
                <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center">
                  <CalendarCheck className="h-6 w-6 text-primary" />
                </div>
              </div>
              <p className="text-4xl font-bold text-foreground tracking-tight">
                {todayAppointmentsCount}
              </p>
              <p className="text-sm font-medium text-muted-foreground mt-1">
                Citas hoy
              </p>
            </div>
          </Card>

          {/* Pacientes activos */}
          <Card className="desktop-card p-6 relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-32 h-32 bg-secondary/50 rounded-full -translate-y-1/2 translate-x-1/2 group-hover:scale-110 transition-transform" />
            <div className="relative">
              <div className="flex items-center gap-3 mb-4">
                <div className="h-12 w-12 rounded-xl bg-secondary flex items-center justify-center">
                  <Users className="h-6 w-6 text-secondary-foreground" />
                </div>
              </div>
              <p className="text-4xl font-bold text-foreground tracking-tight">
                {activePatientsCount}
              </p>
              <p className="text-sm font-medium text-muted-foreground mt-1">
                Pacientes activos
              </p>
            </div>
          </Card>

          {/* Cobrado este mes */}
          <Card className="desktop-card p-6 relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-32 h-32 bg-green-500/10 rounded-full -translate-y-1/2 translate-x-1/2 group-hover:scale-110 transition-transform" />
            <div className="relative">
              <div className="flex items-center gap-3 mb-4">
                <div className="h-12 w-12 rounded-xl bg-green-500/10 flex items-center justify-center">
                  <TrendingUp className="h-6 w-6 text-green-600" />
                </div>
              </div>
              <p className="text-4xl font-bold text-foreground tracking-tight">
                {formatCurrency(collectedThisMonth)}
              </p>
              <p className="text-sm font-medium text-muted-foreground mt-1">
                Cobrado este mes
              </p>
            </div>
          </Card>

          {/* Pagos vencidos */}
          <Card className={`desktop-card p-6 relative overflow-hidden group ${overduePaymentsCount > 0 ? 'border-destructive/30 bg-destructive/5' : ''}`}>
            <div className={`absolute top-0 right-0 w-32 h-32 rounded-full -translate-y-1/2 translate-x-1/2 group-hover:scale-110 transition-transform ${overduePaymentsCount > 0 ? 'bg-destructive/10' : 'bg-muted/50'}`} />
            <div className="relative">
              <div className="flex items-center gap-3 mb-4">
                <div className={`h-12 w-12 rounded-xl flex items-center justify-center ${overduePaymentsCount > 0 ? 'bg-destructive/10' : 'bg-muted'}`}>
                  <AlertTriangle className={`h-6 w-6 ${overduePaymentsCount > 0 ? 'text-destructive' : 'text-muted-foreground'}`} />
                </div>
              </div>
              <p className={`text-4xl font-bold tracking-tight ${overduePaymentsCount > 0 ? 'text-destructive' : 'text-foreground'}`}>
                {overduePaymentsCount}
              </p>
              <p className="text-sm font-medium text-muted-foreground mt-1">
                Pagos vencidos
                {overduePaymentsCount > 0 && (
                  <span className="text-destructive ml-1">
                    ({formatCurrency(overdueAmount)})
                  </span>
                )}
              </p>
            </div>
          </Card>
        </div>

        {/* Central Block - 2 Columns */}
        <div className="grid grid-cols-5 gap-8">
          {/* Left: Próximas citas */}
          <Card className="col-span-3 desktop-card">
            <CardHeader className="pb-4 border-b border-border/50">
              <div className="flex items-center justify-between">
                <CardTitle className="text-xl font-semibold flex items-center gap-3">
                  <Clock className="h-5 w-5 text-primary" />
                  Próximas citas
                </CardTitle>
                <Badge variant="secondary" className="text-xs">
                  Hoy y mañana
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="p-6">
              {upcomingAppointments.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <div className="h-16 w-16 rounded-2xl bg-muted/50 flex items-center justify-center mb-4">
                    <CalendarCheck className="h-8 w-8 text-muted-foreground/50" />
                  </div>
                  <p className="text-lg font-medium text-foreground mb-1">Todo al día</p>
                  <p className="text-sm text-muted-foreground">No hay citas pendientes</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {upcomingAppointments.map((apt) => {
                    const professional = professionals.find(p => p.userId === apt.professional_id);
                    const dateLabel = getDateLabel(apt.start_at);
                    return (
                      <div
                        key={apt.id}
                        className="flex items-center gap-4 p-4 rounded-xl bg-muted/30 hover:bg-muted/50 transition-colors group cursor-pointer"
                        onClick={() => navigate("/agenda")}
                      >
                        {/* Time block */}
                        <div className="flex flex-col items-center min-w-[70px]">
                          <span className={`text-xs font-medium px-2 py-0.5 rounded-full mb-1 ${
                            dateLabel === "Hoy" 
                              ? "bg-primary/10 text-primary" 
                              : "bg-muted text-muted-foreground"
                          }`}>
                            {dateLabel}
                          </span>
                          <span className="text-xl font-bold text-foreground">
                            {formatTime(apt.start_at)}
                          </span>
                        </div>

                        {/* Divider */}
                        <div className="h-12 w-px bg-border/50" />

                        {/* Patient info */}
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-foreground text-lg truncate">
                            {apt.patients?.full_name || "Sin paciente"}
                          </p>
                          <div className="flex items-center gap-3 mt-1">
                            {apt.services?.name && (
                              <span className="text-sm text-muted-foreground">
                                {apt.services.name}
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Professional */}
                        {professional && (
                          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-card border border-border/50">
                            <div
                              className="w-2.5 h-2.5 rounded-full"
                              style={{ backgroundColor: professional.color || "#00b5b5" }}
                            />
                            <span className="text-sm font-medium text-muted-foreground">
                              {professional.name.split(" ")[0]}
                            </span>
                          </div>
                        )}

                        {/* Arrow */}
                        <ArrowRight className="h-5 w-5 text-muted-foreground/50 group-hover:text-primary group-hover:translate-x-1 transition-all" />
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Right: Estado del consultorio */}
          <Card className="col-span-2 desktop-card">
            <CardHeader className="pb-4 border-b border-border/50">
              <CardTitle className="text-xl font-semibold flex items-center gap-3">
                <Building2 className="h-5 w-5 text-primary" />
                Estado del consultorio
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6 space-y-6">
              {/* Profesionales activos */}
              <div>
                <p className="text-sm font-medium text-muted-foreground mb-3 uppercase tracking-wider">
                  Profesionales activos hoy
                </p>
                {activeProfessionalsToday.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-2">
                    Sin profesionales con citas hoy
                  </p>
                ) : (
                  <div className="space-y-2">
                    {activeProfessionalsToday.map((prof) => {
                      const profAppts = todayAppointments.filter(
                        a => a.professional_id === prof.userId
                      );
                      const attended = profAppts.filter(a => a.status === "attended").length;
                      return (
                        <div
                          key={prof.id}
                          className="flex items-center justify-between p-3 rounded-xl bg-muted/30"
                        >
                          <div className="flex items-center gap-3">
                            <Avatar className="h-9 w-9">
                              <AvatarFallback 
                                className="text-xs font-medium"
                                style={{ 
                                  backgroundColor: `${prof.color}20`,
                                  color: prof.color || "#00b5b5"
                                }}
                              >
                                {getInitials(prof.name)}
                              </AvatarFallback>
                            </Avatar>
                            <span className="font-medium text-foreground">
                              {prof.name.split(" ")[0]}
                            </span>
                          </div>
                          <Badge variant="secondary" className="text-xs">
                            {attended}/{profAppts.length} atendidas
                          </Badge>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Ocupación de agenda */}
              <div>
                <p className="text-sm font-medium text-muted-foreground mb-3 uppercase tracking-wider">
                  Ocupación de agenda
                </p>
                <div className="p-4 rounded-xl bg-muted/30">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-foreground">Hoy</span>
                    <span className="text-sm font-bold text-primary">{agendaOccupation}%</span>
                  </div>
                  <div className="h-2 rounded-full bg-muted overflow-hidden">
                    <div 
                      className="h-full rounded-full bg-primary transition-all duration-500"
                      style={{ width: `${agendaOccupation}%` }}
                    />
                  </div>
                </div>
              </div>

              {/* Alertas */}
              <div>
                <p className="text-sm font-medium text-muted-foreground mb-3 uppercase tracking-wider">
                  Alertas
                </p>
                <div className="space-y-2">
                  {overduePaymentsCount > 0 ? (
                    <div 
                      className="flex items-center gap-3 p-3 rounded-xl bg-destructive/10 border border-destructive/20 cursor-pointer hover:bg-destructive/15 transition-colors"
                      onClick={() => navigate("/pagos")}
                    >
                      <AlertCircle className="h-5 w-5 text-destructive flex-shrink-0" />
                      <div className="flex-1">
                        <p className="text-sm font-medium text-destructive">
                          {overduePaymentsCount} pago{overduePaymentsCount !== 1 ? "s" : ""} vencido{overduePaymentsCount !== 1 ? "s" : ""}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Total: {formatCurrency(overdueAmount)}
                        </p>
                      </div>
                      <ArrowRight className="h-4 w-4 text-destructive" />
                    </div>
                  ) : (
                    <div className="flex items-center gap-3 p-3 rounded-xl bg-green-500/10 border border-green-500/20">
                      <div className="h-5 w-5 rounded-full bg-green-500/20 flex items-center justify-center">
                        <div className="h-2 w-2 rounded-full bg-green-500" />
                      </div>
                      <p className="text-sm font-medium text-green-700 dark:text-green-400">
                        Sin alertas pendientes
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Demo Patient Portal Banner */}
        {isDemo && (
          <Card 
            className="border-accent bg-accent/10 hover:bg-accent/20 transition-all cursor-pointer"
            onClick={() => navigate("/portal-paciente/demo")}
          >
            <CardContent className="p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-accent/20">
                  <Eye className="h-5 w-5 text-accent-foreground" />
                </div>
                <div>
                  <p className="font-semibold text-foreground">Demo Portal del Paciente</p>
                  <p className="text-sm text-muted-foreground">Mirá cómo ven tus pacientes su portal personal</p>
                </div>
              </div>
              <ArrowRight className="h-5 w-5 text-muted-foreground" />
            </CardContent>
          </Card>
        )}

        {/* Quick Actions Row */}
        <div className="grid grid-cols-3 gap-6">
          <Button
            size="lg"
            className="h-16 gap-4 text-base font-semibold shadow-md hover:shadow-lg transition-all"
            onClick={() => navigate("/agenda")}
          >
            <Plus className="h-5 w-5" />
            Nueva cita
          </Button>
          <Button
            size="lg"
            variant="outline"
            className="h-16 gap-4 text-base font-semibold bg-card hover:bg-muted/50 transition-all"
            onClick={() => navigate("/pacientes")}
          >
            <UserPlus className="h-5 w-5 text-primary" />
            Nuevo paciente
          </Button>
          <Button
            size="lg"
            variant="outline"
            className="h-16 gap-4 text-base font-semibold bg-card hover:bg-muted/50 transition-all"
            onClick={() => navigate("/pagos")}
          >
            <DollarSign className="h-5 w-5 text-primary" />
            Registrar pago
          </Button>
        </div>

        {/* Monthly Highlights Section - Secondary visual block */}
        <MonthlyHighlights businessId={businessId} className="pt-4" />
      </main>
    </div>
  );
};
