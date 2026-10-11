// Vínculo entre la suscripción push de ESTE navegador y la cuenta con sesión.
//
// Un navegador tiene una sola suscripción push (un endpoint), pero por él
// pueden pasar varias cuentas (profesional, paciente, otra persona). Reglas:
//  1. La suscripción está "activa" para la cuenta actual solo si esa cuenta
//     tiene una fila propia con ESE endpoint (RLS: cada uno ve las suyas).
//  2. Si el navegador tiene una suscripción que la cuenta actual no tiene
//     registrada (es de otra cuenta, o de nadie), se da de baja en el
//     navegador: así los avisos de la cuenta anterior dejan de llegar acá.
//     La fila vieja queda apuntando a un endpoint muerto y el envío la borra
//     sola cuando el servicio push responde 404/410.
//  3. Sin sesión (logout), el navegador no conserva ninguna suscripción.
//  4. Nunca se tocan filas ni suscripciones de otros dispositivos.
//
// Sin dependencias de Supabase ni del DOM: se prueba con node:test.

export interface BrowserPushSubscription {
  endpoint: string;
  unsubscribe(): Promise<boolean>;
}

export interface PushBindingDeps {
  /** Suscripción actual del navegador, o null. */
  getSubscription(): Promise<BrowserPushSubscription | null>;
  /** ¿La cuenta tiene una fila propia con este endpoint? Lanza si la consulta falla. */
  ownsEndpoint(userId: string, endpoint: string): Promise<boolean>;
}

export type DevicePushState =
  /** El navegador tiene suscripción y es de la cuenta actual. */
  | "active"
  /** El navegador no tiene suscripción para la cuenta actual. */
  | "inactive"
  /** No se pudo verificar (p. ej. sin red): no se cambia nada. */
  | "unknown";

export interface ReconcileResult {
  state: DevicePushState;
  /** Se dio de baja una suscripción que no era de la cuenta actual. */
  released: boolean;
}

/**
 * Deja el navegador consistente con la cuenta actual (userId null = sin sesión).
 * Es idempotente: varias pestañas pueden llamarlo a la vez.
 */
export async function reconcileDevicePush(userId: string | null, deps: PushBindingDeps): Promise<ReconcileResult> {
  const sub = await deps.getSubscription();
  if (!sub) return { state: "inactive", released: false };

  if (!userId) {
    await safeUnsubscribe(sub);
    return { state: "inactive", released: true };
  }

  let owned: boolean;
  try {
    owned = await deps.ownsEndpoint(userId, sub.endpoint);
  } catch {
    // Sin certeza no se da de baja nada (la cuenta podría ser la dueña).
    return { state: "unknown", released: false };
  }
  if (owned) return { state: "active", released: false };

  await safeUnsubscribe(sub);
  return { state: "inactive", released: true };
}

async function safeUnsubscribe(sub: BrowserPushSubscription) {
  try {
    await sub.unsubscribe();
  } catch {
    /* ya no existía: nada que hacer */
  }
}

/** Código de Postgres para "ya existe" (UNIQUE user_id + endpoint). */
export const UNIQUE_VIOLATION = "23505";

/** Una inserción que choca con la fila propia ya existente cuenta como éxito. */
export function isAlreadyRegistered(error: { code?: string } | null | undefined): boolean {
  return !!error && error.code === UNIQUE_VIOLATION;
}

/**
 * Ejecuta fn con exclusión entre pestañas del mismo navegador (Web Locks),
 * para que una pestaña no dé de baja la suscripción que otra está creando.
 * Sin soporte de locks, ejecuta directo.
 */
export async function withPushLock<T>(fn: () => Promise<T>): Promise<T> {
  const locks = typeof navigator !== "undefined" ? (navigator as Navigator & { locks?: LockManager }).locks : undefined;
  if (!locks?.request) return fn();
  return locks.request("consultorio-push-binding", fn) as Promise<T>;
}
