// Single source of truth for all plan definitions
// This file defines all plans, limits, and prices used across the entire system

export interface PlanDefinition {
  code: string;
  name: string;
  description: string;
  maxProfessionals: number | null; // null = unlimited
  maxPatients: number | null; // null = unlimited
  priceAnnual: number; // Monthly price when paying annually
  priceMonthly: number; // Monthly price when paying monthly
  isHighlighted?: boolean;
  highlightLabel?: string;
}

export const PLAN_DEFINITIONS: Record<string, PlanDefinition> = {
  esencial: {
    code: "esencial",
    name: "Plan Esencial",
    description: "Para empezar con pocos pacientes",
    maxProfessionals: 1,
    maxPatients: 10,
    priceAnnual: 1500,
    priceMonthly: 2000,
  },
  inicial: {
    code: "inicial",
    name: "Plan Inicial",
    description: "Ideal para profesionales independientes",
    maxProfessionals: 1,
    maxPatients: 25,
    priceAnnual: 1900,
    priceMonthly: 2900,
  },
  profesional: {
    code: "profesional",
    name: "Plan Profesional",
    description: "Para consultorios en crecimiento",
    maxProfessionals: 3,
    maxPatients: 100,
    priceAnnual: 3900,
    priceMonthly: 5400,
    isHighlighted: true,
    highlightLabel: "Más elegido",
  },
  equipo: {
    code: "equipo",
    name: "Plan Equipo",
    description: "Para clínicas medianas",
    maxProfessionals: 7,
    maxPatients: 300,
    priceAnnual: 6900,
    priceMonthly: 9400,
  },
  clinica: {
    code: "clinica",
    name: "Plan Clínica",
    description: "Para clínicas grandes",
    maxProfessionals: 12,
    maxPatients: 500,
    priceAnnual: 12000,
    priceMonthly: 17000,
  },
  personalizado: {
    code: "personalizado",
    name: "Plan Personalizado",
    description: "A medida para tus necesidades",
    maxProfessionals: null,
    maxPatients: null,
    priceAnnual: 0,
    priceMonthly: 0,
  },
};

// Ordered list for UI display
export const PLAN_ORDER = ["esencial", "inicial", "profesional", "equipo", "clinica", "personalizado"];

// Helper functions
export function getPlanDefinition(planCode: string): PlanDefinition {
  return PLAN_DEFINITIONS[planCode] || PLAN_DEFINITIONS.inicial;
}

export function getPlanName(planCode: string): string {
  return PLAN_DEFINITIONS[planCode]?.name || PLAN_DEFINITIONS.inicial.name;
}

export function getPlanLimits(planCode: string, customLimits?: { maxProfessionals?: number | null; maxPatients?: number | null }) {
  if (planCode === "personalizado" && customLimits) {
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
  return price.toLocaleString("es-UY");
}

// Map old plan codes to new ones for migration
export const LEGACY_PLAN_MAP: Record<string, string> = {
  individual: "inicial",
  professional: "profesional", 
  advanced: "equipo",
  enterprise: "clinica",
  custom: "personalizado",
};

export function normalizePlanCode(planCode: string): string {
  return LEGACY_PLAN_MAP[planCode] || planCode;
}
