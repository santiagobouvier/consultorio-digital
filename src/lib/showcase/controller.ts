// Entrar, verificar y salir del modo capturas. Sin dependencias de React ni
// del cliente de Supabase (se inyectan): se prueba con node:test.
import { AUTHZ_RPC, clearShowcaseSession, writeShowcaseSession, type ShowcaseSession } from "./session.ts";

export interface ShowcaseDeps {
  storage: Pick<Storage, "setItem" | "removeItem">;
  /** Recarga completa de la página (descarta todo lo que había en memoria). */
  navigate: (path: string) => void;
  getSessionUserId: () => Promise<string | null>;
  /** RPC real can_use_showcase_mode (única consulta que sale a la base en el modo). */
  canUse: (businessId: string) => Promise<boolean>;
  onSignedOutOrUserChange?: (cb: () => void, expectedUserId: string) => void;
}

export const SHOWCASE_HOME = "/dashboard";

/** Activa el modo (solo si la base dice que esta cuenta puede) y recarga. */
export async function activateShowcase(deps: ShowcaseDeps, userId: string | null, businessId: string | null): Promise<"activated" | "not_allowed"> {
  if (!userId || !businessId) return "not_allowed";
  let allowed = false;
  try {
    allowed = await deps.canUse(businessId);
  } catch {
    allowed = false;
  }
  if (!allowed) return "not_allowed";
  writeShowcaseSession(deps.storage as Storage, { userId, businessId });
  deps.navigate(SHOWCASE_HOME);
  return "activated";
}

/** Sale del modo: borra la marca y recarga; reaparecen solo los datos reales. */
export function exitShowcase(deps: Pick<ShowcaseDeps, "storage" | "navigate">, path = SHOWCASE_HOME) {
  clearShowcaseSession(deps.storage);
  deps.navigate(path);
}

/**
 * Con el modo activo: confirma que la sesión es de la misma persona y que la
 * base la sigue autorizando para ese consultorio. Si algo no cierra, sale.
 */
export async function verifyShowcase(deps: ShowcaseDeps, session: ShowcaseSession): Promise<"ok" | "exited"> {
  let ok = false;
  try {
    const uid = await deps.getSessionUserId();
    ok = uid === session.userId && (await deps.canUse(session.businessId));
  } catch {
    ok = false;
  }
  if (!ok) {
    exitShowcase(deps);
    return "exited";
  }
  deps.onSignedOutOrUserChange?.(() => exitShowcase(deps, "/auth"), session.userId);
  return "ok";
}

export { AUTHZ_RPC };
