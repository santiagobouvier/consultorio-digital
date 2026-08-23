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
import { supabase } from "@/integrations/supabase/client";
import { PERSONAL_CATEGORIES, type Professional } from "./types";

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
 * Referencia de colores de la agenda. Se abre sola la primera vez y el "ya la
 * vi" se guarda en la cuenta del usuario (profiles.ui_prefs), así no reaparece
 * al cambiar de dispositivo ni al limpiar datos del navegador. El botón
 * "Referencias" queda siempre disponible.
 */
export const AgendaLegend = ({ showProfessionalColors, professionals }: AgendaLegendProps) => {
  const [open, setOpen] = useState(false);
  const [autoOpened, setAutoOpened] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const check = async () => {
      try {
        // Atajo local: si este navegador ya la marcó vista, ni consultamos.
        if (localStorage.getItem(SEEN_KEY)) return;

        const { data: { user } } = await supabase.auth.getUser();
        if (!user || cancelled) return;

        const { data, error } = await (supabase as any)
          .from("profiles")
          .select("ui_prefs")
          .eq("id", user.id)
          .maybeSingle();
        if (cancelled || error) return; // ante la duda, no molestamos

        if (data?.ui_prefs?.agenda_legend_seen) {
          try { localStorage.setItem(SEEN_KEY, "1"); } catch { /* ignore */ }
          return;
        }

        setAutoOpened(true);
        setOpen(true);
      } catch {
        /* ignore: nunca abrir por un error */
      }
    };
    void check();
    return () => { cancelled = true; };
  }, []);

  const markSeen = async () => {
    try { localStorage.setItem(SEEN_KEY, "1"); } catch { /* ignore */ }
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await (supabase as any)
        .from("profiles")
        .select("ui_prefs")
        .eq("id", user.id)
        .maybeSingle();
      const prefs = { ...(data?.ui_prefs ?? {}), agenda_legend_seen: true };
      await (supabase as any)
        .from("profiles")
        .update({ ui_prefs: prefs })
        .eq("id", user.id);
    } catch {
      /* ignore: el atajo local ya evita que reaparezca en este navegador */
    }
  };

  const handleOpenChange = (o: boolean) => {
    setOpen(o);
    if (!o) {
      setAutoOpened(false);
      void markSeen();
    }
  };

  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setOpen(true)}
        className="rounded-full gap-1.5 h-7 px-2.5 text-[11px] font-medium text-muted-foreground hover:text-foreground"
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

            {/* Etiquetas de eventos personales */}
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Tus eventos personales (etiqueta con color fijo)
              </p>
              <div className="grid grid-cols-2 gap-2">
                {PERSONAL_CATEGORIES.map((c) => (
                  <div key={c.id} className="flex items-center gap-2">
                    <span
                      className="w-3.5 h-3.5 rounded-full shrink-0"
                      style={{ backgroundColor: c.color }}
                    />
                    <span className="text-sm">{c.label}</span>
                  </div>
                ))}
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
              {autoOpened ? "Entendido, no volver a mostrar" : "Entendido"}
            </Button>
            {autoOpened && (
              <p className="text-xs text-muted-foreground text-center -mt-2">
                Podés volver a verla cuando quieras con el botón "Referencias".
              </p>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};
