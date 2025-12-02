import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { Calendar, Clock } from "lucide-react";

interface AvailabilitySlot {
  id: string;
  date: string;
  start_time: string;
  end_time: string;
  modality: string;
  price: number | null;
}

const PublicBooking = () => {
  const { slug } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [slots, setSlots] = useState<AvailabilitySlot[]>([]);
  const [selectedSlot, setSelectedSlot] = useState<AvailabilitySlot | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    message: "",
  });
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    loadAvailableSlots();
  }, [slug]);

  const loadAvailableSlots = async () => {
    setLoading(true);
    try {
      if (!slug) return;

      const { data, error } = await supabase.functions.invoke("public-get-availability-slots", {
        body: { slug },
      });

      if (error) {
        console.error("Error from public-get-availability-slots:", error);
        toast({
          title: "Error",
          description: "No se pudieron cargar los horarios",
          variant: "destructive",
        });
        return;
      }

      const response = data as { slots?: AvailabilitySlot[]; error?: string } | null;

      if (!response || response.error === "business_not_found") {
        toast({
          title: "Error",
          description: "No se encontró el consultorio",
          variant: "destructive",
        });
        setSlots([]);
        return;
      }

      setSlots(response.slots || []);
    } catch (error) {
      console.error("Unexpected error loading slots:", error);
      toast({
        title: "Error",
        description: "Ocurrió un error inesperado",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedSlot) {
      toast({
        title: "Error",
        description: "Debes seleccionar un horario",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);

    try {
      if (!slug) {
        toast({
          title: "Error",
          description: "No se pudo identificar el consultorio",
          variant: "destructive",
        });
        setLoading(false);
        return;
      }

      const { error } = await supabase.functions.invoke("public-create-appointment-request", {
        body: {
          slug,
          slotId: selectedSlot.id,
          name: formData.name,
          email: formData.email,
          phone: formData.phone,
          message: formData.message,
        },
      });

      if (error) {
        console.error("Error from edge function:", error);
        throw error;
      }

      setSubmitted(true);
      toast({
        title: "Cita reservada",
        description: "Tu cita ha sido confirmada",
      });
    } catch (error) {
      console.error("Error submitting request:", error);
      toast({
        title: "Error",
        description: "No se pudo realizar la reserva",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const getWhatsAppLink = () => {
    if (!selectedSlot) return "";
    const formattedDate = format(new Date(selectedSlot.date), "dd/MM/yyyy", { locale: es });
    const formattedTime = selectedSlot.start_time.slice(0, 5);
    const message = `Hola, soy ${formData.name}. Reservé una cita para ${formattedDate} a las ${formattedTime}.`;
    return `https://wa.me/?text=${encodeURIComponent(message)}`;
  };

  if (submitted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="max-w-md w-full">
          <CardHeader>
            <CardTitle>¡Cita confirmada!</CardTitle>
            <CardDescription>
              Tu cita ha sido reservada exitosamente.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {selectedSlot && (
              <div className="p-4 bg-muted rounded-lg">
                <p className="font-medium">
                  {format(new Date(selectedSlot.date), "EEEE d 'de' MMMM", { locale: es })}
                </p>
                <p className="text-sm text-muted-foreground">
                  {selectedSlot.start_time.slice(0, 5)} - {selectedSlot.end_time.slice(0, 5)} • {selectedSlot.modality}
                </p>
              </div>
            )}
            <Button 
              onClick={() => window.open(getWhatsAppLink(), "_blank")}
              className="w-full"
              variant="outline"
            >
              Contactar por WhatsApp
            </Button>
            <Button 
              onClick={() => navigate(`/consultorio/${slug}`)}
              className="w-full"
              variant="secondary"
            >
              Volver al consultorio
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (selectedSlot) {
    return (
      <div className="min-h-screen bg-background p-4 py-12">
        <div className="container mx-auto max-w-2xl">
          <Button variant="ghost" onClick={() => setSelectedSlot(null)} className="mb-4">
            ← Volver a horarios
          </Button>
          <Card>
            <CardHeader>
              <CardTitle>Completá tus datos</CardTitle>
              <CardDescription>
                Has seleccionado: {format(new Date(selectedSlot.date), "EEEE d 'de' MMMM", { locale: es })} a las {selectedSlot.start_time.slice(0, 5)}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Nombre completo *</Label>
                  <Input
                    id="name"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="email">Email *</Label>
                  <Input
                    id="email"
                    type="email"
                    required
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="phone">WhatsApp *</Label>
                  <Input
                    id="phone"
                    type="tel"
                    required
                    placeholder="Ej: +598 99 123 456"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="message">Motivo o consulta</Label>
                  <Textarea
                    id="message"
                    value={formData.message}
                    onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                    rows={4}
                  />
                </div>

                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setSelectedSlot(null)}
                    className="flex-1"
                  >
                    Cancelar
                  </Button>
                  <Button type="submit" disabled={loading} className="flex-1">
                    {loading ? "Confirmando..." : "Confirmar cita"}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-4 py-12">
      <div className="container mx-auto max-w-2xl">
        <Button variant="ghost" onClick={() => navigate(`/consultorio/${slug}`)} className="mb-4">
          ← Volver al consultorio
        </Button>
        <Card>
          <CardHeader>
            <CardTitle>Reservar una cita</CardTitle>
            <CardDescription>
              Seleccioná un horario disponible
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <p className="text-muted-foreground">Cargando horarios disponibles...</p>
            ) : slots.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-muted-foreground mb-4">
                  Por el momento no hay horarios disponibles.
                </p>
                <p className="text-sm text-muted-foreground">
                  Por favor, volvé a intentar más tarde o contactá por WhatsApp.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {slots.map((slot) => (
                  <button
                    key={slot.id}
                    onClick={() => setSelectedSlot(slot)}
                    className="w-full p-4 border rounded-lg hover:border-primary hover:bg-accent transition-colors text-left"
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <Calendar className="h-4 w-4 text-muted-foreground" />
                          <span className="font-medium">
                            {format(new Date(slot.date), "EEEE d 'de' MMMM", { locale: es })}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Clock className="h-4 w-4" />
                          {slot.start_time.slice(0, 5)} - {slot.end_time.slice(0, 5)}
                        </div>
                        <div className="flex items-center gap-2 mt-2">
                          <span className="text-xs px-2 py-1 bg-muted rounded">
                            {slot.modality}
                          </span>
                          {slot.price && (
                            <span className="text-xs px-2 py-1 bg-muted rounded">
                              ${slot.price}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="text-sm text-primary">
                        Seleccionar →
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default PublicBooking;
