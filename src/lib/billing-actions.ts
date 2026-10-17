// Qué puede hacer el cliente en "Mi plan" según su suscripción. Puro: no
// consulta ni modifica nada.
//
// Desde oct. 2026 la suscripción a Consultorio Digital se cobra POR FUERA de
// la aplicación: Santiago coordina el pago y registra plan, período, monto y
// vigencia desde el superadmin. Por eso, en todos los casos:
// - Contratar o cambiar de plan se pide a soporte por WhatsApp (sin checkout).
// - No se ofrece "agregar método de pago" en la plataforma.
// - Un débito automático de Mercado Pago que ya existía se respeta: el cliente
//   puede cancelarlo (es su derecho) y su estado sigue llegando por el webhook.

export interface BillingSubscriptionLike {
  status: string;
  mercadopago_preapproval_id?: string | null;
}

export interface BillingActions {
  /** Sin débito automático: la gestiona Santiago a mano desde el superadmin. */
  isManual: boolean;
  /** Siempre "support_request": el plan se coordina por WhatsApp. */
  planChangeMode: "support_request";
  /** Mostrar "Cancelar prueba/suscripción" (prueba o débito de Mercado Pago heredado). */
  canCancel: boolean;
  /** Siempre false: ya no se cobra la suscripción por la plataforma. */
  canAddPlatformPayment: false;
  /** Tiene un débito automático de Mercado Pago anterior al cobro manual. */
  hasLegacyAutomaticDebit: boolean;
}

export function getBillingActions(sub: BillingSubscriptionLike | null | undefined): BillingActions {
  if (!sub) {
    return { isManual: false, planChangeMode: "support_request", canCancel: false, canAddPlatformPayment: false, hasLegacyAutomaticDebit: false };
  }
  const hasPlatformDebit = !!sub.mercadopago_preapproval_id;
  const isActive = sub.status === "active";
  const isManual = isActive && !hasPlatformDebit;
  return {
    isManual,
    planChangeMode: "support_request",
    // Prueba: se puede cancelar. Débito heredado: se puede cancelar. Manual: lo corta Santiago.
    canCancel: sub.status !== "cancelled" && !isManual && (sub.status === "trial" || hasPlatformDebit),
    canAddPlatformPayment: false,
    hasLegacyAutomaticDebit: hasPlatformDebit,
  };
}
