// Qué puede hacer el cliente en "Mi plan" según su suscripción. Puro: no
// consulta ni modifica nada.
//
// - Suscripción activa (manual o por plataforma): el cambio de plan se pide a
//   soporte por WhatsApp. Ni cobra ni toca la suscripción.
// - Prueba, vencida, cancelada o sin suscripción: puede elegir plan y pagar por
//   la plataforma (capacidad existente) o coordinar con soporte.
// - Activa sin débito de Mercado Pago = gestionada a mano por el superadmin:
//   no hay nada automático que cancelar ni medio de pago que agregar.

export interface BillingSubscriptionLike {
  status: string;
  mercadopago_preapproval_id?: string | null;
}

export interface BillingActions {
  /** Activa sin débito automático: la gestiona el superadmin a mano. */
  isManual: boolean;
  /** "support_request": pedir por WhatsApp. "self_checkout": elegir plan y pagar por la plataforma. */
  planChangeMode: "support_request" | "self_checkout";
  /** Mostrar "Cancelar prueba/suscripción" (cancela el débito de Mercado Pago o la prueba). */
  canCancel: boolean;
  /** Mostrar "Agregar método de pago" (abre el pago por la plataforma). */
  canAddPlatformPayment: boolean;
}

export function getBillingActions(sub: BillingSubscriptionLike | null | undefined): BillingActions {
  if (!sub) {
    return { isManual: false, planChangeMode: "self_checkout", canCancel: false, canAddPlatformPayment: true };
  }
  const hasPlatformDebit = !!sub.mercadopago_preapproval_id;
  const isActive = sub.status === "active";
  const isManual = isActive && !hasPlatformDebit;
  return {
    isManual,
    planChangeMode: isActive ? "support_request" : "self_checkout",
    canCancel: sub.status !== "cancelled" && !isManual,
    canAddPlatformPayment: !isActive && !hasPlatformDebit,
  };
}
