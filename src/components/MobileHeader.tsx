import { Menu, X } from "lucide-react";
import { useSidebar } from "@/components/ui/sidebar";

export function MobileHeader() {
  const { toggleSidebar, open } = useSidebar();

  return (
    <header className="sticky top-0 z-40 flex items-center h-12 px-3 bg-[#0a0a0a]/95 backdrop-blur-md border-b border-white/[0.06] md:hidden">
      <button
        onClick={toggleSidebar}
        className="w-9 h-9 rounded-lg bg-white/[0.04] border border-white/[0.08] flex items-center justify-center text-white/50 hover:text-white hover:border-white/15 transition-all duration-300"
        aria-label={open ? "Cerrar menú" : "Abrir menú"}
      >
        <div className="relative w-4 h-4">
          <Menu
            className={`w-4 h-4 absolute inset-0 transition-all duration-300 ${
              open ? "opacity-0 rotate-90 scale-75" : "opacity-100 rotate-0 scale-100"
            }`}
          />
          <X
            className={`w-4 h-4 absolute inset-0 transition-all duration-300 ${
              open ? "opacity-100 rotate-0 scale-100" : "opacity-0 -rotate-90 scale-75"
            }`}
          />
        </div>
      </button>
      
      <div className="flex-1 flex justify-center">
        <span className="text-xs font-medium text-white/40 tracking-wide">
          Consultorio Digital
        </span>
      </div>

      {/* Spacer to balance the hamburger */}
      <div className="w-9" />
    </header>
  );
}
