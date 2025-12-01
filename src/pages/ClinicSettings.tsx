import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/hooks/use-toast";
import { ArrowLeft, Save, Copy, ExternalLink } from "lucide-react";

const DEFAULT_TEMPLATES = {
  reminder: "Hola {{paciente}}, te recuerdo tu sesión del {{fecha}} a las {{hora}}. Modalidad: {{modalidad}}. {{link}}. Cualquier cosa me escribís por acá.",
  confirmation: "Hola {{paciente}}, confirmo tu sesión del {{fecha}} a las {{hora}}. Modalidad: {{modalidad}}. {{link}}. Te espero!",
  postsession: "Hola {{paciente}}, gracias por tu sesión de hoy. Quedamos en contacto para la próxima. Saludos!"
};

const ClinicSettings = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [settingsId, setSettingsId] = useState<string | null>(null);
  
  const [clinicName, setClinicName] = useState("");
  const [specialty, setSpecialty] = useState("");
  const [welcomeMessage, setWelcomeMessage] = useState("");
  const [reminderMessage, setReminderMessage] = useState(DEFAULT_TEMPLATES.reminder);
  const [confirmationMessage, setConfirmationMessage] = useState(DEFAULT_TEMPLATES.confirmation);
  const [postsessionMessage, setPostsessionMessage] = useState(DEFAULT_TEMPLATES.postsession);
  const [logoUrl, setLogoUrl] = useState("");
  const [coverImageUrl, setCoverImageUrl] = useState("");
  const [autoAcceptBookings, setAutoAcceptBookings] = useState(false);
  const [publicSlug, setPublicSlug] = useState("");

  useEffect(() => {
    checkAuth();
    loadSettings();
  }, []);

  const checkAuth = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      navigate("/auth");
    }
  };

  const loadSettings = async () => {
    try {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Load or create business slug
      let { data: business } = await supabase
        .from("businesses")
        .select("public_slug")
        .eq("owner_user_id", user.id)
        .maybeSingle();

      // If no business exists, create one
      if (!business) {
        const slug = user.id.slice(0, 8); // Use first 8 chars of user ID as default slug
        const { data: newBusiness, error: createError } = await supabase
          .from("businesses")
          .insert({
            owner_user_id: user.id,
            public_slug: slug,
            name: "Mi Consultorio",
            contact_email: user.email || "",
            timezone: "America/Montevideo"
          })
          .select("public_slug")
          .single();

        if (createError) {
          console.error("Error creating business:", createError);
          toast({
            title: "Error",
            description: "No se pudo crear el consultorio",
            variant: "destructive"
          });
          return;
        }

        business = newBusiness;
      }

      if (business) {
        setPublicSlug(business.public_slug);
      }

      const { data: settings, error } = await supabase
        .from("clinic_settings")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();

      if (error) {
        console.error("Error loading settings:", error);
        return;
      }

      if (settings) {
        setSettingsId(settings.id);
        setClinicName(settings.clinic_name || "");
        setSpecialty(settings.specialty || "");
        setWelcomeMessage(settings.welcome_message || "");
        setReminderMessage(settings.default_reminder_message || DEFAULT_TEMPLATES.reminder);
        setConfirmationMessage(settings.default_confirmation_message || DEFAULT_TEMPLATES.confirmation);
        setPostsessionMessage(settings.default_postsession_message || DEFAULT_TEMPLATES.postsession);
        setLogoUrl(settings.logo_url || "");
        setCoverImageUrl(settings.cover_image_url || "");
        setAutoAcceptBookings(settings.auto_accept_bookings || false);
      }
    } catch (error) {
      console.error("Error loading settings:", error);
      toast({
        title: "Error",
        description: "No se pudo cargar la configuración del consultorio",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const settingsData = {
        user_id: user.id,
        clinic_name: clinicName,
        specialty: specialty,
        welcome_message: welcomeMessage,
        default_reminder_message: reminderMessage,
        default_confirmation_message: confirmationMessage,
        default_postsession_message: postsessionMessage,
        logo_url: logoUrl,
        cover_image_url: coverImageUrl,
        auto_accept_bookings: autoAcceptBookings,
      };

      if (settingsId) {
        // Update existing settings
        const { error } = await supabase
          .from("clinic_settings")
          .update(settingsData)
          .eq("id", settingsId);

        if (error) throw error;
      } else {
        // Insert new settings
        const { data, error } = await supabase
          .from("clinic_settings")
          .insert([settingsData])
          .select()
          .single();

        if (error) throw error;
        if (data) setSettingsId(data.id);
      }

      toast({
        title: "Guardado exitoso",
        description: "La configuración del consultorio se guardó correctamente",
      });
    } catch (error) {
      console.error("Error saving settings:", error);
      toast({
        title: "Error",
        description: "No se pudo guardar la configuración",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    setReminderMessage(DEFAULT_TEMPLATES.reminder);
    setConfirmationMessage(DEFAULT_TEMPLATES.confirmation);
    setPostsessionMessage(DEFAULT_TEMPLATES.postsession);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background p-8">
        <div className="max-w-4xl mx-auto">
          <p className="text-muted-foreground">Cargando...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-8">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate("/dashboard")}
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-3xl font-bold">Mi Consultorio</h1>
        </div>

        {/* URL Pública */}
        {publicSlug && (
          <Card className="border-primary/50 bg-primary/5">
            <CardHeader>
              <CardTitle className="text-lg">Tu página pública</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Compartí esta URL para que pacientes puedan solicitar citas
              </p>
              <div className="flex gap-2">
                <Input
                  value={`${window.location.origin}/consultorio/${publicSlug}`}
                  readOnly
                  className="font-mono text-sm"
                />
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => {
                    navigator.clipboard.writeText(`${window.location.origin}/consultorio/${publicSlug}`);
                    toast({
                      title: "URL copiada",
                      description: "La URL se copió al portapapeles",
                    });
                  }}
                >
                  <Copy className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => window.open(`/consultorio/${publicSlug}`, "_blank")}
                >
                  <ExternalLink className="h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Información básica */}
        <Card>
          <CardHeader>
            <CardTitle>Información básica</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="clinicName">Nombre del consultorio</Label>
              <Input
                id="clinicName"
                value={clinicName}
                onChange={(e) => setClinicName(e.target.value)}
                placeholder="Ej: Consultorio Psicológico Bienestar"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="specialty">Especialidad</Label>
              <Input
                id="specialty"
                value={specialty}
                onChange={(e) => setSpecialty(e.target.value)}
                placeholder="Ej: Psicología Clínica"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="welcomeMessage">Mensaje de bienvenida</Label>
              <Textarea
                id="welcomeMessage"
                value={welcomeMessage}
                onChange={(e) => setWelcomeMessage(e.target.value)}
                placeholder="Mensaje opcional para nuevos pacientes"
                rows={3}
              />
            </div>
          </CardContent>
        </Card>

        {/* Imágenes */}
        <Card>
          <CardHeader>
            <CardTitle>Imágenes</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="logoUrl">URL del logo</Label>
              <Input
                id="logoUrl"
                value={logoUrl}
                onChange={(e) => setLogoUrl(e.target.value)}
                placeholder="https://ejemplo.com/logo.png"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="coverImageUrl">URL de imagen de portada</Label>
              <Input
                id="coverImageUrl"
                value={coverImageUrl}
                onChange={(e) => setCoverImageUrl(e.target.value)}
                placeholder="https://ejemplo.com/portada.jpg"
              />
            </div>
          </CardContent>
        </Card>

        {/* Auto-Accept Bookings */}
        <Card>
          <CardHeader>
            <CardTitle>Reservas automáticas</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between p-4 border rounded-lg">
              <div className="space-y-1 flex-1">
                <Label htmlFor="auto-accept" className="cursor-pointer">
                  Auto-aceptar reservas de pacientes registrados
                </Label>
                <p className="text-sm text-muted-foreground">
                  Si está activado, las reservas de pacientes ya registrados se confirmarán automáticamente
                </p>
              </div>
              <input
                id="auto-accept"
                type="checkbox"
                checked={autoAcceptBookings}
                onChange={(e) => setAutoAcceptBookings(e.target.checked)}
                className="h-5 w-5 cursor-pointer"
              />
            </div>
          </CardContent>
        </Card>

        {/* Variables disponibles */}
        <Card>
          <CardHeader>
            <CardTitle>Variables disponibles para mensajes</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <code className="bg-muted px-2 py-1 rounded">{"{{paciente}}"}</code>
              <span className="text-muted-foreground">Nombre del paciente</span>
              <code className="bg-muted px-2 py-1 rounded">{"{{fecha}}"}</code>
              <span className="text-muted-foreground">Fecha de la cita</span>
              <code className="bg-muted px-2 py-1 rounded">{"{{hora}}"}</code>
              <span className="text-muted-foreground">Hora de la cita</span>
              <code className="bg-muted px-2 py-1 rounded">{"{{modalidad}}"}</code>
              <span className="text-muted-foreground">Online o Presencial</span>
              <code className="bg-muted px-2 py-1 rounded">{"{{link}}"}</code>
              <span className="text-muted-foreground">Link o ubicación</span>
            </div>
          </CardContent>
        </Card>

        {/* Mensajes personalizados */}
        <Card>
          <CardHeader>
            <CardTitle>Mensaje de recordatorio</CardTitle>
          </CardHeader>
          <CardContent>
            <Textarea
              value={reminderMessage}
              onChange={(e) => setReminderMessage(e.target.value)}
              rows={4}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Mensaje de confirmación</CardTitle>
          </CardHeader>
          <CardContent>
            <Textarea
              value={confirmationMessage}
              onChange={(e) => setConfirmationMessage(e.target.value)}
              rows={4}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Mensaje post-sesión</CardTitle>
          </CardHeader>
          <CardContent>
            <Textarea
              value={postsessionMessage}
              onChange={(e) => setPostsessionMessage(e.target.value)}
              rows={4}
            />
          </CardContent>
        </Card>

        {/* Action Buttons */}
        <div className="flex gap-4">
          <Button
            variant="outline"
            onClick={handleReset}
          >
            Restablecer mensajes por defecto
          </Button>
          <Button
            onClick={handleSave}
            disabled={saving}
          >
            <Save className="h-4 w-4 mr-2" />
            {saving ? "Guardando..." : "Guardar cambios"}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default ClinicSettings;
