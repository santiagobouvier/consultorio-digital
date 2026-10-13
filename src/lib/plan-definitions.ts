// Single source of truth for all plan definitions
// 4 plans: Emprendedor, Esencial, Profesional, Consultorio + Personalizado (admin only)

export interface PlanDefinition {
  code: string;
  name: string;
  description: string;
  maxProfessionals: number | null; // null = unlimited
  maxPatients: number | null; // null = unlimited
  /** Pago anual expresado por mes (UYU). El total del año es priceAnnual × 12. */
  priceAnnual: number;
  priceMonthly: number; // Monthly price when paying monthly (UYU)
  /** Recordatorios automáticos de WhatsApp incluidos por mes. null = sin límite (a medida). */
  whatsappMonthly: number | null;
  /**
   * Página pública de reservas del consultorio (/consultorio/:slug y
   * /consultorio/:slug/reservar) y portal del paciente. No es una "web"
   * armada por el equipo: esa prestación se retiró de los planes (oct. 2026).
   */
  includesOnlineBooking: boolean;
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
    priceAnnual: 800, // 9.600 al año
    priceMonthly: 1590,
    whatsappMonthly: 250,
    includesOnlineBooking: true,
  },
  esencial: {
    code: "esencial",
    name: "Esencial",
    description: "Para el profesional independiente establecido",
    maxProfessionals: 1,
    maxPatients: 40,
    priceAnnual: 1500, // 18.000 al año
    priceMonthly: 2900,
    whatsappMonthly: 700,
    includesOnlineBooking: true,
    isHighlighted: true,
    highlightLabel: "Más elegido",
  },
  profesional: {
    code: "profesional",
    name: "Profesional",
    description: "Para el profesional con la agenda llena",
    maxProfessionals: 1,
    maxPatients: null,
    priceAnnual: 3000, // 36.000 al año
    priceMonthly: 5490,
    whatsappMonthly: 1500,
    includesOnlineBooking: true,
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
    includesOnlineBooking: true,
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
    includesOnlineBooking: true,
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

/** Total del pago anual (UYU): el precio anual por mes × 12. */
export function getAnnualTotal(planCode: string): number {
  return getPlanDefinition(planCode).priceAnnual * 12;
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
