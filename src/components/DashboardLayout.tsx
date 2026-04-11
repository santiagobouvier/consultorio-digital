import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { useIsMobile } from "@/hooks/use-mobile";
import { Menu } from "lucide-react";

interface DashboardLayoutProps {
  children: React.ReactNode;
}

export function DashboardLayout({ children }: DashboardLayoutProps) {
  const isMobile = useIsMobile();

  return (
    <SidebarProvider defaultOpen={!isMobile}>
      <div className="min-h-screen flex w-full bg-[hsl(180,15%,4%)]">
        <AppSidebar />
        <div className="flex-1 flex flex-col min-w-0">
          {/* Mobile header with trigger */}
          <header className="h-12 flex items-center border-b border-white/5 px-4 lg:hidden">
            <SidebarTrigger className="text-white/50 hover:text-white">
              <Menu className="h-5 w-5" />
            </SidebarTrigger>
          </header>
          <main className="flex-1 overflow-auto">
            {children}
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
