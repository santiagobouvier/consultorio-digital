import { supabase } from "@/integrations/supabase/client";

export const isCurrentUserSuperAdmin = async (userId: string): Promise<boolean> => {
  const { data, error } = await supabase.rpc("is_super_admin", { _user_id: userId });

  if (error) {
    console.error("Error checking super admin role:", error);
    return false;
  }

  return Boolean(data);
};