import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import {
  LayoutDashboard,
  Users,
  CalendarDays,
  Receipt,
  Clock,
  AlarmClock,
  FileText,
  Settings,
  Palette,
  CreditCard,
  BarChart3,
  LogOut,
  ChevronRight,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useDashboardBranding } from "@/contexts/DashboardBrandingContext";
import { usePendingRequestsCount } from "@/hooks/use-pending-requests-count";

type NavItem = {
  title: string;
  url: string;
  icon: typeof LayoutDashboard;
  highlight?: boolean;
};

const navItems: NavItem[] = [
  { title: "Dashboard", url: "/dashboard", icon: LayoutDashboard },
  { title: "Solicitudes", url: "/solicitudes", icon: FileText, highlight: true },
  { title: "Pacientes", url: "/patients", icon: Users },
  { title: "Agenda", url: "/agenda", icon: CalendarDays },
  { title: "Pagos", url: "/pagos", icon: Receipt },
  { title: "Recordatorios", url: "/recordatorios-pendientes", icon: Clock },
  { title: "Horarios", url: "/horarios-disponibles", icon: AlarmClock },
  { title: "Estadísticas", url: "/estadisticas", icon: BarChart3 },
  { title: "Facturación", url: "/billing", icon: CreditCard },
  { title: "Consultorio", url: "/mi-consultorio", icon: Settings },
  { title: "Portal", url: "/personalizar-portal", icon: Palette },
];

/**
 * Premium glassmorphism mobile header with animated minimal hamburger.
 * - Frosted dark surface with subtle brand glow
 * - Hamburger morphs into X using thin animated lines
 * - Drawer items reveal with staggered fade-in
 */
