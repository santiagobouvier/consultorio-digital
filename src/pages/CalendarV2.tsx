import { useState, useEffect, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { useBusinessId } from "@/hooks/use-business-id";
import { useProfessionals } from "@/hooks/use-professionals";
import { calculatePaymentStatus, type PaymentStatus } from "@/lib/payments";
import {
  format,
  addMonths,
  subMonths,
  addWeeks,
  subWeeks,
  addDays,
  subDays,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
} from "date-fns";
import { es } from "date-fns/locale";

import { CalendarHeader } from "@/components/calendar-v2/CalendarHeader";
import { ProfessionalFilter } from "@/components/calendar-v2/ProfessionalFilter";
import { CalendarFiltersPanel } from "@/components/calendar-v2/CalendarFiltersPanel";
import { DayViewV2 } from "@/components/calendar-v2/DayViewV2";
import { WeekViewV2 } from "@/components/calendar-v2/WeekViewV2";
import { MonthViewV2 } from "@/components/calendar-v2/MonthViewV2";
import { AppointmentDetailModal } from "@/components/calendar/AppointmentDetailModal";
import { CreateAppointmentModal } from "@/components/CreateAppointmentModal";
import { Skeleton } from "@/components/ui/skeleton";
import {
  CalendarAppointment,
  CalendarFilters,
  ViewType,
  Professional,
  PaymentColor,
  AppointmentStatus,
} from "@/components/calendar-v2/types";

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

const CalendarV2 = () => {
  const navigate = useNavigate();
  const { businessId, loading: businessLoading } = useBusinessId();
  const { professionals, loading: professionalsLoading, currentUserId, isOwner } = useProfessionals(businessId);

  // Calendar state
  const [viewType, setViewType] = useState<ViewType>("week");
  const [currentDate, setCurrentDate] = useState(new Date());
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState<CalendarFilters>({
    professionalId: null,
    patientId: null,
    status: "all",
    paymentStatus: "all",
  });

  // Data state
  const [appointments, setAppointments] = useState<CalendarAppointment[]>([]);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [allPayments, setAllPayments] = useState<Payment[]>([]);
  const [sharedCalendar, setSharedCalendar] = useState(true);
  const [dataLoading, setDataLoading] = useState(true);

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

  // Fetch patients
  useEffect(() => {
    const fetchPatients = async () => {
      if (!businessId) return;

      const { data } = await supabase
        .from("patients")
        .select("id, full_name")
        .eq("business_id", businessId)
        .eq("is_active", true)
        .order("full_name");

      setPatients(data || []);
    };

    fetchPatients();
  }, [businessId]);

  // Get date range based on view
  const getDateRange = useCallback(() => {
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

    const { data } = await supabase
      .from("payments")
      .select("id, patient_id, due_date, paid_at, status, amount")
      .eq("business_id", businessId)
      .neq("status", "cancelled");

    setAllPayments(data || []);
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

      const pendingPayments = patientPayments.filter(
        (p) => !p.paid_at && p.status !== "cancelled"
      );

      if (pendingPayments.length === 0) return "paid";

      let hasOverdue = false;
      let hasDueSoon = false;

      for (const payment of pendingPayments) {
        const status = calculatePaymentStatus({
          due_date: payment.due_date,
          paid_at: payment.paid_at,
          status: payment.status,
        });

        if (status === "overdue") {
          hasOverdue = true;
          break;
        } else if (status === "due_soon") {
          hasDueSoon = true;
        }
      }

      if (hasOverdue) return "overdue";
      if (hasDueSoon) return "due_soon";
      return "pending";
    },
    [allPayments]
  );

  // Add payment colors and professional info to appointments
  const processedAppointments = useMemo(() => {
    return appointments.map((apt) => {
      // Payment color
      let paymentColor: PaymentColor = "gray";
      if (apt.patient_id) {
        const status = getPatientPaymentStatus(apt.patient_id);
        if (status === "overdue") paymentColor = "red";
        else if (status === "due_soon") paymentColor = "orange";
        else paymentColor = "green";
      }

      // Professional info
      const professional = professionals.find(
        (p) => p.userId === apt.professional_id
      );

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

    // Filter by professional (if not shared calendar, only show own appointments)
    if (!sharedCalendar && !isOwner) {
      result = result.filter((apt) => apt.professional_id === currentUserId);
    } else if (filters.professionalId) {
      const prof = professionals.find((p) => p.id === filters.professionalId);
      if (prof) {
        result = result.filter((apt) => apt.professional_id === prof.userId);
      }
    }

    // Filter by patient
    if (filters.patientId) {
      result = result.filter((apt) => apt.patient_id === filters.patientId);
    }

    // Filter by status
    if (filters.status !== "all") {
      result = result.filter((apt) => apt.status === filters.status);
    }

    // Filter by payment status
    if (filters.paymentStatus !== "all") {
      result = result.filter((apt) => {
        if (!apt.patient_id) return false;
        const status = apt.patientPaymentStatus;

        switch (filters.paymentStatus) {
          case "al_dia":
            return status === "paid" || status === "pending";
          case "por_vencer":
            return status === "due_soon";
          case "vencido":
            return status === "overdue";
          default:
            return true;
        }
      });
    }

    return result;
  }, [
    processedAppointments,
    filters,
    sharedCalendar,
    isOwner,
    currentUserId,
    professionals,
  ]);

  // Navigation
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

  const goToToday = () => setCurrentDate(new Date());

  const handleDayClick = (date: Date) => {
    setCurrentDate(date);
    setViewType("day");
  };

  // Date label
  const getDateLabel = () => {
    switch (viewType) {
      case "month":
        return format(currentDate, "MMMM yyyy", { locale: es });
      case "week":
        const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 });
        const weekEnd = endOfWeek(currentDate, { weekStartsOn: 1 });
        return `${format(weekStart, "d MMM", { locale: es })} - ${format(weekEnd, "d MMM", { locale: es })}`;
      case "day":
        return format(currentDate, "d 'de' MMMM", { locale: es });
    }
  };

  // Filter count
  const activeFiltersCount =
    (filters.patientId ? 1 : 0) +
    (filters.status !== "all" ? 1 : 0) +
    (filters.paymentStatus !== "all" ? 1 : 0) +
    (filters.professionalId ? 1 : 0);

  const hasActiveFilters = activeFiltersCount > 0;

  const clearFilters = () => {
    setFilters({
      professionalId: null,
      patientId: null,
      status: "all",
      paymentStatus: "all",
    });
  };

  const handleRefresh = () => {
    fetchAppointments();
    fetchPayments();
  };

  // Determine if we should show professional colors
  const showProfessionalColors = sharedCalendar && professionals.length > 1;

  const loading = businessLoading || professionalsLoading;

  if (loading && !businessId) {
    return (
      <div className="min-h-screen bg-background p-4 sm:p-6 space-y-6">
        <Skeleton className="h-12 w-full rounded-xl" />
        <Skeleton className="h-10 w-full rounded-xl" />
        <Skeleton className="h-[400px] w-full rounded-2xl" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-7xl mx-auto p-4 sm:p-6 space-y-4">
        {/* Header */}
        <CalendarHeader
          currentDate={currentDate}
          viewType={viewType}
          onViewChange={setViewType}
          onNavigate={navigateDate}
          onToday={goToToday}
          onAddAppointment={() => setShowCreateModal(true)}
          onToggleFilters={() => setShowFilters(!showFilters)}
          hasActiveFilters={hasActiveFilters}
          activeFiltersCount={activeFiltersCount}
          dateLabel={getDateLabel()}
        />

        {/* Professional filter chips (for shared calendar) */}
        <ProfessionalFilter
          professionals={professionals}
          selectedProfessionalId={filters.professionalId}
          onSelect={(id) => setFilters({ ...filters, professionalId: id })}
          sharedCalendar={sharedCalendar && isOwner}
        />

        {/* Filters panel */}
        {showFilters && (
          <CalendarFiltersPanel
            filters={filters}
            onFiltersChange={setFilters}
            patients={patients}
            onClear={clearFilters}
          />
        )}

        {/* Calendar views */}
        {dataLoading ? (
          <div className="flex items-center justify-center py-20">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary" />
          </div>
        ) : (
          <>
            {viewType === "day" && (
              <DayViewV2
                currentDate={currentDate}
                appointments={filteredAppointments}
                onAppointmentClick={(apt) => {
                  setSelectedAppointment(apt);
                  setShowAppointmentModal(true);
                }}
                onAddAppointment={() => setShowCreateModal(true)}
                showProfessionalColors={showProfessionalColors}
              />
            )}
            {viewType === "week" && (
              <WeekViewV2
                currentDate={currentDate}
                appointments={filteredAppointments}
                onAppointmentClick={(apt) => {
                  setSelectedAppointment(apt);
                  setShowAppointmentModal(true);
                }}
                onDayClick={handleDayClick}
                onAddAppointment={() => setShowCreateModal(true)}
                showProfessionalColors={showProfessionalColors}
              />
            )}
            {viewType === "month" && (
              <MonthViewV2
                currentDate={currentDate}
                appointments={filteredAppointments}
                onAppointmentClick={(apt) => {
                  setSelectedAppointment(apt);
                  setShowAppointmentModal(true);
                }}
                onDayClick={handleDayClick}
                onAddAppointment={() => setShowCreateModal(true)}
                showProfessionalColors={showProfessionalColors}
              />
            )}
          </>
        )}

        {/* Appointment detail modal */}
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

        {/* Create appointment modal */}
        <CreateAppointmentModal
          open={showCreateModal}
          onOpenChange={setShowCreateModal}
          patientId={null}
          onSuccess={handleRefresh}
        />
      </div>
    </div>
  );
};

export default CalendarV2;
