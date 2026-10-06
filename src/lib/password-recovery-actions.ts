// Acciones de recuperación de contraseña que hablan con Supabase. Las
// decisiones puras viven en password-recovery.ts.
import { supabase } from "@/integrations/supabase/client";
import { isCurrentUserSuperAdmin } from "@/lib/admin-access";
import { decideRecoveryReturn, type RecoveryReturn, type ReturnClinic } from "@/lib/password-recovery";

export const RESET_PASSWORD_PATH = "/reset-password";

/**
 * Pide el mail de recuperación. Supabase responde igual exista o no la cuenta;
 * la pantalla muestra siempre el mismo mensaje para no revelar emails.
 */
export async function requestPasswordReset(email: string): Promise<{ ok: boolean; rateLimited: boolean }> {
  const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
    redirectTo: `${window.location.origin}${RESET_PASSWORD_PATH}`,
  });
  if (!error) return { ok: true, rateLimited: false };
  return { ok: false, rateLimited: error.status === 429 || /rate limit|seconds/i.test(error.message) };
}

/** Adónde mandar al usuario recién recuperado, según lo que es (con su propia sesión). */
export async function resolveRecoveryReturn(userId: string): Promise<RecoveryReturn> {
  const isSuperAdmin = await isCurrentUserSuperAdmin(userId).catch(() => false);

  let isProfessional = false;
  if (!isSuperAdmin) {
    const [roles, owned] = await Promise.all([
      supabase.from("user_roles").select("role").eq("user_id", userId),
      supabase.from("businesses").select("id").eq("owner_user_id", userId).limit(1),
    ]);
    isProfessional =
      (owned.data?.length ?? 0) > 0 ||
      (roles.data ?? []).some((r) => r.role !== "patient" && r.role !== "super_admin");
  }

  let clinics: ReturnClinic[] | null = null;
  if (!isSuperAdmin && !isProfessional) {
    // Solo los consultorios de ESTE usuario (la función usa la sesión, no un email)
    const { data } = await supabase.functions.invoke("public-patient-lookup", { body: {} });
    clinics = Array.isArray(data?.clinics) ? data.clinics : null;
  }

  return decideRecoveryReturn({ isSuperAdmin, isProfessional, clinics });
}
