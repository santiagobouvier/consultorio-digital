import { useEffect, useState, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "@/hooks/use-toast";
import { ArrowLeft, ChevronLeft, ChevronRight, Search } from "lucide-react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { CalendarGrid } from "@/components/calendar/CalendarGrid";
import { WeekView } from "@/components/calendar/WeekView";
import { DayView } from "@/components/calendar/DayView";
import { AppointmentDetailModal } from "@/components/calendar/AppointmentDetailModal";
import { PatientSummary } from "@/components/calendar/PatientSummary";
import { format, addMonths, subMonths, addWeeks, subWeeks, addDays, subDays, startOfMonth, endOfMonth, startOfWeek, endOfWeek, subMonths as subMonthsFn } from "date-fns";
import { es } from "date-fns/locale";
import { calculatePaymentStatus, type PaymentStatus } from "@/lib/payments";
import { useBusinessId } from "@/hooks/use-business-id";

interface AppointmentWithRelations {
  id: string;
  start_at: string;
  end_at: string;
  status: string;
  modality: string | null;
  location: string | null;
  payment_status: string | null;
  patient_id: string | null;
  service_id: string | null;
  patients: { full_name: string } | null;
  services: { name: string } | null;
  paymentColor?: string;
  patientPaymentStatus?: PaymentStatus;
}

interface Patient {
  id: string;
  full_name: string;
}

interface Payment {
  id: string;
  patient_id: string;
  due_date: string;
  paid_at: string | null;
  status: string;
  amount: number;
}

type ViewType = "month" | "week" | "day";
type AppointmentStatusFilter = "all" | "pending" | "confirmed" | "attended" | "cancelled" | "no_show";
type PaymentStatusFilter = "all" | "al_dia" | "por_vencer" | "vencido";

const Agenda = () => {
  const navigate = useNavigate();
  const [appointments, setAppointments] = useState<AppointmentWithRelations[]>([]);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [allPayments, setAllPayments] = useState<Payment[]>([]);
  const [selectedPatientPayments, setSelectedPatientPayments] = useState<Payment[]>([]);
  const [dataLoading, setDataLoading] = useState(true);
  const [viewType, setViewType] = useState<ViewType>("month");
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedPatientId, setSelectedPatientId] = useState<string | null>(null);
  const [patientSearch, setPatientSearch] = useState("");
  const [selectedAppointment, setSelectedAppointment] = useState<AppointmentWithRelations | null>(null);
  const [showAppointmentModal, setShowAppointmentModal] = useState(false);
  const [statusFilter, setStatusFilter] = useState<AppointmentStatusFilter>("all");
  const [paymentStatusFilter, setPaymentStatusFilter] = useState<PaymentStatusFilter>("all");
  
  const { businessId, loading: businessLoading } = useBusinessId();

  useEffect(() => {
    if (businessId) {
      fetchPatients();
    }
  }, [businessId]);

  useEffect(() => {
    if (businessId) {
      fetchAppointments();
      fetchAllPayments();
    }
  }, [currentDate, viewType, businessId]);

  useEffect(() => {
    if (businessId && selectedPatientId) {
      fetchSelectedPatientPayments();
    } else {
      setSelectedPatientPayments([]);
    }
  }, [selectedPatientId, businessId]);

  const fetchPatients = async () => {
    if (!businessId) return;
    
    try {
      const { data: patientsData } = await supabase
        .from("patients")
        .select("id, full_name")
        .eq("business_id", businessId)
        .eq("is_active", true)
        .order("full_name");

      setPatients(patientsData || []);
    } catch (error) {
      console.error("Error fetching patients:", error);
      toast({
        title: "Error",
        description: "No se pudo cargar la información inicial",
        variant: "destructive",
      });
    }
  };

  const loading = businessLoading || dataLoading;

  const getDateRange = () => {
    switch (viewType) {
      case "month":
        return {
          startDate: startOfMonth(currentDate),
          endDate: endOfMonth(currentDate),
        };
      case "week":
        return {
          startDate: startOfWeek(currentDate, { weekStartsOn: 1 }),
          endDate: endOfWeek(currentDate, { weekStartsOn: 1 }),
        };
      case "day":
        const dayStart = new Date(currentDate);
        dayStart.setHours(0, 0, 0, 0);
        const dayEnd = new Date(currentDate);
        dayEnd.setHours(23, 59, 59, 999);
        return { startDate: dayStart, endDate: dayEnd };
      default:
        return {
          startDate: startOfWeek(currentDate, { weekStartsOn: 1 }),
          endDate: endOfWeek(currentDate, { weekStartsOn: 1 }),
        };
    }
  };

  const fetchAppointments = async () => {
    if (!businessId) return;

    try {
      setDataLoading(true);
      const { startDate, endDate } = getDateRange();

      let query = supabase
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
          patients (full_name),
          services (name)
        `)
        .eq("business_id", businessId)
        .gte("start_at", startDate.toISOString())
        .lte("start_at", endDate.toISOString())
        .order("start_at", { ascending: true });

      const { data, error } = await query;

      if (error) throw error;

      setAppointments(data || []);
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
  };

  // Fetch all pending payments for all patients (for coloring appointments)
  const fetchAllPayments = async () => {
    if (!businessId) return;

    try {
      const { data, error } = await supabase
        .from("payments")
        .select("id, patient_id, due_date, paid_at, status, amount")
        .eq("business_id", businessId)
        .neq("status", "cancelled");

      if (error) throw error;
      setAllPayments(data || []);
    } catch (error) {
      console.error("Error fetching all payments:", error);
    }
  };

  // Fetch detailed payments for selected patient
  const fetchSelectedPatientPayments = async () => {
    if (!businessId || !selectedPatientId) return;

    try {
      const { data, error } = await supabase
        .from("payments")
        .select("id, patient_id, due_date, paid_at, status, amount")
        .eq("business_id", businessId)
        .eq("patient_id", selectedPatientId)
        .order("due_date", { ascending: false });

      if (error) throw error;
      setSelectedPatientPayments(data || []);
    } catch (error) {
      console.error("Error fetching patient payments:", error);
    }
  };

  // Calculate payment status for a patient based on their pending payments
  // FIX: Priorizar "paid" siempre - si paid_at existe, es PAGADO
  const getPatientPaymentStatus = useCallback((patientId: string): PaymentStatus => {
    const patientPayments = allPayments.filter(p => p.patient_id === patientId);
    
    if (patientPayments.length === 0) {
      return 'pending'; // No payments = treat as pending (green)
    }

    // Find pending/unpaid payments - FIX: verificar paid_at Y status
    const pendingPayments = patientPayments.filter(p => 
      !p.paid_at && p.status !== 'paid' && p.status !== 'cancelled'
    );
    
    if (pendingPayments.length === 0) {
      return 'paid'; // All paid = green
    }

    // Check for overdue or due_soon
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    let hasOverdue = false;
    let hasDueSoon = false;

    for (const payment of pendingPayments) {
      const dueDate = new Date(payment.due_date);
      dueDate.setHours(0, 0, 0, 0);
      
      const timeDiff = dueDate.getTime() - today.getTime();
      const daysUntilDue = Math.ceil(timeDiff / (1000 * 60 * 60 * 24));
      
      if (daysUntilDue < 0) {
        hasOverdue = true;
        break; // No need to continue, overdue is the worst status
      } else if (daysUntilDue <= 4) {
        hasDueSoon = true;
      }
    }

    if (hasOverdue) return 'overdue';
    if (hasDueSoon) return 'due_soon';
    return 'pending'; // Has pending payments but not due soon
  }, [allPayments]);

  // Calculate payment colors for ALL appointments based on patient payment status
  const appointmentsWithPaymentColors = useMemo(() => {
    return appointments.map((apt) => {
      if (!apt.patient_id) {
        return { ...apt, paymentColor: "gray", patientPaymentStatus: undefined };
      }

      const patientStatus = getPatientPaymentStatus(apt.patient_id);
      
      let color = "green";
      if (patientStatus === "overdue") color = "red";
      else if (patientStatus === "due_soon") color = "orange";
      else if (patientStatus === "pending" || patientStatus === "paid") color = "green";

      return { ...apt, paymentColor: color, patientPaymentStatus: patientStatus };
    });
  }, [appointments, getPatientPaymentStatus]);

  // Apply filters
  const filteredAppointments = useMemo(() => {
    let result = appointmentsWithPaymentColors;

    // Filter by patient
    if (selectedPatientId) {
      result = result.filter(apt => apt.patient_id === selectedPatientId);
    }

    // Filter by appointment status
    if (statusFilter !== "all") {
      result = result.filter(apt => apt.status === statusFilter);
    }

    // Filter by payment status
    if (paymentStatusFilter !== "all") {
      result = result.filter(apt => {
        if (!apt.patient_id) return false;
        
        const patientStatus = apt.patientPaymentStatus;
        
        switch (paymentStatusFilter) {
          case "al_dia":
            return patientStatus === "paid" || patientStatus === "pending";
          case "por_vencer":
            return patientStatus === "due_soon";
          case "vencido":
            return patientStatus === "overdue";
          default:
            return true;
        }
      });
    }

    return result;
  }, [appointmentsWithPaymentColors, selectedPatientId, statusFilter, paymentStatusFilter]);

  // Calculate patient payment status for PatientSummary
  const patientPaymentStatus = useMemo(() => {
    if (!selectedPatientId || selectedPatientPayments.length === 0) return "sin_pagos";

    const pendingPayments = selectedPatientPayments.filter(p => !p.paid_at && p.status !== 'cancelled');
    
    if (pendingPayments.length === 0) return "al_dia";

    const hasOverdue = pendingPayments.some((p) => {
      const status = calculatePaymentStatus({
        due_date: p.due_date,
        paid_at: p.paid_at,
        status: p.status,
      });
      return status === "overdue";
    });

    if (hasOverdue) return "vencido";

    const hasDueSoon = pendingPayments.some((p) => {
      const status = calculatePaymentStatus({
        due_date: p.due_date,
        paid_at: p.paid_at,
        status: p.status,
      });
      return status === "due_soon";
    });

    if (hasDueSoon) return "por_vencer";

    return "al_dia";
  }, [selectedPatientPayments, selectedPatientId]);

  // Get next due date for selected patient
  const nextDueDate = useMemo(() => {
    if (!selectedPatientId || selectedPatientPayments.length === 0) return null;

    const pendingPayments = selectedPatientPayments
      .filter(p => !p.paid_at && p.status !== 'cancelled')
      .sort((a, b) => new Date(a.due_date).getTime() - new Date(b.due_date).getTime());

    return pendingPayments.length > 0 ? pendingPayments[0].due_date : null;
  }, [selectedPatientPayments, selectedPatientId]);

  // Count paid payments in last 6 months
  const paidPaymentsLast6Months = useMemo(() => {
    if (!selectedPatientId || selectedPatientPayments.length === 0) return 0;

    const sixMonthsAgo = subMonthsFn(new Date(), 6);

    return selectedPatientPayments.filter(p => 
      p.paid_at && new Date(p.paid_at) >= sixMonthsAgo
    ).length;
  }, [selectedPatientPayments, selectedPatientId]);

  const selectedPatient = patients.find((p) => p.id === selectedPatientId);

  const filteredPatients = patients.filter((p) =>
    p.full_name.toLowerCase().includes(patientSearch.toLowerCase())
  );

  const navigateDate = (direction: "prev" | "next") => {
    switch (viewType) {
      case "month":
        setCurrentDate(direction === "prev" ? subMonths(currentDate, 1) : addMonths(currentDate, 1));
        break;
      case "week":
        setCurrentDate(direction === "prev" ? subWeeks(currentDate, 1) : addWeeks(currentDate, 1));
        break;
      case "day":
        setCurrentDate(direction === "prev" ? subDays(currentDate, 1) : addDays(currentDate, 1));
        break;
    }
  };

  const goToToday = () => {
    setCurrentDate(new Date());
  };

  const handleDateClick = (date: Date) => {
    setCurrentDate(date);
    setViewType("day");
  };

  const handleAppointmentClick = (appointment: AppointmentWithRelations) => {
    setSelectedAppointment(appointment);
    setShowAppointmentModal(true);
  };

  const getDateRangeLabel = () => {
    switch (viewType) {
      case "month":
        return format(currentDate, "MMMM yyyy", { locale: es });
      case "week":
        const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 });
        const weekEnd = endOfWeek(currentDate, { weekStartsOn: 1 });
        return `${format(weekStart, "d MMM", { locale: es })} - ${format(weekEnd, "d MMM yyyy", { locale: es })}`;
      case "day":
        return format(currentDate, "EEEE, d 'de' MMMM", { locale: es });
      default:
        return "";
    }
  };

  const hasActiveFilters = statusFilter !== "all" || paymentStatusFilter !== "all" || selectedPatientId !== null;

  const handleRefreshData = () => {
    fetchAppointments();
    fetchAllPayments();
    if (selectedPatientId) {
      fetchSelectedPatientPayments();
    }
  };

  if (loading && !businessId) {
    return (
      <div className="min-h-screen bg-background p-4 sm:p-6 lg:p-8">
        <div className="max-w-7xl mx-auto space-y-6">
          <div className="flex items-center gap-4">
            <Skeleton className="h-10 w-10 rounded-xl" />
            <Skeleton className="h-8 w-48" />
          </div>
          <div className="flex gap-4">
            <Skeleton className="h-11 w-48 rounded-xl" />
            <Skeleton className="h-11 w-48 rounded-xl" />
          </div>
          <Skeleton className="h-96 w-full rounded-2xl" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-7xl mx-auto p-4 sm:p-6 lg:p-8 space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate("/dashboard")}
              className="shrink-0"
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold">Calendario</h1>
              <p className="text-sm text-muted-foreground capitalize">{getDateRangeLabel()}</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={goToToday} className="rounded-xl">
              Hoy
            </Button>
          </div>
        </div>

        {/* View type & Navigation */}
        <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
          <Tabs value={viewType} onValueChange={(value) => setViewType(value as ViewType)}>
            <TabsList className="rounded-xl h-11">
              <TabsTrigger value="day" className="rounded-lg px-4">Día</TabsTrigger>
              <TabsTrigger value="week" className="rounded-lg px-4">Semana</TabsTrigger>
              <TabsTrigger value="month" className="rounded-lg px-4">Mes</TabsTrigger>
            </TabsList>
          </Tabs>

          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigateDate("prev")}
              className="rounded-xl"
            >
              <ChevronLeft className="h-5 w-5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigateDate("next")}
              className="rounded-xl"
            >
              <ChevronRight className="h-5 w-5" />
            </Button>
          </div>
        </div>

        {/* Patient Summary (when filtered) */}
        {selectedPatient && (
          <PatientSummary
            patientId={selectedPatientId!}
            patientName={selectedPatient.full_name}
            appointments={filteredAppointments}
            payments={selectedPatientPayments}
            paymentStatus={patientPaymentStatus as "al_dia" | "por_vencer" | "vencido" | "sin_pagos"}
            nextDueDate={nextDueDate}
            paidPaymentsLast6Months={paidPaymentsLast6Months}
            currentDate={currentDate}
            businessId={businessId!}
            onRefresh={handleRefreshData}
          />
        )}

        {/* Calendar Views */}
        {loading ? (
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
              </div>
            </CardContent>
          </Card>
        ) : (
          <>
            {viewType === "month" && (
              <CalendarGrid
                currentDate={currentDate}
                appointments={filteredAppointments}
                payments={selectedPatientPayments}
                onDateClick={handleDateClick}
                onAppointmentClick={handleAppointmentClick}
                selectedPatientId={selectedPatientId}
                businessId={businessId}
                onAppointmentCreated={handleRefreshData}
              />
            )}
            {viewType === "week" && (
              <WeekView
                currentDate={currentDate}
                appointments={filteredAppointments}
                onAppointmentClick={handleAppointmentClick}
                selectedPatientId={selectedPatientId}
              />
            )}
            {viewType === "day" && (
              <DayView
                currentDate={currentDate}
                appointments={filteredAppointments}
                onAppointmentClick={handleAppointmentClick}
                selectedPatientId={selectedPatientId}
              />
            )}
          </>
        )}

        {/* Filters Section - Always visible below calendar */}
        <Card className="bg-card/50">
          <CardContent className="p-4 space-y-4">
            <p className="text-sm font-semibold text-foreground">Filtros</p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {/* Patient filter */}
              <div className="space-y-2">
                <label className="text-xs font-medium text-muted-foreground">Paciente</label>
                <Select
                  value={selectedPatientId || "all"}
                  onValueChange={(value) => setSelectedPatientId(value === "all" ? null : value)}
                >
                  <SelectTrigger className="h-11 rounded-xl">
                    <Search className="h-4 w-4 mr-2 text-muted-foreground" />
                    <SelectValue placeholder="Todos" />
                  </SelectTrigger>
                  <SelectContent>
                    <div className="p-2">
                      <Input
                        placeholder="Buscar paciente..."
                        value={patientSearch}
                        onChange={(e) => setPatientSearch(e.target.value)}
                        className="h-9 rounded-lg"
                      />
                    </div>
                    <SelectItem value="all">Todos los pacientes</SelectItem>
                    {filteredPatients.map((patient) => (
                      <SelectItem key={patient.id} value={patient.id}>
                        {patient.full_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Appointment status filter */}
              <div className="space-y-2">
                <label className="text-xs font-medium text-muted-foreground">Estado de cita</label>
                <Select
                  value={statusFilter}
                  onValueChange={(value) => setStatusFilter(value as AppointmentStatusFilter)}
                >
                  <SelectTrigger className="h-11 rounded-xl">
                    <SelectValue placeholder="Todos" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos los estados</SelectItem>
                    <SelectItem value="pending">Programada</SelectItem>
                    <SelectItem value="confirmed">Confirmada</SelectItem>
                    <SelectItem value="attended">Realizada</SelectItem>
                    <SelectItem value="cancelled">Cancelada</SelectItem>
                    <SelectItem value="no_show">Ausente</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Payment status filter */}
              <div className="space-y-2">
                <label className="text-xs font-medium text-muted-foreground">Estado de pago</label>
                <Select
                  value={paymentStatusFilter}
                  onValueChange={(value) => setPaymentStatusFilter(value as PaymentStatusFilter)}
                >
                  <SelectTrigger className="h-11 rounded-xl">
                    <SelectValue placeholder="Todos" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    <SelectItem value="al_dia">
                      <div className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-emerald-500" />
                        Al día
                      </div>
                    </SelectItem>
                    <SelectItem value="por_vencer">
                      <div className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-amber-500" />
                        Por vencer
                      </div>
                    </SelectItem>
                    <SelectItem value="vencido">
                      <div className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-rose-500" />
                        Vencido
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Clear filters */}
            {hasActiveFilters && (
              <Button
                variant="outline"
                size="sm"
                className="rounded-xl w-full sm:w-auto"
                onClick={() => {
                  setSelectedPatientId(null);
                  setStatusFilter("all");
                  setPaymentStatusFilter("all");
                }}
              >
                Limpiar filtros
              </Button>
            )}
          </CardContent>
        </Card>

        {/* Calendar Views */}
        {loading ? (
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
              </div>
            </CardContent>
          </Card>
        ) : (
          <>
            {viewType === "month" && (
              <CalendarGrid
                currentDate={currentDate}
                appointments={filteredAppointments}
                payments={selectedPatientPayments}
                onDateClick={handleDateClick}
                onAppointmentClick={handleAppointmentClick}
                selectedPatientId={selectedPatientId}
                businessId={businessId}
                onAppointmentCreated={handleRefreshData}
              />
            )}
            {viewType === "week" && (
              <WeekView
                currentDate={currentDate}
                appointments={filteredAppointments}
                onAppointmentClick={handleAppointmentClick}
                selectedPatientId={selectedPatientId}
              />
            )}
            {viewType === "day" && (
              <DayView
                currentDate={currentDate}
                appointments={filteredAppointments}
                onAppointmentClick={handleAppointmentClick}
                selectedPatientId={selectedPatientId}
              />
            )}
          </>
        )}

        {/* Appointment Detail Modal */}
        <AppointmentDetailModal
          appointment={selectedAppointment}
          open={showAppointmentModal}
          onClose={() => {
            setShowAppointmentModal(false);
            setSelectedAppointment(null);
          }}
          businessId={businessId}
          onPaymentRegistered={handleRefreshData}
        />
      </div>
    </div>
  );
};

export default Agenda;
