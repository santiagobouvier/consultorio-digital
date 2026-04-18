import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
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
  LogOut,
  ChevronRight,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useDashboardBranding } from "@/contexts/DashboardBrandingContext";
import { isCurrentUserSuperAdmin } from "@/lib/admin-access";

const navItems = [
  { title: "Dashboard", url: "/dashboard", icon: LayoutDashboard },
  { title: "Pacientes", url: "/patients", icon: Users },
  { title: "Agenda", url: "/agenda", icon: CalendarDays },
  { title: "Pagos", url: "/pagos", icon: Receipt },
  { title: "Recordatorios", url: "/recordatorios-pendientes", icon: Clock },
  { title: "Solicitudes", url: "/solicitudes", icon: FileText },
  { title: "Estadísticas", url: "/estadisticas", icon: BarChart3 },
  { title: "Facturación", url: "/billing", icon: CreditCard },
  { title: "Consultorio", url: "/mi-consultorio", icon: Settings },
  { title: "Portal", url: "/personalizar-portal", icon: Palette },
  { title: "Horarios", url: "/horarios-disponibles", icon: Clock },
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
          background: "rgba(0, 0, 0, 0.55)",
          backdropFilter: "saturate(180%) blur(22px)",
          WebkitBackdropFilter: "saturate(180%) blur(22px)",
          borderBottom: "1px solid rgba(255,255,255,0.06)",
        }}
      >
        {/* Minimalist toggle — small pill with rotating chevron */}
        <button
          onClick={() => setOpen(!open)}
          className="relative h-9 w-9 rounded-xl flex items-center justify-center transition-all duration-300 active:scale-90"
          style={{
            background: "rgba(255,255,255,0.06)",
            border: "1px solid rgba(255,255,255,0.08)",
          }}
          aria-label={open ? "Cerrar menú" : "Abrir menú"}
        >
          <ChevronRight
            className="h-4 w-4 transition-transform duration-300 ease-out"
            style={{
              color: "rgba(255,255,255,0.9)",
              transform: open ? "rotate(180deg)" : "rotate(0deg)",
            }}
            strokeWidth={2.4}
          />
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

      {/* ============================ Drawer ============================ */}
      <div
        className={cn(
          "fixed inset-0 z-50 md:hidden",
          open ? "pointer-events-auto" : "pointer-events-none"
        )}
      >
        {/* Backdrop */}
        <div
          className={cn(
            "absolute inset-0 transition-opacity duration-300",
            open ? "opacity-100" : "opacity-0"
          )}
          style={{
            background: "rgba(0,0,0,0.55)",
            backdropFilter: "blur(6px)",
            WebkitBackdropFilter: "blur(6px)",
          }}
          onClick={() => setOpen(false)}
        />

        {/* Drawer panel */}
        <div
          className={cn(
            "absolute left-0 top-0 bottom-0 w-[300px] flex flex-col transition-transform duration-[350ms] ease-[cubic-bezier(0.32,0.72,0,1)]",
            open ? "translate-x-0" : "-translate-x-full"
          )}
          style={{
            background: "rgba(10, 10, 10, 0.92)",
            backdropFilter: "saturate(180%) blur(24px)",
            WebkitBackdropFilter: "saturate(180%) blur(24px)",
            borderRight: `1px solid ${brandHsla(0.18)}`,
            boxShadow: `8px 0 40px -12px ${brandHsla(0.35)}, inset -1px 0 0 rgba(255,255,255,0.04)`,
          }}
        >
          {/* Brand glow accent */}
          <div
            className="absolute top-0 left-0 right-0 h-32 pointer-events-none"
            style={{
              background: `radial-gradient(ellipse at top left, ${brandHsla(0.18)}, transparent 70%)`,
            }}
          />

          {/* Drawer header */}
          <div
            className="relative flex items-center gap-3 h-16 px-5"
            style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}
          >
            {logoUrl ? (
              <img
                src={logoUrl}
                alt="Logo"
                className="w-10 h-10 rounded-xl object-cover"
                style={{ boxShadow: `0 4px 16px ${brandHsla(0.35)}` }}
              />
            ) : (
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center"
                style={{
                  background: `linear-gradient(135deg, ${brandHsl}, hsl(${primaryColor.split(" ")[0]} 100% 25%))`,
                  boxShadow: `0 4px 16px ${brandHsla(0.35)}`,
                }}
              >
                <CalendarDays className="h-5 w-5 text-white" />
              </div>
            )}
            <div className="flex flex-col">
              <span className="text-[15px] font-semibold text-white leading-tight">
                {displayName || "Consultorio"}
              </span>
              <span className="text-[11px] text-white/40 uppercase tracking-wider">Panel</span>
            </div>
          </div>

          {/* Nav items with stagger animation */}
          <nav className="flex-1 px-3 py-5 space-y-1 overflow-y-auto">
            {visibleNavItems.map((item, index) => {
              const active = isActive(item.url);
              return (
                <button
                  key={item.url}
                  onClick={() => handleNav(item.url)}
                  className={cn(
                    "relative flex items-center gap-3.5 w-full px-3.5 py-3 rounded-xl text-left transition-all duration-200 group",
                    "active:scale-[0.98]",
                    active
                      ? "text-white"
                      : "text-white/55 hover:text-white hover:bg-white/[0.04]",
                    open && "animate-in fade-in slide-in-from-left-3"
                  )}
                  style={{
                    background: active ? brandHsla(0.14) : undefined,
                    border: active ? `1px solid ${brandHsla(0.28)}` : "1px solid transparent",
                    animationDelay: open ? `${index * 35 + 100}ms` : "0ms",
                    animationDuration: "350ms",
                    animationFillMode: "both",
                  }}
                >
                  {active && (
                    <div
                      className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-6 rounded-r-full"
                      style={{
                        background: brandHsl,
                        boxShadow: `0 0 12px ${brandHsla(0.6)}`,
                      }}
                    />
                  )}
                  <item.icon
                    className="h-[19px] w-[19px] shrink-0 transition-colors"
                    style={{ color: active ? brandHsl : undefined }}
                  />
                  <span className="text-[14px] font-medium tracking-tight">{item.title}</span>
                </button>
              );
            })}
          </nav>

          {/* Logout */}
          <div
            className="p-3"
            style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}
          >
            <button
              onClick={handleLogout}
              className="flex items-center gap-3.5 w-full px-3.5 py-3 rounded-xl text-white/40 hover:text-rose-400 hover:bg-rose-500/10 transition-all duration-200 active:scale-[0.98]"
            >
              <LogOut className="h-[19px] w-[19px]" />
              <span className="text-[14px] font-medium tracking-tight">Cerrar sesión</span>
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
