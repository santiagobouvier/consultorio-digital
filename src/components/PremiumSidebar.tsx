import { useState, useRef } from "react";
import {
  LayoutDashboard,
  Users,
  CalendarDays,
  Receipt,
  Clock,
  FileText,
  Settings,
  Palette,
  CreditCard,
  BarChart3,
  Shield,
  LogOut,
  ChevronRight,
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
import { isCurrentUserSuperAdmin } from "@/lib/admin-access";
import { useBusinessId } from "@/hooks/use-business-id";
import { prefetchRoute } from "@/lib/query-prefetch";
import { usePendingRequestsCount } from "@/hooks/use-pending-requests-count";

type NavItem = {
  title: string;
  url: string;
  icon: typeof LayoutDashboard;
  highlight?: boolean;
};

const mainItems: NavItem[] = [
  { title: "Dashboard", url: "/dashboard", icon: LayoutDashboard },
  { title: "Solicitudes", url: "/solicitudes", icon: FileText, highlight: true },
  { title: "Pacientes", url: "/patients", icon: Users },
  { title: "Agenda", url: "/agenda", icon: CalendarDays },
  { title: "Pagos", url: "/pagos", icon: Receipt },
  { title: "Recordatorios", url: "/recordatorios-pendientes", icon: Clock },
  { title: "Estadísticas", url: "/estadisticas", icon: BarChart3 },
];

const configItems = [
  { title: "Facturación", url: "/billing", icon: CreditCard },
  { title: "Mi consultorio", url: "/mi-consultorio", icon: Settings },
  { title: "Portal", url: "/personalizar-portal", icon: Palette },
  { title: "Horarios", url: "/horarios-disponibles", icon: Clock },
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

  const isActive = (path: string) => location.pathname === path;

  const initials = userName
    ? userName
        .split(" ")
        .map((n) => n[0])
        .join("")
        .slice(0, 2)
        .toUpperCase()
    : "U";

  const visibleConfigItems = isSuperAdmin
    ? configItems.filter((item) => item.url !== "/billing")
    : configItems;

  const renderItem = (item: (typeof mainItems)[0]) => {
    const active = isActive(item.url);

    const button = (
      <button
        onClick={() => navigate(item.url)}
        onMouseEnter={() => handlePrefetch(item.url)}
        onFocus={() => handlePrefetch(item.url)}
        className={cn(
          "group relative flex items-center gap-3 w-full rounded-xl transition-all duration-200",
          expanded ? "px-3 py-2.5" : "px-0 py-2.5 justify-center",
          active
            ? "text-white"
            : "text-white/40 hover:text-white/80 hover:bg-white/[0.04]"
        )}
        style={active ? { background: brandHsla(0.12), color: brandHsl } : undefined}
      >
        {/* Active indicator bar */}
        {active && (
          <div
            className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 rounded-r-full"
            style={{ background: brandHsl }}
          />
        )}

        <item.icon
          className={cn(
            "shrink-0 transition-all duration-200",
            expanded ? "h-[18px] w-[18px]" : "h-5 w-5"
          )}
          style={active ? { filter: `drop-shadow(0 0 6px ${brandHsla(0.4)})` } : undefined}
        />

        <span
          className={cn(
            "text-sm font-medium whitespace-nowrap transition-all duration-200",
            expanded
              ? "opacity-100 translate-x-0"
              : "opacity-0 -translate-x-2 absolute pointer-events-none"
          )}
        >
          {item.title}
        </span>
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
          {/* Logo area */}
          <div className="flex items-center h-16 px-4">
            <div className="flex items-center gap-3 min-w-0">
              {logoUrl ? (
                <img
                  src={logoUrl}
                  alt="Logo"
                  className="w-8 h-8 rounded-lg object-cover shrink-0"
                  style={{ boxShadow: `0 4px 12px ${brandHsla(0.2)}` }}
                />
              ) : (
                <div
                  className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                  style={{
                    background: `linear-gradient(135deg, ${brandHsl}, hsl(${primaryColor.split(' ')[0]} 100% 25%))`,
                    boxShadow: `0 4px 12px ${brandHsla(0.2)}`,
                  }}
                >
                  <CalendarDays className="h-4 w-4 text-white" />
                </div>
              )}
              <span
                className={cn(
                  "text-sm font-semibold text-white/80 whitespace-nowrap tracking-tight transition-all duration-200",
                  expanded
                    ? "opacity-100 translate-x-0"
                    : "opacity-0 -translate-x-2 absolute pointer-events-none"
                )}
              >
                {displayName || "Consultorio"}
              </span>
            </div>
          </div>

          {/* Main nav */}
          <nav className="flex-1 px-2.5 py-2 space-y-0.5 overflow-y-auto overflow-x-hidden [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
            <div
              className={cn(
                "text-[10px] uppercase tracking-[0.15em] font-medium mb-2 transition-all duration-200",
                expanded
                  ? "text-white/20 px-3 opacity-100"
                  : "text-transparent opacity-0 h-0 mb-0"
              )}
            >
              Principal
            </div>

            {mainItems.map((item) => (
              <div key={item.url}>{renderItem(item)}</div>
            ))}

            <div className="!my-3 mx-2">
              <div className="h-px bg-gradient-to-r from-transparent via-white/[0.08] to-transparent" />
            </div>

            <div
              className={cn(
                "text-[10px] uppercase tracking-[0.15em] font-medium mb-2 transition-all duration-200",
                expanded
                  ? "text-white/20 px-3 opacity-100"
                  : "text-transparent opacity-0 h-0 mb-0"
              )}
            >
              Configuración
            </div>

            {visibleConfigItems.map((item) => (
              <div key={item.url}>{renderItem(item)}</div>
            ))}

            {isSuperAdmin &&
              renderItem({
                title: "Panel Admin",
                url: "/saas-admin",
                icon: Shield,
              })}
          </nav>

          {/* User footer */}
          <div className="p-2.5 border-t border-white/[0.06]">
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
                <button
                  onClick={handleLogout}
                  className="text-white/20 hover:text-rose-400 transition-colors duration-200 p-1.5 rounded-lg hover:bg-rose-500/10"
                  title="Cerrar sesión"
                >
                  <LogOut className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </TooltipProvider>
  );
}
