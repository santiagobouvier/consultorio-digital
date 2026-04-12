import { useMemo, useState } from "react";
import { format, isToday, isBefore, startOfDay } from "date-fns";
import { es } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { 
  Calendar, 
  Clock, 
  User, 
  X, 
  Plus, 
  CheckCircle2, 
  CreditCard, 
  AlertTriangle,
  DollarSign,
  Loader2
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";
import { QuickActionSheet } from "./QuickActionSheet";
import { ConfirmPaymentDialog } from "@/components/ConfirmPaymentDialog";

interface Appointment {
  id: string;
  start_at: string;
  end_at: string;
  status: string;
  payment_status: string | null;
  patient_id: string | null;
  patients: { full_name: string } | null;
  services: { name: string } | null;
}

interface Payment {
  id: string;
  patient_id: string;
  due_date: string;
  paid_at: string | null;
  status: string;
  amount: number;
}

interface Patient {
  id: string;
  full_name: string;
}

interface TodaySummaryDrawerProps {
  open: boolean;
  onClose: () => void;
  appointments: Appointment[];
  payments: Payment[];
  patients: Patient[];
  businessId: string;
  onRefresh: () => void;
  onCreateAppointment: () => void;
  onCreatePayment: () => void;
}

export const TodaySummaryDrawer = ({
  open,
  onClose,
  appointments,
  payments,
  patients,
  businessId,
  onRefresh,
  onCreateAppointment,
  onCreatePayment,
}: TodaySummaryDrawerProps) => {
  const [loadingAppointmentId, setLoadingAppointmentId] = useState<string | null>(null);
  const [loadingPaymentId, setLoadingPaymentId] = useState<string | null>(null);
  const [showActionSheet, setShowActionSheet] = useState(false);
  const [confirmPayment, setConfirmPayment] = useState<{ id: string; amount: number; patientName: string } | null>(null);

  const today = new Date();
  const todayStart = startOfDay(today);

  // Filter today's appointments
  const todayAppointments = useMemo(() => {
    return appointments
      .filter((apt) => isToday(new Date(apt.start_at)))
      .sort((a, b) => new Date(a.start_at).getTime() - new Date(b.start_at).getTime());
  }, [appointments]);

  // Calculate today's metrics
  const todayMetrics = useMemo(() => {
    const appointmentIds = todayAppointments.map(a => a.id);
    
    // Payments due today or linked to today's appointments
    const relevantPayments = payments.filter(p => {
      // Already paid - don't count
      if (p.paid_at || p.status === 'paid') return false;
      
      const dueDate = startOfDay(new Date(p.due_date));
      return isToday(dueDate);
    });

    const amountToCollect = relevantPayments.reduce((sum, p) => sum + (p.amount || 0), 0);

    // Overdue payments (before today and not paid)
    const overduePayments = payments.filter(p => {
      if (p.paid_at || p.status === 'paid') return false;
      const dueDate = startOfDay(new Date(p.due_date));
      return isBefore(dueDate, todayStart);
    });

    return {
      appointmentCount: todayAppointments.length,
      amountToCollect,
      overdueCount: overduePayments.length,
    };
  }, [todayAppointments, payments, todayStart]);

  // Critical payments (overdue + due today)
  const criticalPayments = useMemo(() => {
    return payments
      .filter(p => {
        // Already paid - skip
        if (p.paid_at || p.status === 'paid') return false;
        
        const dueDate = startOfDay(new Date(p.due_date));
        // Overdue or due today
        return isBefore(dueDate, todayStart) || isToday(dueDate);
      })
      .sort((a, b) => new Date(a.due_date).getTime() - new Date(b.due_date).getTime());
  }, [payments, todayStart]);

  // Get patient name by ID
  const getPatientName = (patientId: string | null) => {
    if (!patientId) return "Sin paciente";
    const patient = patients.find(p => p.id === patientId);
    return patient?.full_name || "Paciente";
  };

  // Mark appointment as attended
  const handleMarkAttended = async (appointmentId: string) => {
    setLoadingAppointmentId(appointmentId);
    try {
      const { error } = await supabase
        .from("appointments")
        .update({ status: "attended" })
        .eq("id", appointmentId);

      if (error) throw error;

      toast({ title: "Cita marcada como atendida" });
      onRefresh();
    } catch (error) {
      console.error("Error updating appointment:", error);
      toast({ 
        title: "Error", 
        description: "No se pudo actualizar la cita",
        variant: "destructive" 
      });
    } finally {
      setLoadingAppointmentId(null);
    }
  };

  // Mark payment as paid (called from confirmation dialog)
  const handleMarkPaid = async (paymentId: string) => {
    const { error } = await supabase
      .from("payments")
      .update({ 
        status: "paid",
        paid_at: new Date().toISOString()
      })
      .eq("id", paymentId);

    if (error) throw error;
    onRefresh();
  };

  // Open confirmation dialog for a payment
  const openPaymentConfirm = (paymentId: string, amount: number, patientId: string | null) => {
    setConfirmPayment({
      id: paymentId,
      amount,
      patientName: getPatientName(patientId),
    });
  };

  // Get appointment payment for quick action
  const getAppointmentPayment = (appointmentId: string, patientId: string | null) => {
    if (!patientId) return null;
    
    // Find pending payment for this patient due today or earlier
    return payments.find(p => 
      p.patient_id === patientId && 
      !p.paid_at && 
      p.status !== 'paid'
    );
  };

  const getStatusBadge = (status: string) => {
    const statusMap: Record<string, { label: string; className: string }> = {
      pending: { label: "Programada", className: "bg-primary/10 text-primary" },
      confirmed: { label: "Confirmada", className: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400" },
      attended: { label: "Atendida", className: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400" },
      cancelled: { label: "Cancelada", className: "bg-destructive/10 text-destructive" },
      no_show: { label: "Ausente", className: "bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400" },
    };
    return statusMap[status] || { label: status, className: "bg-muted text-muted-foreground" };
  };

  const getPaymentStatusBadge = (patientId: string | null) => {
    if (!patientId) return null;
    
    const patientPayments = payments.filter(p => p.patient_id === patientId);
    if (patientPayments.length === 0) return null;

    // Check if has unpaid payments
    const pendingPayments = patientPayments.filter(p => !p.paid_at && p.status !== 'paid');
    
    if (pendingPayments.length === 0) {
      return { label: "Al día", className: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400" };
    }

    // Check if overdue
    const hasOverdue = pendingPayments.some(p => {
      const dueDate = startOfDay(new Date(p.due_date));
      return isBefore(dueDate, todayStart);
    });

    if (hasOverdue) {
      return { label: "Vencido", className: "bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400" };
    }

    return { label: "Pendiente", className: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400" };
  };

  const formatTime = (datetime: string) => format(new Date(datetime), "HH:mm");

  return (
    <>
      <Drawer open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
        <DrawerContent className="max-h-[85vh]">
          <DrawerHeader className="border-b pb-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-primary flex items-center justify-center">
                  <Calendar className="w-6 h-6 text-primary-foreground" />
                </div>
                <div>
                  <DrawerTitle className="text-xl text-left">Hoy</DrawerTitle>
                  <p className="text-sm text-muted-foreground capitalize">
                    {format(today, "EEEE d 'de' MMMM", { locale: es })}
                  </p>
                </div>
              </div>
              <Button variant="ghost" size="icon" onClick={onClose} className="rounded-full">
                <X className="w-5 h-5" />
              </Button>
            </div>

            {/* Mini Summary */}
            <div className="grid grid-cols-3 gap-2 mt-4">
              <div className="bg-primary/10 rounded-xl p-3 text-center">
                <p className="text-2xl font-bold text-primary">{todayMetrics.appointmentCount}</p>
                <p className="text-xs text-muted-foreground">Citas</p>
              </div>
              <div className="bg-emerald-100 dark:bg-emerald-900/30 rounded-xl p-3 text-center">
                <p className="text-2xl font-bold text-emerald-700 dark:text-emerald-400">
                  ${todayMetrics.amountToCollect.toLocaleString()}
                </p>
                <p className="text-xs text-muted-foreground">A cobrar</p>
              </div>
              <div className={cn(
                "rounded-xl p-3 text-center",
                todayMetrics.overdueCount > 0 
                  ? "bg-rose-100 dark:bg-rose-900/30" 
                  : "bg-muted"
              )}>
                <p className={cn(
                  "text-2xl font-bold",
                  todayMetrics.overdueCount > 0 
                    ? "text-rose-700 dark:text-rose-400" 
                    : "text-muted-foreground"
                )}>
                  {todayMetrics.overdueCount}
                </p>
                <p className="text-xs text-muted-foreground">Vencidos</p>
              </div>
            </div>
          </DrawerHeader>

          <div className="overflow-y-auto p-4 space-y-6 pb-24">
            {/* Today's Appointments */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <Clock className="w-4 h-4 text-primary" />
                <h3 className="font-semibold text-sm">Citas de hoy</h3>
                <Badge variant="secondary" className="ml-auto rounded-full">
                  {todayAppointments.length}
                </Badge>
              </div>

              {todayAppointments.length === 0 ? (
                <div className="text-center py-8 bg-muted/30 rounded-xl">
                  <Calendar className="w-10 h-10 text-muted-foreground mx-auto mb-2 opacity-50" />
                  <p className="text-sm text-muted-foreground">Sin citas programadas para hoy</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {todayAppointments.map((apt) => {
                    const statusBadge = getStatusBadge(apt.status);
                    const paymentBadge = getPaymentStatusBadge(apt.patient_id);
                    const pendingPayment = getAppointmentPayment(apt.id, apt.patient_id);
                    const isAttended = apt.status === "attended";
                    const isLoading = loadingAppointmentId === apt.id;

                    return (
                      <div
                        key={apt.id}
                        className="p-4 rounded-xl bg-card border shadow-sm"
                      >
                        <div className="flex items-start justify-between gap-3 mb-3">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="text-lg font-bold text-primary">
                                {formatTime(apt.start_at)}
                              </span>
                              <span className="text-sm text-muted-foreground">
                                - {formatTime(apt.end_at)}
                              </span>
                            </div>
                            <div className="flex items-center gap-2">
                              <User className="w-4 h-4 text-muted-foreground" />
                              <p className="font-medium text-sm truncate">
                                {apt.patients?.full_name || "Sin paciente"}
                              </p>
                            </div>
                            {apt.services?.name && (
                              <p className="text-xs text-muted-foreground ml-6">
                                {apt.services.name}
                              </p>
                            )}
                          </div>
                          <div className="flex flex-col items-end gap-1.5 shrink-0">
                            <Badge className={cn("rounded-full text-[10px]", statusBadge.className)}>
                              {statusBadge.label}
                            </Badge>
                            {paymentBadge && (
                              <Badge className={cn("rounded-full text-[10px]", paymentBadge.className)}>
                                {paymentBadge.label}
                              </Badge>
                            )}
                          </div>
                        </div>

                        {/* Quick Actions */}
                        <div className="flex gap-2 pt-2 border-t">
                          {!isAttended && apt.status !== "cancelled" && apt.status !== "no_show" && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="flex-1 h-10 rounded-xl text-sm font-medium gap-1.5"
                              onClick={() => handleMarkAttended(apt.id)}
                              disabled={isLoading}
                            >
                              {isLoading ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                              ) : (
                                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                              )}
                              Atendida
                            </Button>
                          )}
                          {pendingPayment && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="flex-1 h-10 rounded-xl text-sm font-medium gap-1.5 text-emerald-600 border-emerald-200 hover:bg-emerald-50"
                              onClick={() => openPaymentConfirm(pendingPayment.id, pendingPayment.amount, apt.patient_id)}
                            >
                              <DollarSign className="w-4 h-4" />
                              Cobrar ${pendingPayment.amount.toLocaleString()}
                            </Button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Critical Payments */}
            {criticalPayments.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <AlertTriangle className="w-4 h-4 text-rose-500" />
                  <h3 className="font-semibold text-sm text-rose-700 dark:text-rose-400">
                    Pagos críticos
                  </h3>
                  <Badge className="ml-auto rounded-full bg-rose-100 text-rose-700">
                    {criticalPayments.length}
                  </Badge>
                </div>

                <div className="space-y-2">
                  {criticalPayments.map((payment) => {
                    const isOverdue = isBefore(startOfDay(new Date(payment.due_date)), todayStart);
                    const isLoading = loadingPaymentId === payment.id;

                    return (
                      <div
                        key={payment.id}
                        className={cn(
                          "p-4 rounded-xl border",
                          isOverdue 
                            ? "bg-rose-50 dark:bg-rose-950/20 border-rose-200 dark:border-rose-900" 
                            : "bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-900"
                        )}
                      >
                        <div className="flex items-center justify-between gap-3">
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-sm truncate">
                              {getPatientName(payment.patient_id)}
                            </p>
                            <p className="text-lg font-bold">
                              ${payment.amount.toLocaleString()}
                            </p>
                            <p className={cn(
                              "text-xs",
                              isOverdue ? "text-rose-600" : "text-amber-600"
                            )}>
                              {isOverdue 
                                ? `Venció: ${format(new Date(payment.due_date), "d MMM", { locale: es })}`
                                : "Vence hoy"
                              }
                            </p>
                          </div>
                          <Button
                            size="sm"
                            className={cn(
                              "h-10 rounded-xl font-medium gap-1.5",
                              isOverdue
                                ? "bg-rose-600 hover:bg-rose-700"
                                : "bg-amber-600 hover:bg-amber-700"
                            )}
                            onClick={() => openPaymentConfirm(payment.id, payment.amount, payment.patient_id)}
                          >
                            <CreditCard className="w-4 h-4" />
                            Cobrar
                          </Button>
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Fixed Bottom Action */}
          <div className="absolute bottom-0 left-0 right-0 p-4 bg-background border-t">
            <Button
              onClick={() => setShowActionSheet(true)}
              className="w-full h-14 rounded-xl text-base font-semibold gap-2"
            >
              <Plus className="w-5 h-5" />
              Crear
            </Button>
          </div>
        </DrawerContent>
      </Drawer>

      {/* Quick Action Sheet for Create */}
      <QuickActionSheet
        open={showActionSheet}
        onClose={() => setShowActionSheet(false)}
        onCreateAppointment={() => {
          setShowActionSheet(false);
          onClose();
          onCreateAppointment();
        }}
        onCreatePayment={() => {
          setShowActionSheet(false);
          onClose();
          onCreatePayment();
        }}
      />
    </>
  );
};
