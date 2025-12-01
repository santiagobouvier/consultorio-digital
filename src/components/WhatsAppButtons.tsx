import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { MessageCircle, Bell, CheckCircle, MessageSquare } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

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
      alert("El paciente no tiene un número de WhatsApp registrado");
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
      <div className="text-sm text-muted-foreground italic">
        Sin número de WhatsApp registrado
      </div>
    );
  }

  return (
    <TooltipProvider>
      <div className="flex gap-2">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              onClick={() => sendWhatsApp("confirmation")}
              disabled={loading === "confirmation"}
            >
              <CheckCircle className="h-4 w-4 mr-1" />
              {loading === "confirmation" ? "Enviando..." : "Confirmar"}
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>Enviar confirmación por WhatsApp</p>
          </TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              onClick={() => sendWhatsApp("followup")}
              disabled={loading === "followup"}
            >
              <MessageSquare className="h-4 w-4 mr-1" />
              {loading === "followup" ? "Enviando..." : "Post-sesión"}
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>Enviar mensaje posterior a la sesión</p>
          </TooltipContent>
        </Tooltip>
      </div>
    </TooltipProvider>
  );
};
