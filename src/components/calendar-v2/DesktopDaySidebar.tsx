import { useMemo } from "react";
import { format, isSameDay, isToday, isTomorrow } from "date-fns";
import { es } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { CalendarAppointment, DayPayment } from "./types";
import { AppointmentCard } from "./AppointmentCard";
import { DayMiniTimeline } from "./DayMiniTimeline";
import { useDashboardBranding } from "@/contexts/DashboardBrandingContext";
import {
  Calendar,
  Plus,
  CreditCard,
  Clock,
  Users,
  Sparkles,
  X
} from "lucide-react";
import { cn } from "@/lib/utils";
import { calculatePaymentStatus, formatCurrency } from "@/lib/payments";

interface DesktopDaySidebarProps {
  selectedDate: Date | null;
  appointments: CalendarAppointment[];
  dayPayments?: DayPayment[];
  onAppointmentClick: (appointment: CalendarAppointment) => void;
  onPaymentClick?: (payment: DayPayment) => void;
  onCreateAppointment: () => void;
  onCreatePayment: () => void;
  onClose: () => void;
  showProfessionalColors: boolean;
}

export const DesktopDaySidebar = ({
  selectedDate,
  appointments,
  dayPayments = [],
  onAppointmentClick,
  onPaymentClick,
  onCreateAppointment,
  onCreatePayment,
  onClose,
  showProfessionalColors,
}: DesktopDaySidebarProps) => {
  const dayAppointments = useMemo(() => {
    if (!selectedDate) return [];
    return appointments
      .filter((apt) => isSameDay(new Date(apt.start_at), selectedDate))
      .sort((a, b) => new Date(a.start_at).getTime() - new Date(b.start_at).getTime());
  }, [appointments, selectedDate]);

  const { primaryColor } = useDashboardBranding();

  // Get payment summary for the day
  const paymentSummary = useMemo(() => {
    const paid = dayAppointments.filter(apt => apt.paymentColor === "green").length;
    const pending = dayAppointments.filter(apt => apt.paymentColor === "orange" || apt.paymentColor === "red").length;
    return { paid, pending };
  }, [dayAppointments]);

  if (!selectedDate) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-muted-foreground p-8">
        <div className="w-20 h-20 rounded-2xl bg-muted/30 flex items-center justify-center mb-4">
          <Calendar className="w-10 h-10 text-muted-foreground/50" />
        </div>
        <p className="text-lg font-medium text-foreground/70">Selecciona un día</p>
        <p className="text-sm text-center mt-1">
          Haz click en cualquier día del calendario para ver sus citas
        </p>
      </div>
    );
  }

  const isSelectedToday = isToday(selectedDate);
  const isSelectedTomorrow = isTomorrow(selectedDate);

  const getDayLabel = () => {
    if (isSelectedToday) return "Hoy";
    if (isSelectedTomorrow) return "Mañana";
    return format(selectedDate, "EEEE", { locale: es });
  };

  return (
    <div className="h-full flex flex-col bg-card animate-slide-in-right">
      {/* Header */}
      <div
        className="p-5 border-b shrink-0"
        style={{
          background: `linear-gradient(160deg, hsla(${primaryColor}, 0.12) 0%, hsla(${primaryColor}, 0.03) 60%, transparent)`,
        }}
      >
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <div
              className={cn(
                "w-14 h-14 rounded-2xl flex flex-col items-center justify-center",
                !isSelectedToday && "bg-card border border-border/70"
              )}
              style={
                isSelectedToday
                  ? {
                      background: `hsl(${primaryColor})`,
                      color: "#fff",
                      boxShadow: `0 10px 24px -10px hsla(${primaryColor}, 0.65)`,
                    }
                  : undefined
              }
            >
              <span className="text-xs font-medium uppercase leading-none opacity-80">
                {format(selectedDate, "EEE", { locale: es })}
              </span>
              <span className="text-xl font-extrabold leading-none mt-0.5">
                {format(selectedDate, "d")}
              </span>
            </div>
            <div>
              <h3 className="text-lg font-semibold capitalize">{getDayLabel()}</h3>
              <p className="text-sm text-muted-foreground">
                {format(selectedDate, "d 'de' MMMM, yyyy", { locale: es })}
              </p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="rounded-full -mt-1 -mr-1"
          >
            <X className="w-5 h-5" />
          </Button>
        </div>

        {/* El día en miniatura */}
        <DayMiniTimeline
          appointments={dayAppointments}
          showProfessionalColors={showProfessionalColors}
          isCurrentDay={isSelectedToday}
          className="mb-4"
        />

        {/* Quick stats */}
        <div className="flex gap-2">
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-background/60 border border-border/50 flex-1">
            <Clock className="w-4 h-4 text-muted-foreground" />
            <span className="text-sm font-medium">{dayAppointments.length}</span>
            <span className="text-xs text-muted-foreground">citas</span>
          </div>
          {paymentSummary.pending > 0 && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-amber-500/10 flex-1">
              <CreditCard className="w-4 h-4 text-amber-600" />
              <span className="text-sm font-medium text-amber-700">{paymentSummary.pending}</span>
              <span className="text-xs text-amber-600">pendientes</span>
            </div>
          )}
        </div>
      </div>

      {/* Quick actions */}
      <div className="p-4 border-b shrink-0">
        <div className="grid grid-cols-2 gap-2">
          <Button
            onClick={onCreateAppointment}
            className="h-11 rounded-xl font-medium gap-2"
          >
            <Plus className="w-4 h-4" />
            Nueva cita
          </Button>
          <Button
            variant="outline"
            onClick={onCreatePayment}
            className="h-11 rounded-xl font-medium gap-2 border-dashed"
          >
            <CreditCard className="w-4 h-4" />
            Registrar pago
          </Button>
        </div>
      </div>

      {/* Appointments + Payments list */}
      <ScrollArea className="flex-1">
        <div className="p-4 space-y-4">
          {dayAppointments.length === 0 && dayPayments.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="w-16 h-16 rounded-2xl bg-muted/30 flex items-center justify-center mb-4">
                <Sparkles className="w-8 h-8 text-muted-foreground/50" />
              </div>
              <p className="text-muted-foreground font-medium">Sin actividad</p>
              <p className="text-sm text-muted-foreground/70 mt-1">
                Este día está libre
              </p>
              <Button
                onClick={onCreateAppointment}
                variant="outline"
                className="mt-4 rounded-xl"
              >
                <Plus className="w-4 h-4 mr-2" />
                Agendar cita
              </Button>
            </div>
          ) : (
            <>
              {dayAppointments.length > 0 && (
                <div className="space-y-3">
                  <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Citas</h4>
                  {dayAppointments.map((apt, index) => (
                    <div
                      key={apt.id}
                      className="animate-fade-in"
                      style={{ animationDelay: `${index * 50}ms` }}
                    >
                      <AppointmentCard
                        appointment={apt}
                        onClick={() => onAppointmentClick(apt)}
                        showProfessionalColor={showProfessionalColors}
                      />
                    </div>
                  ))}
                </div>
              )}

              {dayPayments.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-1.5">
                    <CreditCard className="h-3.5 w-3.5" />
                    Pagos
                  </h4>
                  {dayPayments.map((p) => {
                    const st = calculatePaymentStatus(p);
                    return (
                      <button
                        key={p.id}
                        onClick={() => onPaymentClick?.(p)}
                        className={cn(
                          "w-full text-left p-3 rounded-xl border-l-4 transition-all hover:shadow-md",
                          st === "overdue" && "bg-rose-50 dark:bg-rose-950/30 border-l-rose-500",
                          st === "due_soon" && "bg-amber-50 dark:bg-amber-950/30 border-l-amber-500",
                          st !== "overdue" && st !== "due_soon" && "bg-emerald-50 dark:bg-emerald-950/30 border-l-emerald-500"
                        )}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="min-w-0">
                            <p className="font-semibold text-sm truncate">{p.patient_name}</p>
                            <p className="text-xs text-muted-foreground mt-0.5">
                              {formatCurrency(p.amount, p.currency)}
                            </p>
                          </div>
                          <Badge
                            variant="outline"
                            className={cn(
                              "rounded-full text-xs shrink-0",
                              st === "overdue" && "border-rose-300 text-rose-700 dark:text-rose-400",
                              st === "due_soon" && "border-amber-300 text-amber-700 dark:text-amber-400"
                            )}
                          >
                            {st === "overdue" ? "Vencido" : st === "due_soon" ? "Por vencer" : "Pendiente"}
                          </Badge>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </div>
      </ScrollArea>

      {/* Footer summary */}
      {dayAppointments.length > 0 && (
        <div className="p-4 border-t shrink-0 bg-muted/30">
          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Users className="w-4 h-4" />
              <span>{dayAppointments.length} paciente{dayAppointments.length !== 1 ? 's' : ''}</span>
            </div>
            {paymentSummary.paid > 0 && (
              <div className="flex items-center gap-1.5 text-emerald-600">
                <div className="w-2 h-2 rounded-full bg-emerald-500" />
                <span>{paymentSummary.paid} al día</span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
