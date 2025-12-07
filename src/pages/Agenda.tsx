import { useEffect, useState, useMemo } from "react";
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
import { ArrowLeft, ChevronLeft, ChevronRight, Calendar as CalendarIcon, Search } from "lucide-react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { CalendarGrid } from "@/components/calendar/CalendarGrid";
import { WeekView } from "@/components/calendar/WeekView";
import { DayView } from "@/components/calendar/DayView";
import { AppointmentDetailModal } from "@/components/calendar/AppointmentDetailModal";
import { PatientSummary } from "@/components/calendar/PatientSummary";
import { format, addMonths, subMonths, addWeeks, subWeeks, addDays, subDays, startOfMonth, endOfMonth, startOfWeek, endOfWeek } from "date-fns";
import { es } from "date-fns/locale";
import { calculatePaymentStatus } from "@/lib/payments";

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
  amount?: number;
}

type ViewType = "month" | "week" | "day";

const Agenda = () => {
  const navigate = useNavigate();
  const [appointments, setAppointments] = useState<AppointmentWithRelations[]>([]);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewType, setViewType] = useState<ViewType>("week");
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedPatientId, setSelectedPatientId] = useState<string | null>(null);
  const [patientSearch, setPatientSearch] = useState("");
  const [selectedAppointment, setSelectedAppointment] = useState<AppointmentWithRelations | null>(null);
  const [showAppointmentModal, setShowAppointmentModal] = useState(false);
  const [businessId, setBusinessId] = useState<string | null>(null);

  useEffect(() => {
    fetchInitialData();
  }, []);

  useEffect(() => {
    if (businessId) {
      fetchAppointments();
    }
  }, [currentDate, viewType, businessId]);

  useEffect(() => {
    if (businessId) {
      fetchPatientPayments();
    }
  }, [selectedPatientId, businessId, currentDate]);

  const fetchInitialData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        navigate("/auth");
        return;
      }

      const { data: business } = await supabase
        .from("businesses")
        .select("id")
        .eq("owner_user_id", user.id)
        .maybeSingle();

      if (!business) {
        navigate("/configurar-negocio");
        return;
      }

      setBusinessId(business.id);

      // Fetch patients for the filter
      const { data: patientsData } = await supabase
        .from("patients")
        .select("id, full_name")
        .eq("business_id", business.id)
        .eq("is_active", true)
        .order("full_name");

      setPatients(patientsData || []);
    } catch (error) {
      console.error("Error fetching initial data:", error);
      toast({
        title: "Error",
        description: "No se pudo cargar la información inicial",
        variant: "destructive",
      });
    }
  };

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
      setLoading(true);
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

      if (selectedPatientId) {
        query = query.eq("patient_id", selectedPatientId);
      }

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
      setLoading(false);
    }
  };

  const fetchPatientPayments = async () => {
    if (!businessId) return;

    try {
      let query = supabase
        .from("payments")
        .select("id, patient_id, due_date, paid_at, status, amount")
        .eq("business_id", businessId);
      
      if (selectedPatientId) {
        query = query.eq("patient_id", selectedPatientId);
      }

      const { data, error } = await query;

      if (error) throw error;

      setPayments(data || []);
    } catch (error) {
      console.error("Error fetching payments:", error);
    }
  };

  // Calculate payment colors for appointments
  const appointmentsWithPaymentColors = useMemo(() => {
    if (!selectedPatientId || payments.length === 0) {
      return appointments;
    }

    return appointments.map((apt) => {
      // Find the most relevant payment for this appointment
      const aptMonth = new Date(apt.start_at).getMonth();
      const aptYear = new Date(apt.start_at).getFullYear();

      const relevantPayment = payments.find((p) => {
        const paymentMonth = new Date(p.due_date).getMonth();
        const paymentYear = new Date(p.due_date).getFullYear();
        return paymentMonth === aptMonth && paymentYear === aptYear;
      });

      if (!relevantPayment) {
        return { ...apt, paymentColor: "gray" };
      }

      const status = calculatePaymentStatus({
        due_date: relevantPayment.due_date,
        paid_at: relevantPayment.paid_at,
        status: relevantPayment.status,
      });

      let color = "gray";
      if (status === "paid") color = "green";
      else if (status === "due_soon") color = "orange";
      else if (status === "overdue") color = "red";

      return { ...apt, paymentColor: color };
    });
  }, [appointments, payments, selectedPatientId]);

  // Calculate patient payment status
  const patientPaymentStatus = useMemo(() => {
    if (!selectedPatientId || payments.length === 0) return "sin_pagos";

    const hasOverdue = payments.some((p) => {
      const status = calculatePaymentStatus({
        due_date: p.due_date,
        paid_at: p.paid_at,
        status: p.status,
      });
      return status === "overdue";
    });

    if (hasOverdue) return "vencido";

    const hasDueSoon = payments.some((p) => {
      const status = calculatePaymentStatus({
        due_date: p.due_date,
        paid_at: p.paid_at,
        status: p.status,
      });
      return status === "due_soon";
    });

    if (hasDueSoon) return "por_vencer";

    return "al_dia";
  }, [payments, selectedPatientId]);

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

          <Button variant="outline" size="sm" onClick={goToToday} className="rounded-xl">
            Hoy
          </Button>
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-3">
          {/* Patient filter */}
          <Select
            value={selectedPatientId || "all"}
            onValueChange={(value) => setSelectedPatientId(value === "all" ? null : value)}
          >
            <SelectTrigger className="w-full sm:w-[250px] h-11 rounded-xl">
              <Search className="h-4 w-4 mr-2 text-muted-foreground" />
              <SelectValue placeholder="Filtrar por paciente" />
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

          {/* View type */}
          <Tabs value={viewType} onValueChange={(value) => setViewType(value as ViewType)}>
            <TabsList className="rounded-xl h-11">
              <TabsTrigger value="day" className="rounded-lg px-4">Día</TabsTrigger>
              <TabsTrigger value="week" className="rounded-lg px-4">Semana</TabsTrigger>
              <TabsTrigger value="month" className="rounded-lg px-4">Mes</TabsTrigger>
            </TabsList>
          </Tabs>

          {/* Navigation */}
          <div className="flex items-center gap-1 sm:ml-auto">
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
            patientName={selectedPatient.full_name}
            appointments={appointmentsWithPaymentColors}
            paymentStatus={patientPaymentStatus as "al_dia" | "por_vencer" | "vencido" | "sin_pagos"}
            currentDate={currentDate}
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
                appointments={appointmentsWithPaymentColors}
                payments={payments}
                onDateClick={handleDateClick}
                onAppointmentClick={handleAppointmentClick}
                selectedPatientId={selectedPatientId}
              />
            )}
            {viewType === "week" && (
              <WeekView
                currentDate={currentDate}
                appointments={appointmentsWithPaymentColors}
                onAppointmentClick={handleAppointmentClick}
                selectedPatientId={selectedPatientId}
              />
            )}
            {viewType === "day" && (
              <DayView
                currentDate={currentDate}
                appointments={appointmentsWithPaymentColors}
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
        />
      </div>
    </div>
  );
};

export default Agenda;
