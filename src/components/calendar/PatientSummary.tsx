import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Calendar, CreditCard, TrendingUp } from "lucide-react";
import { startOfWeek, endOfWeek, startOfMonth, endOfMonth, isWithinInterval } from "date-fns";

interface PatientSummaryProps {
  patientName: string;
  appointments: Array<{
    id: string;
    start_at: string;
  }>;
  paymentStatus: "al_dia" | "por_vencer" | "vencido" | "sin_pagos";
  currentDate: Date;
}

export const PatientSummary = ({
  patientName,
  appointments,
  paymentStatus,
  currentDate,
}: PatientSummaryProps) => {
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
        return { label: "Al día", variant: "default" as const, color: "text-green-600" };
      case "por_vencer":
        return { label: "Por vencer", variant: "outline" as const, color: "text-orange-600" };
      case "vencido":
        return { label: "Vencido", variant: "destructive" as const, color: "text-red-600" };
      default:
        return { label: "Sin pagos", variant: "secondary" as const, color: "text-muted-foreground" };
    }
  };

  const statusInfo = getPaymentStatusInfo();

  return (
    <Card className="bg-gradient-to-r from-primary/5 to-primary/10 border-primary/20">
      <CardContent className="p-4">
        <div className="flex flex-col sm:flex-row sm:items-center gap-4">
          <div className="flex-1">
            <p className="text-sm text-muted-foreground mb-1">Viendo citas de</p>
            <h3 className="text-lg font-bold text-foreground">{patientName}</h3>
          </div>

          <div className="flex flex-wrap items-center gap-4">
            {/* Weekly frequency */}
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                <Calendar className="h-4 w-4 text-primary" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Esta semana</p>
                <p className="font-bold">{appointmentsThisWeek} cita{appointmentsThisWeek !== 1 ? "s" : ""}</p>
              </div>
            </div>

            {/* Monthly frequency */}
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-secondary/50 flex items-center justify-center">
                <TrendingUp className="h-4 w-4 text-secondary-foreground" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Este mes</p>
                <p className="font-bold">{appointmentsThisMonth} cita{appointmentsThisMonth !== 1 ? "s" : ""}</p>
              </div>
            </div>

            {/* Payment status */}
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-accent flex items-center justify-center">
                <CreditCard className={`h-4 w-4 ${statusInfo.color}`} />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Pagos</p>
                <Badge variant={statusInfo.variant} className="rounded-full">
                  {statusInfo.label}
                </Badge>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
