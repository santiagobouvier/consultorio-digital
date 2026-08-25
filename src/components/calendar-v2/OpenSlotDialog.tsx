import { useEffect, useState } from "react";
import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import { Loader2, Plus } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Drawer, DrawerContent, DrawerTitle } from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { useIsMobile } from "@/hooks/use-mobile";
import { TimeRail } from "@/components/horarios/WeeklyTemplateEditor";
import { toHHMM } from "@/hooks/use-availability-template";

const DUR_OPTIONS = [30, 45, 60, 90];
const GROTESK = { fontFamily: "'Space Grotesk', sans-serif" } as const;

interface OpenSlotDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  businessId: string;
  /** Día que se está mirando en la agenda. */
  date: Date;
  onSaved: () => void;
}

/**
 * Abrir un cupo puntual desde la agenda: un horario suelto que la reserva
 * online ofrece ese día, sin tocar la semana tipo.
 * Bottom-sheet en celular, dialog en escritorio.
 */
export const OpenSlotDialog = ({ open, onOpenChange, businessId, date, onSaved }: OpenSlotDialogProps) => {
  const isMobile = useIsMobile();
  const [dateStr, setDateStr] = useState(() => format(date, "yyyy-MM-dd"));
  const [time, setTime] = useState(9 * 60);
  const [dur, setDur] = useState(60);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) setDateStr(format(date, "yyyy-MM-dd"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const openSlot = async () => {
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Sesión no válida");
      const { error } = await (supabase as any).from("availability_slots").insert({
        business_id: businessId,
        professional_user_id: user.id,
        date: dateStr,
        start_time: toHHMM(time),
        end_time: toHHMM(Math.min(time + dur, 23 * 60 + 59)),
        modality: "Online",
        price: null,
        notes: null,
        status: "available",
      });
      if (error) throw error;
      toast({
        title: "Cupo abierto ✓",
        description: `${format(parseISO(dateStr), "EEEE d 'de' MMMM", { locale: es })} a las ${toHHMM(time)} ya se puede reservar online.`,
      });
      onOpenChange(false);
      onSaved();
    } catch (e: any) {
      console.error(e);
      toast({ title: "Error", description: e?.message ?? "No se pudo abrir el cupo", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const body = (
    <div className="space-y-3.5 min-w-0">
      <label className="block space-y-1">
        <span className="text-xs font-medium text-muted-foreground">Día</span>
        <input
          type="date"
          value={dateStr}
          min={format(new Date(), "yyyy-MM-dd")}
          onChange={(e) => setDateStr(e.target.value)}
          className="w-full h-12 rounded-xl border border-input bg-background px-3 text-[15px] tabular-nums"
        />
      </label>

      <div className="space-y-1 min-w-0">
        <span className="text-xs font-medium text-muted-foreground">Hora</span>
        {/* min-w-0 + overflow-hidden: el riel scrollea adentro, nunca
            agranda el diálogo */}
        <div className="w-full min-w-0 overflow-hidden">
          <TimeRail value={time} onChange={setTime} />
        </div>
      </div>

      <div className="space-y-1">
        <span className="text-xs font-medium text-muted-foreground">Duración</span>
        <div className="grid grid-cols-4 gap-1.5">
          {DUR_OPTIONS.map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => setDur(d)}
              className={`h-11 rounded-xl text-sm font-semibold tabular-nums transition-colors border ${
                dur === d
                  ? "bg-primary/15 text-primary border-primary/50"
                  : "bg-background text-muted-foreground border-border"
              }`}
              style={GROTESK}
            >
              {d}’
            </button>
          ))}
        </div>
      </div>

      <Button
        type="button"
        disabled={saving}
        onClick={openSlot}
        className="w-full h-12 rounded-xl gap-2 text-[15px] font-bold"
      >
        {saving ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <>
            <Plus className="h-4 w-4" />
            Abrir cupo {toHHMM(time)}–{toHHMM(time + dur)}
          </>
        )}
      </Button>
    </div>
  );

  const title = "Abrir un cupo";
  const description = "Un horario suelto fuera de tu rutina — la reserva online lo ofrece solo ese día.";

  if (isMobile) {
    return (
      <Drawer open={open} onOpenChange={onOpenChange}>
        <DrawerContent className="max-h-[94dvh]">
          <div
            className="overflow-y-auto overflow-x-hidden px-4 pt-3"
            style={{ paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 1.5rem)" }}
          >
            <DrawerTitle className="text-lg font-bold">{title}</DrawerTitle>
            <p className="text-sm text-muted-foreground mt-1 mb-4">{description}</p>
            {body}
          </div>
        </DrawerContent>
      </Drawer>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md max-h-[88dvh] overflow-y-auto overflow-x-hidden">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        {body}
      </DialogContent>
    </Dialog>
  );
};
