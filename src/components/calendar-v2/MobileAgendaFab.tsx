import { useState } from "react";
import { Plus, CalendarPlus, CreditCard, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useDashboardBranding } from "@/contexts/DashboardBrandingContext";

interface MobileAgendaFabProps {
  onAddAppointment: () => void;
  onAddPayment: () => void;
}

/**
 * Minimal floating action button for the mobile agenda.
 * - Anchored bottom-right, above safe-area
 * - No text labels — pure iconography
 * - Brand-colored circular satellites that fan out on open
 */
export const MobileAgendaFab = ({ onAddAppointment, onAddPayment }: MobileAgendaFabProps) => {
  const [open, setOpen] = useState(false);
  const { primaryColor } = useDashboardBranding();
  const brandHsl = `hsl(${primaryColor})`;

  const handleAction = (fn: () => void) => {
    fn();
    setOpen(false);
  };

  const satelliteBase =
    "h-12 w-12 rounded-full flex items-center justify-center text-white transition-all duration-300 ease-out active:scale-90";
  const satelliteStyle = {
    background: brandHsl,
    boxShadow: `0 8px 22px -6px hsla(${primaryColor}, 0.55), 0 2px 6px rgba(0,0,0,0.25)`,
  };

  return (
    <>
      {/* Backdrop */}
      <div
        className={cn(
          "md:hidden fixed inset-0 z-40 bg-black/30 backdrop-blur-[2px] transition-opacity duration-200",
          open ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
        )}
        onClick={() => setOpen(false)}
        aria-hidden
      />

      {/* FAB stack */}
      <div
        className="md:hidden fixed right-5 z-50 flex flex-col items-center gap-3"
        style={{ bottom: "calc(env(safe-area-inset-bottom, 0px) + 1.25rem)" }}
      >
        {/* Satellite: Nuevo pago */}
        <button
          onClick={() => handleAction(onAddPayment)}
          aria-label="Nuevo pago"
          className={cn(
            satelliteBase,
            open ? "opacity-100 translate-y-0 scale-100" : "opacity-0 translate-y-3 scale-75 pointer-events-none"
          )}
          style={{ ...satelliteStyle, transitionDelay: open ? "80ms" : "0ms" }}
        >
          <CreditCard className="h-5 w-5" strokeWidth={2.2} />
        </button>

        {/* Satellite: Nueva cita */}
        <button
          onClick={() => handleAction(onAddAppointment)}
          aria-label="Nueva cita"
          className={cn(
            satelliteBase,
            open ? "opacity-100 translate-y-0 scale-100" : "opacity-0 translate-y-3 scale-75 pointer-events-none"
          )}
          style={{ ...satelliteStyle, transitionDelay: open ? "0ms" : "80ms" }}
        >
          <CalendarPlus className="h-5 w-5" strokeWidth={2.2} />
        </button>

        {/* Main FAB — minimal, brand-colored */}
        <button
          onClick={() => setOpen((v) => !v)}
          aria-label={open ? "Cerrar" : "Crear"}
          className="h-14 w-14 rounded-full flex items-center justify-center text-white transition-all duration-300 ease-out active:scale-90"
          style={{
            background: brandHsl,
            boxShadow: `0 12px 28px -8px hsla(${primaryColor}, 0.6), 0 3px 8px rgba(0,0,0,0.28)`,
          }}
        >
          <div className="relative w-6 h-6">
            <Plus
              className={cn(
                "h-6 w-6 absolute inset-0 transition-all duration-300",
                open ? "opacity-0 rotate-90 scale-50" : "opacity-100 rotate-0 scale-100"
              )}
              strokeWidth={2.4}
            />
            <X
              className={cn(
                "h-6 w-6 absolute inset-0 transition-all duration-300",
                open ? "opacity-100 rotate-0 scale-100" : "opacity-0 -rotate-90 scale-50"
              )}
              strokeWidth={2.4}
            />
          </div>
        </button>
      </div>
    </>
  );
};
