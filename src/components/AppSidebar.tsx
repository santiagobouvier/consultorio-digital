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
  ChevronDown,
} from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { NavLink } from "@/components/NavLink";
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
];

const configItems = [
  { title: "Facturación", url: "/billing", icon: CreditCard },
  { title: "Mi consultorio", url: "/mi-consultorio", icon: Settings },
  { title: "Portal pacientes", url: "/personalizar-portal", icon: Palette },
  { title: "Horarios", url: "/horarios-disponibles", icon: Clock },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const location = useLocation();
  const navigate = useNavigate();
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

      const { data: adminRole } = await supabase
        .from("user_roles")
        .select("id")
        .eq("user_id", user.id)
        .eq("role", "super_admin")
        .maybeSingle();

      setIsSuperAdmin(!!adminRole);
    };
    loadProfile();
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/");
  };

  const isActive = (path: string) => location.pathname === path;

  return (
    <Sidebar collapsible="icon" className="border-r border-white/5 bg-[hsl(180,15%,4%)]">
      <SidebarContent className="bg-[hsl(180,15%,4%)]">
        {/* Logo / Brand */}
        <div className={`p-4 ${collapsed ? "px-2" : ""}`}>
          {collapsed ? (
            <div className="w-8 h-8 rounded-lg bg-[hsla(176,80%,40%,0.15)] flex items-center justify-center mx-auto">
              <span className="text-[hsl(176,80%,40%)] font-bold text-sm">TC</span>
            </div>
          ) : (
            <h2 className="text-sm font-semibold text-white/80 tracking-tight">
              Tu Consultorio Digital
            </h2>
          )}
        </div>

        {/* Main navigation */}
        <SidebarGroup>
          <SidebarGroupLabel className="text-white/30 text-[10px] uppercase tracking-wider">
            {!collapsed && "Principal"}
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {mainItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton
                    asChild
                    isActive={isActive(item.url)}
                    tooltip={collapsed ? item.title : undefined}
                  >
                    <NavLink
                      to={item.url}
                      end
                      className="text-white/50 hover:text-white hover:bg-white/5 transition-colors"
                      activeClassName="bg-[hsla(176,80%,40%,0.1)] text-[hsl(176,80%,40%)] font-medium"
                    >
                      <item.icon className="h-4 w-4" />
                      {!collapsed && <span>{item.title}</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* Config navigation */}
        <SidebarGroup>
          <SidebarGroupLabel className="text-white/30 text-[10px] uppercase tracking-wider">
            {!collapsed && "Configuración"}
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {configItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton
                    asChild
                    isActive={isActive(item.url)}
                    tooltip={collapsed ? item.title : undefined}
                  >
                    <NavLink
                      to={item.url}
                      end
                      className="text-white/50 hover:text-white hover:bg-white/5 transition-colors"
                      activeClassName="bg-[hsla(176,80%,40%,0.1)] text-[hsl(176,80%,40%)] font-medium"
                    >
                      <item.icon className="h-4 w-4" />
                      {!collapsed && <span>{item.title}</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}

              {isSuperAdmin && (
                <SidebarMenuItem>
                  <SidebarMenuButton
                    asChild
                    isActive={isActive("/saas-admin")}
                    tooltip={collapsed ? "Admin" : undefined}
                  >
                    <NavLink
                      to="/saas-admin"
                      end
                      className="text-white/50 hover:text-white hover:bg-white/5 transition-colors"
                      activeClassName="bg-[hsla(176,80%,40%,0.1)] text-[hsl(176,80%,40%)] font-medium"
                    >
                      <Shield className="h-4 w-4" />
                      {!collapsed && <span>Admin</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              )}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      {/* Footer with user info */}
      <SidebarFooter className="bg-[hsl(180,15%,4%)] border-t border-white/5 p-3">
        {collapsed ? (
          <button onClick={handleLogout} className="mx-auto">
            <Avatar className="h-8 w-8">
              <AvatarImage src={avatarUrl || undefined} />
              <AvatarFallback className="bg-white/10 text-white/60 text-xs">
                {userName?.charAt(0)?.toUpperCase() || "U"}
              </AvatarFallback>
            </Avatar>
          </button>
        ) : (
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 min-w-0">
              <Avatar className="h-8 w-8 flex-shrink-0">
                <AvatarImage src={avatarUrl || undefined} />
                <AvatarFallback className="bg-white/10 text-white/60 text-xs">
                  {userName?.charAt(0)?.toUpperCase() || "U"}
                </AvatarFallback>
              </Avatar>
              <span className="text-sm text-white/60 truncate">{userName || "Usuario"}</span>
            </div>
            <button
              onClick={handleLogout}
              className="text-white/30 hover:text-red-400 transition-colors p-1"
              title="Cerrar sesión"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        )}
      </SidebarFooter>
    </Sidebar>
  );
}
