// Conexión del modo capturas con Supabase y el navegador (ver controller.ts).
import { supabase } from "@/integrations/supabase/client";
import { AUTHZ_RPC, activateShowcase, exitShowcase, verifyShowcase, type ShowcaseDeps } from "./controller.ts";
import type { ShowcaseRuntime } from "./interceptor.ts";

export const showcaseDeps: ShowcaseDeps = {
  storage: typeof window !== "undefined" ? window.sessionStorage : ({ setItem() {}, removeItem() {} } as unknown as Storage),
  navigate: (path) => window.location.replace(path),
  getSessionUserId: async () => (await supabase.auth.getSession()).data.session?.user?.id ?? null,
  canUse: async (businessId) => {
    // Nombre fijo: el interceptor deja pasar SOLO esta consulta de solo lectura.
    const { data, error } = await (supabase.rpc as unknown as (fn: string, args: object) => Promise<{ data: unknown; error: unknown }>)(
      AUTHZ_RPC,
      { p_business_id: businessId },
    );
    if (error) throw error;
    return data === true;
  },
  onSignedOutOrUserChange: (cb, expectedUserId) => {
    supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_OUT" || (session?.user?.id && session.user.id !== expectedUserId)) {
        window.setTimeout(cb, 0);
      }
    });
  },
};

export function getShowcaseRuntime(): ShowcaseRuntime | null {
  return (window as unknown as { __cdShowcase?: ShowcaseRuntime }).__cdShowcase ?? null;
}

/** Llamar una vez al arrancar (main.tsx). */
export function verifyActiveShowcase() {
  const rt = getShowcaseRuntime();
  if (rt) void verifyShowcase(showcaseDeps, rt.session);
}

export const startShowcase = (userId: string | null, businessId: string | null) => activateShowcase(showcaseDeps, userId, businessId);
export const leaveShowcase = () => exitShowcase(showcaseDeps);
export const checkShowcaseAccess = (businessId: string) => showcaseDeps.canUse(businessId);
