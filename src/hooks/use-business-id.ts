import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useBusinessIdContext } from "@/contexts/BusinessIdContext";

const SAAS_SELECTED_BUSINESS_KEY = "saas_selected_business";

interface UseBusinessIdResult {
  businessId: string | null;
  loading: boolean;
  isSuperAdmin: boolean;
  refetch: () => Promise<void>;
}

export const useBusinessId = (redirectIfNoBusiness = true): UseBusinessIdResult => {
  const navigate = useNavigate();
  const { businessId, loading, isSuperAdmin, refetch } = useBusinessIdContext();

  // Handle redirects based on context result
  useEffect(() => {
    if (loading) return;
    if (!redirectIfNoBusiness) return;
    
    if (!businessId && isSuperAdmin && window.location.pathname !== "/saas-admin") {
      navigate("/saas-admin");
    } else if (!businessId && !isSuperAdmin) {
      // Only redirect if there's truly no business (not just loading)
      if (businessId === null) {
        navigate("/configurar-negocio");
      }
    }
  }, [loading, businessId, isSuperAdmin, redirectIfNoBusiness, navigate]);

  return {
    businessId,
    loading,
    isSuperAdmin,
    refetch,
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
