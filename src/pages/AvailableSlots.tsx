import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { ArrowLeft, Plus, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface AvailabilitySlot {
  id: string;
  date: string;
  start_time: string;
  end_time: string;
  modality: string;
  price: number | null;
  status: string;
  notes: string | null;
}

const AvailableSlots = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [slots, setSlots] = useState<AvailabilitySlot[]>([]);
  const [businessId, setBusinessId] = useState<string>("");
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    date: "",
    start_time: "",
    duration: "60",
    modality: "Online",
    price: "",
    notes: "",
  });

  useEffect(() => {
    checkAuth();
    loadSlots();
  }, []);

  const checkAuth = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      navigate("/auth");
      return;
    }

    const { data: business } = await supabase
      .from("businesses")
      .select("id")
      .eq("owner_user_id", user.id)
      .single();

    if (business) {
      setBusinessId(business.id);
    }
  };

  const loadSlots = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: business } = await supabase
        .from("businesses")
        .select("id")
        .eq("owner_user_id", user.id)
        .single();

      if (!business) return;

      const { data, error } = await supabase
        .from("availability_slots")
        .select("*")
        .eq("business_id", business.id)
        .order("date", { ascending: true })
        .order("start_time", { ascending: true });

      if (error) throw error;
      setSlots(data || []);
    } catch (error) {
      console.error("Error loading slots:", error);
      toast({
        title: "Error",
        description: "No se pudieron cargar los horarios",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const duration = parseInt(formData.duration);
      const [hours, minutes] = formData.start_time.split(":").map(Number);
      const endHours = Math.floor((hours * 60 + minutes + duration) / 60);
      const endMinutes = (minutes + duration) % 60;
      const end_time = `${String(endHours).padStart(2, "0")}:${String(endMinutes).padStart(2, "0")}`;

      const { error } = await supabase.from("availability_slots").insert({
        business_id: businessId,
        date: formData.date,
        start_time: formData.start_time,
        end_time,
        modality: formData.modality,
        price: formData.price ? parseFloat(formData.price) : null,
        notes: formData.notes || null,
        status: "available",
      });

      if (error) throw error;

      toast({
        title: "Horario agregado",
        description: "El horario está disponible para reservas",
      });

      setFormData({
        date: "",
        start_time: "",
        duration: "60",
        modality: "Online",
        price: "",
        notes: "",
      });
      setShowForm(false);
      loadSlots();
    } catch (error) {
      console.error("Error creating slot:", error);
      toast({
        title: "Error",
        description: "No se pudo agregar el horario",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleBlock = async (slotId: string) => {
    try {
      const { error } = await supabase
        .from("availability_slots")
        .update({ status: "blocked" })
        .eq("id", slotId);

      if (error) throw error;

      toast({
        title: "Horario bloqueado",
        description: "El horario ya no está disponible",
      });
      loadSlots();
    } catch (error) {
      console.error("Error blocking slot:", error);
      toast({
        title: "Error",
        description: "No se pudo bloquear el horario",
        variant: "destructive",
      });
    }
  };

  const handleDelete = async (slotId: string) => {
    try {
      const { error } = await supabase
        .from("availability_slots")
        .delete()
        .eq("id", slotId);

      if (error) throw error;

      toast({
        title: "Horario eliminado",
      });
      loadSlots();
    } catch (error) {
      console.error("Error deleting slot:", error);
      toast({
        title: "Error",
        description: "No se pudo eliminar el horario",
        variant: "destructive",
      });
    }
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, "default" | "secondary" | "destructive"> = {
      available: "default",
      reserved: "secondary",
      blocked: "destructive",
    };
    const labels: Record<string, string> = {
      available: "Disponible",
      reserved: "Reservado",
      blocked: "Bloqueado",
    };
    return <Badge variant={variants[status]}>{labels[status]}</Badge>;
  };

  return (
    <div className="min-h-screen bg-background p-4">
      <div className="container mx-auto max-w-4xl">
        <div className="mb-6 flex items-center justify-between">
          <Button variant="ghost" onClick={() => navigate("/dashboard")}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Volver
          </Button>
        </div>

        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Horarios disponibles</CardTitle>
          </CardHeader>
          <CardContent>
            <Button onClick={() => setShowForm(!showForm)} className="mb-4">
              <Plus className="mr-2 h-4 w-4" />
              {showForm ? "Cancelar" : "Agregar horario"}
            </Button>

            {showForm && (
              <form onSubmit={handleSubmit} className="space-y-4 mb-6 p-4 border rounded-lg">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="date">Fecha *</Label>
                    <Input
                      id="date"
                      type="date"
                      required
                      min={format(new Date(), "yyyy-MM-dd")}
                      value={formData.date}
                      onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="start_time">Hora de inicio *</Label>
                    <Input
                      id="start_time"
                      type="time"
                      required
                      value={formData.start_time}
                      onChange={(e) => setFormData({ ...formData, start_time: e.target.value })}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="duration">Duración (minutos) *</Label>
                    <Select value={formData.duration} onValueChange={(value) => setFormData({ ...formData, duration: value })}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="30">30 minutos</SelectItem>
                        <SelectItem value="45">45 minutos</SelectItem>
                        <SelectItem value="60">60 minutos</SelectItem>
                        <SelectItem value="90">90 minutos</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="modality">Modalidad *</Label>
                    <Select value={formData.modality} onValueChange={(value) => setFormData({ ...formData, modality: value })}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Online">Online</SelectItem>
                        <SelectItem value="Presencial">Presencial</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="price">Precio (opcional)</Label>
                    <Input
                      id="price"
                      type="number"
                      step="0.01"
                      placeholder="Ej: 1500"
                      value={formData.price}
                      onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="notes">Notas (opcional)</Label>
                  <Textarea
                    id="notes"
                    placeholder="Notas internas sobre este horario"
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    rows={2}
                  />
                </div>

                <Button type="submit" disabled={loading}>
                  {loading ? "Guardando..." : "Agregar horario"}
                </Button>
              </form>
            )}

            {loading && !showForm ? (
              <p className="text-muted-foreground">Cargando horarios...</p>
            ) : slots.length === 0 ? (
              <p className="text-muted-foreground">No hay horarios configurados aún.</p>
            ) : (
              <div className="space-y-2">
                {slots.map((slot) => (
                  <div key={slot.id} className="flex items-center justify-between p-3 border rounded-lg">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-medium">
                          {format(new Date(slot.date), "EEEE d 'de' MMMM", { locale: es })}
                        </span>
                        {getStatusBadge(slot.status)}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {slot.start_time.slice(0, 5)} - {slot.end_time.slice(0, 5)} • {slot.modality}
                        {slot.price && ` • $${slot.price}`}
                      </div>
                      {slot.notes && (
                        <div className="text-xs text-muted-foreground mt-1">{slot.notes}</div>
                      )}
                    </div>
                    {slot.status === "available" && (
                      <div className="flex gap-2">
                        <Button size="sm" variant="outline" onClick={() => handleBlock(slot.id)}>
                          Bloquear
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => handleDelete(slot.id)}>
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default AvailableSlots;
