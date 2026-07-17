import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useBusinessId } from "@/hooks/use-business-id";

interface DashboardBranding {
  primaryColor: string; // HSL string like "176 100% 32%"
  logoUrl: string | null;
  displayName: string | null;
  loading: boolean;
  refetch: () => Promise<void>;
}

const DEFAULT_COLOR = "176 100% 32%";

const DashboardBrandingContext = createContext<DashboardBranding>({
  primaryColor: DEFAULT_COLOR,
  logoUrl: null,
  displayName: null,
  loading: true,
  refetch: async () => {},
});

export function useDashboardBranding() {
  return useContext(DashboardBrandingContext);
}

export function DashboardBrandingProvider({ children }: { children: ReactNode }) {
  const { businessId } = useBusinessId(false);
  const [primaryColor, setPrimaryColor] = useState(DEFAULT_COLOR);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [displayName, setDisplayName] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchBranding = async () => {
    if (!businessId) {
      setLoading(false);
      return;
    }

    try {
      const { data } = await supabase
        .from("businesses")
        .select("dashboard_primary_color, dashboard_logo_url, dashboard_display_name, name, portal_logo_url, portal_clinic_display_name, portal_primary_color")
        .eq("id", businessId)
        .maybeSingle();

      if (data) {
        // La marca del panel reutiliza lo que el consultorio configura en
        // "Personalizar portal": un solo logo/nombre/color para todo el producto.
        // Los campos dashboard_* quedan como override manual si algún día se exponen.
        const d = data as any;
        setPrimaryColor(d.dashboard_primary_color || d.portal_primary_color || DEFAULT_COLOR);
        setLogoUrl(d.dashboard_logo_url || d.portal_logo_url || null);
        setDisplayName(d.dashboard_display_name || d.portal_clinic_display_name || data.name || null);
      }
    } catch (err) {
      console.error("Error loading dashboard branding:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBranding();
  }, [businessId]);

  // Inject CSS custom properties for dynamic theming
  useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty("--brand-primary", primaryColor);
    // El color de marca pinta TODO el panel (botones, acentos, focus):
    // se sobreescribe --primary mientras el panel está montado; al salir
    // (portal, web pública) se limpia y vuelve el color del stylesheet.
    root.style.setProperty("--primary", primaryColor);

    // Parse HSL to generate variations
    const parts = primaryColor.split(" ");
    if (parts.length >= 3) {
      const h = parts[0];
      const s = parseInt(parts[1]);
      const l = parseInt(parts[2]);
      root.style.setProperty("--brand-primary-h", h);
      root.style.setProperty("--brand-primary-s", `${s}%`);
      root.style.setProperty("--brand-primary-l", `${l}%`);
      root.style.setProperty("--brand-primary-light", `${h} ${Math.max(s - 20, 10)}% ${Math.min(l + 15, 90)}%`);
      root.style.setProperty("--brand-primary-dark", `${h} ${Math.min(s + 10, 100)}% ${Math.max(l - 10, 10)}%`);
      root.style.setProperty("--brand-primary-glow", `${h} ${s}% ${Math.min(l + 5, 60)}%`);
    }

    return () => {
      root.style.removeProperty("--brand-primary");
      root.style.removeProperty("--primary");
      root.style.removeProperty("--brand-primary-h");
      root.style.removeProperty("--brand-primary-s");
      root.style.removeProperty("--brand-primary-l");
      root.style.removeProperty("--brand-primary-light");
      root.style.removeProperty("--brand-primary-dark");
      root.style.removeProperty("--brand-primary-glow");
    };
  }, [primaryColor]);

  return (
    <DashboardBrandingContext.Provider
      value={{ primaryColor, logoUrl, displayName, loading, refetch: fetchBranding }}
    >
      {children}
    </DashboardBrandingContext.Provider>
  );
}
