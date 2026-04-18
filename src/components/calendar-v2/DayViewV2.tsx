import { useMemo } from "react";
import { format, isSameDay } from "date-fns";
import { es } from "date-fns/locale";
import { CalendarAppointment, Professional, DayPayment } from "./types";
import { AppointmentCard } from "./AppointmentCard";
import { CalendarDays, Plus, Clock, AlertTriangle, CreditCard } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { calculatePaymentStatus, formatCurrency } from "@/lib/payments";

// Re-export for backwards compatibility
export type { DayPayment };

interface DayViewV2Props {
  currentDate: Date;
  appointments: CalendarAppointment[];
  onAppointmentClick: (appointment: CalendarAppointment) => void;
  onAddAppointment: () => void;
  showProfessionalColors: boolean;
  professionals?: Professional[];
  dayPayments?: DayPayment[];
  onPaymentClick?: (payment: DayPayment) => void;
}

interface DayViewV2Props {
  currentDate: Date;
  appointments: CalendarAppointment[];
  onAppointmentClick: (appointment: CalendarAppointment) => void;
  onAddAppointment: () => void;
  showProfessionalColors: boolean;
  professionals?: Professional[];
  dayPayments?: DayPayment[];
  onPaymentClick?: (payment: DayPayment) => void;
}

const HOUR_HEIGHT = 60;
const START_HOUR = 7;
const END_HOUR = 21;

const TimeColumn = () => {
  const hours = Array.from({ length: END_HOUR - START_HOUR }, (_, i) => START_HOUR + i);
  return (
    <div className="w-12 shrink-0">
      {hours.map((hour) => (
        <div key={hour} className="h-[60px] relative">
          <span className="absolute -top-2.5 left-0 text-[10px] text-muted-foreground font-medium">
            {`${hour.toString().padStart(2, "0")}:00`}
          </span>
        </div>
      ))}
    </div>
  );
};

const AppointmentBlock = ({
  apt,
  onClick,
  professionalColor,
}: {
  apt: CalendarAppointment;
  onClick: () => void;
  professionalColor: string;
}) => {
  const startDate = new Date(apt.start_at);
  const endDate = new Date(apt.end_at);
  const startMinutes = startDate.getHours() * 60 + startDate.getMinutes();
  const endMinutes = endDate.getHours() * 60 + endDate.getMinutes();
  const durationMinutes = endMinutes - startMinutes;
  const top = ((startMinutes - START_HOUR * 60) / 60) * HOUR_HEIGHT;
  const height = Math.max((durationMinutes / 60) * HOUR_HEIGHT - 2, 24);
  const isCompact = height < 45;

  return (
    <div
      onClick={onClick}
      className={cn(
        "absolute left-1 right-1 rounded-lg border-l-4 bg-card shadow-sm cursor-pointer transition-all hover:shadow-md hover:scale-[1.01] overflow-hidden",
        apt.status === "attended" && "opacity-60",
        apt.status === "cancelled" && "opacity-40"
      )}
      style={{
        top: `${top}px`,
        height: `${height}px`,
        borderLeftColor: professionalColor,
      }}
    >
      <div className={cn("p-2 h-full flex flex-col", isCompact && "p-1.5")}>
        <p className={cn("font-medium truncate text-foreground", isCompact ? "text-xs" : "text-sm")}>
          {apt.patients?.full_name || "Sin paciente"}
        </p>
        {!isCompact && (
          <div className="mt-auto flex items-center gap-1 text-[10px] text-muted-foreground">
            <Clock className="h-3 w-3" />
            {format(startDate, "HH:mm")} - {format(endDate, "HH:mm")}
          </div>
        )}
      </div>
    </div>
  );
};

const NowIndicator = () => {
  const now = new Date();
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  const top = ((nowMinutes - START_HOUR * 60) / 60) * HOUR_HEIGHT;
  if (now.getHours() < START_HOUR || now.getHours() >= END_HOUR) return null;

  return (
    <div
      className="absolute left-0 right-0 flex items-center z-20 pointer-events-none"
      style={{ top: `${top}px` }}
    >
      <div className="w-3 h-3 rounded-full bg-destructive" />
      <div className="flex-1 h-0.5 bg-destructive" />
    </div>
  );
};

