import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { hardResetBrowserSession } from "@/lib/session-recovery";

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
  const [businessId, setBusinessId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);

  const fetchBusinessId = async () => {
    try {
      setLoading(true);

      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError) {
        await hardResetBrowserSession({ redirectTo: "/auth?session=expired" });
        return;
      }

      if (!user) {
        navigate("/auth");
        return;
      }

      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("id")
        .eq("id", user.id)
        .maybeSingle();

      if (!profile || profileError) {
        await hardResetBrowserSession({ redirectTo: "/auth?session=expired" });
        return;
      }

      // Check if user is super_admin
      const { data: superAdminRole } = await supabase
        .from("user_roles")
        .select("id")
        .eq("user_id", user.id)
        .eq("role", "super_admin")
        .maybeSingle();

      const isAdmin = !!superAdminRole;
      setIsSuperAdmin(isAdmin);

      // Check for SaaS selected business in sessionStorage
      const saasSelectedBusiness = sessionStorage.getItem(SAAS_SELECTED_BUSINESS_KEY);
      
      if (saasSelectedBusiness) {
        // Verify the business exists
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
          // Clear invalid business ID
          sessionStorage.removeItem(SAAS_SELECTED_BUSINESS_KEY);
        }
      }

      // For super_admin without selection, get first business
      if (isAdmin) {
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
      }

      // Try to find user's owned business
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

      // Check if user is member via user_roles
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

      // No business found
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
    fetchBusinessId();
  }, []);

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
