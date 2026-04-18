import { useState } from "react";
import { Plus, CalendarPlus, CreditCard, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useDashboardBranding } from "@/contexts/DashboardBrandingContext";

interface MobileAgendaFabProps {
  onAddAppointment: () => void;
  onAddPayment: () => void;
}

/**
 * Floating Action Button for the mobile agenda.
 * Sits anchored to the bottom-right, ABOVE the safe-area, so it
 * never overlaps the calendar grid itself.
 */
export const MobileAgendaFab = ({ onAddAppointment, onAddPayment }: MobileAgendaFabProps) => {
  const [open, setOpen] = useState(false);
  const { primaryColor } = useDashboardBranding();
  const brandHsl = `hsl(${primaryColor})`;

  const handleAction = (fn: () => void) => {
    fn();
    setOpen(false);
  };

  return (
    <>
      {/* Backdrop when open */}
      <div
        className={cn(
          "md:hidden fixed inset-0 z-40 bg-black/40 backdrop-blur-sm transition-opacity duration-200",
          open ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
        )}
        onClick={() => setOpen(false)}
        aria-hidden
      />

      {/* FAB container — bottom-right, above safe-area */}
      <div
        className="md:hidden fixed right-4 z-50 flex flex-col items-end gap-2.5"
        style={{ bottom: "calc(env(safe-area-inset-bottom, 0px) + 1rem)" }}
      >
        {/* Action: Nuevo pago */}
        <button
          onClick={() => handleAction(onAddPayment)}
          className={cn(
            "flex items-center gap-2.5 pl-4 pr-5 h-12 rounded-full bg-[#0a0a0a] text-white border border-white/10 shadow-2xl transition-all duration-300",
            open ? "opacity-100 translate-y-0 scale-100" : "opacity-0 translate-y-4 scale-90 pointer-events-none"
          )}
          style={{ transitionDelay: open ? "60ms" : "0ms" }}
        >
          <CreditCard className="h-4 w-4" style={{ color: brandHsl }} />
          <span className="text-sm font-medium">Nuevo pago</span>
        </button>

        {/* Action: Nueva cita */}
        <button
          onClick={() => handleAction(onAddAppointment)}
          className={cn(
            "flex items-center gap-2.5 pl-4 pr-5 h-12 rounded-full bg-[#0a0a0a] text-white border border-white/10 shadow-2xl transition-all duration-300",
            open ? "opacity-100 translate-y-0 scale-100" : "opacity-0 translate-y-4 scale-90 pointer-events-none"
          )}
          style={{ transitionDelay: open ? "0ms" : "60ms" }}
        >
          <CalendarPlus className="h-4 w-4" style={{ color: brandHsl }} />
          <span className="text-sm font-medium">Nueva cita</span>
        </button>

        {/* Main FAB */}
        <button
          onClick={() => setOpen((v) => !v)}
          aria-label={open ? "Cerrar menú de creación" : "Crear cita o pago"}
          className={cn(
            "h-14 w-14 rounded-full flex items-center justify-center text-white transition-all duration-300",
            "shadow-[0_10px_30px_-5px_rgba(0,0,0,0.5)] active:scale-95"
          )}
          style={{
            background: `linear-gradient(135deg, ${brandHsl}, hsl(${primaryColor.split(" ")[0]} 100% 28%))`,
            boxShadow: `0 12px 30px -8px hsla(${primaryColor}, 0.55), 0 4px 10px -2px rgba(0,0,0,0.3)`,
          }}
        >
          <div className="relative w-6 h-6">
            <Plus
              className={cn(
                "h-6 w-6 absolute inset-0 transition-all duration-300",
                open ? "opacity-0 rotate-90 scale-50" : "opacity-100 rotate-0 scale-100"
              )}
              strokeWidth={2.5}
            />
            <X
              className={cn(
                "h-6 w-6 absolute inset-0 transition-all duration-300",
                open ? "opacity-100 rotate-0 scale-100" : "opacity-0 -rotate-90 scale-50"
              )}
              strokeWidth={2.5}
            />
          </div>
        </button>
      </div>
    </>
  );
};
