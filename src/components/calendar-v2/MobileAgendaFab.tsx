import { useState } from "react";
import { Plus } from "lucide-react";
import { useDashboardBranding } from "@/contexts/DashboardBrandingContext";
import { NewActionDialog } from "./NewActionDialog";

interface MobileAgendaFabProps {
  onAddAppointment: () => void;
  onAddPayment: () => void;
  onAddPersonal?: () => void;
  onQuickBlock?: () => void;
  onOpenSlot?: () => void;
  /** En vista día: todo lo creado queda fijo para ese día. */
  fixedDateLabel?: string | null;
}

/**
 * Botón flotante de la agenda en mobile. Al tocarlo abre el selector con
 * dos tarjetas grandes (cita / pago) — reemplaza los botoncitos satélite
 * que eran difíciles de acertar.
 */
export const MobileAgendaFab = ({ onAddAppointment, onAddPayment, onAddPersonal, onQuickBlock, onOpenSlot, fixedDateLabel }: MobileAgendaFabProps) => {
  const [open, setOpen] = useState(false);
  const { primaryColor } = useDashboardBranding();
  const brandHsl = `hsl(${primaryColor})`;

  return (
    <>
      <div
        className="md:hidden fixed right-5 z-50"
        style={{ bottom: "calc(env(safe-area-inset-bottom, 0px) + 1.25rem)" }}
      >
        <button
          onClick={() => setOpen(true)}
          aria-label="Crear"
          className="h-14 w-14 rounded-full flex items-center justify-center text-white transition-all duration-300 ease-out active:scale-90"
          style={{
            background: brandHsl,
            boxShadow: `0 12px 28px -8px hsla(${primaryColor}, 0.6), 0 3px 8px rgba(0,0,0,0.28)`,
          }}
        >
          <Plus className="h-6 w-6" strokeWidth={2.4} />
        </button>
      </div>

      <NewActionDialog
        open={open}
        onOpenChange={setOpen}
        onAddAppointment={onAddAppointment}
        onAddPayment={onAddPayment}
        onAddPersonal={onAddPersonal}
        onQuickBlock={onQuickBlock}
        onOpenSlot={onOpenSlot}
        fixedDateLabel={fixedDateLabel}
      />
    </>
  );
};
