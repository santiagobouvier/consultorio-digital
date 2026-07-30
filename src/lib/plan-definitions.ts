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
  /** Recordatorios automáticos de WhatsApp incluidos por mes. null = sin límite (a medida). */
  whatsappMonthly: number | null;
  hasPublicWeb: boolean;
  /** Web con dominio propio armada por el equipo: sin web, plantilla establecida, o diseño a medida. */
  customWebsite: "none" | "template" | "custom";
  isHighlighted?: boolean;
  highlightLabel?: string;
}

export const PLAN_DEFINITIONS: Record<string, PlanDefinition> = {
  emprendedor: {
    code: "emprendedor",
    name: "Emprendedor",
    description: "Para empezar tu consultorio digital",
    maxProfessionals: 1,
    maxPatients: 30,
    priceAnnual: 1290,
    priceMonthly: 1590,
    whatsappMonthly: 200,
    customWebsite: "none",
    hasPublicWeb: true,
  },
  esencial: {
    code: "esencial",
    name: "Esencial",
    description: "Para el profesional independiente establecido",
    maxProfessionals: 1,
    maxPatients: 75,
    priceAnnual: 2400,
    priceMonthly: 2900,
    whatsappMonthly: 500,
    customWebsite: "template",
    hasPublicWeb: true,
    isHighlighted: true,
    highlightLabel: "Más elegido",
  },
  profesional: {
    code: "profesional",
    name: "Profesional",
    description: "Para el profesional con la agenda llena",
    maxProfessionals: 1,
    maxPatients: null,
    priceAnnual: 4500,
    priceMonthly: 5490,
    whatsappMonthly: 1500,
    customWebsite: "custom",
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
    whatsappMonthly: 3000,
    customWebsite: "custom",
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
    whatsappMonthly: null,
    customWebsite: "custom",
    hasPublicWeb: true,
  },
};

// Ordered list for UI display (personalizado excluded from public pricing)
export const PLAN_ORDER = ["emprendedor", "esencial", "profesional", "consultorio"];
export const PLAN_ORDER_WITH_CUSTOM = ["emprendedor", "esencial", "profesional", "consultorio", "personalizado"];

// Plans offered publicly for self-service purchase. All public plans are
// single-professional and differ only by active-patient capacity. The
// multi-professional plan (consultorio) stays hidden until the per-professional
// payment settlement module exists. Admin can still assign any plan.
export const PUBLIC_PLAN_ORDER = ["emprendedor", "esencial", "profesional"];

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

/** Recordatorios automáticos de WhatsApp incluidos por mes para un plan. */
export function getWhatsappMonthlyLimit(planCode: string): number | null {
  return getPlanDefinition(planCode).whatsappMonthly;
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
