import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";
import { ArrowLeft } from "lucide-react";

const DEFAULT_TEMPLATES = {
  reminder: "Hola {{paciente}}, te recuerdo tu sesión del {{fecha}} a las {{hora}}. Modalidad: {{modalidad}}. {{link}}. Cualquier cosa me escribís por acá.",
  confirmation: "Hola {{paciente}}, confirmo tu sesión del {{fecha}} a las {{hora}}. Modalidad: {{modalidad}}. {{link}}. Te espero!",
  followup: "Hola {{paciente}}, gracias por tu sesión de hoy. Quedamos en contacto para la próxima. Saludos!"
};

const NotificationSettings = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [templates, setTemplates] = useState(DEFAULT_TEMPLATES);

  useEffect(() => {
    checkAuth();
    loadTemplates();
  }, []);

  const checkAuth = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      navigate("/auth");
      return;
    }
    setLoading(false);
  };

  const loadTemplates = () => {
    try {
      const stored = localStorage.getItem("whatsapp_templates");
      if (stored) {
        setTemplates(JSON.parse(stored));
      }
    } catch (error) {
      console.error("Error loading templates:", error);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      localStorage.setItem("whatsapp_templates", JSON.stringify(templates));
      toast({
        title: "Éxito",
        description: "Plantillas de mensajes guardadas correctamente",
      });
    } catch (error) {
      console.error("Error saving templates:", error);
      toast({
        title: "Error",
        description: "No se pudieron guardar las plantillas",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    setTemplates(DEFAULT_TEMPLATES);
    toast({
      title: "Plantillas restablecidas",
      description: "Se restauraron los mensajes por defecto",
    });
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
          <div>
            <h1 className="text-3xl font-bold">Configuración de Notificaciones</h1>
            <p className="text-muted-foreground mt-1">
              Personaliza los mensajes de WhatsApp que se enviarán a tus pacientes
            </p>
          </div>
        </div>

        {/* Variables Info */}
        <Card>
          <CardHeader>
            <CardTitle>Variables disponibles</CardTitle>
            <CardDescription>
              Puedes usar estas variables en tus mensajes. Se reemplazarán automáticamente con los datos de cada cita:
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <code className="bg-muted px-2 py-1 rounded">{"{{paciente}}"}</code>
                <p className="text-muted-foreground mt-1">Nombre del paciente</p>
              </div>
              <div>
                <code className="bg-muted px-2 py-1 rounded">{"{{fecha}}"}</code>
                <p className="text-muted-foreground mt-1">Fecha de la cita</p>
              </div>
              <div>
                <code className="bg-muted px-2 py-1 rounded">{"{{hora}}"}</code>
                <p className="text-muted-foreground mt-1">Hora de la cita</p>
              </div>
              <div>
                <code className="bg-muted px-2 py-1 rounded">{"{{modalidad}}"}</code>
                <p className="text-muted-foreground mt-1">Online o Presencial</p>
              </div>
              <div>
                <code className="bg-muted px-2 py-1 rounded">{"{{link}}"}</code>
                <p className="text-muted-foreground mt-1">Link de Meet o ubicación</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Templates */}
        <div className="space-y-4">
          {/* Reminder Template */}
          <Card>
            <CardHeader>
              <CardTitle>Mensaje de Recordatorio</CardTitle>
              <CardDescription>
                Se envía para recordar al paciente sobre su próxima cita
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Label htmlFor="reminder">Plantilla de recordatorio</Label>
              <Textarea
                id="reminder"
                value={templates.reminder}
                onChange={(e) => setTemplates({ ...templates, reminder: e.target.value })}
                rows={4}
                className="mt-2"
              />
            </CardContent>
          </Card>

          {/* Confirmation Template */}
          <Card>
            <CardHeader>
              <CardTitle>Mensaje de Confirmación</CardTitle>
              <CardDescription>
                Se envía para confirmar la cita con el paciente
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Label htmlFor="confirmation">Plantilla de confirmación</Label>
              <Textarea
                id="confirmation"
                value={templates.confirmation}
                onChange={(e) => setTemplates({ ...templates, confirmation: e.target.value })}
                rows={4}
                className="mt-2"
              />
            </CardContent>
          </Card>

          {/* Follow-up Template */}
          <Card>
            <CardHeader>
              <CardTitle>Mensaje Post-Sesión</CardTitle>
              <CardDescription>
                Se envía después de la sesión como seguimiento
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Label htmlFor="followup">Plantilla post-sesión</Label>
              <Textarea
                id="followup"
                value={templates.followup}
                onChange={(e) => setTemplates({ ...templates, followup: e.target.value })}
                rows={4}
                className="mt-2"
              />
            </CardContent>
          </Card>
        </div>

        {/* Actions */}
        <div className="flex gap-2 justify-end">
          <Button variant="outline" onClick={handleReset}>
            Restablecer por defecto
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? "Guardando..." : "Guardar cambios"}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default NotificationSettings;
