import { useState, useRef } from "react";
import {
  LayoutDashboard,
  Users,
  CalendarDays,
  Receipt,
  FileText,
  Settings,
  BarChart3,
  Shield,
  LogOut,
  ArrowLeft,
} from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useDashboardBranding } from "@/contexts/DashboardBrandingContext";
import consultorioLogo from "@/assets/logo-loading.png";
import { isCurrentUserSuperAdmin } from "@/lib/admin-access";
import { useBusinessId, clearActiveBusinessId, getActiveBusinessId } from "@/hooks/use-business-id";
import { prefetchRoute } from "@/lib/query-prefetch";
import { usePendingRequestsCount } from "@/hooks/use-pending-requests-count";
import { useTheme } from "@/contexts/ThemeContext";
import { Sun, Moon } from "lucide-react";
import { InstallAppButton } from "@/components/pwa/InstallAppButton";

type NavItem = {
  title: string;
  url: string;
  icon: typeof LayoutDashboard;
  /** Tinte HSL propio del módulo ("38 92% 55%"). null = color de marca. */
  tint: string | null;
  highlight?: boolean;
};

// Nav mínimo: solo lo que se usa todos los días. Todo lo secundario
// (horarios, recordatorios, mi consultorio, portal, plan, ayuda) vive
// dentro de la pantalla Configuración. Misma organización que mobile.
const MODULE_GROUPS: { label: string | null; items: NavItem[] }[] = [
  {
    label: null,
    items: [{ title: "Inicio", url: "/dashboard", icon: LayoutDashboard, tint: null }],
  },
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
    ],
  },
];

// Configuración va suelta al final del nav: es la puerta a todo lo secundario.
const CONFIG_ITEM: NavItem = { title: "Configuración", url: "/configuracion", icon: Settings, tint: "215 15% 65%" };

// Rutas que viven "adentro" de Configuración: el item se marca activo
// también cuando estás en cualquiera de sus subpáginas.
export const CONFIG_ROUTES = [
  "/configuracion",
  "/horarios-disponibles",
  "/recordatorios-pendientes",
  "/mi-consultorio",
  "/personalizar-portal",
  "/billing",
  "/ayuda",
];

const MINI_WIDTH = 64;
const EXPANDED_WIDTH = 240;

