import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Users, UserCheck, Crown, Sparkles } from "lucide-react";
import { usePlanLimits } from "@/hooks/use-plan-limits";

interface PlanUsageCardProps {
  businessId: string | null;
}

export function PlanUsageCard({ businessId }: PlanUsageCardProps) {
  const { planInfo } = usePlanLimits(businessId);

  if (planInfo.loading || !businessId) {
    return (
      <Card className="mobile-card">
        <CardContent className="p-4 sm:p-5">
          <div className="animate-pulse space-y-3">
            <div className="h-5 bg-muted rounded w-1/3"></div>
            <div className="h-4 bg-muted rounded w-full"></div>
            <div className="h-4 bg-muted rounded w-full"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  const getProfessionalUsage = () => {
    if (planInfo.limits.maxProfessionals === null) {
      return { percentage: 0, text: `${planInfo.currentProfessionals} (sin límite)`, unlimited: true };
    }
    const percentage = (planInfo.currentProfessionals / planInfo.limits.maxProfessionals) * 100;
    return { 
      percentage: Math.min(percentage, 100), 
      text: `${planInfo.currentProfessionals} / ${planInfo.limits.maxProfessionals}`,
      unlimited: false 
    };
  };

  const getPatientUsage = () => {
    if (planInfo.limits.maxPatients === null) {
      return { percentage: 0, text: `${planInfo.currentPatients} (sin límite)`, unlimited: true };
    }
    const percentage = (planInfo.currentPatients / planInfo.limits.maxPatients) * 100;
    return { 
      percentage: Math.min(percentage, 100), 
      text: `${planInfo.currentPatients} / ${planInfo.limits.maxPatients}`,
      unlimited: false 
    };
  };

  const profUsage = getProfessionalUsage();
  const patUsage = getPatientUsage();

  const getPlanIcon = () => {
    switch (planInfo.planCode) {
      case "enterprise":
        return <Sparkles className="h-4 w-4" />;
      case "custom":
        return <Crown className="h-4 w-4" />;
      default:
        return null;
    }
  };

  const isNearLimit = (current: number, max: number | null) => {
    if (max === null) return false;
    return current >= max * 0.8;
  };

  const isAtLimit = (current: number, max: number | null) => {
    if (max === null) return false;
    return current >= max;
  };

  return (
    <Card className="mobile-card border-primary/20 bg-gradient-to-br from-primary/5 to-transparent">
      <CardContent className="p-4 sm:p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-foreground">Plan actual:</span>
            <Badge variant="secondary" className="flex items-center gap-1">
              {getPlanIcon()}
              {planInfo.planName}
            </Badge>
          </div>
        </div>

        {/* Profesionales */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Users className="h-4 w-4" />
              <span>Profesionales</span>
            </div>
            <span className={`font-medium ${
              isAtLimit(planInfo.currentProfessionals, planInfo.limits.maxProfessionals)
                ? "text-destructive"
                : isNearLimit(planInfo.currentProfessionals, planInfo.limits.maxProfessionals)
                ? "text-amber-600"
                : "text-foreground"
            }`}>
              {profUsage.text}
            </span>
          </div>
          {!profUsage.unlimited && (
            <Progress 
              value={profUsage.percentage} 
              className={`h-2 ${
                isAtLimit(planInfo.currentProfessionals, planInfo.limits.maxProfessionals)
                  ? "[&>div]:bg-destructive"
                  : isNearLimit(planInfo.currentProfessionals, planInfo.limits.maxProfessionals)
                  ? "[&>div]:bg-amber-500"
                  : ""
              }`}
            />
          )}
        </div>

        {/* Pacientes activos */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-2 text-muted-foreground">
              <UserCheck className="h-4 w-4" />
              <span>Pacientes activos</span>
            </div>
            <span className={`font-medium ${
              isAtLimit(planInfo.currentPatients, planInfo.limits.maxPatients)
                ? "text-destructive"
                : isNearLimit(planInfo.currentPatients, planInfo.limits.maxPatients)
                ? "text-amber-600"
                : "text-foreground"
            }`}>
              {patUsage.text}
            </span>
          </div>
          {!patUsage.unlimited && (
            <Progress 
              value={patUsage.percentage} 
              className={`h-2 ${
                isAtLimit(planInfo.currentPatients, planInfo.limits.maxPatients)
                  ? "[&>div]:bg-destructive"
                  : isNearLimit(planInfo.currentPatients, planInfo.limits.maxPatients)
                  ? "[&>div]:bg-amber-500"
                  : ""
              }`}
            />
          )}
        </div>

        {/* Mensajes de alerta */}
        {isAtLimit(planInfo.currentProfessionals, planInfo.limits.maxProfessionals) && (
          <p className="text-xs text-destructive bg-destructive/10 p-2 rounded-lg">
            Alcanzaste el límite de profesionales. Para agregar más, subí de plan.
          </p>
        )}
        {isAtLimit(planInfo.currentPatients, planInfo.limits.maxPatients) && (
          <p className="text-xs text-destructive bg-destructive/10 p-2 rounded-lg">
            Alcanzaste el límite de pacientes activos. Podés archivar pacientes o subir de plan.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
