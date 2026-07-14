import { useEffect, useState } from "react";
import { Palette, CreditCard } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { Professional } from "./types";

const SEEN_KEY = "agenda_legend_seen_v1";

interface AgendaLegendProps {
  showProfessionalColors: boolean;
  professionals: Professional[];
}

const Chip = ({ swatchClass, label }: { swatchClass: string; label: string }) => (
  <div className="flex items-center gap-2">
    <span className={`w-3.5 h-3.5 rounded-full shrink-0 ${swatchClass}`} />
    <span className="text-sm">{label}</span>
  </div>
);

/**
 * Referencia de colores de la agenda. Se abre sola la primera vez que el
 * profesional entra (y nunca más); después queda el botón "Referencias".
 */
export const AgendaLegend = ({ showProfessionalColors, professionals }: AgendaLegendProps) => {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    try {
      if (!localStorage.getItem(SEEN_KEY)) {
        setOpen(true);
      }
    } catch {
      /* ignore */
    }
  }, []);

  const handleOpenChange = (o: boolean) => {
    setOpen(o);
    if (!o) {
      try {
        localStorage.setItem(SEEN_KEY, "1");
      } catch {
        /* ignore */
      }
    }
  };

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={() => setOpen(true)}
        className="rounded-xl gap-2 h-8 text-xs"
      >
        <Palette className="h-3.5 w-3.5" />
        Referencias
      </Button>

      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Cómo leer tu agenda</DialogTitle>
            <DialogDescription>
              Los colores te cuentan todo de un vistazo.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-5 pt-1">
            {/* Estado de la cita */}
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Estado de la cita (color de la tarjeta)
              </p>
              <div className="grid grid-cols-2 gap-2">
                <Chip swatchClass="bg-primary" label="Confirmada" />
                <Chip swatchClass="bg-amber-500" label="Pendiente de confirmar" />
                <Chip swatchClass="bg-yellow-400" label="Pidió reprogramar" />
                <Chip swatchClass="bg-rose-500" label="Cancelada por paciente" />
                <Chip swatchClass="bg-muted-foreground/40" label="Pasada / cancelada" />
              </div>
            </div>

            {/* Pagos */}
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Pagos del paciente (puntito en la cita)
              </p>
              <div className="grid grid-cols-2 gap-2">
                <Chip swatchClass="bg-emerald-500" label="Al día" />
                <Chip swatchClass="bg-amber-500" label="Pago por vencer" />
                <Chip swatchClass="bg-rose-500" label="Pago vencido" />
              </div>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <CreditCard className="h-4 w-4 shrink-0" />
                Las tarjetitas con este ícono son vencimientos de pago de ese día.
              </div>
            </div>

            {/* Profesionales */}
            {showProfessionalColors && professionals.length > 1 && (
              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Profesionales (borde de color)
                </p>
                <div className="grid grid-cols-2 gap-2">
                  {professionals.map((p) => (
                    <div key={p.id} className="flex items-center gap-2">
                      <span
                        className="w-3.5 h-3.5 rounded-full shrink-0"
                        style={{ backgroundColor: p.color }}
                      />
                      <span className="text-sm truncate">{p.name}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <Button onClick={() => handleOpenChange(false)} className="w-full rounded-xl">
              Entendido
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};
