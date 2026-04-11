import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { Menu, X } from "lucide-react";
import { useSidebar } from "@/components/ui/sidebar";
import { useState } from "react";

interface DashboardLayoutProps {
  children: React.ReactNode;
}

function SidebarToggle() {
  const { toggleSidebar, open } = useSidebar();

  return (
    <button
      onClick={toggleSidebar}
      className="fixed top-4 left-4 z-50 w-10 h-10 rounded-xl bg-[#111]/90 backdrop-blur border border-white/10 flex items-center justify-center text-white/60 hover:text-white hover:border-white/20 transition-all duration-300 shadow-lg"
      aria-label={open ? "Cerrar menú" : "Abrir menú"}
    >
      <div className="relative w-5 h-5">
        <Menu
          className={`w-5 h-5 absolute inset-0 transition-all duration-300 ${
            open ? "opacity-0 rotate-90 scale-75" : "opacity-100 rotate-0 scale-100"
          }`}
        />
        <X
          className={`w-5 h-5 absolute inset-0 transition-all duration-300 ${
            open ? "opacity-100 rotate-0 scale-100" : "opacity-0 -rotate-90 scale-75"
          }`}
        />
      </div>
    </button>
  );
}

export function DashboardLayout({ children }: DashboardLayoutProps) {
  return (
    <SidebarProvider defaultOpen={false}>
      <div className="min-h-screen flex w-full relative">
        <AppSidebar />
        <SidebarToggle />
        <main className="flex-1 min-w-0">
          {children}
        </main>
      </div>
    </SidebarProvider>
  );
}
