import {
  LayoutDashboard,
  Users,
  CalendarDays,
  CreditCard,
  Receipt,
  Settings,
  Palette,
  Clock,
  FileText,
  LogOut,
  Shield,
  BarChart3,
} from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { NavLink } from "@/components/NavLink";
import { isCurrentUserSuperAdmin } from "@/lib/admin-access";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useEffect, useState } from "react";

const mainItems = [
  { title: "Dashboard", url: "/dashboard", icon: LayoutDashboard },
  { title: "Pacientes", url: "/patients", icon: Users },
  { title: "Agenda", url: "/agenda", icon: CalendarDays },
  { title: "Pagos", url: "/pagos", icon: Receipt },
  { title: "Recordatorios", url: "/recordatorios-pendientes", icon: Clock },
  { title: "Solicitudes", url: "/solicitudes", icon: FileText },
  { title: "Estadísticas", url: "/estadisticas", icon: BarChart3 },
];

const configItems = [
  { title: "Facturación", url: "/billing", icon: CreditCard },
  { title: "Mi consultorio", url: "/mi-consultorio", icon: Settings },
  { title: "Portal pacientes", url: "/personalizar-portal", icon: Palette },
  { title: "Horarios", url: "/horarios-disponibles", icon: Clock },
];

export function AppSidebar() {
  const location = useLocation();
  const navigate = useNavigate();
  const { setOpen } = useSidebar();
  const [userName, setUserName] = useState("");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);

  useEffect(() => {
    const loadProfile = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: profile } = await supabase
        .from("profiles")
        .select("name, avatar_url")
        .eq("id", user.id)
        .maybeSingle();

      if (profile) {
        setUserName(profile.name);
        setAvatarUrl(profile.avatar_url);
      }

      setIsSuperAdmin(await isCurrentUserSuperAdmin(user.id));
    };
    loadProfile();
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/");
  };

  const handleNavigate = (url: string) => {
    navigate(url);
    setOpen(false); // Close sidebar after navigation
  };

  const isActive = (path: string) => location.pathname === path;

  return (
    <Sidebar
      collapsible="offcanvas"
      className="border-r-0"
      style={{
        "--sidebar-width": "280px",
      } as React.CSSProperties}
    >
      <SidebarContent className="bg-[#0a0a0a] border-r border-white/5 pt-14 md:pt-16">
        {/* Main navigation */}
        <SidebarGroup>
          <SidebarGroupLabel className="text-white/25 text-[10px] uppercase tracking-widest px-4 mb-1">
            Principal
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {mainItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton
                    isActive={isActive(item.url)}
                    onClick={() => handleNavigate(item.url)}
                    className={`mx-2 rounded-lg transition-all duration-200 ${
                      isActive(item.url)
                        ? "bg-[hsla(176,80%,40%,0.08)] text-[hsl(176,80%,40%)]"
                        : "text-white/45 hover:text-white/80 hover:bg-white/[0.03]"
                    }`}
                  >
                    <item.icon className="h-4 w-4" />
                    <span className="text-sm">{item.title}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* Separator */}
        <div className="mx-6 my-2 h-px bg-white/5" />

        {/* Config navigation */}
        <SidebarGroup>
          <SidebarGroupLabel className="text-white/25 text-[10px] uppercase tracking-widest px-4 mb-1">
            Configuración
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {configItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton
                    isActive={isActive(item.url)}
                    onClick={() => handleNavigate(item.url)}
                    className={`mx-2 rounded-lg transition-all duration-200 ${
                      isActive(item.url)
                        ? "bg-[hsla(176,80%,40%,0.08)] text-[hsl(176,80%,40%)]"
                        : "text-white/45 hover:text-white/80 hover:bg-white/[0.03]"
                    }`}
                  >
                    <item.icon className="h-4 w-4" />
                    <span className="text-sm">{item.title}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}

              {isSuperAdmin && (
                <SidebarMenuItem>
                  <SidebarMenuButton
                    isActive={isActive("/saas-admin")}
                    onClick={() => handleNavigate("/saas-admin")}
                    className={`mx-2 rounded-lg transition-all duration-200 ${
                      isActive("/saas-admin")
                        ? "bg-[hsla(176,80%,40%,0.08)] text-[hsl(176,80%,40%)]"
                        : "text-white/45 hover:text-white/80 hover:bg-white/[0.03]"
                    }`}
                  >
                    <Shield className="h-4 w-4" />
                    <span className="text-sm">Panel Admin</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              )}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      {/* Footer */}
      <SidebarFooter className="bg-[#0a0a0a] border-r border-white/5 border-t border-t-white/5 p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3 min-w-0">
            <Avatar className="h-8 w-8 flex-shrink-0 ring-1 ring-white/10">
              <AvatarImage src={avatarUrl || undefined} />
              <AvatarFallback className="bg-white/5 text-white/50 text-xs">
                {userName?.charAt(0)?.toUpperCase() || "U"}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <p className="text-sm text-white/70 truncate">{userName || "Usuario"}</p>
              <p className="text-[10px] text-white/25">Mi cuenta</p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="text-white/25 hover:text-red-400 transition-colors duration-200 p-2 rounded-lg hover:bg-red-500/5"
            title="Cerrar sesión"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