export const DayViewV2 = ({
  currentDate,
  appointments,
  onAppointmentClick,
  onAddAppointment,
  showProfessionalColors,
  professionals = [],
  dayPayments = [],
  onPaymentClick,
}: DayViewV2Props) => {
  const dayAppointments = useMemo(
    () =>
      appointments
        .filter((apt) => isSameDay(new Date(apt.start_at), currentDate))
        .sort((a, b) => new Date(a.start_at).getTime() - new Date(b.start_at).getTime()),
    [appointments, currentDate]
  );

  const isCurrentDay = isSameDay(currentDate, new Date());
  const useMultiColumn = showProfessionalColors && professionals.length > 1;
  const hours = Array.from({ length: END_HOUR - START_HOUR }, (_, i) => START_HOUR + i);

  // Group appointments by professional for multi-column view
  const columnData = useMemo(() => {
    if (!useMultiColumn) return null;
    return professionals.map((prof) => ({
      professional: prof,
      appointments: dayAppointments.filter((apt) => apt.professional_id === prof.userId),
    }));
  }, [useMultiColumn, professionals, dayAppointments]);

  return (
    <div className="space-y-4">
      {/* Day header */}
      <div className="flex items-center justify-between p-4 bg-card rounded-2xl border">
        <div>
          <h2 className="text-xl font-bold capitalize">
            {format(currentDate, "EEEE", { locale: es })}
          </h2>
          <p className="text-muted-foreground">
            {format(currentDate, "d 'de' MMMM, yyyy", { locale: es })}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-3xl font-bold text-primary">{dayAppointments.length}</span>
          <span className="text-sm text-muted-foreground">
            cita{dayAppointments.length !== 1 ? "s" : ""}
          </span>
        </div>
      </div>

      {/* Multi-column time grid (desktop, 2+ professionals) */}
      {useMultiColumn && columnData ? (
        <div className="hidden md:block bg-card rounded-2xl border overflow-hidden">
          {/* Column headers */}
          <div className="grid border-b" style={{ gridTemplateColumns: `48px repeat(${columnData.length}, 1fr)` }}>
            <div className="border-r" />
            {columnData.map(({ professional }) => (
              <div
                key={professional.id}
                className="py-3 px-2 text-center border-r last:border-r-0 flex items-center justify-center gap-2"
              >
                <div
                  className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0"
                  style={{ backgroundColor: professional.color }}
                >
                  {professional.name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase()}
                </div>
                <span className="text-sm font-semibold truncate">{professional.name}</span>
              </div>
            ))}
          </div>

          {/* Time grid */}
          <div className="overflow-auto max-h-[calc(100vh-320px)]">
            <div
              className="grid relative"
              style={{ gridTemplateColumns: `48px repeat(${columnData.length}, 1fr)` }}
            >
              {/* Time labels */}
              <div>
                {hours.map((hour) => (
                  <div key={hour} className="h-[60px] border-b border-border/30 relative">
                    <span className="absolute -top-2.5 left-1 text-[10px] text-muted-foreground font-medium">
                      {`${hour.toString().padStart(2, "0")}:00`}
                    </span>
                  </div>
                ))}
              </div>

              {/* Professional columns */}
              {columnData.map(({ professional, appointments: profApts }) => (
                <div key={professional.id} className="border-r last:border-r-0 relative">
                  {/* Hour lines */}
                  {hours.map((hour) => (
                    <div key={hour} className="h-[60px] border-b border-border/30" />
                  ))}
                  {/* Appointments */}
                  {profApts.map((apt) => (
                    <AppointmentBlock
                      key={apt.id}
                      apt={apt}
                      onClick={() => onAppointmentClick(apt)}
                      professionalColor={professional.color}
                    />
                  ))}
                  {/* Now indicator */}
                  {isCurrentDay && <NowIndicator />}
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : null}

      {/* Single-column / mobile list view */}
      <div className={cn(useMultiColumn && "md:hidden")}>
        {dayAppointments.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 px-4">
            <div className="w-20 h-20 rounded-full bg-muted/50 flex items-center justify-center mb-4">
              <CalendarDays className="h-10 w-10 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-semibold text-foreground mb-1">Sin citas programadas</h3>
            <p className="text-muted-foreground text-center mb-6">No hay citas para este día</p>
            <Button onClick={onAddAppointment} className="rounded-xl gap-2">
              <Plus className="h-4 w-4" />
              Agregar cita
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            {dayAppointments.map((apt, index) => (
              <div
                key={apt.id}
                className="animate-fade-in"
                style={{ animationDelay: `${index * 50}ms`, animationFillMode: "both" }}
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
      </div>

      {/* Pending payments for this day */}
      {dayPayments.length > 0 && (
        <div className="bg-card rounded-2xl border p-4 space-y-3">
          <div className="flex items-center gap-2">
            <CreditCard className="h-4 w-4 text-muted-foreground" />
            <h3 className="text-sm font-semibold">
              Pagos del día ({dayPayments.length})
            </h3>
          </div>
          {dayPayments.map((payment) => {
            const payStatus = calculatePaymentStatus({
              due_date: payment.due_date,
              paid_at: payment.paid_at,
              status: payment.status,
            });
            const isOverdue = payStatus === "overdue";
            const isDueSoon = payStatus === "due_soon";
            
            return (
              <div
                key={payment.id}
                onClick={() => onPaymentClick?.(payment)}
                className={cn(
                  "p-3 rounded-xl border-l-4 cursor-pointer transition-all hover:shadow-md",
                  isOverdue && "bg-rose-50 dark:bg-rose-950/30 border-l-rose-500",
                  isDueSoon && "bg-amber-50 dark:bg-amber-950/30 border-l-amber-500",
                  !isOverdue && !isDueSoon && "bg-emerald-50 dark:bg-emerald-950/30 border-l-emerald-500"
                )}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-sm">{payment.patient_name}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      ${payment.amount.toLocaleString()}
                    </p>
                  </div>
                  <Badge
                    variant="outline"
                    className={cn(
                      "rounded-full text-xs",
                      isOverdue && "border-rose-300 text-rose-700 dark:text-rose-400",
                      isDueSoon && "border-amber-300 text-amber-700 dark:text-amber-400"
                    )}
                  >
                    <AlertTriangle className="h-3 w-3 mr-1" />
                    {isOverdue ? "Vencido" : isDueSoon ? "Por vencer" : "Pendiente"}
                  </Badge>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
