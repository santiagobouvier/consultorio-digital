import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "@/hooks/use-toast";
import { useBusinessId } from "@/hooks/use-business-id";
import { useProfessionals } from "@/hooks/use-professionals";
import { useDashboardBranding } from "@/contexts/DashboardBrandingContext";
import { useIsMobile } from "@/hooks/use-mobile";
import { calculatePaymentStatus, type PaymentStatus } from "@/lib/payments";
import {
  format,
  isSameDay,
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
import { AgendaLegend } from "@/components/calendar-v2/AgendaLegend";
import { ProfessionalFilter } from "@/components/calendar-v2/ProfessionalFilter";
import { ProfessionalColorLegend } from "@/components/calendar-v2/ProfessionalColorLegend";
import { CalendarFiltersPanel } from "@/components/calendar-v2/CalendarFiltersPanel";
import { DayViewV2 } from "@/components/calendar-v2/DayViewV2";
import { WeekViewV2 } from "@/components/calendar-v2/WeekViewV2";
import { MonthViewV2 } from "@/components/calendar-v2/MonthViewV2";
import { DesktopCalendarLayout } from "@/components/calendar-v2/DesktopCalendarLayout";
import { MobileAgendaFab } from "@/components/calendar-v2/MobileAgendaFab";
import { BirthdaysStrip } from "@/components/calendar-v2/BirthdaysStrip";
import { ShareFreeSlotsDialog } from "@/components/calendar-v2/ShareFreeSlotsDialog";
import { AppointmentDetailModal } from "@/components/calendar/AppointmentDetailModal";
import { CreateAppointmentModal } from "@/components/CreateAppointmentModal";
import { PersonalEventModal } from "@/components/PersonalEventModal";
import { QuickPaymentDrawer } from "@/components/calendar/QuickPaymentDrawer";
import { PaymentDayDrawer } from "@/components/calendar-v2/PaymentDayDrawer";
import type { DayPayment } from "@/components/calendar-v2/types";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { exportCSV, todayDateString } from "@/lib/csv-export";
import { invalidateAppointmentData } from "@/lib/data-sync";

import {
  CalendarAppointment,
  CalendarFilters,
  ViewType,
  Professional,
  PaymentColor,
  AppointmentStatus,
  PersonalEvent,
} from "@/components/calendar-v2/types";

interface Patient {
  id: string;
  full_name: string;
  whatsapp_phone: string | null;
  avatar_url: string | null;
  birth_date?: string | null;
}

const toDayPayment = (p: Payment, patient?: Patient): DayPayment => ({
  id: p.id,
  patient_id: p.patient_id,
  patient_name: patient?.full_name || "Sin paciente",
  patient_phone: patient?.whatsapp_phone ?? null,
  patient_avatar_url: patient?.avatar_url ?? null,
  due_date: p.due_date,
  amount: p.amount,
  currency: p.currency,
  status: p.status,
  paid_at: p.paid_at,
  method: p.method,
  notes: p.notes,
});

interface Payment {
  id: string;
  patient_id: string;
  due_date: string;
  paid_at: string | null;
  status: string;
  amount: number;
  currency: string;
  method: string | null;
  notes: string | null;
}

const CalendarV2 = () => {
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const { businessId, loading: businessLoading } = useBusinessId();
  const { professionals, loading: professionalsLoading, currentUserId, isOwner } = useProfessionals(businessId);
  const { displayName } = useDashboardBranding();

  // Animation state for view transitions
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [transitionDirection, setTransitionDirection] = useState<"left" | "right" | "none">("none");

  // Calendar state - default to month on desktop
  const [viewType, setViewType] = useState<ViewType>("month");
  // Mobile default: vista día (más legible que mensual en pantallas chicas).
  useEffect(() => {
    if (typeof window !== "undefined" && window.innerWidth < 768) {
      setViewType("day");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const [currentDate, setCurrentDate] = useState(new Date());

  // Deep-link: /agenda?date=YYYY-MM-DD abre la agenda EN ese día en vista
  // día (lo usa el dashboard, ej: "citas de mañana sin confirmar").
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const dateParam = params.get("date");
    if (!dateParam || !/^\d{4}-\d{2}-\d{2}$/.test(dateParam)) return;
    const target = new Date(`${dateParam}T12:00:00`);
    if (isNaN(target.getTime())) return;
    setCurrentDate(target);
    setViewType("day");
    // Limpiar el parámetro para que navegar dentro de la agenda no lo re-aplique
    window.history.replaceState({}, "", window.location.pathname);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState<CalendarFilters>({
    professionalId: null,
    patientId: null,
    status: "all",
    paymentStatus: "all",
  });

  // Data state
  const [sharedCalendar, setSharedCalendar] = useState(true);
  const queryClient = useQueryClient();

  // Modal state
  const [selectedAppointment, setSelectedAppointment] = useState<CalendarAppointment | null>(null);
  const [showAppointmentModal, setShowAppointmentModal] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showPaymentDrawer, setShowPaymentDrawer] = useState(false);
  const [selectedDateForAction, setSelectedDateForAction] = useState<Date>(new Date());
  const [lockDateForAction, setLockDateForAction] = useState(false);
  const [selectedPayment, setSelectedPayment] = useState<DayPayment | null>(null);
  const [showPaymentDetailDrawer, setShowPaymentDetailDrawer] = useState(false);
  // Eventos personales: modal (crear si target=null, editar si tiene evento)
  const [showPersonalModal, setShowPersonalModal] = useState(false);
  const [personalEventTarget, setPersonalEventTarget] = useState<PersonalEvent | null>(null);
  // Compartir huecos libres
  const [showShareSlots, setShowShareSlots] = useState(false);

  // Fetch business settings
  useEffect(() => {
    const fetchBusinessSettings = async () => {
      if (!businessId) return;
      const { data } = await supabase
        .from("businesses")
        .select("shared_calendar")
        .eq("id", businessId)
        .single();
      if (data) setSharedCalendar(data.shared_calendar ?? true);
    };
    fetchBusinessSettings();
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

  // Appointments query — key matches query-prefetch.ts for month view
  const appointmentQueryKey = useMemo(() => {
      const { startDate, endDate } = getDateRange();
    if (viewType === "month") {
      return ["appointments", businessId, "month", currentDate.getMonth()] as const;
    }
    return ["appointments", businessId, viewType, startDate.toISOString()] as const;
  }, [businessId, viewType, currentDate, getDateRange]);

  const { data: appointments = [], isLoading: dataLoading } = useQuery({
    queryKey: appointmentQueryKey,
    queryFn: async () => {
      const { startDate, endDate } = getDateRange();
      const { data, error } = await supabase
        .from("appointments")
        .select(`
          id, start_at, end_at, status, modality, location, payment_status,
          patient_id, service_id, professional_id, recurrence_group_id,
          patients (full_name, whatsapp_phone, email, avatar_url),
          services (name)
        `)
        .eq("business_id", businessId!)
        .gte("start_at", startDate.toISOString())
        .lte("start_at", endDate.toISOString())
        .order("start_at", { ascending: true });
      if (error) throw error;
      return (data as CalendarAppointment[]) || [];
    },
    enabled: !!businessId,
    staleTime: 30_000,
    gcTime: 300_000,
  });

  // Eventos personales del rango visible (incluye series semanales vigentes)
  const { data: personalEventsRaw = [] } = useQuery({
    queryKey: ["personal_events", ...appointmentQueryKey.slice(1)],
    queryFn: async (): Promise<PersonalEvent[]> => {
      const { startDate, endDate } = getDateRange();
      const startDay = format(startDate, "yyyy-MM-dd");
      const { data, error } = await (supabase as any)
        .from("personal_events")
        .select("*")
        .eq("business_id", businessId!)
        .lte("start_at", endDate.toISOString())
        .or(
          `and(recurrence.eq.none,end_at.gte.${startDate.toISOString()}),` +
          `and(recurrence.eq.weekly,or(recurrence_until.is.null,recurrence_until.gte.${startDay}))`
        );
      if (error) throw error;
      return (data as PersonalEvent[]) || [];
    },
    enabled: !!businessId,
    staleTime: 30_000,
    gcTime: 300_000,
  });

  // Expandir a ocurrencias visibles con forma de CalendarAppointment:
  // entran al mismo pipeline de las vistas (día/semana/mes) sin tocarlas.
  const personalOccurrences = useMemo<CalendarAppointment[]>(() => {
    const { startDate, endDate } = getDateRange();
    const WEEK_MS = 7 * 86400000;
    const out: CalendarAppointment[] = [];

    for (const ev of personalEventsRaw) {
      const evStart = new Date(ev.start_at);
      const evEnd = new Date(ev.end_at);
      const durMs = evEnd.getTime() - evStart.getTime();
      if (durMs <= 0) continue;

      const pushOccurrence = (s: Date, e: Date) => {
        if (s > endDate || e < startDate) return;
        out.push({
          id: `personal-${ev.id}-${format(s, "yyyyMMdd")}`,
          start_at: s.toISOString(),
          end_at: e.toISOString(),
          status: "personal",
          modality: null,
          location: null,
          payment_status: null,
          patient_id: null,
          service_id: null,
          professional_id: ev.professional_user_id,
          patients: { full_name: ev.title },
          services: null,
          isPersonal: true,
          personalEvent: ev,
        });
      };

      if (ev.recurrence === "weekly") {
        const until = ev.recurrence_until
          ? new Date(`${ev.recurrence_until}T23:59:59`)
          : null;
        // Saltar de a semanas enteras hasta acercarse al rango visible
        let occMs = evStart.getTime();
        if (occMs + durMs < startDate.getTime()) {
          const weeksBehind = Math.floor((startDate.getTime() - occMs) / WEEK_MS);
          occMs += weeksBehind * WEEK_MS;
        }
        for (let i = 0; occMs <= endDate.getTime() && i < 60; occMs += WEEK_MS, i++) {
          const s = new Date(occMs);
          if (until && s > until) break;
          pushOccurrence(s, new Date(occMs + durMs));
        }
      } else {
        pushOccurrence(evStart, evEnd);
      }
    }
    return out;
  }, [personalEventsRaw, getDateRange]);

  // Patients for calendar
  const { data: patients = [] } = useQuery({
    queryKey: ["calendar_patients", businessId],
    queryFn: async () => {
      const { data } = await supabase
        .from("patients")
        .select("id, full_name, whatsapp_phone, avatar_url, birth_date")
        .eq("business_id", businessId!)
        .eq("is_active", true)
        .order("full_name");
      return (data || []) as Patient[];
    },
    enabled: !!businessId,
    staleTime: 60_000,
  });

  // Payments for calendar
  const { data: allPayments = [] } = useQuery({
    queryKey: ["calendar_payments", businessId],
    queryFn: async () => {
      const { data } = await supabase
        .from("payments")
        .select("id, patient_id, due_date, paid_at, status, amount, currency, method, notes")
        .eq("business_id", businessId!)
        .neq("status", "cancelled");
      return (data as Payment[]) || [];
    },
    enabled: !!businessId,
    staleTime: 30_000,
  });

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
    // Eventos personales entran al mismo pipeline (con su profesional para
    // el filtro por profesional), ordenados junto a las citas.
    const personalWithProfessional = personalOccurrences.map((occ) => ({
      ...occ,
      professional: professionals.find((p) => p.userId === occ.professional_id),
    }));
    let result = [...processedAppointments, ...personalWithProfessional].sort(
      (a, b) => new Date(a.start_at).getTime() - new Date(b.start_at).getTime()
    );

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
    personalOccurrences,
    filters,
    sharedCalendar,
    isOwner,
    currentUserId,
    professionals,
  ]);

  // Navigation
  const navigateDate = (direction: "prev" | "next") => {
    setTransitionDirection(direction === "prev" ? "right" : "left");
    setIsTransitioning(true);
    
    setTimeout(() => {
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
      setTransitionDirection("none");
      setIsTransitioning(false);
    }, 150);
  };

  const goToToday = () => {
    setIsTransitioning(true);
    setTimeout(() => {
      setCurrentDate(new Date());
      setIsTransitioning(false);
    }, 150);
  };

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
    // Central: una cita que cambia también mueve su cobro → refrescar todo
    invalidateAppointmentData(queryClient);
  };

  // Determine if we should show professional colors
  const showProfessionalColors = sharedCalendar && professionals.length > 1;

  // Compute payments for the currently selected day (for day view)
  const dayPayments = useMemo<DayPayment[]>(() => {
    if (viewType !== "day") return [];
    return allPayments
      .filter((p) => {
        const dueDate = new Date(p.due_date);
        return (
          isSameDay(dueDate, currentDate) &&
          p.status !== "cancelled" &&
          !p.paid_at
        );
      })
      .map((p) => toDayPayment(p, patients.find((pat) => pat.id === p.patient_id)));
  }, [allPayments, patients, currentDate, viewType]);

  // Map of payments by day for month/week overlay (key: date.toDateString())
  const paymentsByDay = useMemo<Map<string, DayPayment[]>>(() => {
    const map = new Map<string, DayPayment[]>();
    for (const p of allPayments) {
      if (p.status === "cancelled" || p.paid_at) continue;
      const key = new Date(p.due_date).toDateString();
      const dp = toDayPayment(p, patients.find((pat) => pat.id === p.patient_id));
      const arr = map.get(key);
      if (arr) arr.push(dp);
      else map.set(key, [dp]);
    }
    return map;
  }, [allPayments, patients]);

  const handlePaymentClick = useCallback((payment: DayPayment) => {
    setSelectedPayment(payment);
    setShowPaymentDetailDrawer(true);
  }, []);

  // Un solo click handler: cita → detalle de cita; evento personal → su modal.
  const handleAppointmentClick = useCallback((apt: CalendarAppointment) => {
    if (apt.isPersonal && apt.personalEvent) {
      setPersonalEventTarget(apt.personalEvent);
      setShowPersonalModal(true);
      return;
    }
    setSelectedAppointment(apt);
    setShowAppointmentModal(true);
  }, []);

  const openCreatePersonal = useCallback((date?: Date) => {
    setPersonalEventTarget(null);
    setSelectedDateForAction(date ?? currentDate);
    setShowPersonalModal(true);
  }, [currentDate]);

  const loading = businessLoading || professionalsLoading;

  if (loading && !businessId) {
    return (
      <div className="min-h-screen bg-background p-4 sm:p-6 space-y-6 animate-fade-in">
        {/* Header skeleton */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Skeleton className="h-10 w-10 rounded-xl" />
            <Skeleton className="h-10 w-10 rounded-xl" />
            <Skeleton className="h-8 w-48 rounded-lg" />
          </div>
          <div className="flex gap-2">
            <Skeleton className="h-10 w-10 rounded-xl" />
            <Skeleton className="h-10 w-10 rounded-xl" />
          </div>
        </div>
        {/* Tabs skeleton */}
        <Skeleton className="h-12 w-full rounded-xl" />
        {/* Calendar skeleton */}
        <div className="space-y-2">
          <div className="grid grid-cols-7 gap-1">
            {Array.from({ length: 7 }).map((_, i) => (
              <Skeleton key={i} className="h-8 rounded-lg" />
            ))}
          </div>
          {Array.from({ length: 5 }).map((_, row) => (
            <div key={row} className="grid grid-cols-7 gap-1">
              {Array.from({ length: 7 }).map((_, col) => (
                <Skeleton key={col} className="h-16 rounded-xl" />
              ))}
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* La agenda usa TODO el ancho disponible (con tope solo en ultra-wide):
          los calendarios necesitan espacio, no márgenes decorativos. */}
      <div className="w-full max-w-[1900px] mx-auto p-4 sm:p-6 space-y-4 animate-fade-in">
        {/* Header */}
        <CalendarHeader
          currentDate={currentDate}
          viewType={viewType}
          onViewChange={setViewType}
          onNavigate={navigateDate}
          onToday={goToToday}
          onAddAppointment={() => {
            setSelectedDateForAction(currentDate);
            setLockDateForAction(false);
            setShowCreateModal(true);
          }}
          onAddPayment={() => {
            setSelectedDateForAction(currentDate);
            setLockDateForAction(false);
            setShowPaymentDrawer(true);
          }}
          onAddPersonal={() => openCreatePersonal()}
          onShareSlots={() => setShowShareSlots(true)}
          onToggleFilters={() => setShowFilters(!showFilters)}
          hasActiveFilters={hasActiveFilters}
          activeFiltersCount={activeFiltersCount}
          dateLabel={getDateLabel()}
          onExportCSV={() => {
            const headers = ["Fecha", "Hora inicio", "Hora fin", "Paciente", "Profesional", "Servicio", "Modalidad", "Estado", "Estado de pago", "Notas"];
            const statusMap: Record<string, string> = { pending: "Pendiente", confirmed: "Confirmada", attended: "Atendida", cancelled: "Cancelada", no_show: "No asistió" };
            const rows = filteredAppointments.filter((a) => !a.isPersonal).map((a) => {
              const start = new Date(a.start_at);
              const end = new Date(a.end_at);
              return [
                start.toLocaleDateString("es-UY"),
                start.toLocaleTimeString("es-UY", { hour: "2-digit", minute: "2-digit" }),
                end.toLocaleTimeString("es-UY", { hour: "2-digit", minute: "2-digit" }),
                a.patients?.full_name || "",
                a.professional?.name || "",
                (a.services as any)?.name || "",
                a.modality || "",
                statusMap[a.status] || a.status,
                a.payment_status || "",
                "",
              ];
            });
            exportCSV(headers, rows, `citas_${todayDateString()}.csv`);
          }}
        />

        {/* Referencias de colores (se abre sola la primera vez) */}
        <div className="flex justify-end">
          <AgendaLegend
            showProfessionalColors={showProfessionalColors}
            professionals={professionals}
          />
        </div>

        {/* Cumpleaños del rango visible, con saludo por WhatsApp a un toque */}
        <BirthdaysStrip
          patients={patients}
          rangeStart={getDateRange().startDate}
          rangeEnd={getDateRange().endDate}
          clinicName={displayName || "tu consultorio"}
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
          <div className="animate-scale-in">
            <CalendarFiltersPanel
              filters={filters}
              onFiltersChange={setFilters}
              patients={patients}
              onClear={clearFilters}
            />
          </div>
        )}

        {/* Professional color legend */}
        {showProfessionalColors && <ProfessionalColorLegend professionals={professionals} />}

        {/* Calendar views with transition */}
        <div
          className={cn(
            "transition-all duration-200 ease-out",
            isTransitioning && transitionDirection === "left" && "opacity-0 -translate-x-4",
            isTransitioning && transitionDirection === "right" && "opacity-0 translate-x-4",
            isTransitioning && transitionDirection === "none" && "opacity-0 scale-95",
            !isTransitioning && "opacity-100 translate-x-0 scale-100"
          )}
        >
          {dataLoading ? (
            <div className="flex flex-col items-center justify-center py-20 gap-3">
              <div className="relative">
                <div className="animate-spin rounded-full h-12 w-12 border-4 border-muted border-t-primary" />
              </div>
              <p className="text-sm text-muted-foreground animate-pulse">Cargando agenda...</p>
            </div>
          ) : (
            <>
              {/* Desktop: Use DesktopCalendarLayout for month view */}
              {!isMobile && viewType === "month" ? (
                <DesktopCalendarLayout
                  currentDate={currentDate}
                  appointments={filteredAppointments}
                  onAppointmentClick={handleAppointmentClick}
                  onCreateAppointment={(date) => {
                    if (date) {
                      setSelectedDateForAction(date);
                      setLockDateForAction(true);
                    } else {
                      setLockDateForAction(false);
                    }
                    setShowCreateModal(true);
                  }}
                  onCreatePayment={(date) => {
                    if (date) {
                      setSelectedDateForAction(date);
                      setLockDateForAction(true);
                    } else {
                      setLockDateForAction(false);
                    }
                    setShowPaymentDrawer(true);
                  }}
                  showProfessionalColors={showProfessionalColors}
                  paymentsByDay={paymentsByDay}
                  onPaymentClick={handlePaymentClick}
                />
              ) : (
                <>
                  {viewType === "day" && (
                    <DayViewV2
                      currentDate={currentDate}
                      appointments={filteredAppointments}
                      onAppointmentClick={handleAppointmentClick}
                      onAddAppointment={() => {
                        setSelectedDateForAction(currentDate);
                        setLockDateForAction(true);
                        setShowCreateModal(true);
                      }}
                      showProfessionalColors={showProfessionalColors}
                      professionals={professionals}
                      dayPayments={dayPayments}
                      onPaymentClick={handlePaymentClick}
                    />
                  )}
                  {viewType === "week" && (
                    <WeekViewV2
                      currentDate={currentDate}
                      appointments={filteredAppointments}
                      onAppointmentClick={handleAppointmentClick}
                      onDayClick={handleDayClick}
                      onAddAppointment={() => {
                        setSelectedDateForAction(currentDate);
                        setLockDateForAction(true);
                        setShowCreateModal(true);
                      }}
                      showProfessionalColors={showProfessionalColors}
                      paymentsByDay={paymentsByDay}
                      onPaymentClick={handlePaymentClick}
                    />
                  )}
                  {viewType === "month" && isMobile && (
                    <MonthViewV2
                      currentDate={currentDate}
                      appointments={filteredAppointments}
                      onAppointmentClick={handleAppointmentClick}
                      onDayClick={handleDayClick}
                      onAddAppointment={() => {
                        setSelectedDateForAction(currentDate);
                        setLockDateForAction(true);
                        setShowCreateModal(true);
                      }}
                      showProfessionalColors={showProfessionalColors}
                      paymentsByDay={paymentsByDay}
                      onPaymentClick={handlePaymentClick}
                    />
                  )}
                </>
              )}
            </>
          )}
        </div>

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

        {/* Compartir huecos libres */}
        <ShareFreeSlotsDialog
          open={showShareSlots}
          onOpenChange={setShowShareSlots}
          businessId={businessId}
          currentUserId={currentUserId}
        />

        {/* Personal event modal (crear/editar) */}
        <PersonalEventModal
          open={showPersonalModal}
          onOpenChange={(o) => {
            setShowPersonalModal(o);
            if (!o) setPersonalEventTarget(null);
          }}
          businessId={businessId}
          event={personalEventTarget}
          defaultDate={selectedDateForAction}
          onSaved={() => {
            queryClient.invalidateQueries({ queryKey: ["personal_events"] });
          }}
        />

        {/* Create appointment modal */}
        <CreateAppointmentModal
          open={showCreateModal}
          onOpenChange={setShowCreateModal}
          patientId={null}
          onSuccess={handleRefresh}
          prefilledDate={selectedDateForAction}
          lockDate={lockDateForAction}
        />

        {/* Quick payment drawer (create new) */}
        {businessId && (
          <QuickPaymentDrawer
            open={showPaymentDrawer}
            onClose={() => setShowPaymentDrawer(false)}
            selectedDate={selectedDateForAction}
            businessId={businessId}
            onSuccess={handleRefresh}
            lockDate={lockDateForAction}
          />
        )}

        {/* Payment detail drawer (existing payment) */}
        {businessId && (
          <PaymentDayDrawer
            open={showPaymentDetailDrawer}
            onClose={() => {
              setShowPaymentDetailDrawer(false);
              setSelectedPayment(null);
            }}
            payment={selectedPayment}
            businessId={businessId}
            onUpdated={handleRefresh}
          />
        )}
      </div>

      {/* Mobile FAB — bottom-right, never overlaps the calendar */}
      <MobileAgendaFab
        onAddAppointment={() => {
          setSelectedDateForAction(currentDate);
          setLockDateForAction(false);
          setShowCreateModal(true);
        }}
        onAddPayment={() => {
          setSelectedDateForAction(currentDate);
          setLockDateForAction(false);
          setShowPaymentDrawer(true);
        }}
        onAddPersonal={() => openCreatePersonal()}
      />
    </div>
  );
};

export default CalendarV2;
