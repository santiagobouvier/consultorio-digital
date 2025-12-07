import { useMemo } from "react";
import { format, isSameDay } from "date-fns";
import { es } from "date-fns/locale";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { Calendar, CreditCard, Clock, MapPin, User, X } from "lucide-react";
import { cn } from "@/lib/utils";

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

interface DayDetailDrawerProps {
  open: boolean;
  onClose: () => void;
  selectedDate: Date;
  appointments: Appointment[];
  payments: Payment[];
  onAppointmentClick: (appointment: Appointment) => void;
  selectedPatientId: string | null;
}

export const DayDetailDrawer = ({
  open,
  onClose,
  selectedDate,
  appointments,
  payments,
  onAppointmentClick,
  selectedPatientId,
}: DayDetailDrawerProps) => {
  const dayAppointments = useMemo(() => {
    return appointments
      .filter((apt) => isSameDay(new Date(apt.start_at), selectedDate))
      .sort((a, b) => new Date(a.start_at).getTime() - new Date(b.start_at).getTime());
  }, [appointments, selectedDate]);

  const dayPayments = useMemo(() => {
    return payments.filter((payment) => isSameDay(new Date(payment.due_date), selectedDate));
  }, [payments, selectedDate]);

  const formatTime = (datetime: string) => format(new Date(datetime), "HH:mm");

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

  const getStatusBadge = (status: string) => {
    const statusMap: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
      pending: { label: "Programada", variant: "default" },
      confirmed: { label: "Confirmada", variant: "default" },
      attended: { label: "Realizada", variant: "secondary" },
      cancelled: { label: "Cancelada", variant: "destructive" },
      no_show: { label: "Ausente", variant: "destructive" },
    };
    return statusMap[status] || { label: status, variant: "outline" as const };
  };

  const getPaymentStatusBadge = (status: string) => {
    switch (status) {
      case "paid":
        return { label: "Pagado", className: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400" };
      case "pending":
        return { label: "Pendiente", className: "bg-muted text-muted-foreground" };
      case "overdue":
        return { label: "Vencido", className: "bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400" };
      default:
        return { label: status, className: "bg-muted text-muted-foreground" };
    }
  };

  return (
    <Drawer open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DrawerContent className="max-h-[85vh]">
        <DrawerHeader className="border-b pb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                <Calendar className="w-5 h-5 text-primary" />
              </div>
              <div>
                <DrawerTitle className="capitalize text-left">
                  {format(selectedDate, "EEEE d 'de' MMMM", { locale: es })}
                </DrawerTitle>
                <p className="text-sm text-muted-foreground">
                  {dayAppointments.length} cita{dayAppointments.length !== 1 ? "s" : ""}
                  {dayPayments.length > 0 && ` · ${dayPayments.length} pago${dayPayments.length !== 1 ? "s" : ""}`}
                </p>
              </div>
            </div>
            <Button variant="ghost" size="icon" onClick={onClose} className="rounded-full">
              <X className="w-5 h-5" />
            </Button>
          </div>
        </DrawerHeader>

        <div className="overflow-y-auto p-4 space-y-6">
          {/* Appointments Section */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Clock className="w-4 h-4 text-muted-foreground" />
              <h3 className="font-semibold text-sm">Citas</h3>
            </div>

            {dayAppointments.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center bg-muted/30 rounded-xl">
                Sin citas programadas
              </p>
            ) : (
              <div className="space-y-2">
                {dayAppointments.map((apt) => {
                  const statusInfo = getStatusBadge(apt.status);
                  return (
                    <div
                      key={apt.id}
                      onClick={() => onAppointmentClick(apt)}
                      className={cn(
                        "p-4 rounded-xl bg-card border cursor-pointer active:scale-[0.98] transition-all border-l-4 hover:shadow-sm",
                        selectedPatientId ? getPaymentBorderColor(apt.paymentColor) : "border-l-primary"
                      )}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-base font-bold text-primary">
                              {formatTime(apt.start_at)} - {formatTime(apt.end_at)}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 mb-1">
                            <User className="w-3.5 h-3.5 text-muted-foreground" />
                            <p className="font-medium text-sm truncate">
                              {apt.patients?.full_name || "Sin paciente"}
                            </p>
                          </div>
                          {apt.services?.name && (
                            <p className="text-xs text-muted-foreground ml-5">
                              {apt.services.name}
                            </p>
                          )}
                          {apt.location && (
                            <div className="flex items-center gap-2 mt-1">
                              <MapPin className="w-3.5 h-3.5 text-muted-foreground" />
                              <p className="text-xs text-muted-foreground">{apt.location}</p>
                            </div>
                          )}
                        </div>
                        <div className="flex flex-col items-end gap-1.5 shrink-0">
                          <Badge variant={statusInfo.variant} className="rounded-full text-[10px]">
                            {statusInfo.label}
                          </Badge>
                          <Badge variant="outline" className="rounded-full text-[10px]">
                            {apt.modality === "online" ? "Online" : "Presencial"}
                          </Badge>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Payments Section */}
          {dayPayments.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-3">
                <CreditCard className="w-4 h-4 text-muted-foreground" />
                <h3 className="font-semibold text-sm">Pagos del día</h3>
              </div>

              <div className="space-y-2">
                {dayPayments.map((payment) => {
                  const statusInfo = getPaymentStatusBadge(payment.status);
                  return (
                    <div
                      key={payment.id}
                      className="p-4 rounded-xl bg-card border"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex-1 min-w-0">
                          {payment.amount && (
                            <p className="text-lg font-bold text-foreground">
                              ${payment.amount.toLocaleString()}
                            </p>
                          )}
                          <p className="text-xs text-muted-foreground">
                            Vence: {format(new Date(payment.due_date), "d MMM", { locale: es })}
                          </p>
                        </div>
                        <Badge className={cn("rounded-full text-[10px]", statusInfo.className)}>
                          {statusInfo.label}
                        </Badge>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {dayAppointments.length === 0 && dayPayments.length === 0 && (
            <div className="text-center py-8">
              <p className="text-muted-foreground">No hay actividad programada para este día</p>
            </div>
          )}
        </div>
      </DrawerContent>
    </Drawer>
  );
};
