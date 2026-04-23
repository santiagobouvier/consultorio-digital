import { supabase } from "@/integrations/supabase/client";
import { isCurrentUserSuperAdmin } from "@/lib/admin-access";

export type PostLoginDestination =
  | "/saas-admin"
  | "/dashboard"
  | "/portal-paciente"
  | "/configurar-negocio";

export interface UserAccessPriority {
  isSuperAdmin: boolean;
  hasBusinessAccess: boolean;
  isPatientOnly: boolean;
}

export const getUserAccessPriority = async (
  userId: string,
): Promise<UserAccessPriority> => {
  // No swallowear errores: si la RPC is_super_admin falla, queremos que el
  // caller lo sepa para hacer fallback a otra fuente de verdad (AuthContext)
  // en lugar de degradar silenciosamente al super_admin a /configurar-negocio.
  const { data, error } = await supabase.rpc("is_super_admin", { _user_id: userId });
  if (error) throw error;
  if (Boolean(data)) {
    return {
      isSuperAdmin: true,
      hasBusinessAccess: true,
      isPatientOnly: false,
    };
  }

  const [ownedBusinessResult, businessRoleResult, patientRoleResult] = await Promise.all([
    supabase.from("businesses").select("id").eq("owner_user_id", userId).limit(1).maybeSingle(),
    supabase
      .from("user_roles")
      .select("business_id, role")
      .eq("user_id", userId)
      .in("role", ["owner", "professional"])
      .limit(1)
      .maybeSingle(),
    supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .eq("role", "patient")
      .limit(1)
      .maybeSingle(),
  ]);

  if (ownedBusinessResult.error) throw ownedBusinessResult.error;
  if (businessRoleResult.error) throw businessRoleResult.error;
  if (patientRoleResult.error) throw patientRoleResult.error;

  const hasBusinessAccess = Boolean(ownedBusinessResult.data || businessRoleResult.data);
  const isPatientOnly = Boolean(patientRoleResult.data) && !hasBusinessAccess;

  return {
    isSuperAdmin: false,
    hasBusinessAccess,
    isPatientOnly,
  };
};

export const getPostLoginDestination = async (
  userId: string,
): Promise<PostLoginDestination> => {
  const priority = await getUserAccessPriority(userId);

  if (priority.isSuperAdmin) return "/saas-admin";
  if (priority.hasBusinessAccess) return "/dashboard";
  if (priority.isPatientOnly) return "/portal-paciente";

  return "/configurar-negocio";
};