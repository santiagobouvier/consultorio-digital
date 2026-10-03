// WhatsApp de soporte (el mismo número que ya usan la landing, precios y las
// pantallas de cobro). Solo arma links: no consulta ni modifica nada.

export const SUPPORT_WHATSAPP_NUMBER = "59898543623";

export const supportWhatsAppUrl = (text: string): string =>
  `https://wa.me/${SUPPORT_WHATSAPP_NUMBER}?text=${encodeURIComponent(text)}`;

export interface PlanChangeRequest {
  businessName?: string | null;
  currentPlanName?: string | null;
  desiredPlanName?: string | null;
  desiredPeriod?: "monthly" | "annual" | null;
}

/** Mensaje para pedir un cambio de plan. Sin importes: las condiciones las define soporte. */
export function buildPlanChangeRequestMessage(r: PlanChangeRequest): string {
  const lines = ["¡Hola! Quiero solicitar un cambio de plan en Consultorio Digital."];
  if (r.businessName) lines.push(`Consultorio: ${r.businessName}`);
  if (r.currentPlanName) lines.push(`Plan actual: ${r.currentPlanName}`);
  if (r.desiredPlanName) {
    const period = r.desiredPeriod === "monthly" ? " (pago mensual)" : r.desiredPeriod === "annual" ? " (pago anual)" : "";
    lines.push(`Plan que me interesa: ${r.desiredPlanName}${period}`);
  }
  lines.push("¿Me pasan las condiciones?");
  return lines.join("\n");
}

export const buildPlanChangeRequestUrl = (r: PlanChangeRequest): string =>
  supportWhatsAppUrl(buildPlanChangeRequestMessage(r));

/** Mensaje para coordinar el acceso o el pago por fuera de la plataforma. */
export function buildAccessRequestMessage(businessName?: string | null): string {
  return businessName
    ? `¡Hola! Quiero coordinar el acceso y el pago de mi consultorio "${businessName}" en Consultorio Digital.`
    : "¡Hola! Quiero coordinar el acceso y el pago de mi consultorio en Consultorio Digital.";
}

export const buildAccessRequestUrl = (businessName?: string | null): string =>
  supportWhatsAppUrl(buildAccessRequestMessage(businessName));