export function PremiumSidebar() {
  const location = useLocation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { businessId } = useBusinessId();
  const [expanded, setExpanded] = useState(false);
  const hoverTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sidebarRef = useRef<HTMLDivElement>(null);
  const { primaryColor, logoUrl, displayName } = useDashboardBranding();
  const pendingRequests = usePendingRequestsCount();
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === "dark";

  // Dynamic color styles
  const brandHsl = `hsl(${primaryColor})`;
  const brandHsla = (alpha: number) => `hsla(${primaryColor.replace(/%/g, '%')}, ${alpha})`;

  // Perfil cacheado: una sola vez por sesión, persiste entre navegaciones.
  const { data: profileData } = useQuery({
    queryKey: ["sidebar-profile"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;

      const [{ data: profile }, isAdmin] = await Promise.all([
        supabase
          .from("profiles")
          .select("name, avatar_url")
          .eq("id", user.id)
          .maybeSingle(),
        isCurrentUserSuperAdmin(user.id),
      ]);

      return {
        userName: profile?.name ?? "",
        avatarUrl: profile?.avatar_url ?? null,
        isSuperAdmin: isAdmin,
      };
    },
    staleTime: 5 * 60_000, // 5 min: el perfil casi no cambia
    gcTime: 30 * 60_000,
  });

  const userName = profileData?.userName ?? "";
  const avatarUrl = profileData?.avatarUrl ?? null;
  const isSuperAdmin = profileData?.isSuperAdmin ?? false;

  // Visit mode: super admin viewing a specific business from /saas-admin.
  const isVisitMode = isSuperAdmin && Boolean(getActiveBusinessId());

  // Prefetch de la ruta destino al pasar el mouse sobre el item.
  const handlePrefetch = (url: string) => {
    void prefetchRoute(queryClient, url, businessId);
  };

  const handleMouseEnter = () => {
    if (hoverTimeout.current) clearTimeout(hoverTimeout.current);
    hoverTimeout.current = setTimeout(() => setExpanded(true), 150);
  };

  const handleMouseLeave = () => {
    if (hoverTimeout.current) clearTimeout(hoverTimeout.current);
    hoverTimeout.current = setTimeout(() => setExpanded(false), 300);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/");
  };

  const handleBackToAdmin = () => {
    clearActiveBusinessId();
    navigate("/saas-admin");
  };

  const isActive = (path: string) =>
    path === "/configuracion"
      ? CONFIG_ROUTES.includes(location.pathname)
      : location.pathname === path;

  const initials = userName
    ? userName
        .split(" ")
        .map((n) => n[0])
        .join("")
        .slice(0, 2)
        .toUpperCase()
    : "U";

  const visibleGroups = MODULE_GROUPS.map((group) => ({
    ...group,
    items: isSuperAdmin ? group.items.filter((item) => item.url !== "/billing") : group.items,
  })).filter((group) => group.items.length > 0);

  const renderItem = (item: NavItem) => {
    const active = isActive(item.url);
    const showBadge = item.highlight && pendingRequests > 0;
    const tint = item.tint ?? primaryColor;
    const tintHsl = `hsl(${tint})`;
    const tintHsla = (alpha: number) => `hsla(${tint}, ${alpha})`;

    const button = (
      <button
        onClick={() => navigate(item.url)}
        onMouseEnter={() => handlePrefetch(item.url)}
        onFocus={() => handlePrefetch(item.url)}
        className={cn(
          "group relative flex items-center gap-3 w-full rounded-xl transition-all duration-200",
          expanded ? "px-2 py-1.5" : "px-0 py-1.5 justify-center",
          active ? "text-white" : "text-white/55 hover:text-white hover:bg-white/[0.04]"
        )}
        style={active ? { background: tintHsla(0.1) } : undefined}
      >
        {/* Active indicator bar */}
        {active && (
          <div
            className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 rounded-r-full"
            style={{ background: tintHsl }}
          />
        )}

        {/* Ícono en cuadradito tintado (mismo lenguaje que el lanzador mobile) */}
        <div className="relative shrink-0">
          <span
            className="flex items-center justify-center w-10 h-10 rounded-xl transition-all duration-200 group-hover:scale-[1.06]"
            style={{
              background: tintHsla(active ? 0.26 : 0.16),
              boxShadow: `inset 0 0 0 1px ${tintHsla(active ? 0.45 : 0.26)}${active ? `, 0 6px 18px -6px ${tintHsla(0.5)}` : ""}`,
            }}
          >
            <item.icon className="h-[18px] w-[18px]" style={{ color: tintHsl }} strokeWidth={2} />
          </span>
          {/* Mini badge dot when collapsed */}
          {showBadge && !expanded && (
            <span
              className="absolute -top-1 -right-1 inline-flex items-center justify-center min-w-[14px] h-[14px] px-1 rounded-full bg-red-500 text-white text-[9px] font-bold animate-badge-pulse ring-2 ring-[#0a0a0a]"
              aria-label={`${pendingRequests} pendientes`}
            >
              {pendingRequests > 9 ? "9+" : pendingRequests}
            </span>
          )}
        </div>

        <span
          className={cn(
            "text-sm font-medium whitespace-nowrap transition-all duration-200 flex-1 text-left",
            expanded
              ? "opacity-100 translate-x-0"
              : "opacity-0 -translate-x-2 absolute pointer-events-none"
          )}
        >
          {item.title}
        </span>

        {/* Full badge when expanded */}
        {showBadge && expanded && (
          <span
            className="ml-auto inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full bg-red-500 text-white text-[10px] font-semibold animate-badge-pulse"
            aria-label={`${pendingRequests} pendientes`}
          >
            {pendingRequests > 99 ? "99+" : pendingRequests}
          </span>
        )}
      </button>
    );

    if (expanded) return button;

    return (
      <Tooltip key={item.url} delayDuration={0}>
        <TooltipTrigger asChild>{button}</TooltipTrigger>
        <TooltipContent
          side="right"
          sideOffset={12}
          className="bg-[#1a1a1a] text-white/90 border-white/10 text-xs font-medium"
        >
          {item.title}
          {showBadge && ` · ${pendingRequests} pendiente${pendingRequests > 1 ? "s" : ""}`}
        </TooltipContent>
      </Tooltip>
    );
  };

  return (
    <TooltipProvider>
      <div
        ref={sidebarRef}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        className="hidden md:flex flex-col fixed left-0 top-0 bottom-0 z-50 transition-all duration-300 ease-out"
        style={{ width: expanded ? EXPANDED_WIDTH : MINI_WIDTH }}
      >
        {/* Glassmorphism background */}
        <div className="absolute inset-0 bg-[#0a0a0a]/95 backdrop-blur-xl border-r border-white/[0.06]" />

        {/* Glow effect on expand */}
        <div
          className={cn(
            "absolute inset-0 transition-opacity duration-500 pointer-events-none",
            expanded ? "opacity-100" : "opacity-0"
          )}
          style={{
            background: `radial-gradient(ellipse at 50% 0%, ${brandHsla(0.06)} 0%, transparent 70%)`,
          }}
        />

        {/* Content */}
        <div className="relative flex flex-col h-full">
          {/* Logo area: la marca del consultorio con presencia. Aire generoso
              y nombre hasta en dos líneas: "Consultorio Camila Rodriguez"
              tiene que verse tan bien como "Mente Clara". */}
          <div
            className={cn(
              "flex items-center border-b border-white/[0.06]",
              expanded ? "gap-3 px-4 py-4 min-h-[76px]" : "justify-center px-0 h-[72px]"
            )}
          >
            {logoUrl ? (
              <img
                src={logoUrl}
                alt="Logo"
                loading="lazy"
                decoding="async"
                className="w-11 h-11 rounded-xl object-cover shrink-0"
                style={{
                  boxShadow: `0 0 0 2px ${brandHsla(0.35)}, 0 8px 24px -6px ${brandHsla(0.5)}`,
                }}
              />
            ) : (
              <span
                className="w-11 h-11 rounded-xl shrink-0 flex items-center justify-center"
                style={{
                  background: brandHsla(0.12),
                  boxShadow: `0 0 0 2px ${brandHsla(0.3)}, 0 8px 24px -6px ${brandHsla(0.4)}`,
                }}
              >
                <img
                  src={consultorioLogo}
                  alt="Consultorio Digital"
                  className="h-8 w-8 object-contain"
                />
              </span>
            )}
            <span
              className={cn(
                "text-[13px] font-semibold text-white/90 leading-snug tracking-tight transition-all duration-200 min-w-0 break-words line-clamp-2 pr-1",
                expanded
                  ? "opacity-100 translate-x-0"
                  : "opacity-0 -translate-x-2 absolute pointer-events-none"
              )}
            >
              {displayName || "Consultorio"}
            </span>
          </div>

          {/* Main nav: mismos grupos que el lanzador mobile */}
          <nav className="flex-1 px-2.5 py-2 space-y-1 overflow-y-auto overflow-x-hidden [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
            {visibleGroups.map((group, groupIndex) => (
              <div key={group.label ?? "top"}>
                {group.label && (
                  <div
                    className={cn(
                      "text-[10px] uppercase tracking-[0.15em] font-medium mb-1.5 mt-3 transition-all duration-200",
                      expanded
                        ? "text-white/25 px-2 opacity-100"
                        : "text-transparent opacity-0 h-0 mb-0 mt-2"
                    )}
                  >
                    {group.label}
                  </div>
                )}
                <div className="space-y-1">
                  {group.items.map((item) => (
                    <div key={item.url}>{renderItem(item)}</div>
                  ))}
                </div>
                {/* Separador sutil entre grupos cuando está colapsado */}
                {!expanded && groupIndex < visibleGroups.length - 1 && (
                  <div className="my-2 mx-3">
                    <div className="h-px bg-gradient-to-r from-transparent via-white/[0.08] to-transparent" />
                  </div>
                )}
              </div>
            ))}

            {/* Configuración: suelta, separada de los módulos del día a día */}
            <div className="my-2 mx-3">
              <div className="h-px bg-gradient-to-r from-transparent via-white/[0.08] to-transparent" />
            </div>
            {renderItem(CONFIG_ITEM)}

            {isSuperAdmin && !isVisitMode &&
              renderItem({
                title: "Panel Admin",
                url: "/saas-admin",
                icon: Shield,
                tint: "0 72% 58%",
              })}
          </nav>

          {/* User footer */}
          <div className="p-2.5 border-t border-white/[0.06]">
            {expanded && (
              <div className="px-1 pb-2">
                <InstallAppButton variant="icon-text" className="w-full justify-start text-white/55 hover:text-white hover:bg-white/[0.04]" />
              </div>
            )}
            {/* Theme toggle row */}
            <Tooltip delayDuration={0}>
              <TooltipTrigger asChild>
                <button
                  onClick={toggleTheme}
                  className={cn(
                    "group relative flex items-center gap-3 w-full rounded-xl transition-all duration-200 mb-1.5 text-white/45 hover:text-white/85 hover:bg-white/[0.04]",
                    expanded ? "px-3 py-2.5" : "px-0 py-2.5 justify-center",
                  )}
                  aria-label={isDark ? "Activar modo claro" : "Activar modo oscuro"}
                >
                  <div className="relative shrink-0 h-[18px] w-[18px]">
                    <Sun
                      className={cn(
                        "h-[18px] w-[18px] absolute transition-all duration-300",
                        isDark ? "opacity-0 rotate-90 scale-50" : "opacity-100 rotate-0 scale-100",
                      )}
                      strokeWidth={2}
                    />
                    <Moon
                      className={cn(
                        "h-[18px] w-[18px] absolute transition-all duration-300",
                        isDark ? "opacity-100 rotate-0 scale-100" : "opacity-0 -rotate-90 scale-50",
                      )}
                      strokeWidth={2}
                    />
                  </div>
                  <span
                    className={cn(
                      "text-sm font-medium whitespace-nowrap transition-all duration-200 flex-1 text-left",
                      expanded
                        ? "opacity-100 translate-x-0"
                        : "opacity-0 -translate-x-2 absolute pointer-events-none",
                    )}
                  >
                    {isDark ? "Modo claro" : "Modo oscuro"}
                  </span>
                </button>
              </TooltipTrigger>
              {!expanded && (
                <TooltipContent
                  side="right"
                  sideOffset={12}
                  className="bg-[#1a1a1a] text-white/90 border-white/10 text-xs font-medium"
                >
                  {isDark ? "Modo claro" : "Modo oscuro"}
                </TooltipContent>
              )}
            </Tooltip>

            <div
              className={cn(
                "flex items-center rounded-xl transition-all duration-200",
                expanded ? "gap-3 px-3 py-2.5" : "justify-center py-2.5"
              )}
            >
              <Avatar className="h-8 w-8 shrink-0 ring-2 ring-white/[0.08] ring-offset-1 ring-offset-[#0a0a0a]">
                <AvatarImage src={avatarUrl || undefined} />
                <AvatarFallback
                  className="text-white/80 text-xs font-semibold"
                  style={{
                    background: `linear-gradient(135deg, hsl(${primaryColor.split(' ')[0]} 60% 30%), hsl(${primaryColor.split(' ')[0]} 80% 20%))`,
                  }}
                >
                  {initials}
                </AvatarFallback>
              </Avatar>

              <div
                className={cn(
                  "flex-1 min-w-0 transition-all duration-200",
                  expanded
                    ? "opacity-100 translate-x-0"
                    : "opacity-0 -translate-x-2 absolute pointer-events-none"
                )}
              >
                <p className="text-sm text-white/70 truncate font-medium">
                  {userName || "Usuario"}
                </p>
              </div>

              {expanded && (
                isVisitMode ? (
                  <button
                    onClick={handleBackToAdmin}
                    className="text-amber-300/70 hover:text-amber-300 transition-colors duration-200 p-1.5 rounded-lg hover:bg-amber-500/10"
                    title="Volver al panel"
                  >
                    <ArrowLeft className="h-3.5 w-3.5" />
                  </button>
                ) : (
                  <button
                    onClick={handleLogout}
                    className="text-white/20 hover:text-rose-400 transition-colors duration-200 p-1.5 rounded-lg hover:bg-rose-500/10"
                    title="Cerrar sesión"
                  >
                    <LogOut className="h-3.5 w-3.5" />
                  </button>
                )
              )}
            </div>
          </div>
        </div>
      </div>
    </TooltipProvider>
  );
}
