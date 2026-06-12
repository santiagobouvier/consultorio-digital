// Single source of truth for all plan definitions
// 4 plans: Emprendedor, Esencial, Profesional, Consultorio + Personalizado (admin only)

export interface PlanDefinition {
  code: string;
  name: string;
  description: string;
  maxProfessionals: number | null; // null = unlimited
  maxPatients: number | null; // null = unlimited
  priceAnnual: number; // Monthly price when paying annually (UYU)
  priceMonthly: number; // Monthly price when paying monthly (UYU)
  hasPublicWeb: boolean;
  isHighlighted?: boolean;
  highlightLabel?: string;
}

export const PLAN_DEFINITIONS: Record<string, PlanDefinition> = {
  emprendedor: {
    code: "emprendedor",
    name: "Emprendedor",
    description: "Para empezar tu consultorio digital",
    maxProfessionals: 1,
    maxPatients: 15,
    priceAnnual: 1290,
    priceMonthly: 1613,
    hasPublicWeb: false,
  },
  esencial: {
    code: "esencial",
    name: "Esencial",
    description: "Para el profesional independiente establecido",
    maxProfessionals: 1,
    maxPatients: 40,
    priceAnnual: 2500,
    priceMonthly: 3125,
    hasPublicWeb: false,
    isHighlighted: true,
    highlightLabel: "Más elegido",
  },
  profesional: {
    code: "profesional",
    name: "Profesional",
    description: "Para consultorios en crecimiento con equipo",
    maxProfessionals: 3,
    maxPatients: 120,
    priceAnnual: 4500,
    priceMonthly: 5625,
    hasPublicWeb: true,
  },
  consultorio: {
    code: "consultorio",
    name: "Consultorio",
    description: "Para clínicas y equipos grandes",
    maxProfessionals: 8,
    maxPatients: 300,
    priceAnnual: 8000,
    priceMonthly: 10000,
    hasPublicWeb: true,
  },
  personalizado: {
    code: "personalizado",
    name: "Personalizado",
    description: "A medida para tus necesidades",
    maxProfessionals: null,
    maxPatients: null,
    priceAnnual: 0,
    priceMonthly: 0,
    hasPublicWeb: true,
  },
};

// Ordered list for UI display (personalizado excluded from public pricing)
export const PLAN_ORDER = ["emprendedor", "esencial", "profesional", "consultorio"];
export const PLAN_ORDER_WITH_CUSTOM = ["emprendedor", "esencial", "profesional", "consultorio", "personalizado"];

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
  starter: "emprendedor",
  individual: "esencial",
  inicial: "esencial",
  professional: "profesional",
  advanced: "consultorio",
  equipo: "consultorio",
  enterprise: "personalizado",
  clinica: "personalizado",
  custom: "personalizado",
};

export function normalizePlanCode(planCode: string): string {
  return LEGACY_PLAN_MAP[planCode] || planCode;
}
