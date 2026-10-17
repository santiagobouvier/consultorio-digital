// Estado del modo capturas: una marca en sessionStorage (por pestaña). Sin
// la marca, el modo no existe: no se instala nada y la app funciona igual
// que siempre para todas las cuentas.

export const SHOWCASE_SESSION_KEY = "cd_modo_capturas";

/** Única consulta a la base que sale con el modo activo (solo lectura). */
export const AUTHZ_RPC = "can_use_showcase_mode";

export interface ShowcaseSession {
  userId: string;
  businessId: string;
  startedAt: string;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function readShowcaseSession(storage: Pick<Storage, "getItem"> | null | undefined): ShowcaseSession | null {
  try {
    const raw = storage?.getItem(SHOWCASE_SESSION_KEY);
    if (!raw) return null;
    const v = JSON.parse(raw) as Partial<ShowcaseSession>;
    if (typeof v.userId !== "string" || !UUID.test(v.userId)) return null;
    if (typeof v.businessId !== "string" || !UUID.test(v.businessId)) return null;
    return { userId: v.userId, businessId: v.businessId, startedAt: String(v.startedAt ?? "") };
  } catch {
    return null;
  }
}

export function writeShowcaseSession(storage: Pick<Storage, "setItem">, s: Omit<ShowcaseSession, "startedAt">) {
  storage.setItem(SHOWCASE_SESSION_KEY, JSON.stringify({ ...s, startedAt: new Date().toISOString() }));
}

export function clearShowcaseSession(storage: Pick<Storage, "removeItem"> | null | undefined) {
  try {
    storage?.removeItem(SHOWCASE_SESSION_KEY);
  } catch {
    /* sin storage: nada que limpiar */
  }
}

/** ¿Esta pestaña arrancó en modo capturas? (lo fija boot.ts al instalar la capa) */
export function isShowcaseActive(): boolean {
  return typeof window !== "undefined" && !!(window as unknown as { __cdShowcase?: unknown }).__cdShowcase;
}
