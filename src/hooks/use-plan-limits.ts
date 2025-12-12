import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { 
  getPlanDefinition, 
  getPlanLimits as getDefinitionLimits,
  getPlanName as getDefinitionName,
  normalizePlanCode 
} from "@/lib/plan-definitions";

export interface PlanLimits {
  maxProfessionals: number | null;
  maxPatients: number | null;
}

export interface BusinessPlanInfo {
  planCode: string;
  planName: string;
  limits: PlanLimits;
  currentProfessionals: number;
  currentPatients: number;
  canAddProfessional: boolean;
  canAddPatient: boolean;
  loading: boolean;
}

// Re-export for backwards compatibility
export function getPlanConfig(planCode: string, customLimits?: { maxProfessionals?: number | null; maxPatients?: number | null }) {
  const normalizedCode = normalizePlanCode(planCode);
  if (normalizedCode === "personalizado" && customLimits) {
    return {
      name: "Personalizado",
      maxProfessionals: customLimits.maxProfessionals ?? null,
      maxPatients: customLimits.maxPatients ?? null,
    };
  }
  const plan = getPlanDefinition(normalizedCode);
  return {
    name: plan.name,
    maxProfessionals: plan.maxProfessionals,
    maxPatients: plan.maxPatients,
  };
}

export function getPlanName(planCode: string): string {
  return getDefinitionName(normalizePlanCode(planCode));
}

export function usePlanLimits(businessId: string | null) {
  const [planInfo, setPlanInfo] = useState<BusinessPlanInfo>({
    planCode: "inicial",
    planName: "Plan Inicial",
    limits: { maxProfessionals: 1, maxPatients: 25 },
    currentProfessionals: 0,
    currentPatients: 0,
    canAddProfessional: true,
    canAddPatient: true,
    loading: true,
  });

  const fetchPlanInfo = useCallback(async () => {
    if (!businessId) {
      setPlanInfo(prev => ({ ...prev, loading: false }));
      return;
    }

    try {
      // Fetch business plan code and custom limits
      const { data: business, error: bizError } = await supabase
        .from("businesses")
        .select("plan_code, custom_max_professionals, custom_max_patients")
        .eq("id", businessId)
        .single();

      if (bizError) throw bizError;

      const rawPlanCode = business?.plan_code || "inicial";
      const planCode = normalizePlanCode(rawPlanCode);
      const customLimits = planCode === "personalizado" ? {
        maxProfessionals: (business as any)?.custom_max_professionals ?? null,
        maxPatients: (business as any)?.custom_max_patients ?? null,
      } : undefined;
      const config = getPlanConfig(rawPlanCode, customLimits);

      // Count professionals
      const { count: profCount, error: profError } = await supabase
        .from("user_roles")
        .select("*", { count: "exact", head: true })
        .eq("business_id", businessId)
        .in("role", ["owner", "professional"]);

      if (profError) throw profError;

      // Count active patients
      const { count: patientCount, error: patError } = await supabase
        .from("patients")
        .select("*", { count: "exact", head: true })
        .eq("business_id", businessId)
        .eq("is_active", true);

      if (patError) throw patError;

      const currentProfessionals = profCount || 0;
      const currentPatients = patientCount || 0;

      // Calculate if can add more
      const canAddProfessional = config.maxProfessionals === null || currentProfessionals < config.maxProfessionals;
      const canAddPatient = config.maxPatients === null || currentPatients < config.maxPatients;

      setPlanInfo({
        planCode,
        planName: config.name,
        limits: {
          maxProfessionals: config.maxProfessionals,
          maxPatients: config.maxPatients,
        },
        currentProfessionals,
        currentPatients,
        canAddProfessional,
        canAddPatient,
        loading: false,
      });
    } catch (error) {
      console.error("Error fetching plan info:", error);
      setPlanInfo(prev => ({ ...prev, loading: false }));
    }
  }, [businessId]);

  useEffect(() => {
    fetchPlanInfo();
  }, [fetchPlanInfo]);

  return { planInfo, refetch: fetchPlanInfo };
}

// Helper to check limits before creating - can be used in edge functions or frontend
export async function checkProfessionalLimit(businessId: string): Promise<{ canAdd: boolean; message?: string }> {
  const { data: business } = await supabase
    .from("businesses")
    .select("plan_code, custom_max_professionals, custom_max_patients")
    .eq("id", businessId)
    .single();

  const rawPlanCode = business?.plan_code || "inicial";
  const planCode = normalizePlanCode(rawPlanCode);
  const customLimits = planCode === "personalizado" ? {
    maxProfessionals: (business as any)?.custom_max_professionals ?? null,
    maxPatients: (business as any)?.custom_max_patients ?? null,
  } : undefined;
  const config = getPlanConfig(rawPlanCode, customLimits);

  if (config.maxProfessionals === null) {
    return { canAdd: true };
  }

  const { count } = await supabase
    .from("user_roles")
    .select("*", { count: "exact", head: true })
    .eq("business_id", businessId)
    .in("role", ["owner", "professional"]);

  const currentCount = count || 0;

  if (currentCount >= config.maxProfessionals) {
    return {
      canAdd: false,
      message: `Ya alcanzaste el máximo de ${config.maxProfessionals} profesional${config.maxProfessionals > 1 ? "es" : ""} para tu plan "${config.name}". Para agregar más profesionales, cambiá a un plan superior.`,
    };
  }

  return { canAdd: true };
}

export async function checkPatientLimit(businessId: string): Promise<{ canAdd: boolean; message?: string }> {
  const { data: business } = await supabase
    .from("businesses")
    .select("plan_code, custom_max_professionals, custom_max_patients")
    .eq("id", businessId)
    .single();

  const rawPlanCode = business?.plan_code || "inicial";
  const planCode = normalizePlanCode(rawPlanCode);
  const customLimits = planCode === "personalizado" ? {
    maxProfessionals: (business as any)?.custom_max_professionals ?? null,
    maxPatients: (business as any)?.custom_max_patients ?? null,
  } : undefined;
  const config = getPlanConfig(rawPlanCode, customLimits);

  if (config.maxPatients === null) {
    return { canAdd: true };
  }

  const { count } = await supabase
    .from("patients")
    .select("*", { count: "exact", head: true })
    .eq("business_id", businessId)
    .eq("is_active", true);

  const currentCount = count || 0;

  if (currentCount >= config.maxPatients) {
    return {
      canAdd: false,
      message: `Alcanzaste el máximo de ${config.maxPatients} pacientes activos para tu plan "${config.name}". Podés archivar pacientes antiguos o subir a un plan superior.`,
    };
  }

  return { canAdd: true };
}
