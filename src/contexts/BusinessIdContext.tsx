import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { triggerSessionExpired } from "@/components/SessionExpiredDialog";
import { useAuth } from "@/contexts/AuthContext";

const SAAS_SELECTED_BUSINESS_KEY = "saas_selected_business";

interface BusinessIdContextValue {
  businessId: string | null;
  loading: boolean;
  isSuperAdmin: boolean;
  refetch: () => Promise<void>;
}

const BusinessIdContext = createContext<BusinessIdContextValue | null>(null);

export const BusinessIdProvider = ({ children }: { children: ReactNode }) => {
  const navigate = useNavigate();
  const { user, isSuperAdmin, isReady: authReady } = useAuth();
  const [businessId, setBusinessId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchBusinessId = useCallback(async () => {
    try {
      setLoading(true);

      if (!user) {
        setBusinessId(null);
        setLoading(false);
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

      // SaaS selected business (super admin impersonating)
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

      // Super admin sin selección
      if (isSuperAdmin) {
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

      setBusinessId(null);
    } catch (error) {
      console.error("Error fetching business ID:", error);
      setBusinessId(null);
    } finally {
      setLoading(false);
    }
  }, [user, isSuperAdmin]);

  useEffect(() => {
    if (!authReady) return;
    fetchBusinessId();
  }, [authReady, user?.id, isSuperAdmin, fetchBusinessId]);

  // Listen for sessionStorage changes (super admin switching businesses)
  useEffect(() => {
    const handleStorage = (e: StorageEvent) => {
      if (e.key === SAAS_SELECTED_BUSINESS_KEY) {
        fetchBusinessId();
      }
    };
    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, [fetchBusinessId]);

  return (
    <BusinessIdContext.Provider value={{ businessId, loading, isSuperAdmin, refetch: fetchBusinessId }}>
      {children}
    </BusinessIdContext.Provider>
  );
};

export const useBusinessIdContext = (): BusinessIdContextValue => {
  const ctx = useContext(BusinessIdContext);
  if (!ctx) {
    throw new Error("useBusinessIdContext debe usarse dentro de <BusinessIdProvider>");
  }
  return ctx;
};