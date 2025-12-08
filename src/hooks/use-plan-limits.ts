import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

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

const PLAN_CONFIG: Record<string, { name: string; maxProfessionals: number | null; maxPatients: number | null }> = {
  individual: { name: "Consultorio Individual", maxProfessionals: 1, maxPatients: 80 },
  professional: { name: "Consultorio Profesional", maxProfessionals: 3, maxPatients: 300 },
  advanced: { name: "Clínica Avanzada", maxProfessionals: 7, maxPatients: 800 },
  enterprise: { name: "Enterprise", maxProfessionals: null, maxPatients: null },
};

export function getPlanConfig(planCode: string) {
  return PLAN_CONFIG[planCode] || PLAN_CONFIG.individual;
}

export function getPlanName(planCode: string): string {
  return getPlanConfig(planCode).name;
}

export function usePlanLimits(businessId: string | null) {
  const [planInfo, setPlanInfo] = useState<BusinessPlanInfo>({
    planCode: "individual",
    planName: "Consultorio Individual",
    limits: { maxProfessionals: 1, maxPatients: 80 },
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
      // Fetch business plan code
      const { data: business, error: bizError } = await supabase
        .from("businesses")
        .select("plan_code")
        .eq("id", businessId)
        .single();

      if (bizError) throw bizError;

      const planCode = business?.plan_code || "individual";
      const config = getPlanConfig(planCode);

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
    .select("plan_code")
    .eq("id", businessId)
    .single();

  const planCode = business?.plan_code || "individual";
  const config = getPlanConfig(planCode);

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
    .select("plan_code")
    .eq("id", businessId)
    .single();

  const planCode = business?.plan_code || "individual";
  const config = getPlanConfig(planCode);

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
