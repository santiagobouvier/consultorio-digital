import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/hooks/use-toast";
import { Send, CheckCircle2 } from "lucide-react";
import LoadingPage from "@/components/LoadingPage";

const PublicClinic = () => {
  const { slug } = useParams();
  const [loading, setLoading] = useState(true);
  const [clinicData, setClinicData] = useState<any>(null);
  const [businessId, setBusinessId] = useState<string | null>(null);
  const [showRequestForm, setShowRequestForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    message: "",
  });

  useEffect(() => {
    loadClinicData();
  }, [slug]);

  const loadClinicData = async () => {
    try {
      setLoading(true);
      
      // Get business data
      const { data: business, error: businessError } = await supabase
        .from("businesses")
        .select("id, owner_user_id, name, specialty")
        .eq("public_slug", slug)
        .maybeSingle();

      if (businessError) throw businessError;
      if (!business) {
        setLoading(false);
        return;
      }

      setBusinessId(business.id);

      // Get clinic settings
      const { data: settings } = await supabase
        .from("clinic_settings")
        .select("*")
        .eq("user_id", business.owner_user_id)
        .maybeSingle();

      setClinicData({
        ...settings,
        business_name: business.name,
        business_specialty: business.specialty,
      });
    } catch (error) {
      console.error("Error loading clinic:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!businessId) {
      toast({
        title: "Error",
        description: "No se pudo identificar el consultorio",
        variant: "destructive",
      });
      return;
    }

    setSubmitting(true);

    try {
      // Get the owner_user_id for the clinic_user_id field
      const { data: business } = await supabase
        .from("businesses")
        .select("owner_user_id")
        .eq("id", businessId)
        .single();

      if (!business) throw new Error("Business not found");

      // Create appointment request with a placeholder datetime
      const { error } = await supabase
        .from("appointment_requests")
        .insert({
          clinic_user_id: business.owner_user_id,
          name: formData.name,
          email: formData.email,
          phone: formData.phone,
          message: formData.message,
          requested_datetime: new Date().toISOString(),
          status: "pending",
        });

      if (error) throw error;

      setSubmitted(true);
      toast({
        title: "Solicitud enviada",
        description: "El consultorio recibirá tu solicitud y se pondrá en contacto contigo.",
      });
    } catch (error) {
      console.error("Error submitting request:", error);
      toast({
        title: "Error",
        description: "No se pudo enviar la solicitud. Intenta nuevamente.",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return <LoadingPage />;
  }

  if (!businessId) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6 text-center">
            <p className="text-muted-foreground">Consultorio no encontrado</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Show default content if no clinic settings exist yet
  const displayData = clinicData || {
    clinic_name: "Consultorio",
    specialty: null,
    welcome_message: "Bienvenido a nuestro consultorio. Estamos aquí para ayudarte.",
    logo_url: null,
    cover_image_url: null,
  };

  const clinicName = displayData.clinic_name || displayData.business_name || "Consultorio";
  const specialty = displayData.specialty || displayData.business_specialty;

  if (submitted) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6 text-center space-y-4">
            <CheckCircle2 className="h-16 w-16 text-green-500 mx-auto" />
            <h2 className="text-xl font-semibold">¡Solicitud enviada!</h2>
            <p className="text-muted-foreground">
              Hemos recibido tu solicitud. El consultorio revisará tu mensaje y se pondrá en contacto contigo pronto.
            </p>
            <Button variant="outline" onClick={() => {
              setSubmitted(false);
              setShowRequestForm(false);
              setFormData({ name: "", email: "", phone: "", message: "" });
            }}>
              Volver al inicio
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Cover Image */}
      {displayData.cover_image_url && (
        <div 
          className="h-64 bg-cover bg-center"
          style={{ backgroundImage: `url(${displayData.cover_image_url})` }}
        />
      )}

      {/* Main Content */}
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        {/* Logo and Header */}
        <div className={`flex flex-col items-center text-center mb-8 ${displayData.cover_image_url ? '-mt-16' : ''}`}>
          {displayData.logo_url && (
            <img 
              src={displayData.logo_url} 
              alt="Logo"
              className="w-32 h-32 rounded-full border-4 border-background shadow-lg mb-4 object-cover"
            />
          )}
          <h1 className="text-4xl font-bold text-foreground mb-2">
            {clinicName}
          </h1>
          {specialty && (
            <p className="text-xl text-muted-foreground">
              {specialty}
            </p>
          )}
        </div>

        {/* Welcome Message */}
        <Card className="mb-8">
          <CardContent className="pt-6">
            <p className="text-foreground whitespace-pre-wrap">
              {displayData.welcome_message}
            </p>
          </CardContent>
        </Card>

        {/* Request Consultation Section */}
        {!showRequestForm ? (
          <div className="flex justify-center">
            <Button 
              size="lg"
              onClick={() => setShowRequestForm(true)}
              className="gap-2"
            >
              <Send className="h-5 w-5" />
              Solicitar consulta
            </Button>
          </div>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle>Solicitar una consulta</CardTitle>
              <CardDescription>
                Completá tus datos y el consultorio se pondrá en contacto contigo para coordinar una cita.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmitRequest} className="space-y-4">
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
                  <Label htmlFor="phone">Teléfono / WhatsApp *</Label>
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
                  <Label htmlFor="message">Motivo de la consulta</Label>
                  <Textarea
                    id="message"
                    value={formData.message}
                    onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                    placeholder="Contanos brevemente el motivo de tu consulta..."
                    rows={4}
                  />
                </div>

                <div className="flex gap-2 pt-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setShowRequestForm(false)}
                    className="flex-1"
                  >
                    Cancelar
                  </Button>
                  <Button type="submit" disabled={submitting} className="flex-1">
                    {submitting ? "Enviando..." : "Enviar solicitud"}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        )}

        {/* Info notice */}
        <p className="text-center text-sm text-muted-foreground mt-8">
          ¿Ya sos paciente del consultorio? <a href="/auth" className="text-primary hover:underline">Iniciá sesión</a> para ver tu agenda y reservar citas.
        </p>
      </div>
    </div>
  );
};

export default PublicClinic;