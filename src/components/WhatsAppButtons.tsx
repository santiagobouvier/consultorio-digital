import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { CheckCircle, MessageSquare } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

interface WhatsAppButtonsProps {
  patientName: string;
  patientPhone: string | null;
  appointmentDate: string;
  appointmentTime: string;
  modality: string;
  location: string | null;
}

const DEFAULT_TEMPLATES = {
  reminder: "Hola {{paciente}}, te recuerdo tu sesión del {{fecha}} a las {{hora}}. Modalidad: {{modalidad}}. {{link}}. Cualquier cosa me escribís por acá.",
  confirmation: "Hola {{paciente}}, confirmo tu sesión del {{fecha}} a las {{hora}}. Modalidad: {{modalidad}}. {{link}}. Te espero!",
  followup: "Hola {{paciente}}, gracias por tu sesión de hoy. Quedamos en contacto para la próxima. Saludos!"
};

export const WhatsAppButtons = ({
  patientName,
  patientPhone,
  appointmentDate,
  appointmentTime,
  modality,
  location,
}: WhatsAppButtonsProps) => {
  const [loading, setLoading] = useState<string | null>(null);
  const [templates, setTemplates] = useState(DEFAULT_TEMPLATES);

  useEffect(() => {
    loadClinicSettings();
  }, []);

  const loadClinicSettings = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: settings } = await supabase
        .from("clinic_settings")
        .select("default_reminder_message, default_confirmation_message, default_postsession_message")
        .eq("user_id", user.id)
        .maybeSingle();

      if (settings) {
        setTemplates({
          reminder: settings.default_reminder_message || DEFAULT_TEMPLATES.reminder,
          confirmation: settings.default_confirmation_message || DEFAULT_TEMPLATES.confirmation,
          followup: settings.default_postsession_message || DEFAULT_TEMPLATES.followup,
        });
      }
    } catch (error) {
      console.error("Error loading clinic settings:", error);
    }
  };

  const formatMessage = (template: string) => {
    const modalityText = modality === "online" ? "Online" : "Presencial";
    const linkText = location 
      ? (modality === "online" ? `Link: ${location}` : `Ubicación: ${location}`)
      : "";

    return template
      .replace(/\{\{paciente\}\}/g, patientName)
      .replace(/\{\{fecha\}\}/g, appointmentDate)
      .replace(/\{\{hora\}\}/g, appointmentTime)
      .replace(/\{\{modalidad\}\}/g, modalityText)
      .replace(/\{\{link\}\}/g, linkText);
  };

  const sendWhatsApp = (type: "reminder" | "confirmation" | "followup") => {
    if (!patientPhone) {
      toast({
        title: "Sin número",
        description: "El paciente no tiene un número de WhatsApp registrado",
        variant: "destructive",
      });
      return;
    }

    setLoading(type);
    
    const message = formatMessage(templates[type]);
    const phone = patientPhone.replace(/[^0-9]/g, "");
    const url = `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
    
    window.open(url, "_blank");
    
    setTimeout(() => setLoading(null), 500);
  };

  if (!patientPhone) {
    return (
      <div className="p-3 bg-muted/50 rounded-xl text-center">
        <p className="text-sm text-muted-foreground">
          Sin número de WhatsApp registrado
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col sm:flex-row gap-2">
      <Button
        variant="outline"
        onClick={() => sendWhatsApp("confirmation")}
        disabled={loading === "confirmation"}
        className="h-11 rounded-xl text-sm font-semibold flex-1"
      >
        <CheckCircle className="h-4 w-4 mr-2" />
        {loading === "confirmation" ? "Enviando..." : "Confirmar"}
      </Button>

      <Button
        variant="outline"
        onClick={() => sendWhatsApp("followup")}
        disabled={loading === "followup"}
        className="h-11 rounded-xl text-sm font-semibold flex-1"
      >
        <MessageSquare className="h-4 w-4 mr-2" />
        {loading === "followup" ? "Enviando..." : "Post-sesión"}
      </Button>
    </div>
  );
};