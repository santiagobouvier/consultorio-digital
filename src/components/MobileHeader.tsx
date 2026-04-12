import { useState } from "react";
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
  Menu,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useDashboardBranding } from "@/contexts/DashboardBrandingContext";

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

export function MobileHeader() {
  const [open, setOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { primaryColor, logoUrl, displayName } = useDashboardBranding();

  const brandHsl = `hsl(${primaryColor})`;
  const brandHsla = (alpha: number) => `hsla(${primaryColor}, ${alpha})`;

  const isActive = (path: string) => location.pathname === path;

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
      {/* Mobile header bar */}
      <header className="sticky top-0 z-40 flex items-center h-14 px-4 bg-[#0a0a0a]/95 backdrop-blur-xl border-b border-white/[0.06] md:hidden">
        <button
          onClick={() => setOpen(!open)}
          className="w-10 h-10 rounded-xl bg-white/[0.04] border border-white/[0.08] flex items-center justify-center text-white/50 hover:text-white hover:border-white/15 transition-all duration-300"
          aria-label={open ? "Cerrar menú" : "Abrir menú"}
        >
          <div className="relative w-5 h-5">
            <Menu
              className={cn(
                "w-5 h-5 absolute inset-0 transition-all duration-300",
                open ? "opacity-0 rotate-90 scale-75" : "opacity-100 rotate-0 scale-100"
              )}
            />
            <X
              className={cn(
                "w-5 h-5 absolute inset-0 transition-all duration-300",
                open ? "opacity-100 rotate-0 scale-100" : "opacity-0 -rotate-90 scale-75"
              )}
            />
          </div>
        </button>

        <div className="flex-1 flex justify-center">
          <div className="flex items-center gap-2">
            {logoUrl ? (
              <img src={logoUrl} alt="Logo" className="w-6 h-6 rounded-md object-cover" />
            ) : (
              <div
                className="w-6 h-6 rounded-md flex items-center justify-center"
                style={{
                  background: `linear-gradient(135deg, ${brandHsl}, hsl(${primaryColor.split(' ')[0]} 100% 25%))`,
                }}
              >
                <CalendarDays className="h-3.5 w-3.5 text-white" />
              </div>
            )}
            <span className="text-xs font-semibold text-white/50 tracking-wide">
              {displayName || "Consultorio Digital"}
            </span>
          </div>
        </div>

        <div className="w-10" />
      </header>

      {/* Mobile fullscreen nav overlay */}
      <div
        className={cn(
          "fixed inset-0 z-50 md:hidden transition-all duration-300",
          open ? "pointer-events-auto" : "pointer-events-none"
        )}
      >
        {/* Backdrop */}
        <div
          className={cn(
            "absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity duration-300",
            open ? "opacity-100" : "opacity-0"
          )}
          onClick={() => setOpen(false)}
        />

        {/* Drawer */}
        <div
          className={cn(
            "absolute left-0 top-0 bottom-0 w-[280px] bg-[#0a0a0a] border-r border-white/[0.06] transition-transform duration-300 ease-out flex flex-col",
            open ? "translate-x-0" : "-translate-x-full"
          )}
        >
          {/* Close button */}
          <div className="flex items-center justify-between h-14 px-4 border-b border-white/[0.06]">
            <div className="flex items-center gap-2.5">
              {logoUrl ? (
                <img
                  src={logoUrl}
                  alt="Logo"
                  className="w-8 h-8 rounded-lg object-cover"
                  style={{ boxShadow: `0 4px 12px ${brandHsla(0.2)}` }}
                />
              ) : (
                <div
                  className="w-8 h-8 rounded-lg flex items-center justify-center"
                  style={{
                    background: `linear-gradient(135deg, ${brandHsl}, hsl(${primaryColor.split(' ')[0]} 100% 25%))`,
                    boxShadow: `0 4px 12px ${brandHsla(0.2)}`,
                  }}
                >
                  <CalendarDays className="h-4 w-4 text-white" />
                </div>
              )}
              <span className="text-sm font-semibold text-white/80">
                {displayName || "Consultorio"}
              </span>
            </div>
            <button
              onClick={() => setOpen(false)}
              className="w-8 h-8 rounded-lg bg-white/[0.04] flex items-center justify-center text-white/40 hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Nav items */}
          <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
            {navItems.map((item) => {
              const active = isActive(item.url);
              return (
                <button
                  key={item.url}
                  onClick={() => handleNav(item.url)}
                  className={cn(
                    "relative flex items-center gap-3 w-full px-3 py-3 rounded-xl transition-all duration-200 text-left",
                    active
                      ? "text-white"
                      : "text-white/40 hover:text-white/80 hover:bg-white/[0.04]"
                  )}
                  style={active ? { background: brandHsla(0.12), color: brandHsl } : undefined}
                >
                  {active && (
                    <div
                      className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 rounded-r-full"
                      style={{ background: brandHsl }}
                    />
                  )}
                  <item.icon className="h-[18px] w-[18px] shrink-0" />
                  <span className="text-sm font-medium">{item.title}</span>
                </button>
              );
            })}
          </nav>

          {/* Logout */}
          <div className="p-3 border-t border-white/[0.06]">
            <button
              onClick={handleLogout}
              className="flex items-center gap-3 w-full px-3 py-3 rounded-xl text-white/30 hover:text-rose-400 hover:bg-rose-500/10 transition-all duration-200"
            >
              <LogOut className="h-[18px] w-[18px]" />
              <span className="text-sm font-medium">Cerrar sesión</span>
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
