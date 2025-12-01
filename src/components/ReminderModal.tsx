import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Bell, Send } from "lucide-react";

interface ReminderModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  appointmentId: string;
  patientName: string;
  patientPhone: string | null;
  appointmentDate: string;
  appointmentTime: string;
  modality: string;
  location: string | null;
}

interface Patient {
  id: string;
}

export const ReminderModal = ({
  open,
  onOpenChange,
  appointmentId,
  patientName,
  patientPhone,
  appointmentDate,
  appointmentTime,
  modality,
  location,
}: ReminderModalProps) => {
  const [loading, setLoading] = useState(false);
  const [reminderTemplate, setReminderTemplate] = useState(
    "Hola {{paciente}}, te recuerdo tu sesión del {{fecha}} a las {{hora}}. Modalidad: {{modalidad}}. {{link}}"
  );

  useEffect(() => {
    loadClinicSettings();
  }, []);

  const loadClinicSettings = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: settings } = await supabase
        .from("clinic_settings")
        .select("default_reminder_message")
        .eq("user_id", user.id)
        .maybeSingle();

      if (settings?.default_reminder_message) {
        setReminderTemplate(settings.default_reminder_message);
      }
    } catch (error) {
      console.error("Error loading clinic settings:", error);
    }
  };

  const getTemplates = () => {
    return {
      reminder: reminderTemplate,
    };
  };

  const formatMessage = (template: string) => {
    return template
      .replace("{{paciente}}", patientName)
      .replace("{{fecha}}", appointmentDate)
      .replace("{{hora}}", appointmentTime)
      .replace("{{modalidad}}", modality === "online" ? "Online" : "Presencial")
      .replace("{{link}}", location || "");
  };

  const scheduleReminder = async (daysBeforeOrNow: number | "now") => {
    if (!patientPhone) {
      toast({
        title: "Error",
        description: "El paciente no tiene número de teléfono",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);

    try {
      const templates = getTemplates();
      const message = formatMessage(templates.reminder);

      if (daysBeforeOrNow === "now") {
        // Enviar ahora - abrir WhatsApp
        const phone = patientPhone.replace(/\D/g, "");
        const encodedMessage = encodeURIComponent(message);
        const url = `https://wa.me/${phone}?text=${encodedMessage}`;
        window.open(url, "_blank");
        
        toast({
          title: "WhatsApp abierto",
          description: "Se abrió WhatsApp con el mensaje preparado",
        });
      } else {
        // Programar recordatorio en la base de datos
        // Obtener la fecha original de la cita desde la BD
        const { data: appointmentData, error: appointmentError } = await supabase
          .from("appointments")
          .select("patient_id, start_at")
          .eq("id", appointmentId)
          .single();

        if (appointmentError || !appointmentData) {
          throw new Error("No se pudo obtener la información de la cita");
        }

        // Calcular la fecha del recordatorio
        const appointmentDateTime = new Date(appointmentData.start_at);
        const scheduledDate = new Date(appointmentDateTime);
        scheduledDate.setDate(scheduledDate.getDate() - daysBeforeOrNow);

        // Insertar en la tabla scheduled_reminders
        const { error: insertError } = await supabase
          .from("scheduled_reminders")
          .insert({
            appointment_id: appointmentId,
            patient_id: appointmentData.patient_id,
            scheduled_for: scheduledDate.toISOString(),
            message,
          });

        if (insertError) throw insertError;

        toast({
          title: "Recordatorio programado",
          description: `Se programó el recordatorio para ${scheduledDate.toLocaleDateString("es-UY")}`,
        });
      }

      onOpenChange(false);
    } catch (error) {
      console.error("Error scheduling reminder:", error);
      toast({
        title: "Error",
        description: "No se pudo programar el recordatorio",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Programar recordatorio</DialogTitle>
          <DialogDescription>
            Elegí cuándo enviar el recordatorio a {patientName}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 mt-4">
          <Button
            className="w-full justify-start"
            variant="outline"
            onClick={() => scheduleReminder("now")}
            disabled={loading || !patientPhone}
          >
            <Send className="h-4 w-4 mr-2" />
            Enviar ahora
          </Button>

          <Button
            className="w-full justify-start"
            variant="outline"
            onClick={() => scheduleReminder(1)}
            disabled={loading || !patientPhone}
          >
            <Bell className="h-4 w-4 mr-2" />
            Recordar 1 día antes
          </Button>

          <Button
            className="w-full justify-start"
            variant="outline"
            onClick={() => scheduleReminder(7)}
            disabled={loading || !patientPhone}
          >
            <Bell className="h-4 w-4 mr-2" />
            Recordar 1 semana antes
          </Button>

          <Button
            className="w-full justify-start"
            variant="outline"
            onClick={() => scheduleReminder(30)}
            disabled={loading || !patientPhone}
          >
            <Bell className="h-4 w-4 mr-2" />
            Recordar 1 mes antes
          </Button>
        </div>

        {!patientPhone && (
          <p className="text-sm text-muted-foreground mt-4">
            El paciente no tiene número de teléfono configurado
          </p>
        )}
      </DialogContent>
    </Dialog>
  );
};
