import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { DOC_TYPE_ICONS, type BusinessDocType } from "@/lib/document-types";

// Crear un tipo de documento propio del consultorio: nombre + ícono.
// Queda disponible en todo el sistema (subida, filtros, expediente).

interface CreateDocTypeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  businessId: string;
  /** Se llama con el tipo recién creado (para seleccionarlo al toque). */
  onCreated: (type: BusinessDocType) => void;
}

export const CreateDocTypeDialog = ({ open, onOpenChange, businessId, onCreated }: CreateDocTypeDialogProps) => {
  const [label, setLabel] = useState("");
  const [icon, setIcon] = useState("folder");
  const [saving, setSaving] = useState(false);

  const save = async () => {
    const clean = label.trim();
    if (!clean) {
      toast({ title: "Poné un nombre", description: "Ej: Radiografía, Receta, Test...", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const { data, error } = await supabase
        .from("business_document_types")
        .insert({ business_id: businessId, label: clean, icon })
        .select("id, label, icon")
        .single();
      if (error) throw error;
      toast({ title: "Tipo creado ✓", description: `"${clean}" ya está disponible en todo el sistema.` });
      setLabel("");
      setIcon("folder");
      onOpenChange(false);
      onCreated(data as BusinessDocType);
    } catch (err) {
      console.error("Error creando tipo de documento:", err);
      toast({ title: "Error", description: "No se pudo crear el tipo", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !saving && onOpenChange(o)}>
      <DialogContent className="max-w-md max-h-[90dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Nuevo tipo de documento</DialogTitle>
          <DialogDescription>
            Creá los tipos que usa tu especialidad — radiografías, recetas, tests...
            Quedan disponibles para todos tus pacientes.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Nombre *</Label>
            <Input
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="Ej: Radiografía"
              maxLength={40}
              className="h-11 rounded-xl"
              autoFocus
            />
          </div>
          <div className="space-y-1.5">
            <Label>Ícono</Label>
            <div className="grid grid-cols-5 gap-2">
              {Object.entries(DOC_TYPE_ICONS).map(([key, Icon]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setIcon(key)}
                  className={cn(
                    "h-11 rounded-xl border flex items-center justify-center transition-colors",
                    icon === key
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border/60 text-muted-foreground hover:border-primary/40 hover:text-foreground"
                  )}
                  aria-label={key}
                >
                  <Icon className="h-5 w-5" />
                </button>
              ))}
            </div>
          </div>
        </div>
        <DialogFooter className="flex-col-reverse sm:flex-row gap-2">
          <Button variant="outline" className="rounded-xl w-full sm:w-auto" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancelar
          </Button>
          <Button className="rounded-xl w-full sm:w-auto" onClick={save} disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : null}
            Crear tipo
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default CreateDocTypeDialog;
