// Single source of truth for all plan definitions
// 5 plans: Emprendedor, Esencial, Profesional, Consultorio, Clínica + Personalizado (admin only)

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
  emprendedor: {
    code: "emprendedor",
    name: "Emprendedor",
    description: "Para empezar con tu consultorio digital",
    maxProfessionals: 1,
    maxPatients: 15,
    priceAnnual: 990,
    priceMonthly: 1290,
  },
  esencial: {
    code: "esencial",
    name: "Esencial",
    description: "Para profesionales independientes",
    maxProfessionals: 1,
    maxPatients: 30,
    priceAnnual: 1990,
    priceMonthly: 2490,
  },
  profesional: {
    code: "profesional",
    name: "Profesional",
    description: "Para consultorios en crecimiento",
    maxProfessionals: 2,
    maxPatients: 80,
    priceAnnual: 3590,
    priceMonthly: 4490,
    isHighlighted: true,
    highlightLabel: "Más elegido",
  },
  consultorio: {
    code: "consultorio",
    name: "Consultorio",
    description: "Para consultorios y equipos grandes",
    maxProfessionals: 5,
    maxPatients: 250,
    priceAnnual: 6390,
    priceMonthly: 7990,
  },
  clinica: {
    code: "clinica",
    name: "Clínica",
    description: "Para clínicas sin límites — contactanos",
    maxProfessionals: null,
    maxPatients: null,
    priceAnnual: 0,
    priceMonthly: 0,
  },
};

// Ordered list for UI display (personalizado excluded from public pricing)
export const PLAN_ORDER = ["emprendedor", "esencial", "profesional", "consultorio", "clinica"];
export const PLAN_ORDER_WITH_CUSTOM = ["emprendedor", "esencial", "profesional", "consultorio", "clinica"];

// Helper functions
export function getPlanDefinition(planCode: string): PlanDefinition {
  const normalized = normalizePlanCode(planCode);
  return PLAN_DEFINITIONS[normalized] || PLAN_DEFINITIONS.emprendedor;
}

export function getPlanName(planCode: string): string {
  return getPlanDefinition(planCode).name;
}

export function getPlanLimits(planCode: string, customLimits?: { maxProfessionals?: number | null; maxPatients?: number | null }) {
  const normalized = normalizePlanCode(planCode);
  if (normalized === "clinica" && customLimits) {
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
  starter: "emprendedor",
  individual: "esencial",
  inicial: "esencial",
  professional: "profesional",
  advanced: "consultorio",
  equipo: "consultorio",
  enterprise: "clinica",
  custom: "clinica",
  personalizado: "clinica",
};

export function normalizePlanCode(planCode: string): string {
  return LEGACY_PLAN_MAP[planCode] || planCode;
}
