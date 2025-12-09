import { useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar, CreditCard, TrendingUp, ExternalLink, DollarSign } from "lucide-react";
import { startOfWeek, endOfWeek, startOfMonth, endOfMonth, isWithinInterval, format } from "date-fns";
import { es } from "date-fns/locale";
import { useState } from "react";
import { PaymentForm } from "@/components/PaymentForm";

interface PatientSummaryProps {
  patientId: string;
  patientName: string;
  appointments: Array<{
    id: string;
    start_at: string;
  }>;
  payments: Array<{
    id: string;
    due_date: string;
    paid_at: string | null;
    amount: number;
  }>;
  paymentStatus: "al_dia" | "por_vencer" | "vencido" | "sin_pagos";
  nextDueDate: string | null;
  paidPaymentsLast6Months: number;
  currentDate: Date;
  businessId: string;
  onRefresh: () => void;
}

export const PatientSummary = ({
  patientId,
  patientName,
  appointments,
  payments,
  paymentStatus,
  nextDueDate,
  paidPaymentsLast6Months,
  currentDate,
  businessId,
  onRefresh,
}: PatientSummaryProps) => {
  const navigate = useNavigate();
  const [showPaymentForm, setShowPaymentForm] = useState(false);

  const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(currentDate, { weekStartsOn: 1 });
  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);

  const appointmentsThisWeek = appointments.filter((apt) =>
    isWithinInterval(new Date(apt.start_at), { start: weekStart, end: weekEnd })
  ).length;

  const appointmentsThisMonth = appointments.filter((apt) =>
    isWithinInterval(new Date(apt.start_at), { start: monthStart, end: monthEnd })
  ).length;

  const getPaymentStatusInfo = () => {
    switch (paymentStatus) {
      case "al_dia":
        return { label: "Al día", variant: "default" as const, color: "text-green-600", bgColor: "bg-green-500" };
      case "por_vencer":
        return { label: "Por vencer", variant: "outline" as const, color: "text-orange-600", bgColor: "bg-orange-500" };
      case "vencido":
        return { label: "Vencido", variant: "destructive" as const, color: "text-red-600", bgColor: "bg-red-500" };
      default:
        return { label: "Sin pagos", variant: "secondary" as const, color: "text-muted-foreground", bgColor: "bg-muted" };
    }
  };

  const statusInfo = getPaymentStatusInfo();

  const handleViewAllPayments = () => {
    navigate(`/patients/${patientId}`);
  };

  const handlePaymentSuccess = () => {
    setShowPaymentForm(false);
    onRefresh();
  };

  return (
    <>
      <Card className="bg-gradient-to-r from-primary/5 to-primary/10 border-primary/20">
        <CardContent className="p-4">
          <div className="flex flex-col gap-4">
            {/* Header */}
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1">
                <p className="text-sm text-muted-foreground mb-1">Viendo citas de</p>
                <h3 className="text-lg font-bold text-foreground">{patientName}</h3>
              </div>
              <Badge 
                variant={statusInfo.variant} 
                className="rounded-full flex items-center gap-1.5"
              >
                <span className={`w-2 h-2 rounded-full ${statusInfo.bgColor}`} />
                {statusInfo.label}
              </Badge>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {/* Weekly frequency */}
              <div className="flex items-center gap-2 p-2 bg-background/50 rounded-xl">
                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                  <Calendar className="h-4 w-4 text-primary" />
                </div>
                <div className="min-w-0">
                  <p className="text-[10px] text-muted-foreground truncate">Esta semana</p>
                  <p className="font-bold text-sm">{appointmentsThisWeek} cita{appointmentsThisWeek !== 1 ? "s" : ""}</p>
                </div>
              </div>

              {/* Monthly frequency */}
              <div className="flex items-center gap-2 p-2 bg-background/50 rounded-xl">
                <div className="w-8 h-8 rounded-full bg-secondary/50 flex items-center justify-center shrink-0">
                  <TrendingUp className="h-4 w-4 text-secondary-foreground" />
                </div>
                <div className="min-w-0">
                  <p className="text-[10px] text-muted-foreground truncate">Este mes</p>
                  <p className="font-bold text-sm">{appointmentsThisMonth} cita{appointmentsThisMonth !== 1 ? "s" : ""}</p>
                </div>
              </div>

              {/* Next due date */}
              <div className="flex items-center gap-2 p-2 bg-background/50 rounded-xl">
                <div className="w-8 h-8 rounded-full bg-accent flex items-center justify-center shrink-0">
                  <CreditCard className={`h-4 w-4 ${statusInfo.color}`} />
                </div>
                <div className="min-w-0">
                  <p className="text-[10px] text-muted-foreground truncate">Próx. vencimiento</p>
                  <p className="font-bold text-sm">
                    {nextDueDate 
                      ? format(new Date(nextDueDate), "d MMM", { locale: es })
                      : "—"
                    }
                  </p>
                </div>
              </div>

              {/* Paid last 6 months */}
              <div className="flex items-center gap-2 p-2 bg-background/50 rounded-xl">
                <div className="w-8 h-8 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center shrink-0">
                  <DollarSign className="h-4 w-4 text-green-600" />
                </div>
                <div className="min-w-0">
                  <p className="text-[10px] text-muted-foreground truncate">Pagos (6 meses)</p>
                  <p className="font-bold text-sm">{paidPaymentsLast6Months} pago{paidPaymentsLast6Months !== 1 ? "s" : ""}</p>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                size="sm"
                className="rounded-xl gap-1.5"
                onClick={() => setShowPaymentForm(true)}
              >
                <CreditCard className="h-3.5 w-3.5" />
                Registrar pago
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="rounded-xl gap-1.5 text-muted-foreground"
                onClick={handleViewAllPayments}
              >
                <ExternalLink className="h-3.5 w-3.5" />
                Ver todos los pagos
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Payment Form Modal */}
      <PaymentForm
        open={showPaymentForm}
        onOpenChange={setShowPaymentForm}
        patientId={patientId}
        businessId={businessId}
        onSuccess={handlePaymentSuccess}
      />
    </>
  );
};
