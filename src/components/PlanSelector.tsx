import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Loader2 } from "lucide-react";
import { PLAN_DEFINITIONS, PLAN_ORDER, getPlanName, normalizePlanCode } from "@/lib/plan-definitions";

interface PlanSelectorProps {
  businessId: string;
  currentPlan: string;
  customMaxProfessionals?: number | null;
  customMaxPatients?: number | null;
  onChangePlan: (businessId: string, newPlan: string, customLimits?: { maxProfessionals?: number | null; maxPatients?: number | null }) => Promise<void>;
}

export function PlanSelector({
  businessId,
  currentPlan,
  customMaxProfessionals,
  customMaxPatients,
  onChangePlan,
}: PlanSelectorProps) {
  const [showCustomModal, setShowCustomModal] = useState(false);
  const [customProf, setCustomProf] = useState<string>(customMaxProfessionals?.toString() || "");
  const [customPat, setCustomPat] = useState<string>(customMaxPatients?.toString() || "");
  const [saving, setSaving] = useState(false);

  // Normalize legacy plan codes
  const normalizedPlan = normalizePlanCode(currentPlan);

  const handlePlanChange = async (newPlan: string) => {
    if (newPlan === "personalizado") {
      // Open custom modal
      setCustomProf(customMaxProfessionals?.toString() || "");
      setCustomPat(customMaxPatients?.toString() || "");
      setShowCustomModal(true);
    } else {
      await onChangePlan(businessId, newPlan);
    }
  };

  const handleSaveCustom = async () => {
    setSaving(true);
    try {
      const profLimit = customProf.trim() === "" ? null : parseInt(customProf, 10);
      const patLimit = customPat.trim() === "" ? null : parseInt(customPat, 10);
      
      await onChangePlan(businessId, "personalizado", {
        maxProfessionals: profLimit,
        maxPatients: patLimit,
      });
      setShowCustomModal(false);
    } finally {
      setSaving(false);
    }
  };

  const getDisplayValue = () => {
    if (normalizedPlan === "personalizado") {
      const profStr = customMaxProfessionals === null || customMaxProfessionals === undefined 
        ? "∞" 
        : customMaxProfessionals.toString();
      const patStr = customMaxPatients === null || customMaxPatients === undefined 
        ? "∞" 
        : customMaxPatients.toString();
      return `Personalizado (${profStr}p/${patStr}pac)`;
    }
    return getPlanName(normalizedPlan);
  };

  return (
    <>
      <Select value={normalizedPlan} onValueChange={handlePlanChange}>
        <SelectTrigger className="h-8 text-xs w-44">
          <SelectValue>{getDisplayValue()}</SelectValue>
        </SelectTrigger>
        <SelectContent>
          {PLAN_ORDER.map(planCode => (
            <SelectItem key={planCode} value={planCode}>
              {PLAN_DEFINITIONS[planCode].name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Dialog open={showCustomModal} onOpenChange={setShowCustomModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Configurar plan personalizado</DialogTitle>
            <DialogDescription>
              Define los límites específicos para este consultorio. Dejá en blanco para ilimitado.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="customProf">Máximo de profesionales</Label>
              <Input
                id="customProf"
                type="number"
                min="1"
                value={customProf}
                onChange={(e) => setCustomProf(e.target.value)}
                placeholder="Ilimitado"
              />
              <p className="text-xs text-muted-foreground">
                Dejá en blanco para no aplicar límite
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="customPat">Máximo de pacientes activos</Label>
              <Input
                id="customPat"
                type="number"
                min="1"
                value={customPat}
                onChange={(e) => setCustomPat(e.target.value)}
                placeholder="Ilimitado"
              />
              <p className="text-xs text-muted-foreground">
                Dejá en blanco para no aplicar límite
              </p>
            </div>
          </div>
          <div className="flex gap-3">
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => setShowCustomModal(false)}
            >
              Cancelar
            </Button>
            <Button
              className="flex-1"
              onClick={handleSaveCustom}
              disabled={saving}
            >
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Guardar
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