export function MobileHeader() {
  const [open, setOpen] = useState(false);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { primaryColor, logoUrl, displayName } = useDashboardBranding();
  const pendingRequests = usePendingRequestsCount();

  const brandHsl = `hsl(${primaryColor})`;
  const brandHsla = (alpha: number) => `hsla(${primaryColor}, ${alpha})`;

  const isActive = (path: string) => location.pathname === path;
  const visibleNavItems = isSuperAdmin
    ? navItems.filter((item) => item.url !== "/billing")
    : navItems;

  useEffect(() => {
    const loadRole = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;
      setIsSuperAdmin(await isCurrentUserSuperAdmin(user.id));
    };
    loadRole();
  }, []);

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

  return (
    <>
      {/* ============================ Header bar ============================ */}
      <header
        className="sticky top-0 z-40 flex items-center justify-between h-14 px-4 md:hidden"
        style={{
          background: "#000000",
          borderBottom: "1px solid rgba(255,255,255,0.06)",
        }}
      >
        {/* Minimalist toggle — opens fullscreen drawer */}
        <button
          onClick={() => setOpen(true)}
          className="relative h-9 w-9 rounded-xl flex items-center justify-center transition-all duration-300 active:scale-90"
          style={{
            background: "rgba(255,255,255,0.06)",
            border: "1px solid rgba(255,255,255,0.08)",
          }}
          aria-label="Abrir menú"
        >
          <ChevronRight
            className="h-4 w-4"
            style={{ color: "rgba(255,255,255,0.9)" }}
            strokeWidth={2.4}
          />
          {pendingRequests > 0 && (
            <span
              className="absolute -top-1 -right-1 inline-flex items-center justify-center min-w-[16px] h-4 px-1 rounded-full bg-red-500 text-white text-[9px] font-bold animate-badge-pulse ring-2 ring-black"
              aria-label={`${pendingRequests} solicitudes pendientes`}
            >
              {pendingRequests > 9 ? "9+" : pendingRequests}
            </span>
          )}
        </button>

        {/* Right: only the clinic logo */}
        {logoUrl ? (
          <img
            src={logoUrl}
            alt="Logo"
            className="w-8 h-8 rounded-lg object-cover"
            style={{ boxShadow: `0 2px 10px ${brandHsla(0.3)}` }}
          />
        ) : (
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center"
            style={{
              background: `linear-gradient(135deg, ${brandHsl}, hsl(${primaryColor.split(" ")[0]} 100% 25%))`,
              boxShadow: `0 2px 10px ${brandHsla(0.3)}`,
            }}
          >
            <CalendarDays className="h-4 w-4 text-white" />
          </div>
        )}
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

        {/* Top bar with logo + close X */}
        <div
          className="relative flex items-center justify-between h-14 px-4 shrink-0"
          style={{ paddingTop: "env(safe-area-inset-top, 0px)" }}
        >
          {/* Logo placeholder (left, for symmetry with header) */}
          <div className="w-9 h-9" />

          {/* Centered logo */}
          {logoUrl ? (
            <img
              src={logoUrl}
              alt="Logo"
              className="w-9 h-9 rounded-xl object-cover"
              style={{ boxShadow: `0 4px 16px ${brandHsla(0.4)}` }}
            />
          ) : (
            <div
              className="w-9 h-9 rounded-xl flex items-center justify-center"
              style={{
                background: `linear-gradient(135deg, ${brandHsl}, hsl(${primaryColor.split(" ")[0]} 100% 25%))`,
                boxShadow: `0 4px 16px ${brandHsla(0.4)}`,
              }}
            >
              <CalendarDays className="h-4 w-4 text-white" />
            </div>
          )}

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

        {/* Centered nav items */}
        <nav
          className="flex-1 flex flex-col items-center justify-center gap-2 px-6 py-10 overflow-y-auto"
          style={{
            scrollbarWidth: "none",
            msOverflowStyle: "none",
          }}
        >
          <style>{`nav::-webkit-scrollbar { display: none; }`}</style>
          {visibleNavItems.map((item, index) => {
            const active = isActive(item.url);
            const showBadge = item.highlight && pendingRequests > 0;
            return (
              <button
                key={item.url}
                onClick={() => handleNav(item.url)}
                className={cn(
                  "relative flex items-center justify-center gap-2.5 w-full max-w-[220px] h-10 rounded-xl transition-all duration-200",
                  "active:scale-[0.96]",
                  active
                    ? "text-white"
                    : "text-white/55 hover:text-white hover:bg-white/[0.04]",
                  open && "animate-in fade-in slide-in-from-bottom-3"
                )}
                style={{
                  background: active ? brandHsla(0.16) : undefined,
                  border: active ? `1px solid ${brandHsla(0.32)}` : "1px solid transparent",
                  animationDelay: open ? `${index * 45 + 150}ms` : "0ms",
                  animationDuration: "500ms",
                  animationFillMode: "both",
                  boxShadow: active ? `0 6px 20px -8px ${brandHsla(0.5)}` : undefined,
                }}
              >
                <item.icon
                  className="h-[16px] w-[16px] shrink-0 transition-colors"
                  style={{ color: active ? brandHsl : undefined }}
                />
                <span className="text-[13.5px] font-medium tracking-tight">{item.title}</span>
                {showBadge && (
                  <span
                    className="inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full bg-red-500 text-white text-[10px] font-bold animate-badge-pulse"
                    aria-label={`${pendingRequests} solicitudes pendientes`}
                  >
                    {pendingRequests > 99 ? "99+" : pendingRequests}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* Logout — centered footer */}
        <div
          className="relative flex justify-center pb-6 pt-3 shrink-0"
          style={{ paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 1.5rem)" }}
        >
          <button
            onClick={handleLogout}
            className="flex items-center gap-2.5 px-5 h-11 rounded-full text-white/45 hover:text-rose-400 hover:bg-rose-500/10 transition-all duration-200 active:scale-[0.97]"
            style={{ border: "1px solid rgba(255,255,255,0.08)" }}
          >
            <LogOut className="h-4 w-4" />
            <span className="text-[13px] font-medium tracking-tight">Cerrar sesión</span>
          </button>
        </div>
      </div>
    </>
  );
}
