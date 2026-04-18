import { useMemo } from "react";
import { format, isSameDay } from "date-fns";
import { es } from "date-fns/locale";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { CalendarAppointment, DayPayment } from "./types";
import { AppointmentCard } from "./AppointmentCard";
import { Calendar, X, CreditCard } from "lucide-react";
import { cn } from "@/lib/utils";
import { calculatePaymentStatus, formatCurrency } from "@/lib/payments";

interface MonthDayDrawerProps {
  open: boolean;
  onClose: () => void;
  selectedDate: Date;
  appointments: CalendarAppointment[];
  dayPayments?: DayPayment[];
  onAppointmentClick: (appointment: CalendarAppointment) => void;
  onPaymentClick?: (payment: DayPayment) => void;
  showProfessionalColors: boolean;
}

export const MonthDayDrawer = ({
  open,
  onClose,
  selectedDate,
  appointments,
  dayPayments = [],
  onAppointmentClick,
  onPaymentClick,
  showProfessionalColors,
}: MonthDayDrawerProps) => {
  const dayAppointments = useMemo(() => {
    return appointments
      .filter((apt) => isSameDay(new Date(apt.start_at), selectedDate))
      .sort((a, b) => new Date(a.start_at).getTime() - new Date(b.start_at).getTime());
  }, [appointments, selectedDate]);

  const totalCount = dayAppointments.length + dayPayments.length;

  return (
    <Drawer open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DrawerContent className="max-h-[85vh]">
        <DrawerHeader className="border-b pb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
                <Calendar className="w-6 h-6 text-primary" />
              </div>
              <div>
                <DrawerTitle className="capitalize text-left text-lg">
                  {format(selectedDate, "EEEE d", { locale: es })}
                </DrawerTitle>
                <p className="text-sm text-muted-foreground">
                  {format(selectedDate, "MMMM yyyy", { locale: es })}
                  {totalCount > 0 && ` · ${dayAppointments.length} cita${dayAppointments.length !== 1 ? "s" : ""}`}
                  {dayPayments.length > 0 && ` · ${dayPayments.length} pago${dayPayments.length !== 1 ? "s" : ""}`}
                </p>
              </div>
            </div>
            <Button variant="ghost" size="icon" onClick={onClose} className="rounded-full">
              <X className="w-5 h-5" />
            </Button>
          </div>
        </DrawerHeader>

        <div className="overflow-y-auto p-4 pb-8 space-y-4">
          {dayAppointments.length === 0 && dayPayments.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-muted-foreground">Sin actividad este día</p>
            </div>
          ) : (
            <>
              {dayAppointments.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground px-1">
                    Citas
                  </h4>
                  <div className="space-y-3">
                    {dayAppointments.map((apt) => (
                      <AppointmentCard
                        key={apt.id}
                        appointment={apt}
                        onClick={() => onAppointmentClick(apt)}
                        showProfessionalColor={showProfessionalColors}
                      />
                    ))}
                  </div>
                </div>
              )}

              {dayPayments.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground px-1 flex items-center gap-1.5">
                    <CreditCard className="h-3.5 w-3.5" />
                    Pagos y vencimientos
                  </h4>
                  <div className="space-y-2">
                    {dayPayments.map((p) => {
                      const st = calculatePaymentStatus(p);
                      const initials = (p.patient_name?.trim().split(/\s+/).map((x) => x[0]).slice(0, 2).join("") || "?").toUpperCase();
                      return (
                        <button
                          key={p.id}
                          onClick={() => onPaymentClick?.(p)}
                          className={cn(
                            "w-full text-left p-3 rounded-xl border-l-4 transition-all hover:shadow-md active:scale-[0.99]",
                            st === "overdue" && "bg-rose-50 dark:bg-rose-950/30 border-l-rose-500",
                            st === "due_soon" && "bg-amber-50 dark:bg-amber-950/30 border-l-amber-500",
                            st !== "overdue" && st !== "due_soon" && "bg-emerald-50 dark:bg-emerald-950/30 border-l-emerald-500"
                          )}
                        >
                          <div className="flex items-center gap-3">
                            <Avatar className="h-9 w-9 shrink-0">
                              <AvatarImage src={p.patient_avatar_url || undefined} alt={p.patient_name} />
                              <AvatarFallback className="text-xs font-semibold bg-background">
                                {initials}
                              </AvatarFallback>
                            </Avatar>
                            <div className="min-w-0 flex-1">
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
                </div>
              )}
            </>
          )}
        </div>
      </DrawerContent>
    </Drawer>
  );
};
