import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { clearActiveBusinessId, getActiveBusinessId } from "@/hooks/use-business-id";
import {
  LayoutDashboard,
  Users,
  CalendarDays,
  Receipt,
  FileText,
  Settings,
  BarChart3,
  LogOut,
  ChevronRight,
  X,
  ArrowLeft,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useDashboardBranding } from "@/contexts/DashboardBrandingContext";
import { usePendingRequestsCount } from "@/hooks/use-pending-requests-count";
import { ThemeToggle } from "@/components/ThemeToggle";
import { InstallAppButton } from "@/components/pwa/InstallAppButton";
import consultorioLogo from "@/assets/logo-loading.png";

type ModuleItem = {
  title: string;
  url: string;
  icon: typeof LayoutDashboard;
  /** Tinte HSL propio del módulo ("38 92% 55%"). null = color de marca. */
  tint: string | null;
  highlight?: boolean;
};

type ModuleGroup = {
  label: string;
  items: ModuleItem[];
};

// Lanzador de módulos mínimo: solo lo del día a día. Todo lo secundario
// (horarios, recordatorios, consultorio, portal, plan, ayuda) vive dentro
// de la pantalla Configuración.
const MODULE_GROUPS: ModuleGroup[] = [
  {
    label: "Tu día a día",
    items: [
      { title: "Agenda", url: "/agenda", icon: CalendarDays, tint: null },
      { title: "Solicitudes", url: "/solicitudes", icon: FileText, tint: "38 92% 55%", highlight: true },
      { title: "Pacientes", url: "/patients", icon: Users, tint: "210 90% 60%" },
      { title: "Pagos", url: "/pagos", icon: Receipt, tint: "152 70% 45%" },
    ],
  },
  {
    label: "Tu negocio",
    items: [
      { title: "Estadísticas", url: "/estadisticas", icon: BarChart3, tint: "190 85% 50%" },
      { title: "Configuración", url: "/configuracion", icon: Settings, tint: "215 15% 65%" },
    ],
  },
];

// Rutas que viven "adentro" de Configuración: el bloque se marca activo
// también cuando estás en cualquiera de sus subpáginas.
const CONFIG_ROUTES = [
  "/configuracion",
  "/horarios-disponibles",
  "/recordatorios-pendientes",
  "/mi-consultorio",
  "/personalizar-portal",
  "/billing",
  "/ayuda",
];

/**
 * Premium glassmorphism mobile header with animated minimal hamburger.
 * - Frosted dark surface with subtle brand glow
 * - Hamburger morphs into X using thin animated lines
 * - Drawer items reveal with staggered fade-in
 */
