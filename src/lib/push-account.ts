// Conecta push-binding con Supabase y el navegador. Ver reglas en push-binding.ts.
import { supabase } from "@/integrations/supabase/client";
import { reconcileDevicePush, withPushLock, type BrowserPushSubscription, type PushBindingDeps } from "@/lib/push-binding";

async function getBrowserSubscription(): Promise<PushSubscription | null> {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return null;
  // getRegistration (no .ready): si no hay service worker, no se queda esperando.
  const reg = await navigator.serviceWorker.getRegistration();
  if (!reg?.pushManager) return null;
  return reg.pushManager.getSubscription();
}

export const appPushDeps: PushBindingDeps = {
  getSubscription: async () => (await getBrowserSubscription()) as BrowserPushSubscription | null,
  ownsEndpoint: async (userId, endpoint) => {
    const { data, error } = await supabase
      .from("push_subscriptions")
      .select("id")
      .eq("user_id", userId)
      .eq("endpoint", endpoint)
      .limit(1);
    if (error) throw error;
    return (data?.length ?? 0) > 0;
  },
};

/** Revisa el navegador contra la cuenta actual (con exclusión entre pestañas). */
export function reconcileThisDevice(userId: string | null) {
  return withPushLock(() => reconcileDevicePush(userId, appPushDeps));
}

let installed = false;

/**
 * Una vez por pestaña: cada vez que cambia la cuenta (login, logout, otra
 * cuenta que reemplaza la sesión, logout en otra pestaña), el navegador deja
 * de recibir avisos que no son de la cuenta actual.
 */
export function installPushAccountGuard() {
  if (installed || typeof window === "undefined") return;
  installed = true;
  let lastUserId: string | null | undefined;
  supabase.auth.onAuthStateChange((event, session) => {
    if (event === "TOKEN_REFRESHED") return;
    const userId = session?.user?.id ?? null;
    if (userId === lastUserId && event !== "SIGNED_OUT") return;
    lastUserId = userId;
    // Fuera del callback: auth-js no admite llamadas a Supabase adentro.
    window.setTimeout(() => {
      void reconcileThisDevice(userId).catch((err) => console.warn("No se pudo revisar la suscripción push", err));
    }, 0);
  });
}
