import { useState } from "react";
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

const PublicBooking = () => {
  const { slug } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    message: "",
    date: "",
    time: "",
  });
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    setLoading(true);

    try {
      const requestedDatetime = new Date(`${formData.date}T${formData.time}`);

      if (requestedDatetime <= new Date()) {
        toast({
          title: "Error",
          description: "La fecha y hora deben ser futuras",
          variant: "destructive",
        });
        setLoading(false);
        return;
      }

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
          name: formData.name,
          email: formData.email,
          phone: formData.phone,
          message: formData.message,
          requestedDatetime: requestedDatetime.toISOString(),
        },
      });

      if (error) {
        console.error("Error from edge function:", error);
        throw error;
      }

      setSubmitted(true);
      toast({
        title: "Solicitud enviada",
        description: "La profesional se comunicará contigo para confirmar",
      });
    } catch (error) {
      console.error("Error submitting request:", error);
      toast({
        title: "Error",
        description: "No se pudo enviar la solicitud",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const getWhatsAppLink = () => {
    const datetime = new Date(`${formData.date}T${formData.time}`);
    const formattedDate = format(datetime, "dd/MM/yyyy", { locale: es });
    const formattedTime = format(datetime, "HH:mm", { locale: es });
    const message = `Hola, soy ${formData.name}. Solicité una cita para ${formattedDate} a las ${formattedTime}.`;
    return `https://wa.me/?text=${encodeURIComponent(message)}`;
  };

  if (submitted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="max-w-md w-full">
          <CardHeader>
            <CardTitle>¡Solicitud enviada!</CardTitle>
            <CardDescription>
              La profesional se comunicará contigo para confirmar tu cita.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
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

  return (
    <div className="min-h-screen bg-background p-4 py-12">
      <div className="container mx-auto max-w-2xl">
        <Card>
          <CardHeader>
            <CardTitle>Solicitar una cita</CardTitle>
            <CardDescription>
              Completa el formulario y la profesional se comunicará contigo para confirmar
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
                <Label htmlFor="phone">Teléfono *</Label>
                <Input
                  id="phone"
                  type="tel"
                  required
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="date">Fecha deseada *</Label>
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
                <Label htmlFor="time">Hora deseada *</Label>
                <Input
                  id="time"
                  type="time"
                  required
                  value={formData.time}
                  onChange={(e) => setFormData({ ...formData, time: e.target.value })}
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
                  onClick={() => navigate(`/consultorio/${slug}`)}
                  className="flex-1"
                >
                  Cancelar
                </Button>
                <Button type="submit" disabled={loading} className="flex-1">
                  {loading ? "Enviando..." : "Solicitar cita"}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default PublicBooking;
