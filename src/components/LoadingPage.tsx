import { getCachedClinicBrand } from "@/lib/clinic-brand-cache";

// Pantalla de carga global. Respeta el modo claro/oscuro y es consciente de
// DÓNDE se está mostrando:
// - Superficies del CONSULTORIO (portal del paciente, web pública): identidad
//   100% del consultorio — su logo y color si ya los conocemos (caché local),
//   y si no, solo la animación neutra. Nunca el logo de Consultorio Digital.
// - PANEL del profesional: el logo de SU consultorio (caché que escribe
//   DashboardBrandingContext); si todavía no subió marca, Consultorio Digital.
// - Páginas propias de Consultorio Digital (landing, /auth, /acceso...):
//   logo de Consultorio Digital.
const CLINIC_PREFIXES = ["/portal/", "/consultorio/", "/portal-paciente"];
const PANEL_PREFIXES = [
  "/dashboard", "/agenda", "/patients", "/pagos", "/solicitudes",
  "/recordatorios-pendientes", "/mi-consultorio", "/horarios-disponibles",
  "/personalizar-portal", "/billing", "/estadisticas", "/centro-control",
  "/appointments",
];

const getPanelBrand = (): { logoUrl: string | null; color: string | null } | null => {
  try {
    const raw = localStorage.getItem("panel_brand");
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

const LoadingPage = () => {
  const path = typeof window !== "undefined" ? window.location.pathname : "";
  const clinicMode = CLINIC_PREFIXES.some((p) => path.startsWith(p));
  const panelMode = !clinicMode && PANEL_PREFIXES.some((p) => path.startsWith(p));
  const slug =
    path.startsWith("/portal/") || path.startsWith("/consultorio/")
      ? path.split("/")[2] || null
      : null;
  const brand = clinicMode ? getCachedClinicBrand(slug) : panelMode ? getPanelBrand() : null;
  const ringColor = brand?.color
    ? `hsl(${brand.color} / 0.55)`
    : "hsl(var(--primary) / 0.55)";

  return (
    // Fondo SIEMPRE oscuro (igual que el splash de arranque): la pantalla de
    // carga nunca es blanca, sin importar el tema elegido por el usuario.
    <div
      className="min-h-screen flex items-center justify-center"
      style={{ backgroundColor: "hsl(180 12% 16%)" }}
    >
      <style>{`
        @keyframes loadingFadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }

        @keyframes loadingBreathe {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.05); }
        }

        @keyframes loadingRing {
          0% { transform: scale(1); opacity: 0.45; }
          100% { transform: scale(1.9); opacity: 0; }
        }

        .loading-stage {
          animation: loadingFadeIn 0.5s ease-out both;
        }

        .loading-breathe {
          animation: loadingBreathe 2.8s ease-in-out infinite;
        }

        .loading-ring {
          position: absolute;
          inset: 0;
          border-radius: 9999px;
          border: 2px solid ${ringColor};
          animation: loadingRing 2.4s ease-out infinite;
        }

        .loading-ring-late {
          animation-delay: 1.2s;
        }

        @media (prefers-reduced-motion: reduce) {
          .loading-breathe, .loading-ring { animation: none; }
          .loading-ring { display: none; }
        }
      `}</style>

      <div className="loading-stage relative flex items-center justify-center">
        <span className="loading-ring" aria-hidden="true" />
        <span className="loading-ring loading-ring-late" aria-hidden="true" />
        {brand?.logoUrl ? (
          <img
            src={brand.logoUrl}
            alt="Cargando..."
            className="loading-breathe h-24 w-24 rounded-full object-cover shadow-lg"
            style={{ backgroundColor: "hsl(180 12% 10%)" }}
          />
        ) : clinicMode ? (
          // Marca del consultorio aún desconocida: disco neutro con el color
          // disponible, sin ningún logo ajeno al consultorio.
          <div
            className="loading-breathe h-24 w-24 rounded-full"
            style={{
              background: brand?.color
                ? `hsl(${brand.color} / 0.14)`
                : "hsl(var(--primary) / 0.12)",
            }}
          />
        ) : (
          <div
            className="loading-breathe relative flex h-24 w-24 items-center justify-center overflow-hidden rounded-full shadow-lg"
            style={{ backgroundColor: "hsl(180 12% 10%)" }}
          >
            <img
              src="/logo-loading.png"
              alt="Cargando..."
              className="h-14 w-14 object-contain"
            />
          </div>
        )}
      </div>
    </div>
  );
};

export default LoadingPage;
