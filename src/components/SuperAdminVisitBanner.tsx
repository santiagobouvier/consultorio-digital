import { ArrowLeft, Eye } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useDashboardBranding } from "@/contexts/DashboardBrandingContext";
import { clearActiveBusinessId, getActiveBusinessId } from "@/hooks/use-business-id";
import { useEffect, useState } from "react";

/**
 * Banner que se muestra cuando un super_admin está visitando un consultorio
 * desde el panel SaaS Admin. Da contexto visual claro y un botón de regreso.
 */
export function SuperAdminVisitBanner() {
  const navigate = useNavigate();
  const { isSuperAdmin, isReady } = useAuth();
  const { displayName } = useDashboardBranding();
  const [hasSelected, setHasSelected] = useState<boolean>(() => Boolean(getActiveBusinessId()));

  // Re-check when route changes (sessionStorage may have been updated).
  useEffect(() => {
    setHasSelected(Boolean(getActiveBusinessId()));
  }, [displayName]);

  if (!isReady || !isSuperAdmin || !hasSelected) return null;

  const handleBack = () => {
    clearActiveBusinessId();
    navigate("/saas-admin");
  };

  return (
    <div
      className="sticky top-0 z-30 w-full border-b border-primary/20"
      style={{
        background:
          "linear-gradient(90deg, hsla(178, 100%, 32%, 0.12), hsla(178, 100%, 32%, 0.04))",
        backdropFilter: "blur(8px)",
      }}
      role="status"
      aria-label="Modo visita de super administrador"
    >
      <div className="flex items-center justify-between gap-3 px-3 sm:px-4 py-2 max-w-[1400px] mx-auto">
        <div className="flex items-center gap-2 min-w-0">
          <span
            className="inline-flex items-center justify-center h-6 w-6 rounded-md shrink-0"
            style={{ background: "hsla(178, 100%, 32%, 0.18)" }}
          >
            <Eye className="h-3.5 w-3.5 text-primary" />
          </span>
          <p className="text-[12px] sm:text-[13px] text-foreground/85 truncate">
            <span className="text-muted-foreground hidden xs:inline">Modo visita ·</span>{" "}
            <span className="font-medium">
              <span className="hidden sm:inline">Estás viendo el consultorio de </span>
              <span className="sm:hidden">Visitando </span>
              <span className="text-primary">{displayName || "este negocio"}</span>
            </span>
          </p>
        </div>
        <button
          onClick={handleBack}
          className="inline-flex items-center gap-1.5 h-7 sm:h-8 px-2.5 sm:px-3 rounded-md text-[11px] sm:text-[12px] font-medium text-primary bg-primary/10 hover:bg-primary/20 border border-primary/30 transition-colors active:scale-[0.97] shrink-0"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Volver al panel</span>
          <span className="sm:hidden">Volver</span>
        </button>
      </div>
    </div>
  );
}

export default SuperAdminVisitBanner;
