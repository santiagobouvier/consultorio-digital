import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

const CONSULTORIO_DOMAIN = "consultoriodigital.app";

interface HostnameBusiness {
  id: string;
  name: string;
  public_slug: string;
  custom_subdomain: string | null;
  custom_domain: string | null;
}

interface UseHostnameBusinessResult {
  business: HostnameBusiness | null;
  loading: boolean;
  isCustomDomain: boolean;
  hostname: string;
}

/**
 * Hook to resolve business by hostname.
 * 
 * Resolution priority:
 * 1. If hostname ends with .consultoriodigital.app → extract subdomain, search in custom_subdomain
 * 2. Otherwise → search exact match in custom_domain (supports root domain or external subdomain)
 */
export const useHostnameBusiness = (): UseHostnameBusinessResult => {
  const [business, setBusiness] = useState<HostnameBusiness | null>(null);
  const [loading, setLoading] = useState(true);
  const [isCustomDomain, setIsCustomDomain] = useState(false);

  const hostname = typeof window !== "undefined" ? window.location.hostname : "";

  useEffect(() => {
    const resolveBusiness = async () => {
      try {
        setLoading(true);

        // Skip resolution for localhost or lovable preview domains
        if (
          hostname === "localhost" ||
          hostname.includes("lovableproject.com") ||
          hostname.includes("lovable.app") ||
          !hostname
        ) {
          setBusiness(null);
          setLoading(false);
          return;
        }

        // Check if it's a consultoriodigital.app subdomain
        if (hostname.endsWith(`.${CONSULTORIO_DOMAIN}`)) {
          // Extract subdomain (everything before .consultoriodigital.app)
          const subdomain = hostname.replace(`.${CONSULTORIO_DOMAIN}`, "");
          
          if (subdomain && subdomain !== "www") {
            const { data } = await supabase
              .from("businesses_public_branding")
              .select("id, name, public_slug, custom_subdomain, custom_domain")
              .eq("custom_subdomain", subdomain)
              .maybeSingle();

            if (data) {
              setBusiness(data);
              setIsCustomDomain(false);
              setLoading(false);
              return;
            }
          }
        } else {
          // It's a custom domain - search exact match
          const { data } = await supabase
            .from("businesses_public_branding")
            .select("id, name, public_slug, custom_subdomain, custom_domain")
            .eq("custom_domain", hostname)
            .maybeSingle();

          if (data) {
            setBusiness(data);
            setIsCustomDomain(true);
            setLoading(false);
            return;
          }
        }

        // No business found
        setBusiness(null);
      } catch (error) {
        console.error("Error resolving business by hostname:", error);
        setBusiness(null);
      } finally {
        setLoading(false);
      }
    };

    resolveBusiness();
  }, [hostname]);

  return {
    business,
    loading,
    isCustomDomain,
    hostname,
  };
};

/**
 * Get the full subdomain URL for a business
 */
export const getSubdomainUrl = (subdomain: string): string => {
  return `https://${subdomain}.${CONSULTORIO_DOMAIN}`;
};

/**
 * Check if a subdomain is available
 */
export const checkSubdomainAvailability = async (subdomain: string): Promise<boolean> => {
  const { data } = await supabase
    .from("businesses_public_branding")
    .select("id")
    .eq("custom_subdomain", subdomain)
    .maybeSingle();

  return !data;
};

/**
 * Check if a custom domain is available
 */
export const checkCustomDomainAvailability = async (domain: string): Promise<boolean> => {
  const { data } = await supabase
    .from("businesses_public_branding")
    .select("id")
    .eq("custom_domain", domain)
    .maybeSingle();

  return !data;
};
