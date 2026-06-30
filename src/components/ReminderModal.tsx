import { useState, useMemo } from "react";
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
import { Bell, Send, Mail, MessageSquare, AlertCircle } from "lucide-react";
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
  appointmentStartAt?: string; // ISO string of appointment start
  modality: string;
  location: string | null;
}

// Minimum hours of anticipation needed for an automated email to be useful
const MIN_EMAIL_LEAD_HOURS = 1;

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
  appointmentStartAt,
  modality,
  location,
}: ReminderModalProps) => {
  const [loading, setLoading] = useState(false);
  const [confirmWhatsapp, setConfirmWhatsapp] = useState<{ scheduledId?: string } | null>(null);
  const { businessId } = useBusinessId();

  // Calculate hours remaining until appointment
  const hoursUntilAppointment = useMemo(() => {
    if (!appointmentStartAt) return Infinity;
    const diffMs = new Date(appointmentStartAt).getTime() - Date.now();
    return diffMs / (1000 * 60 * 60);
  }, [appointmentStartAt, open]);

  const isPast = hoursUntilAppointment <= 0;

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
    setConfirmWhatsapp({});
  };

  const scheduleReminder = async (hoursBefore: number, channel: "email" | "whatsapp") => {
    if (!businessId) return;

    // Validate the scheduled time is still in the future
    const remainingForThisOption = hoursUntilAppointment - hoursBefore;
    if (remainingForThisOption <= 0) {
      toast({
        title: "No se puede programar",
        description: "Ese momento ya pasó. Probá una opción más cercana o enviá ahora por WhatsApp.",
        variant: "destructive",
      });
      return;
    }

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
      scheduledDate.setHours(scheduledDate.getHours() - hoursBefore);

      if (scheduledDate.getTime() <= Date.now()) {
        toast({
          title: "No se puede programar",
          description: "El momento programado ya pasó.",
          variant: "destructive",
        });
        return;
      }

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
          // Both channels now auto-send via the cron (whatsapp through Twilio).
          status: "scheduled",
          auto_send: true,
        });

      if (error) throw error;

      toast({
        title: "Recordatorio programado",
        description: `${channel === "email" ? "Email" : "WhatsApp"} programado para ${scheduledDate.toLocaleDateString("es-UY")} ${scheduledDate.toLocaleTimeString("es-UY", { hour: "2-digit", minute: "2-digit" })}`,
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

  // Each scheduled option requires that (hoursUntilAppointment - hoursBefore) > 0
  // Email also needs at least MIN_EMAIL_LEAD_HOURS lead time to actually be sent by the cron
  const canSchedule = (hoursBefore: number, channel: "email" | "whatsapp") => {
    if (isPast) return false;
    const remaining = hoursUntilAppointment - hoursBefore;
    if (channel === "email") return remaining >= MIN_EMAIL_LEAD_HOURS;
    return remaining > 0;
  };

  const can24hWA = canSchedule(24, "whatsapp");
  const can7dWA = canSchedule(168, "whatsapp");
  const can24hEmail = canSchedule(24, "email");
  const can7dEmail = canSchedule(168, "email");

  // Hours remaining label
  const remainingLabel = useMemo(() => {
    if (isPast) return "Esta cita ya pasó";
    if (hoursUntilAppointment < 1) {
      const mins = Math.max(1, Math.round(hoursUntilAppointment * 60));
      return `Faltan ~${mins} min para la cita`;
    }
    if (hoursUntilAppointment < 24) {
      return `Faltan ~${Math.round(hoursUntilAppointment)} h para la cita`;
    }
    return `Faltan ~${Math.round(hoursUntilAppointment / 24)} días para la cita`;
  }, [hoursUntilAppointment, isPast]);

  const confirmWhatsappSent = async () => {
    // No scheduled reminder row to update from this entry point — we only opened wa.me directly.
    // Just close.
    setConfirmWhatsapp(null);
    toast({ title: "WhatsApp marcado como enviado" });
    onOpenChange(false);
  };

  const dismissWhatsappConfirm = () => {
    setConfirmWhatsapp(null);
    toast({ title: "Sin cambios", description: "El recordatorio queda pendiente." });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Enviar recordatorio</DialogTitle>
          <DialogDescription>
            Elegí canal y cuándo enviar el recordatorio a {patientName}
          </DialogDescription>
        </DialogHeader>

        {/* Time context banner */}
        <div className={`flex items-start gap-2 p-3 rounded-xl text-sm ${
          isPast
            ? "bg-destructive/10 text-destructive border border-destructive/20"
            : "bg-muted text-muted-foreground"
        }`}>
          <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
          <span>{remainingLabel}</span>
        </div>

        {confirmWhatsapp ? (
          <div className="space-y-4 mt-2">
            <p className="text-sm">¿Enviaste el WhatsApp a {patientName}?</p>
            <div className="flex gap-2">
              <Button onClick={confirmWhatsappSent} className="flex-1 rounded-xl">Sí, enviado</Button>
              <Button variant="outline" onClick={dismissWhatsappConfirm} className="flex-1 rounded-xl">No</Button>
            </div>
          </div>
        ) : (
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
                disabled={loading || !hasPhone || isPast}
              >
                <Send className="h-4 w-4 mr-2" />
                Enviar ahora
              </Button>
              <Button
                className="w-full justify-start rounded-xl"
                variant="outline"
                onClick={() => scheduleReminder(24, "whatsapp")}
                disabled={loading || !hasPhone || !can24hWA}
              >
                <Bell className="h-4 w-4 mr-2" />
                Programar 1 día antes
                {!can24hWA && !isPast && hasPhone && (
                  <span className="ml-auto text-xs text-muted-foreground">ya pasó</span>
                )}
              </Button>
              <Button
                className="w-full justify-start rounded-xl"
                variant="outline"
                onClick={() => scheduleReminder(168, "whatsapp")}
                disabled={loading || !hasPhone || !can7dWA}
              >
                <Bell className="h-4 w-4 mr-2" />
                Programar 1 semana antes
                {!can7dWA && !isPast && hasPhone && (
                  <span className="ml-auto text-xs text-muted-foreground">ya pasó</span>
                )}
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
                disabled={loading || !hasEmail || !can24hEmail}
              >
                <Bell className="h-4 w-4 mr-2" />
                Programar 1 día antes
                {!can24hEmail && !isPast && hasEmail && (
                  <span className="ml-auto text-xs text-muted-foreground">ya pasó</span>
                )}
              </Button>
              <Button
                className="w-full justify-start rounded-xl"
                variant="outline"
                onClick={() => scheduleReminder(168, "email")}
                disabled={loading || !hasEmail || !can7dEmail}
              >
                <Bell className="h-4 w-4 mr-2" />
                Programar 1 semana antes
                {!can7dEmail && !isPast && hasEmail && (
                  <span className="ml-auto text-xs text-muted-foreground">ya pasó</span>
                )}
              </Button>
              {!hasEmail && (
                <p className="text-xs text-muted-foreground">Sin email configurado</p>
              )}
              {hasEmail && !isPast && !can24hEmail && !can7dEmail && (
                <p className="text-xs text-muted-foreground">
                  No hay tiempo suficiente para programar email. Usá WhatsApp ahora.
                </p>
              )}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};
