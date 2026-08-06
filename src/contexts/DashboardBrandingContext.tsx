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
  const [publicSlug, setPublicSlug] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchBranding = async () => {
    if (!businessId) {
      setLoading(false);
      return;
    }

    try {
      const { data } = await supabase
        .from("businesses")
        .select("dashboard_primary_color, dashboard_logo_url, dashboard_display_name, name, portal_logo_url, portal_clinic_display_name, portal_primary_color, public_slug")
        .eq("id", businessId)
        .maybeSingle();

      if (data) {
        // La marca del panel es lo que el consultorio configura en
        // "Personalizar portal": un solo logo/nombre/color para todo el
        // producto. Lo que se elige ahí MANDA (los campos dashboard_* viejos
        // quedan solo como respaldo). Sin marca propia -> Consultorio Digital.
        const d = data as any;
        const color = d.portal_primary_color || d.dashboard_primary_color || DEFAULT_COLOR;
        const logo = d.portal_logo_url || d.dashboard_logo_url || null;
        setPrimaryColor(color);
        setLogoUrl(logo);
        setDisplayName(d.portal_clinic_display_name || d.dashboard_display_name || data.name || null);
        setPublicSlug(d.public_slug || null);
        // La pantalla de carga del panel y la bienvenida post-login usan esta
        // marca en las próximas visitas (incluye el nombre para el splash).
        try {
          localStorage.setItem("panel_brand", JSON.stringify({
            logoUrl: logo,
            color,
            name: d.portal_clinic_display_name || d.dashboard_display_name || data.name || null,
          }));
        } catch {
          /* ignore */
        }
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

  // App instalable del PANEL con la marca del consultorio: mientras el panel
  // está montado, el manifest genérico se reemplaza por el del consultorio
  // (logo, nombre y color del profesional; arranca en /dashboard). Instalar
  // desde acá = la app del cliente, no "Consultorio Digital".
  useEffect(() => {
    if (!publicSlug) return;
    const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
    if (!projectId) return;
    const origin = window.location.origin;
    const manifestUrl = `https://${projectId}.supabase.co/functions/v1/get-clinic-manifest?slug=${encodeURIComponent(publicSlug)}&area=dashboard&origin=${encodeURIComponent(origin)}`;

    const previousManifestLinks = Array.from(
      document.querySelectorAll<HTMLLinkElement>('link[rel="manifest"]'),
    ).map(el => ({ href: el.href, crossOrigin: el.crossOrigin }));
    document.querySelectorAll('link[rel="manifest"]').forEach(el => el.remove());

    const link = document.createElement("link");
    link.rel = "manifest";
    link.href = manifestUrl;
    link.crossOrigin = "anonymous";
    document.head.appendChild(link);

    // iOS toma nombre e ícono de estos tags, no del manifest
    const prevAppleTitle = document.querySelector<HTMLMetaElement>('meta[name="apple-mobile-web-app-title"]')?.content;
    if (displayName) {
      let appleTitle = document.querySelector<HTMLMetaElement>('meta[name="apple-mobile-web-app-title"]');
      if (!appleTitle) {
        appleTitle = document.createElement("meta");
        appleTitle.name = "apple-mobile-web-app-title";
        document.head.appendChild(appleTitle);
      }
      appleTitle.content = displayName;
    }
    const prevAppleIcon = document.querySelector<HTMLLinkElement>('link[rel="apple-touch-icon"]')?.href;
    if (logoUrl) {
      let appleIcon = document.querySelector<HTMLLinkElement>('link[rel="apple-touch-icon"]');
      if (!appleIcon) {
        appleIcon = document.createElement("link");
        appleIcon.rel = "apple-touch-icon";
        document.head.appendChild(appleIcon);
      }
      appleIcon.href = logoUrl;
    }

    return () => {
      link.remove();
      previousManifestLinks.forEach(({ href, crossOrigin }) => {
        const restored = document.createElement("link");
        restored.rel = "manifest";
        restored.href = href;
        if (crossOrigin) restored.crossOrigin = crossOrigin;
        document.head.appendChild(restored);
      });
      const appleTitle = document.querySelector<HTMLMetaElement>('meta[name="apple-mobile-web-app-title"]');
      if (appleTitle && prevAppleTitle) appleTitle.content = prevAppleTitle;
      const appleIcon = document.querySelector<HTMLLinkElement>('link[rel="apple-touch-icon"]');
      if (appleIcon && prevAppleIcon) appleIcon.href = prevAppleIcon;
    };
  }, [publicSlug, displayName, logoUrl]);

  return (
    <DashboardBrandingContext.Provider
      value={{ primaryColor, logoUrl, displayName, loading, refetch: fetchBranding }}
    >
      {children}
    </DashboardBrandingContext.Provider>
  );
}
