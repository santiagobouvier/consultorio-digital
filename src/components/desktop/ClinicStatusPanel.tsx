import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { formatCurrency } from "@/lib/payments";
import { Professional } from "@/components/calendar-v2/types";
import {
  Users,
  UserCheck,
  DollarSign,
  AlertTriangle,
  Clock,
  ChevronRight,
  CreditCard,
  TrendingUp,
} from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { cn } from "@/lib/utils";

interface Payment {
  id: string;
  patient_id: string;
  due_date: string;
  amount: number;
  patientName?: string;
  calculatedStatus?: string;
}

interface ClinicStatusPanelProps {
  professionals: Professional[];
  attendedToday: number;
  activeProfessionalsTodayCount?: number;
  pendingPaymentsAmount: number;
  overdueCount: number;
  dueSoonCount: number;
  pendingPayments: Payment[];
  onNavigatePayments: () => void;
  onNavigatePatients: () => void;
}

export const ClinicStatusPanel = ({
  professionals,
  attendedToday,
  activeProfessionalsTodayCount = 0,
  pendingPaymentsAmount,
  overdueCount,
  dueSoonCount,
  pendingPayments,
  onNavigatePayments,
  onNavigatePatients,
}: ClinicStatusPanelProps) => {
  
  return (
    <ScrollArea className="h-full">
      <div className="p-4 space-y-5">
        {/* Header */}
        <div>
          <h2 className="font-semibold text-foreground mb-1">Estado del consultorio</h2>
          <p className="text-xs text-muted-foreground">Resumen en tiempo real</p>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-2 gap-3">
          <Card className="bg-primary/5 border-primary/20">
            <CardContent className="p-3 text-center">
              <UserCheck className="h-5 w-5 mx-auto text-primary mb-1" />
              <p className="text-2xl font-bold text-primary">{attendedToday}</p>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wide">
                Atendidos hoy
              </p>
            </CardContent>
          </Card>
          <Card className="bg-success/5 border-success/20">
            <CardContent className="p-3 text-center">
              <TrendingUp className="h-5 w-5 mx-auto text-success mb-1" />
              <p className="text-2xl font-bold text-success">
                {activeProfessionalsTodayCount}
              </p>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wide">
                Con citas hoy
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Active Professionals */}
        <div>
          <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
            Profesionales activos
          </h3>
          <div className="space-y-2">
            {professionals.slice(0, 5).map((prof) => (
              <div
                key={prof.id}
                className="flex items-center gap-2 p-2 rounded-lg bg-card border hover:bg-muted/50 transition-colors"
              >
                <div
                  className="w-3 h-3 rounded-full shrink-0"
                  style={{ backgroundColor: prof.color }}
                />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{prof.name}</p>
                </div>
              </div>
            ))}
            {professionals.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-4">
                Sin profesionales registrados
              </p>
            )}
          </div>
        </div>

        {/* Pending Payments Alert */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Pagos pendientes
            </h3>
            <Button
              variant="ghost"
              size="sm"
              onClick={onNavigatePayments}
              className="h-6 text-xs gap-1 -mr-2"
            >
              Ver todos
              <ChevronRight className="h-3 w-3" />
            </Button>
          </div>

          {/* Summary Cards */}
          <div className="grid grid-cols-2 gap-2 mb-3">
            {overdueCount > 0 && (
              <Card className="bg-destructive/10 border-destructive/30">
                <CardContent className="p-2.5 text-center">
                  <div className="flex items-center justify-center gap-1 text-destructive mb-1">
                    <AlertTriangle className="h-3.5 w-3.5" />
                    <span className="text-lg font-bold">{overdueCount}</span>
                  </div>
                  <p className="text-[10px] text-muted-foreground">Vencidos</p>
                </CardContent>
              </Card>
            )}
            {dueSoonCount > 0 && (
              <Card className="bg-warning/10 border-warning/30">
                <CardContent className="p-2.5 text-center">
                  <div className="flex items-center justify-center gap-1 text-warning mb-1">
                    <Clock className="h-3.5 w-3.5" />
                    <span className="text-lg font-bold">{dueSoonCount}</span>
                  </div>
                  <p className="text-[10px] text-muted-foreground">Por vencer</p>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Total pending */}
          {pendingPaymentsAmount > 0 && (
            <Card className="mb-3">
              <CardContent className="p-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">Total pendiente</span>
                  <span className="text-lg font-bold text-foreground">
                    {formatCurrency(pendingPaymentsAmount)}
                  </span>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Payment List */}
          {pendingPayments.length > 0 && (
            <div className="space-y-1.5">
              {pendingPayments.map((payment) => (
                <div
                  key={payment.id}
                  className={cn(
                    "flex items-center justify-between p-2 rounded-lg border text-xs",
                    payment.calculatedStatus === "overdue" 
                      ? "bg-destructive/5 border-destructive/20" 
                      : "bg-warning/5 border-warning/20"
                  )}
                >
                  <div className="min-w-0 flex-1">
                    <p className="font-medium truncate">{payment.patientName}</p>
                    <p className="text-[10px] text-muted-foreground">
                      Vence: {format(new Date(payment.due_date), "d MMM", { locale: es })}
                    </p>
                  </div>
                  <span className={cn(
                    "font-semibold shrink-0 ml-2",
                    payment.calculatedStatus === "overdue" ? "text-destructive" : "text-warning"
                  )}>
                    {formatCurrency(payment.amount)}
                  </span>
                </div>
              ))}
            </div>
          )}

          {pendingPayments.length === 0 && overdueCount === 0 && dueSoonCount === 0 && (
            <div className="text-center py-4 text-muted-foreground">
              <CreditCard className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">Sin pagos pendientes</p>
            </div>
          )}
        </div>

        {/* Quick Actions */}
        <div className="space-y-2 pt-2 border-t">
          <Button
            variant="outline"
            className="w-full justify-start gap-2 h-9"
            onClick={onNavigatePatients}
          >
            <Users className="h-4 w-4" />
            Ver pacientes
          </Button>
          <Button
            variant="outline"
            className="w-full justify-start gap-2 h-9"
            onClick={onNavigatePayments}
          >
            <DollarSign className="h-4 w-4" />
            Gestionar pagos
          </Button>
        </div>
      </div>
    </ScrollArea>
  );
};
