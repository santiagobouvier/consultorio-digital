import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";
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

  const getTemplates = () => {
    const stored = localStorage.getItem("whatsapp_templates");
    if (stored) {
      return JSON.parse(stored);
    }
    return {
      reminder: `Hola {{paciente}}, te recuerdo tu sesión del {{fecha}} a las {{hora}}. Modalidad: {{modalidad}}. {{link}}`,
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

  const scheduleReminder = (daysBeforeOrNow: number | "now") => {
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
        // Enviar ahora - abrir WhatsApp (web o app)
        const phone = patientPhone.replace(/\D/g, "");
        const encodedMessage = encodeURIComponent(message);
        const url = `https://wa.me/${phone}?text=${encodedMessage}`;
        window.open(url, "_blank");
        
        toast({
          title: "WhatsApp abierto",
          description: "Se abrió WhatsApp con el mensaje preparado",
        });
      } else {
        // Programar recordatorio
        const appointmentDateTime = new Date(`${appointmentDate.split("/").reverse().join("-")}T${appointmentTime}`);
        const scheduledDate = new Date(appointmentDateTime);
        scheduledDate.setDate(scheduledDate.getDate() - daysBeforeOrNow);

        const reminders = JSON.parse(localStorage.getItem("pending_reminders") || "[]");
        
        const newReminder = {
          id: `${appointmentId}-${Date.now()}`,
          appointmentId,
          patientName,
          patientPhone,
          appointmentDate,
          appointmentTime,
          modality,
          location,
          scheduledDate: scheduledDate.toISOString(),
          message,
          createdAt: new Date().toISOString(),
        };

        reminders.push(newReminder);
        localStorage.setItem("pending_reminders", JSON.stringify(reminders));

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
