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
import { supabase } from "@/integrations/supabase/client";
import { Bell, Send, Mail, MessageSquare } from "lucide-react";
import { useBusinessId } from "@/hooks/use-business-id";

interface ReminderModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  appointmentId: string;
  patientId: string | null;
  patientName: string;
  patientPhone: string | null;
  patientEmail: string | null;
  appointmentDate: string;
  appointmentTime: string;
  modality: string;
  location: string | null;
}

export const ReminderModal = ({
  open,
  onOpenChange,
  appointmentId,
  patientId,
  patientName,
  patientPhone,
  patientEmail,
  appointmentDate,
  appointmentTime,
  modality,
  location,
}: ReminderModalProps) => {
  const [loading, setLoading] = useState(false);
  const { businessId } = useBusinessId();

  const buildMessage = () => {
    return `Hola ${patientName}, te recuerdo tu sesión del ${appointmentDate} a las ${appointmentTime}. Modalidad: ${modality === "online" ? "Online" : "Presencial"}. ${location || ""}`.trim();
  };

  const sendNowWhatsApp = () => {
    if (!patientPhone) {
      toast({ title: "Error", description: "Sin número de teléfono", variant: "destructive" });
      return;
    }
    const phone = patientPhone.replace(/\D/g, "");
    const url = `https://wa.me/${phone}?text=${encodeURIComponent(buildMessage())}`;
    window.open(url, "_blank");
    toast({ title: "WhatsApp abierto" });
    onOpenChange(false);
  };

  const scheduleReminder = async (hoursBeforeOrNow: number, channel: "email" | "whatsapp") => {
    if (!businessId) return;
    setLoading(true);
    try {
      const { data: appt } = await supabase
        .from("appointments")
        .select("start_at")
        .eq("id", appointmentId)
        .single();

      if (!appt) throw new Error("Cita no encontrada");

      const apptDate = new Date(appt.start_at);
      const scheduledDate = new Date(apptDate);
      scheduledDate.setHours(scheduledDate.getHours() - hoursBeforeOrNow);

      const message = buildMessage();

      const { error } = await supabase
        .from("scheduled_reminders")
        .insert({
          appointment_id: appointmentId,
          patient_id: patientId!,
          business_id: businessId,
          scheduled_for: scheduledDate.toISOString(),
          message,
          channel,
          type: "reminder",
          status: channel === "email" ? "scheduled" : "pending_manual",
          auto_send: channel === "email",
        });

      if (error) throw error;

      toast({
        title: "Recordatorio programado",
        description: `${channel === "email" ? "Email" : "WhatsApp"} programado para ${scheduledDate.toLocaleDateString("es-UY")}`,
      });
      onOpenChange(false);
    } catch (error) {
      console.error("Error:", error);
      toast({ title: "Error", description: "No se pudo programar", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const hasPhone = !!patientPhone;
  const hasEmail = !!patientEmail;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Enviar recordatorio</DialogTitle>
          <DialogDescription>
            Elegí canal y cuándo enviar el recordatorio a {patientName}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 mt-2">
          {/* WhatsApp section */}
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm font-medium text-green-400">
              <MessageSquare className="h-4 w-4" />
              WhatsApp
            </div>
            <Button
              className="w-full justify-start rounded-xl"
              variant="outline"
              onClick={sendNowWhatsApp}
              disabled={loading || !hasPhone}
            >
              <Send className="h-4 w-4 mr-2" />
              Enviar ahora
            </Button>
            <Button
              className="w-full justify-start rounded-xl"
              variant="outline"
              onClick={() => scheduleReminder(24, "whatsapp")}
              disabled={loading || !hasPhone}
            >
              <Bell className="h-4 w-4 mr-2" />
              Programar 1 día antes
            </Button>
            <Button
              className="w-full justify-start rounded-xl"
              variant="outline"
              onClick={() => scheduleReminder(168, "whatsapp")}
              disabled={loading || !hasPhone}
            >
              <Bell className="h-4 w-4 mr-2" />
              Programar 1 semana antes
            </Button>
            {!hasPhone && (
              <p className="text-xs text-muted-foreground">Sin número de teléfono configurado</p>
            )}
          </div>

          {/* Email section */}
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm font-medium text-blue-400">
              <Mail className="h-4 w-4" />
              Email
            </div>
            <Button
              className="w-full justify-start rounded-xl"
              variant="outline"
              onClick={() => scheduleReminder(24, "email")}
              disabled={loading || !hasEmail}
            >
              <Bell className="h-4 w-4 mr-2" />
              Programar 1 día antes
            </Button>
            <Button
              className="w-full justify-start rounded-xl"
              variant="outline"
              onClick={() => scheduleReminder(168, "email")}
              disabled={loading || !hasEmail}
            >
              <Bell className="h-4 w-4 mr-2" />
              Programar 1 semana antes
            </Button>
            {!hasEmail && (
              <p className="text-xs text-muted-foreground">Sin email configurado</p>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
