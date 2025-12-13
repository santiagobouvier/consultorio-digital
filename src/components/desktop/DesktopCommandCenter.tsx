import { useState, useEffect, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useBusinessId } from "@/hooks/use-business-id";
import { useProfessionals } from "@/hooks/use-professionals";
import { calculatePaymentStatus, formatCurrency, type PaymentStatus } from "@/lib/payments";
import {
  CalendarAppointment,
  Professional,
  PaymentColor,
} from "@/components/calendar-v2/types";
import {
  format,
  addDays,
  subDays,
  addWeeks,
  subWeeks,
  startOfWeek,
  endOfWeek,
  isSameDay,
} from "date-fns";
import { es } from "date-fns/locale";
import { toast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  RefreshCw,
} from "lucide-react";
import { CreateAppointmentModal } from "@/components/CreateAppointmentModal";
import { AppointmentDetailModal } from "@/components/calendar/AppointmentDetailModal";
import { DesktopDayColumn } from "./DesktopDayColumn";
import { TodayAppointmentList } from "./TodayAppointmentList";
import { ClinicStatusPanel } from "./ClinicStatusPanel";

interface Payment {
  id: string;
  patient_id: string;
  due_date: string;
  paid_at: string | null;
  status: string;
  amount: number;
  patientName?: string;
  calculatedStatus?: PaymentStatus;
}

type ViewType = "day" | "week";

