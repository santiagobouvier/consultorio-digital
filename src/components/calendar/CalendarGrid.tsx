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

  // Límite de indicadores por día
  const MAX_BADGES_MOBILE = 3;
  const MAX_BADGES_DESKTOP = 4;

  // Genera badges ordenados por prioridad: rojo > naranja > verde > azul (citas)
  const getPriorityBadges = (
    appointmentsCount: number,
    paymentStats: { paid: number; pending: number; overdue: number }
  ) => {
    const maxBadges = isMobile ? MAX_BADGES_MOBILE : MAX_BADGES_DESKTOP;
    
    type Badge = { type: 'overdue' | 'pending' | 'paid' | 'appointments'; count: number; priority: number };
    const allBadges: Badge[] = [];

    // Prioridad: 1 = rojo (vencido), 2 = naranja (pendiente), 3 = verde (pagado), 4 = azul (citas)
    if (paymentStats.overdue > 0) {
      allBadges.push({ type: 'overdue', count: paymentStats.overdue, priority: 1 });
    }
    if (paymentStats.pending > 0) {
      allBadges.push({ type: 'pending', count: paymentStats.pending, priority: 2 });
    }
    if (paymentStats.paid > 0) {
      allBadges.push({ type: 'paid', count: paymentStats.paid, priority: 3 });
    }
    if (appointmentsCount > 0) {
      allBadges.push({ type: 'appointments', count: appointmentsCount, priority: 4 });
    }

    // Ordenar por prioridad
    allBadges.sort((a, b) => a.priority - b.priority);

    const totalBadges = allBadges.length;
    
    if (totalBadges <= maxBadges) {
      return { visibleBadges: allBadges, remaining: 0 };
    }

    // Si hay vencidos, garantizar que al menos 1 rojo sea visible
    let visibleBadges = allBadges.slice(0, maxBadges);
    const hasOverdueVisible = visibleBadges.some(b => b.type === 'overdue');
    const hasOverdueTotal = allBadges.some(b => b.type === 'overdue');

    // Si hay vencidos pero no están visibles, reemplazar el último por el rojo
    if (hasOverdueTotal && !hasOverdueVisible) {
      const overdueIdx = allBadges.findIndex(b => b.type === 'overdue');
      if (overdueIdx !== -1) {
        visibleBadges = [allBadges[overdueIdx], ...visibleBadges.slice(0, maxBadges - 1)];
      }
    }

    // Calcular restantes (conteo total de items, no de badges)
    const visibleTypes = new Set(visibleBadges.map(b => b.type));
    const hiddenBadges = allBadges.filter(b => !visibleTypes.has(b.type));
    const remaining = hiddenBadges.reduce((sum, b) => sum + b.count, 0);

    return { visibleBadges, remaining };
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
                    
                    {/* Indicators - Limited by priority */}
                    {isCurrentMonth && hasActivity && (() => {
                      const { visibleBadges, remaining } = getPriorityBadges(
                        dayAppointments.length,
                        paymentStats
                      );

                      return (
                        <div className="flex flex-col gap-0.5 items-center w-full">
                          <div className="flex items-center gap-1 flex-wrap justify-center">
                            {visibleBadges.map((badge, idx) => {
                              if (badge.type === 'overdue') {
                                return (
                                  <span key={idx} className="flex items-center gap-0.5">
                                    <span className="w-3.5 h-3.5 rounded-full bg-rose-500 animate-pulse shadow-md" />
                                    <span className="text-xs font-extrabold text-rose-600">{badge.count}</span>
                                  </span>
                                );
                              }
                              if (badge.type === 'pending') {
                                return (
                                  <span key={idx} className="flex items-center gap-0.5">
                                    <span className="w-3 h-3 rounded-full bg-amber-500 shadow-sm" />
                                    <span className="text-xs font-bold text-amber-600">{badge.count}</span>
                                  </span>
                                );
                              }
                              if (badge.type === 'paid') {
                                return (
                                  <span key={idx} className="flex items-center gap-0.5">
                                    <span className="w-3 h-3 rounded-full bg-emerald-500 shadow-sm" />
                                    <span className="text-xs font-bold text-emerald-600">{badge.count}</span>
                                  </span>
                                );
                              }
                              if (badge.type === 'appointments') {
                                return (
                                  <span key={idx} className="flex items-center gap-0.5">
                                    <span className="w-3 h-3 rounded-full bg-primary shadow-sm" />
                                    <span className="text-xs font-bold text-primary">{badge.count}</span>
                                  </span>
                                );
                              }
                              return null;
                            })}
                            {remaining > 0 && (
                              <span className="text-[10px] font-bold text-muted-foreground bg-muted rounded-full px-1.5 py-0.5">
                                +{remaining}
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })()}
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
                
                {/* Day summary badges - Limited by priority */}
                {isCurrentMonth && (() => {
                  const hasActivity = dayAppointments.length > 0 || hasPayments;
                  if (!hasActivity) return null;

                  const { visibleBadges, remaining } = getPriorityBadges(
                    dayAppointments.length,
                    paymentStats
                  );

                  return (
                    <div className="flex items-center gap-1 flex-wrap">
                      {visibleBadges.map((badge, idx) => {
                        if (badge.type === 'overdue') {
                          return (
                            <span 
                              key={idx}
                              className="w-3.5 h-3.5 rounded-full bg-rose-500 animate-pulse shadow-md" 
                              title={`${badge.count} vencido(s)`} 
                            />
                          );
                        }
                        if (badge.type === 'pending') {
                          return (
                            <span 
                              key={idx}
                              className="w-3 h-3 rounded-full bg-amber-500 shadow-sm" 
                              title={`${badge.count} pendiente(s)`} 
                            />
                          );
                        }
                        if (badge.type === 'paid') {
                          return (
                            <span 
                              key={idx}
                              className="w-3 h-3 rounded-full bg-emerald-500 shadow-sm" 
                              title={`${badge.count} pagado(s)`} 
                            />
                          );
                        }
                        if (badge.type === 'appointments') {
                          return (
                            <span 
                              key={idx}
                              className="text-[10px] font-medium text-primary bg-primary/10 px-1.5 py-0.5 rounded-full"
                            >
                              {badge.count} cita{badge.count > 1 ? 's' : ''}
                            </span>
                          );
                        }
                        return null;
                      })}
                      {remaining > 0 && (
                        <span className="text-[10px] font-bold text-muted-foreground bg-muted rounded-full px-1.5 py-0.5">
                          +{remaining}
                        </span>
                      )}
                    </div>
                  );
                })()}
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
