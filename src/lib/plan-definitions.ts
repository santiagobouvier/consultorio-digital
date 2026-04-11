// Single source of truth for all plan definitions
// 4 plans: Starter, Esencial, Profesional, Clínica + Personalizado (admin only)

export interface PlanDefinition {
  code: string;
  name: string;
  description: string;
  maxProfessionals: number | null; // null = unlimited
  maxPatients: number | null; // null = unlimited
  priceAnnual: number; // Monthly price when paying annually (UYU)
  priceMonthly: number; // Monthly price when paying monthly (UYU)
  isHighlighted?: boolean;
  highlightLabel?: string;
}

export const PLAN_DEFINITIONS: Record<string, PlanDefinition> = {
  starter: {
    code: "starter",
    name: "Starter",
    description: "Para empezar con tu consultorio digital",
    maxProfessionals: 1,
    maxPatients: 5,
    priceAnnual: 630,
    priceMonthly: 790,
  },
  esencial: {
    code: "esencial",
    name: "Esencial",
    description: "Para profesionales independientes",
    maxProfessionals: 1,
    maxPatients: 15,
    priceAnnual: 1350,
    priceMonthly: 1690,
  },
  profesional: {
    code: "profesional",
    name: "Profesional",
    description: "Para consultorios en crecimiento",
    maxProfessionals: 2,
    maxPatients: 50,
    priceAnnual: 2390,
    priceMonthly: 2990,
    isHighlighted: true,
    highlightLabel: "Más elegido",
  },
  clinica: {
    code: "clinica",
    name: "Clínica",
    description: "Para clínicas y equipos grandes",
    maxProfessionals: 5,
    maxPatients: 200,
    priceAnnual: 4390,
    priceMonthly: 5490,
  },
  personalizado: {
    code: "personalizado",
    name: "Personalizado",
    description: "A medida para tus necesidades",
    maxProfessionals: null,
    maxPatients: null,
    priceAnnual: 0,
    priceMonthly: 0,
  },
};

// Ordered list for UI display (personalizado excluded from public pricing)
export const PLAN_ORDER = ["starter", "esencial", "profesional", "clinica"];
export const PLAN_ORDER_WITH_CUSTOM = ["starter", "esencial", "profesional", "clinica", "personalizado"];

// Helper functions
export function getPlanDefinition(planCode: string): PlanDefinition {
  const normalized = normalizePlanCode(planCode);
  return PLAN_DEFINITIONS[normalized] || PLAN_DEFINITIONS.starter;
}

export function getPlanName(planCode: string): string {
  return getPlanDefinition(planCode).name;
}

export function getPlanLimits(planCode: string, customLimits?: { maxProfessionals?: number | null; maxPatients?: number | null }) {
  const normalized = normalizePlanCode(planCode);
  if (normalized === "personalizado" && customLimits) {
    return {
      maxProfessionals: customLimits.maxProfessionals ?? null,
      maxPatients: customLimits.maxPatients ?? null,
    };
  }
  const plan = getPlanDefinition(planCode);
  return {
    maxProfessionals: plan.maxProfessionals,
    maxPatients: plan.maxPatients,
  };
}

export function getPlanPrice(planCode: string, billingCycle: "monthly" | "annual"): number {
  const plan = getPlanDefinition(planCode);
  return billingCycle === "annual" ? plan.priceAnnual : plan.priceMonthly;
}

export function formatPrice(price: number): string {
  return `$${price.toLocaleString("es-UY")}`;
}

// Map old plan codes to new ones for migration
export const LEGACY_PLAN_MAP: Record<string, string> = {
  individual: "esencial",
  inicial: "esencial",
  professional: "profesional",
  advanced: "clinica",
  equipo: "clinica",
  enterprise: "clinica",
  custom: "personalizado",
};

export function normalizePlanCode(planCode: string): string {
  return LEGACY_PLAN_MAP[planCode] || planCode;
}
