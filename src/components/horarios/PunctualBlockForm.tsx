import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

interface Props {
  businessId: string;
  professionalUserId: string;
  onCreated: () => void;
}

export const PunctualBlockForm = ({ businessId, professionalUserId, onCreated }: Props) => {
  const [date, setDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("13:00");
  const [duration, setDuration] = useState("60");
  const [modality, setModality] = useState("Online");
  const [price, setPrice] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  const computeSlots = () => {
    if (!startTime || !endTime || startTime >= endTime) return 0;
    const [sh, sm] = startTime.split(":").map(Number);
    const [eh, em] = endTime.split(":").map(Number);
    const total = (eh * 60 + em) - (sh * 60 + sm);
    return Math.floor(total / parseInt(duration));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (startTime >= endTime) {
      toast({ title: "Rango inválido", description: "La hora de inicio debe ser anterior al fin", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const slots: any[] = [];
      const dur = parseInt(duration);
      const [sh, sm] = startTime.split(":").map(Number);
      const [eh, em] = endTime.split(":").map(Number);
      const startMin = sh * 60 + sm;
      const endMin = eh * 60 + em;

      for (let m = startMin; m + dur <= endMin; m += dur) {
        const h1 = Math.floor(m / 60), mi1 = m % 60;
        const h2 = Math.floor((m + dur) / 60), mi2 = (m + dur) % 60;
        slots.push({
          business_id: businessId,
          professional_user_id: professionalUserId,
          date,
          start_time: `${String(h1).padStart(2, "0")}:${String(mi1).padStart(2, "0")}`,
          end_time: `${String(h2).padStart(2, "0")}:${String(mi2).padStart(2, "0")}`,
          modality,
          price: price ? parseFloat(price) : null,
          notes: notes || null,
          status: "available",
        });
      }

      if (slots.length === 0) {
        toast({ title: "Sin slots", description: "El rango no genera ningún slot con esa duración", variant: "destructive" });
        return;
      }

      const { error } = await (supabase as any).from("availability_slots").insert(slots);
      if (error) throw error;

      toast({ title: "Bloque creado", description: `${slots.length} slots agregados` });
      setNotes("");
      onCreated();
    } catch (e: any) {
      console.error(e);
      toast({ title: "Error", description: e?.message ?? "No se pudo crear el bloque", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const slotsCount = computeSlots();

  return (
    <Card>
      <CardHeader>
        <CardTitle>Bloque puntual</CardTitle>
        <CardDescription>
          Cargá un bloque (ej: martes 14-20) y el sistema lo divide automáticamente en slots según la duración.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Fecha</Label>
              <Input type="date" required min={format(new Date(), "yyyy-MM-dd")} value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Hora inicio</Label>
              <Input type="time" required value={startTime} onChange={(e) => setStartTime(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Hora fin</Label>
              <Input type="time" required value={endTime} onChange={(e) => setEndTime(e.target.value)} />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Duración del slot</Label>
              <Select value={duration} onValueChange={setDuration}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="30">30 min</SelectItem>
                  <SelectItem value="45">45 min</SelectItem>
                  <SelectItem value="60">60 min</SelectItem>
                  <SelectItem value="90">90 min</SelectItem>
                  <SelectItem value="120">120 min</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Modalidad</Label>
              <Select value={modality} onValueChange={setModality}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Online">Online</SelectItem>
                  <SelectItem value="Presencial">Presencial</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Precio (opcional)</Label>
              <Input type="number" step="0.01" placeholder="Ej: 1500" value={price} onChange={(e) => setPrice(e.target.value)} />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Notas (opcional)</Label>
            <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Notas internas" />
          </div>

          <div className="flex items-center justify-between p-3 bg-muted/40 rounded-lg">
            <span className="text-sm">Se generarán <strong className="text-primary">{slotsCount}</strong> slots</span>
            <Button type="submit" disabled={saving || slotsCount === 0}>
              {saving ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Creando...</> : <><Plus className="h-4 w-4 mr-2" /> Crear bloque</>}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
};