export function MobileHeader() {
  const [open, setOpen] = useState(false);
  const { isSuperAdmin } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const { primaryColor, logoUrl, displayName } = useDashboardBranding();
  const pendingRequests = usePendingRequestsCount();
  const isVisitMode = isSuperAdmin && Boolean(getActiveBusinessId());

  const brandHsl = `hsl(${primaryColor})`;
  const brandHsla = (alpha: number) => `hsla(${primaryColor}, ${alpha})`;

  const isActive = (path: string) =>
    path === "/configuracion"
      ? CONFIG_ROUTES.includes(location.pathname)
      : location.pathname === path;
  const visibleGroups = MODULE_GROUPS.map((group) => ({
    ...group,
    items: isSuperAdmin ? group.items.filter((item) => item.url !== "/billing") : group.items,
  })).filter((group) => group.items.length > 0);

  // Lock body scroll when drawer is open
  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  const handleNav = (url: string) => {
    navigate(url);
    setOpen(false);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/");
  };

  const handleBackToAdmin = () => {
    clearActiveBusinessId();
    setOpen(false);
    navigate("/saas-admin");
  };

  return (
    <>
      {/* ============================ Header bar ============================ */}
      <header
        className="sticky top-0 z-40 flex items-center justify-between h-14 px-4 md:hidden"
        style={{
          background: "#000000",
          borderBottom: `1px solid ${brandHsla(0.14)}`,
          boxShadow: `0 6px 24px -18px ${brandHsla(0.6)}`,
        }}
      >
        {/* Botón de módulos: abre el lanzador (grilla, como los bloques) */}
        <button
          onClick={() => setOpen(true)}
          className="relative h-10 w-10 rounded-xl flex items-center justify-center transition-all duration-300 active:scale-90"
          style={{
            background: brandHsla(0.14),
            border: `1px solid ${brandHsla(0.28)}`,
          }}
          aria-label="Abrir menú de módulos"
        >
          <span className="grid grid-cols-2 gap-[3px]" aria-hidden="true">
            {[0, 1, 2, 3].map((i) => (
              <span
                key={i}
                className="w-[6px] h-[6px] rounded-[2px]"
                style={{ background: brandHsl, opacity: i === 3 ? 0.55 : 1 }}
              />
            ))}
          </span>
          {pendingRequests > 0 && (
            <span
              className="absolute -top-1 -right-1 inline-flex items-center justify-center min-w-[16px] h-4 px-1 rounded-full bg-red-500 text-white text-[9px] font-bold animate-badge-pulse ring-2 ring-black"
              aria-label={`${pendingRequests} solicitudes pendientes`}
            >
              {pendingRequests > 9 ? "9+" : pendingRequests}
            </span>
          )}
        </button>

        {/* Centro: nombre del consultorio */}
        <p className="absolute left-1/2 -translate-x-1/2 max-w-[45%] truncate text-[13px] font-semibold text-white/85 tracking-tight pointer-events-none">
          {displayName || ""}
        </p>

        {/* Right: theme toggle + clinic logo */}
        <div className="flex items-center gap-2">
        <ThemeToggle />
        {logoUrl ? (
          <img
            src={logoUrl}
            alt="Logo"
            loading="lazy"
            decoding="async"
            className="w-9 h-9 rounded-xl object-cover"
            style={{ boxShadow: `0 0 0 2px ${brandHsla(0.35)}, 0 6px 18px -4px ${brandHsla(0.5)}` }}
          />
        ) : (
          <img
            src={consultorioLogo}
            alt="Consultorio Digital"
            className="h-11 w-11 object-contain"
          />
        )}
        </div>
      </header>

      {/* ============================ Fullscreen Drawer ============================ */}
      <div
        className={cn(
          "fixed inset-0 z-[100] md:hidden flex flex-col transition-all duration-[400ms] ease-[cubic-bezier(0.32,0.72,0,1)]",
          open
            ? "opacity-100 pointer-events-auto scale-100"
            : "opacity-0 pointer-events-none scale-[1.02]"
        )}
        style={{
          background: "#000000",
        }}
      >
        {/* Brand glow accents */}
        <div
          className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[400px] pointer-events-none opacity-60"
          style={{
            background: `radial-gradient(ellipse at center, ${brandHsla(0.22)}, transparent 70%)`,
          }}
        />
        <div
          className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[500px] h-[300px] pointer-events-none opacity-40"
          style={{
            background: `radial-gradient(ellipse at center, ${brandHsla(0.14)}, transparent 70%)`,
          }}
        />

        {/* Top bar: solo el botón de cerrar (el nombre del consultorio ya está
            en la barra "Ir al inicio" del lanzador) */}
        <div
          className="relative flex items-center justify-end h-14 px-4 shrink-0"
          style={{ paddingTop: "env(safe-area-inset-top, 0px)" }}
        >
          {/* Close X */}
          <button
            onClick={() => setOpen(false)}
            className="relative h-9 w-9 rounded-xl flex items-center justify-center transition-all duration-300 active:scale-90"
            style={{
              background: "rgba(255,255,255,0.06)",
              border: "1px solid rgba(255,255,255,0.08)",
            }}
            aria-label="Cerrar menú"
          >
            <X
              className="h-4 w-4"
              style={{ color: "rgba(255,255,255,0.9)" }}
              strokeWidth={2.4}
            />
          </button>
        </div>

        {/* Lanzador de módulos: bloques agrupados */}
        <nav
          className="flex-1 overflow-y-auto px-5 pt-2 pb-6"
          style={{
            scrollbarWidth: "none",
            msOverflowStyle: "none",
          }}
        >
          <style>{`nav::-webkit-scrollbar { display: none; }`}</style>
          <div className="max-w-sm mx-auto space-y-6">
            {/* Nombre del consultorio + acceso al inicio */}
            <button
              onClick={() => handleNav("/dashboard")}
              className={cn(
                "relative w-full flex items-center gap-3 rounded-2xl px-4 h-14 transition-all duration-200 active:scale-[0.97]",
                open && "animate-in fade-in slide-in-from-bottom-3"
              )}
              style={{
                background: isActive("/dashboard") ? brandHsla(0.16) : "rgba(255,255,255,0.045)",
                border: `1px solid ${isActive("/dashboard") ? brandHsla(0.35) : "rgba(255,255,255,0.08)"}`,
                animationDelay: open ? "120ms" : "0ms",
                animationDuration: "450ms",
                animationFillMode: "both",
              }}
            >
              <span
                className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
                style={{ background: brandHsla(0.18) }}
              >
                <LayoutDashboard className="h-[18px] w-[18px]" style={{ color: brandHsl }} />
              </span>
              <span className="min-w-0 text-left">
                <span className="block text-[13.5px] font-semibold text-white truncate">
                  {displayName || "Mi consultorio"}
                </span>
                <span className="block text-[11px] text-white/45">Ir al inicio</span>
              </span>
              <ChevronRight className="h-4 w-4 text-white/30 ml-auto shrink-0" />
            </button>

            {visibleGroups.map((group, groupIndex) => (
              <div key={group.label}>
                <p className="text-[10.5px] font-semibold uppercase tracking-[0.14em] text-white/40 mb-2.5 px-1">
                  {group.label}
                </p>
                <div className="grid grid-cols-2 gap-2.5">
                  {group.items.map((item, itemIndex) => {
                    const active = isActive(item.url);
                    const showBadge = item.highlight && pendingRequests > 0;
                    const tint = item.tint ?? primaryColor;
                    const tintHsl = `hsl(${tint})`;
                    const tintHsla = (alpha: number) => `hsla(${tint}, ${alpha})`;
                    const index = groupIndex * 4 + itemIndex;
                    return (
                      <button
                        key={item.url}
                        onClick={() => handleNav(item.url)}
                        className={cn(
                          "relative flex flex-col items-center justify-center gap-2 rounded-2xl py-4 transition-all duration-200 active:scale-[0.95]",
                          open && "animate-in fade-in slide-in-from-bottom-3"
                        )}
                        style={{
                          background: active ? tintHsla(0.13) : "rgba(255,255,255,0.045)",
                          border: `1px solid ${active ? tintHsla(0.4) : "rgba(255,255,255,0.08)"}`,
                          animationDelay: open ? `${index * 40 + 180}ms` : "0ms",
                          animationDuration: "450ms",
                          animationFillMode: "both",
                          boxShadow: active ? `0 8px 24px -10px ${tintHsla(0.55)}` : undefined,
                        }}
                      >
                        <span
                          className="w-11 h-11 rounded-2xl flex items-center justify-center"
                          style={{
                            background: tintHsla(0.16),
                            boxShadow: `inset 0 0 0 1px ${tintHsla(0.22)}`,
                          }}
                        >
                          <item.icon className="h-5 w-5" style={{ color: tintHsl }} strokeWidth={2} />
                        </span>
                        <span className={cn("text-[12.5px] font-medium tracking-tight", active ? "text-white" : "text-white/75")}>
                          {item.title}
                        </span>
                        {showBadge && (
                          <span
                            className="absolute top-2 right-2 inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full bg-red-500 text-white text-[10px] font-bold animate-badge-pulse"
                            aria-label={`${pendingRequests} solicitudes pendientes`}
                          >
                            {pendingRequests > 99 ? "99+" : pendingRequests}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}

            {/* Instalar la app: entrada permanente y discreta. Se oculta sola
                cuando la app ya está instalada. Cerramos el drawer al tocarla
                para que el prompt/tutorial de instalación quede visible. */}
            <div onClickCapture={() => setOpen(false)}>
              <InstallAppButton
                variant="icon-text"
                label="Instalar la app"
                className="w-full justify-center h-12 rounded-2xl border border-white/[0.08] bg-white/[0.045] text-white/60 hover:text-white hover:bg-white/[0.07]"
              />
            </div>
          </div>
        </nav>

        {/* Logout — centered footer */}
        <div
          className="relative flex justify-center pb-6 pt-3 shrink-0"
          style={{ paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 1.5rem)" }}
        >
          {isVisitMode ? (
            <button
              onClick={handleBackToAdmin}
              className="flex items-center gap-2.5 px-5 h-11 rounded-full text-amber-200/90 hover:text-amber-100 hover:bg-amber-500/15 transition-all duration-200 active:scale-[0.97]"
              style={{ border: "1px solid rgba(245,158,11,0.30)" }}
            >
              <ArrowLeft className="h-4 w-4" />
              <span className="text-[13px] font-medium tracking-tight">Volver al panel</span>
            </button>
          ) : (
            <button
              onClick={handleLogout}
              className="flex items-center gap-2.5 px-5 h-11 rounded-full text-white/45 hover:text-rose-400 hover:bg-rose-500/10 transition-all duration-200 active:scale-[0.97]"
              style={{ border: "1px solid rgba(255,255,255,0.08)" }}
            >
              <LogOut className="h-4 w-4" />
              <span className="text-[13px] font-medium tracking-tight">Cerrar sesión</span>
            </button>
          )}
        </div>
      </div>
    </>
  );
}
