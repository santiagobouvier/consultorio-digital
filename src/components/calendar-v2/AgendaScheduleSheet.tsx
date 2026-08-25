import { useState } from "react";
import { Loader2 } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { toast } from "@/hooks/use-toast";
import { useAvailabilityTemplate } from "@/hooks/use-availability-template";
import { WeeklyTemplateEditor } from "@/components/horarios/WeeklyTemplateEditor";

interface AgendaScheduleSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  businessId: string;
  professionalUserId: string | null;
  /** Después de guardar: refrescar cupos y agenda. */
  onSaved: () => void;
}

/**
 * "Mis horarios" sin salir de la agenda: el editor de cupos de la semana
 * tipo en un panel deslizante. Configurás la rutina donde la ves.
 */
export const AgendaScheduleSheet = ({
  open,
  onOpenChange,
  businessId,
  professionalUserId,
  onSaved,
}: AgendaScheduleSheetProps) => {
  const { template, setTemplate, loading, save } = useAvailabilityTemplate(
    open ? businessId : null,
    open ? professionalUserId : null
  );
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!template) return;
    setSaving(true);
    try {
      await save(template);
      toast({
        title: "Semana guardada",
        description: "Tu disponibilidad ya está al día en la web pública y el portal.",
      });
      onSaved();
      onOpenChange(false);
    } catch (e: any) {
      console.error(e);
      toast({ title: "Error", description: e?.message ?? "No se pudo guardar", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-xl overflow-y-auto p-4 sm:p-6">
        <SheetHeader className="text-left mb-4">
          <SheetTitle>Mis horarios</SheetTitle>
          <SheetDescription>
            Tu semana tipo, sesión por sesión. Los cambios se reflejan al guardar.
          </SheetDescription>
        </SheetHeader>
        {loading || !template ? (
          <div className="py-16 flex items-center justify-center text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin mr-2" /> Cargando...
          </div>
        ) : (
          <WeeklyTemplateEditor
            template={template}
            onChange={setTemplate}
            onSave={handleSave}
            saving={saving}
          />
        )}
      </SheetContent>
    </Sheet>
  );
};
