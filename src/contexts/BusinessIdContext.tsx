import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { triggerSessionExpired } from "@/components/SessionExpiredDialog";
import { useAuth } from "@/contexts/AuthContext";

const SAAS_SELECTED_BUSINESS_KEY = "saas_selected_business";

const PATIENT_PORTAL_PREFIXES = ["/portal/", "/portal-paciente"];

const isOnPatientPortalRoute = () => {
  if (typeof window === "undefined") return false;
  const path = window.location.pathname;
  return PATIENT_PORTAL_PREFIXES.some((prefix) => path.startsWith(prefix));
};

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
  // Guard: evita refetches redundantes cuando el evento de auth (típicamente
  // TOKEN_REFRESHED) no cambia el usuario real. Guardamos el último user.id
  // para el que ya resolvimos el business correctamente.
  const lastResolvedUserIdRef = useRef<string | null | undefined>(undefined);

  const fetchBusinessId = useCallback(async (opts?: { force?: boolean }) => {
    const currentUserId = user?.id ?? null;
    // Si ya resolvimos para este mismo userId y no es un refetch forzado, no
    // hacemos nada. Esto rompe el bucle de re-fetches en cascada que generaban
    // los TOKEN_REFRESHED entre múltiples pestañas.
    if (!opts?.force && lastResolvedUserIdRef.current === currentUserId) {
      return;
    }
    try {
      setLoading(true);

      if (!user) {
        setBusinessId(null);
        setLoading(false);
        lastResolvedUserIdRef.current = null;
        return;
      }

      // Patient portal routes manage their own auth/branded login.
      // No profile is expected for patients here, so we must NOT trigger
      // the global "session expired" dialog or try to resolve a business.
      if (isOnPatientPortalRoute()) {
        setBusinessId(null);
        setLoading(false);
        lastResolvedUserIdRef.current = currentUserId;
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
          lastResolvedUserIdRef.current = currentUserId;
          return;
        } else {
          sessionStorage.removeItem(SAAS_SELECTED_BUSINESS_KEY);
        }
      }

      // Super admin sin selección
      if (isSuperAdmin) {
        setBusinessId(null);
        setLoading(false);
        lastResolvedUserIdRef.current = currentUserId;
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
        lastResolvedUserIdRef.current = currentUserId;
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
        lastResolvedUserIdRef.current = currentUserId;
        return;
      }

      setBusinessId(null);
      lastResolvedUserIdRef.current = currentUserId;
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
        // Cambio manual de business (super admin): forzar refetch.
        lastResolvedUserIdRef.current = undefined;
        fetchBusinessId({ force: true });
      }
    };
    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, [fetchBusinessId]);

  return (
    <BusinessIdContext.Provider value={{ businessId, loading, isSuperAdmin, refetch: () => fetchBusinessId({ force: true }) }}>
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