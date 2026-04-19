import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { triggerSessionExpired } from "@/components/SessionExpiredDialog";
import { useAuth } from "@/contexts/AuthContext";

const SAAS_SELECTED_BUSINESS_KEY = "saas_selected_business";

interface UseBusinessIdResult {
  businessId: string | null;
  loading: boolean;
  isSuperAdmin: boolean;
  refetch: () => Promise<void>;
}

/**
 * Hook to get the current active business ID, respecting multi-tenant scoping.
 *
 * Priority order:
 * 1. SaaS selected business (stored in sessionStorage by super_admin)
 * 2. User's owned business (owner_user_id)
 * 3. User's associated business via user_roles
 *
 * @param redirectIfNoBusiness - If true, redirects to /configurar-negocio if no business found
 */
export const useBusinessId = (redirectIfNoBusiness = true): UseBusinessIdResult => {
  const navigate = useNavigate();
  const { user, isSuperAdmin, isReady: authReady } = useAuth();
  const [businessId, setBusinessId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchBusinessId = async () => {
    try {
      setLoading(true);

      if (!user) {
        navigate("/auth");
        return;
      }

      if (!isSuperAdmin) {
        const { data: profile, error: profileError } = await supabase
          .from("profiles")
          .select("id")
          .eq("id", user.id)
          .maybeSingle();

        if (!profile || profileError) {
          triggerSessionExpired();
          return;
        }
      }

      // SaaS selected business (super admin impersonating, o cualquier selección manual)
      const saasSelectedBusiness = sessionStorage.getItem(SAAS_SELECTED_BUSINESS_KEY);

      if (saasSelectedBusiness) {
        const { data: business } = await supabase
          .from("businesses")
          .select("id")
          .eq("id", saasSelectedBusiness)
          .maybeSingle();

        if (business) {
          setBusinessId(business.id);
          setLoading(false);
          return;
        } else {
          sessionStorage.removeItem(SAAS_SELECTED_BUSINESS_KEY);
        }
      }

      // Super admin sin selección: tomar primer business disponible
      if (isSuperAdmin) {
        const { data: businesses } = await supabase
          .from("businesses")
          .select("id")
          .order("name")
          .limit(1);

        if (businesses && businesses.length > 0) {
          const firstBusinessId = businesses[0].id;
          sessionStorage.setItem(SAAS_SELECTED_BUSINESS_KEY, firstBusinessId);
          setBusinessId(firstBusinessId);
          setLoading(false);
          return;
        }

        setBusinessId(null);
        setLoading(false);
        return;
      }

      // Usuario regular: buscar business propio
      const { data: ownedBusiness } = await supabase
        .from("businesses")
        .select("id")
        .eq("owner_user_id", user.id)
        .maybeSingle();

      if (ownedBusiness) {
        setBusinessId(ownedBusiness.id);
        setLoading(false);
        return;
      }

      // Member via user_roles
      const { data: userRole } = await supabase
        .from("user_roles")
        .select("business_id")
        .eq("user_id", user.id)
        .in("role", ["owner", "professional"])
        .maybeSingle();

      if (userRole?.business_id) {
        setBusinessId(userRole.business_id);
        setLoading(false);
        return;
      }

      if (redirectIfNoBusiness) {
        navigate("/configurar-negocio");
      }
      setBusinessId(null);
    } catch (error) {
      console.error("Error fetching business ID:", error);
      setBusinessId(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!authReady) return;
    fetchBusinessId();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authReady, user?.id, isSuperAdmin]);

  return {
    businessId,
    loading,
    isSuperAdmin,
    refetch: fetchBusinessId,
  };
};

/**
 * Set the active business ID (used by SaaS admin when entering a business)
 */
export const setActiveBusinessId = (businessId: string) => {
  sessionStorage.setItem(SAAS_SELECTED_BUSINESS_KEY, businessId);
};

/**
 * Clear the active business ID
 */
export const clearActiveBusinessId = () => {
  sessionStorage.removeItem(SAAS_SELECTED_BUSINESS_KEY);
};

/**
 * Get the active business ID from sessionStorage without fetching
 */
export const getActiveBusinessId = (): string | null => {
  return sessionStorage.getItem(SAAS_SELECTED_BUSINESS_KEY);
};