export const DesktopCommandCenter = () => {
  const navigate = useNavigate();
  const { businessId, loading: businessLoading } = useBusinessId();
  const { professionals, loading: professionalsLoading, currentUserId, isOwner } = useProfessionals(businessId);

  // Calendar state
  const [viewType, setViewType] = useState<ViewType>("day");
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedProfessionalId, setSelectedProfessionalId] = useState<string | null>(null);

  // Data state
  const [appointments, setAppointments] = useState<CalendarAppointment[]>([]);
  const [allPayments, setAllPayments] = useState<Payment[]>([]);
  const [sharedCalendar, setSharedCalendar] = useState(true);
  const [dataLoading, setDataLoading] = useState(true);

  // Stats
  const [attendedToday, setAttendedToday] = useState(0);
  const [pendingPaymentsAmount, setPendingPaymentsAmount] = useState(0);
  const [overdueCount, setOverdueCount] = useState(0);
  const [dueSoonCount, setDueSoonCount] = useState(0);

  // Modal state
  const [selectedAppointment, setSelectedAppointment] = useState<CalendarAppointment | null>(null);
  const [showAppointmentModal, setShowAppointmentModal] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);

  // Fetch business settings
  useEffect(() => {
    const fetchBusinessSettings = async () => {
      if (!businessId) return;

      const { data } = await supabase
        .from("businesses")
        .select("shared_calendar")
        .eq("id", businessId)
        .single();

      if (data) {
        setSharedCalendar(data.shared_calendar ?? true);
      }
    };

    fetchBusinessSettings();
  }, [businessId]);

  // Get date range based on view
  const getDateRange = useCallback(() => {
    switch (viewType) {
      case "week":
        return {
          startDate: startOfWeek(currentDate, { weekStartsOn: 1 }),
          endDate: endOfWeek(currentDate, { weekStartsOn: 1 }),
        };
      case "day":
      default:
        const dayStart = new Date(currentDate);
        dayStart.setHours(0, 0, 0, 0);
        const dayEnd = new Date(currentDate);
        dayEnd.setHours(23, 59, 59, 999);
        return { startDate: dayStart, endDate: dayEnd };
    }
  }, [viewType, currentDate]);

  // Fetch appointments
  const fetchAppointments = useCallback(async () => {
    if (!businessId) return;

    try {
      setDataLoading(true);
      const { startDate, endDate } = getDateRange();

      const { data, error } = await supabase
        .from("appointments")
        .select(`
          id,
          start_at,
          end_at,
          status,
          modality,
          location,
          payment_status,
          patient_id,
          service_id,
          professional_id,
          patients (full_name),
          services (name)
        `)
        .eq("business_id", businessId)
        .gte("start_at", startDate.toISOString())
        .lte("start_at", endDate.toISOString())
        .order("start_at", { ascending: true });

      if (error) throw error;
      setAppointments((data as CalendarAppointment[]) || []);

      // Calculate attended today
      const todayAppointments = (data || []).filter((apt: any) => 
        isSameDay(new Date(apt.start_at), new Date()) && apt.status === "attended"
      );
      setAttendedToday(todayAppointments.length);
    } catch (error) {
      console.error("Error fetching appointments:", error);
      toast({
        title: "Error",
        description: "No se pudo cargar la agenda",
        variant: "destructive",
      });
    } finally {
      setDataLoading(false);
    }
  }, [businessId, getDateRange]);

  // Fetch payments
  const fetchPayments = useCallback(async () => {
    if (!businessId) return;

    const { data: payments } = await supabase
      .from("payments")
      .select("id, patient_id, due_date, paid_at, status, amount")
      .eq("business_id", businessId)
      .neq("status", "cancelled")
      .is("paid_at", null);

    if (payments) {
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

      setAllPayments(paymentsWithNames);

      // Calculate stats
      const overdue = paymentsWithNames.filter(p => p.calculatedStatus === "overdue");
      const dueSoon = paymentsWithNames.filter(p => p.calculatedStatus === "due_soon");

      setOverdueCount(overdue.length);
      setDueSoonCount(dueSoon.length);
      setPendingPaymentsAmount(
        paymentsWithNames.reduce((sum, p) => sum + (p.amount || 0), 0)
      );
    }
  }, [businessId]);

  useEffect(() => {
    if (businessId) {
      fetchAppointments();
      fetchPayments();
    }
  }, [businessId, currentDate, viewType, fetchAppointments, fetchPayments]);

  // Calculate payment status for a patient
  const getPatientPaymentStatus = useCallback(
    (patientId: string): PaymentStatus => {
      const patientPayments = allPayments.filter((p) => p.patient_id === patientId);

      if (patientPayments.length === 0) return "pending";

      let hasOverdue = false;
      let hasDueSoon = false;

      for (const payment of patientPayments) {
        const status = calculatePaymentStatus(payment);
        if (status === "overdue") {
          hasOverdue = true;
          break;
        } else if (status === "due_soon") {
          hasDueSoon = true;
        }
      }

      if (hasOverdue) return "overdue";
      if (hasDueSoon) return "due_soon";
      return "paid";
    },
    [allPayments]
  );

  // Process appointments with payment colors and professional info
  const processedAppointments = useMemo(() => {
    return appointments.map((apt) => {
      let paymentColor: PaymentColor = "gray";
      if (apt.patient_id) {
        const status = getPatientPaymentStatus(apt.patient_id);
        if (status === "overdue") paymentColor = "red";
        else if (status === "due_soon") paymentColor = "orange";
        else paymentColor = "green";
      }

      const professional = professionals.find((p) => p.userId === apt.professional_id);

      return {
        ...apt,
        paymentColor,
        patientPaymentStatus: apt.patient_id ? getPatientPaymentStatus(apt.patient_id) : undefined,
        professional,
      };
    });
  }, [appointments, professionals, getPatientPaymentStatus]);

  // Filter appointments
  const filteredAppointments = useMemo(() => {
    let result = processedAppointments;

    if (!sharedCalendar && !isOwner) {
      result = result.filter((apt) => apt.professional_id === currentUserId);
    } else if (selectedProfessionalId) {
      const prof = professionals.find((p) => p.id === selectedProfessionalId);
      if (prof) {
        result = result.filter((apt) => apt.professional_id === prof.userId);
      }
    }

    return result;
  }, [processedAppointments, selectedProfessionalId, sharedCalendar, isOwner, currentUserId, professionals]);

  // Today's appointments for left panel
  const todayAppointments = useMemo(() => {
    return filteredAppointments
      .filter((apt) => isSameDay(new Date(apt.start_at), new Date()))
      .sort((a, b) => new Date(a.start_at).getTime() - new Date(b.start_at).getTime());
  }, [filteredAppointments]);

  // Upcoming appointments (next 7 days, excluding today)
  const upcomingAppointments = useMemo(() => {
    const today = new Date();
    today.setHours(23, 59, 59, 999);
    const nextWeek = addDays(today, 7);

    return processedAppointments
      .filter((apt) => {
        const aptDate = new Date(apt.start_at);
        return aptDate > today && aptDate <= nextWeek;
      })
      .sort((a, b) => new Date(a.start_at).getTime() - new Date(b.start_at).getTime())
      .slice(0, 10);
  }, [processedAppointments]);

  // Navigation
  const navigateDate = (direction: "prev" | "next") => {
    switch (viewType) {
      case "week":
        setCurrentDate(direction === "prev" ? subWeeks(currentDate, 1) : addWeeks(currentDate, 1));
        break;
      case "day":
        setCurrentDate(direction === "prev" ? subDays(currentDate, 1) : addDays(currentDate, 1));
        break;
    }
  };

  const goToToday = () => setCurrentDate(new Date());

  const handleRefresh = () => {
    fetchAppointments();
    fetchPayments();
  };

  const showProfessionalColors = sharedCalendar && professionals.length > 1;
  const loading = businessLoading || professionalsLoading;

  if (loading && !businessId) {
    return (
      <div className="min-h-screen bg-background p-6 flex items-center justify-center">
        <Skeleton className="h-[600px] w-full rounded-2xl" />
      </div>
    );
  }

  return (
    <TooltipProvider>
      <div className="min-h-screen bg-background">
        <div className="h-screen flex flex-col">
          {/* Compact Header */}
          <header className="shrink-0 border-b bg-card/50 backdrop-blur-sm px-6 py-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <h1 className="text-xl font-bold text-foreground">Centro de Control</h1>
                <Badge variant="secondary" className="text-xs">
                  {format(new Date(), "EEEE d 'de' MMMM", { locale: es })}
                </Badge>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleRefresh}
                  className="gap-2"
                >
                  <RefreshCw className="h-4 w-4" />
                  Actualizar
                </Button>
                <Button onClick={() => navigate("/dashboard")} variant="outline" size="sm">
                  Dashboard
                </Button>
              </div>
            </div>
          </header>

          {/* Main 3-Column Layout */}
          <div className="flex-1 flex overflow-hidden">
            {/* Left Column - Today's Operations (~30%) */}
            <aside className="w-[320px] border-r bg-muted/20 flex flex-col shrink-0">
              {/* Fixed header */}
              <div className="p-4 border-b bg-card/50">
                <div className="flex items-center justify-between mb-3">
                  <h2 className="font-semibold text-foreground">Hoy</h2>
                  <Badge variant="default" className="text-xs">
                    {todayAppointments.length} citas
                  </Badge>
                </div>
                <Button 
                  onClick={() => setShowCreateModal(true)} 
                  className="w-full gap-2"
                >
                  <Plus className="h-4 w-4" />
                  Nueva cita
                </Button>
              </div>

              {/* Scrollable appointments */}
              <ScrollArea className="flex-1">
                <TodayAppointmentList
                  appointments={todayAppointments}
                  upcomingAppointments={upcomingAppointments}
                  onAppointmentClick={(apt) => {
                    setSelectedAppointment(apt);
                    setShowAppointmentModal(true);
                  }}
                  showProfessionalColors={showProfessionalColors}
                />
              </ScrollArea>
            </aside>

            {/* Center Column - Smart Calendar (~45%) */}
            <main className="flex-1 flex flex-col min-w-0 bg-background">
              {/* Calendar Navigation */}
              <div className="shrink-0 p-4 border-b bg-card/30">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Button variant="ghost" size="icon" onClick={() => navigateDate("prev")}>
                      <ChevronLeft className="h-5 w-5" />
                    </Button>
                    <Button variant="outline" size="sm" onClick={goToToday}>
                      Hoy
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => navigateDate("next")}>
                      <ChevronRight className="h-5 w-5" />
                    </Button>
                    <span className="ml-2 text-lg font-semibold capitalize">
                      {viewType === "day" 
                        ? format(currentDate, "EEEE d 'de' MMMM", { locale: es })
                        : `${format(startOfWeek(currentDate, { weekStartsOn: 1 }), "d MMM", { locale: es })} - ${format(endOfWeek(currentDate, { weekStartsOn: 1 }), "d MMM", { locale: es })}`
                      }
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    {/* View Toggle */}
                    <div className="flex bg-muted rounded-lg p-1">
                      <Button
                        variant={viewType === "day" ? "default" : "ghost"}
                        size="sm"
                        onClick={() => setViewType("day")}
                        className="h-7 px-3 text-xs"
                      >
                        Día
                      </Button>
                      <Button
                        variant={viewType === "week" ? "default" : "ghost"}
                        size="sm"
                        onClick={() => setViewType("week")}
                        className="h-7 px-3 text-xs"
                      >
                        Semana
                      </Button>
                    </div>

                    {/* Professional Filter Chips */}
                    {sharedCalendar && professionals.length > 1 && (
                      <div className="flex gap-1 ml-4">
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant={!selectedProfessionalId ? "secondary" : "ghost"}
                              size="sm"
                              onClick={() => setSelectedProfessionalId(null)}
                              className="h-7 px-2 text-xs"
                            >
                              Todos
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>Ver todas las agendas</TooltipContent>
                        </Tooltip>
                        {professionals.slice(0, 5).map((prof) => (
                          <Tooltip key={prof.id}>
                            <TooltipTrigger asChild>
                              <Button
                                variant={selectedProfessionalId === prof.id ? "secondary" : "ghost"}
                                size="sm"
                                onClick={() => setSelectedProfessionalId(
                                  selectedProfessionalId === prof.id ? null : prof.id
                                )}
                                className="h-7 px-2 text-xs gap-1.5"
                              >
                                <div
                                  className="w-2.5 h-2.5 rounded-full shrink-0"
                                  style={{ backgroundColor: prof.color || "#00b5b5" }}
                                />
                                {prof.name.split(" ")[0]}
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>{prof.name}</TooltipContent>
                          </Tooltip>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Calendar Content */}
              <div className="flex-1 overflow-auto p-4">
                {dataLoading ? (
                  <div className="flex items-center justify-center h-full">
                    <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary" />
                  </div>
                ) : (
                  <DesktopDayColumn
                    currentDate={currentDate}
                    viewType={viewType}
                    appointments={filteredAppointments}
                    professionals={professionals}
                    onAppointmentClick={(apt) => {
                      setSelectedAppointment(apt);
                      setShowAppointmentModal(true);
                    }}
                    onAddAppointment={() => setShowCreateModal(true)}
                    showProfessionalColors={showProfessionalColors}
                  />
                )}
              </div>
            </main>

            {/* Right Column - Clinic Status (~25%) */}
            <aside className="w-[280px] border-l bg-muted/20 flex flex-col shrink-0">
              <ClinicStatusPanel
                professionals={professionals}
                attendedToday={attendedToday}
                pendingPaymentsAmount={pendingPaymentsAmount}
                overdueCount={overdueCount}
                dueSoonCount={dueSoonCount}
                pendingPayments={allPayments.slice(0, 5)}
                onNavigatePayments={() => navigate("/pagos")}
                onNavigatePatients={() => navigate("/patients")}
              />
            </aside>
          </div>
        </div>

        {/* Modals */}
        <AppointmentDetailModal
          appointment={selectedAppointment as any}
          open={showAppointmentModal}
          onClose={() => {
            setShowAppointmentModal(false);
            setSelectedAppointment(null);
          }}
          businessId={businessId}
          onPaymentRegistered={handleRefresh}
        />

        <CreateAppointmentModal
          open={showCreateModal}
          onOpenChange={setShowCreateModal}
          patientId={null}
          onSuccess={handleRefresh}
        />
      </div>
    </TooltipProvider>
  );
};
