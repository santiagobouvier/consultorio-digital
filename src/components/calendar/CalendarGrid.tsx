import { useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, eachDayOfInterval, isSameMonth, isSameDay, isToday } from "date-fns";
import { es } from "date-fns/locale";
import { useIsMobile } from "@/hooks/use-mobile";
import { DayDetailDrawer } from "./DayDetailDrawer";
import { QuickAppointmentDrawer } from "./QuickAppointmentDrawer";
import { QuickPaymentDrawer } from "./QuickPaymentDrawer";

interface Appointment {
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

interface Payment {
  id: string;
  patient_id: string;
  due_date: string;
  paid_at: string | null;
  status: string;
  amount?: number;
}

interface CalendarGridProps {
  currentDate: Date;
  appointments: Appointment[];
  payments?: Payment[];
  onDateClick: (date: Date) => void;
  onAppointmentClick: (appointment: Appointment) => void;
  selectedPatientId: string | null;
  businessId?: string | null;
  onAppointmentCreated?: () => void;
}

export const CalendarGrid = ({
  currentDate,
  appointments,
  payments = [],
  onDateClick,
  onAppointmentClick,
  selectedPatientId,
  businessId,
  onAppointmentCreated,
}: CalendarGridProps) => {
  const isMobile = useIsMobile();
  const [selectedDay, setSelectedDay] = useState<Date | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [createDrawerOpen, setCreateDrawerOpen] = useState(false);
  const [paymentDrawerOpen, setPaymentDrawerOpen] = useState(false);
  const [createDate, setCreateDate] = useState<Date>(new Date());
  
  const days = useMemo(() => {
    const monthStart = startOfMonth(currentDate);
    const monthEnd = endOfMonth(currentDate);
    const calendarStart = startOfWeek(monthStart, { weekStartsOn: 1 });
    const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });
    return eachDayOfInterval({ start: calendarStart, end: calendarEnd });
  }, [currentDate]);

  const getAppointmentsForDay = (date: Date) => {
    return appointments.filter((apt) => {
      const aptDate = new Date(apt.start_at);
      return isSameDay(aptDate, date);
    });
  };

  const getPaymentsForDay = (date: Date) => {
    return payments.filter((payment) => {
      const dueDate = new Date(payment.due_date);
      return isSameDay(dueDate, date);
    });
  };

  const getPaymentStats = (date: Date) => {
    const dayPayments = getPaymentsForDay(date);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    let paid = 0;
    let pending = 0;
    let overdue = 0;

    dayPayments.forEach(payment => {
      if (payment.paid_at || payment.status === 'paid') {
        paid++;
      } else {
        const dueDate = new Date(payment.due_date);
        dueDate.setHours(0, 0, 0, 0);
        
        if (dueDate < today) {
          overdue++;
        } else {
          pending++;
        }
      }
    });

    return { paid, pending, overdue, total: dayPayments.length };
  };

  const getPaymentBorderColor = (color?: string) => {
    switch (color) {
      case "green":
        return "border-l-emerald-500";
      case "orange":
        return "border-l-amber-500";
      case "red":
        return "border-l-rose-500";
      default:
        return "border-l-primary";
    }
  };

  const formatTime = (datetime: string) => {
    return format(new Date(datetime), "HH:mm");
  };

  const handleDayClick = (day: Date) => {
    if (isMobile) {
      setSelectedDay(day);
      setDrawerOpen(true);
    } else {
      onDateClick(day);
    }
  };

  const weekDays = isMobile ? ["L", "M", "X", "J", "V", "S", "D"] : ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];

  // Mobile: Compact calendar with indicators + drawer
  if (isMobile) {
    return (
      <>
        <div className="bg-card rounded-3xl border shadow-sm overflow-hidden">
          {/* Header - Week days */}
          <div className="grid grid-cols-7 bg-muted/40 py-3">
            {weekDays.map((day) => (
              <div
                key={day}
                className="text-center text-xs font-bold text-muted-foreground uppercase tracking-wide"
              >
                {day}
              </div>
            ))}
          </div>

          {/* Days Grid */}
          <div className="grid grid-cols-7 gap-px bg-border/50">
            {days.map((day, index) => {
              const dayAppointments = getAppointmentsForDay(day);
              const paymentStats = getPaymentStats(day);
              const isCurrentMonth = isSameMonth(day, currentDate);
              const isCurrentDay = isToday(day);
              const hasAppointments = dayAppointments.length > 0;
              const hasPayments = paymentStats.total > 0;
              const hasActivity = hasAppointments || hasPayments;

              return (
                <div
                  key={index}
                  className={cn(
                    "min-h-[88px] p-1 cursor-pointer transition-all active:scale-95",
                    isCurrentMonth ? "bg-card" : "bg-muted/30",
                    hasActivity && isCurrentMonth && "bg-primary/5",
                    paymentStats.overdue > 0 && isCurrentMonth && "bg-rose-50 dark:bg-rose-950/20"
                  )}
                  onClick={() => handleDayClick(day)}
                >
                  <div className="flex flex-col items-center gap-0.5 h-full">
                    {/* Day number */}
                    <span
                      className={cn(
                        "text-base font-bold w-8 h-8 flex items-center justify-center rounded-lg transition-all",
                        !isCurrentMonth && "text-muted-foreground/30 font-normal",
                        isCurrentMonth && "text-foreground",
                        isCurrentDay && "bg-primary text-primary-foreground ring-2 ring-primary/30 ring-offset-1 ring-offset-background shadow-lg"
                      )}
                    >
                      {format(day, "d")}
                    </span>
                    
                    {/* Indicators */}
                    {isCurrentMonth && hasActivity && (
                      <div className="flex flex-col gap-0.5 items-center w-full">
                        {/* Appointments */}
                        {hasAppointments && (
                          <div className="flex items-center gap-1">
                            <span className="w-3 h-3 rounded-full bg-primary shadow-sm" />
                            <span className="text-xs font-bold text-primary">
                              {dayAppointments.length}
                            </span>
                          </div>
                        )}
                        
                        {/* Payments */}
                        {hasPayments && (
                          <div className="flex items-center gap-1.5 flex-wrap justify-center">
                            {paymentStats.paid > 0 && (
                              <span className="flex items-center gap-0.5">
                                <span className="w-3 h-3 rounded-full bg-emerald-500 shadow-sm" />
                                <span className="text-xs font-bold text-emerald-600">{paymentStats.paid}</span>
                              </span>
                            )}
                            {paymentStats.pending > 0 && (
                              <span className="flex items-center gap-0.5">
                                <span className="w-3 h-3 rounded-full bg-amber-500 shadow-sm" />
                                <span className="text-xs font-bold text-amber-600">{paymentStats.pending}</span>
                              </span>
                            )}
                            {paymentStats.overdue > 0 && (
                              <span className="flex items-center gap-0.5">
                                <span className="w-3.5 h-3.5 rounded-full bg-rose-500 animate-pulse shadow-md" />
                                <span className="text-xs font-extrabold text-rose-600">{paymentStats.overdue}</span>
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Day Detail Drawer */}
        <DayDetailDrawer
          open={drawerOpen}
          onClose={() => setDrawerOpen(false)}
          selectedDate={selectedDay || currentDate}
          appointments={appointments}
          payments={payments}
          onAppointmentClick={(apt) => {
            setDrawerOpen(false);
            onAppointmentClick(apt);
          }}
          selectedPatientId={selectedPatientId}
          onCreateAppointment={businessId ? (date) => {
            setDrawerOpen(false);
            setCreateDate(date);
            setCreateDrawerOpen(true);
          } : undefined}
          onCreatePayment={businessId ? (date) => {
            setDrawerOpen(false);
            setCreateDate(date);
            setPaymentDrawerOpen(true);
          } : undefined}
        />

        {/* Quick Appointment Drawer */}
        {businessId && (
          <QuickAppointmentDrawer
            open={createDrawerOpen}
            onClose={() => setCreateDrawerOpen(false)}
            selectedDate={createDate}
            businessId={businessId}
            onSuccess={() => {
              onAppointmentCreated?.();
            }}
          />
        )}

        {/* Quick Payment Drawer */}
        {businessId && (
          <QuickPaymentDrawer
            open={paymentDrawerOpen}
            onClose={() => setPaymentDrawerOpen(false)}
            selectedDate={createDate}
            businessId={businessId}
            onSuccess={() => {
              onAppointmentCreated?.();
            }}
          />
        )}
      </>
    );
  }

  // Desktop: Full calendar with appointment previews
  return (
    <div className="bg-card rounded-3xl border shadow-sm overflow-hidden">
      {/* Header */}
      <div className="grid grid-cols-7 bg-muted/40 py-3">
        {weekDays.map((day) => (
          <div
            key={day}
            className="text-center text-xs font-bold text-muted-foreground uppercase tracking-wide"
          >
            {day}
          </div>
        ))}
      </div>

      {/* Days Grid */}
      <div className="grid grid-cols-7 gap-px bg-border/50">
        {days.map((day, index) => {
          const dayAppointments = getAppointmentsForDay(day);
          const paymentStats = getPaymentStats(day);
          const isCurrentMonth = isSameMonth(day, currentDate);
          const isCurrentDay = isToday(day);
          const hasPayments = paymentStats.total > 0;

          return (
            <div
              key={index}
              className={cn(
                "min-h-[130px] p-2 cursor-pointer transition-all hover:bg-accent/30",
                isCurrentMonth ? "bg-card" : "bg-muted/30",
                paymentStats.overdue > 0 && isCurrentMonth && "bg-rose-50 dark:bg-rose-950/20"
              )}
              onClick={() => onDateClick(day)}
            >
              <div className="flex justify-between items-start mb-2">
                <span
                  className={cn(
                    "text-sm font-bold w-8 h-8 flex items-center justify-center rounded-lg transition-all",
                    !isCurrentMonth && "text-muted-foreground/30 font-normal",
                    isCurrentMonth && "text-foreground",
                    isCurrentDay && "bg-primary text-primary-foreground ring-2 ring-primary/30 ring-offset-1 ring-offset-background"
                  )}
                >
                  {format(day, "d")}
                </span>
                
                {/* Day summary badges */}
                {isCurrentMonth && (
                  <div className="flex items-center gap-1">
                    {dayAppointments.length > 0 && (
                      <span className="text-[10px] font-medium text-primary bg-primary/10 px-1.5 py-0.5 rounded-full">
                        {dayAppointments.length} cita{dayAppointments.length > 1 ? 's' : ''}
                      </span>
                    )}
                    {hasPayments && (
                      <div className="flex items-center gap-1">
                        {paymentStats.paid > 0 && (
                          <span className="w-3 h-3 rounded-full bg-emerald-500 shadow-sm" title={`${paymentStats.paid} pagado(s)`} />
                        )}
                        {paymentStats.pending > 0 && (
                          <span className="w-3 h-3 rounded-full bg-amber-500 shadow-sm" title={`${paymentStats.pending} pendiente(s)`} />
                        )}
                        {paymentStats.overdue > 0 && (
                          <span className="w-3.5 h-3.5 rounded-full bg-rose-500 animate-pulse shadow-md" title={`${paymentStats.overdue} vencido(s)`} />
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {isCurrentMonth && (
                <div className="space-y-1 overflow-hidden">
                  {dayAppointments.slice(0, 2).map((apt) => (
                    <div
                      key={apt.id}
                      onClick={(e) => {
                        e.stopPropagation();
                        onAppointmentClick(apt);
                      }}
                      className={cn(
                        "text-xs p-1.5 rounded-lg bg-primary/10 hover:bg-primary/20 cursor-pointer truncate border-l-2",
                        selectedPatientId ? getPaymentBorderColor(apt.paymentColor) : "border-l-primary"
                      )}
                    >
                      <span className="font-semibold">{formatTime(apt.start_at)}</span>
                      <span className="ml-1 text-muted-foreground">
                        {apt.patients?.full_name?.split(" ")[0] || "Sin paciente"}
                      </span>
                    </div>
                  ))}
                  {dayAppointments.length > 2 && (
                    <div className="text-[10px] font-medium text-muted-foreground text-center py-0.5">
                      +{dayAppointments.length - 2} más
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
