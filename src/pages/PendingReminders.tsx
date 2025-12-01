import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import { ArrowLeft, Send, Trash2 } from "lucide-react";

interface Reminder {
  id: string;
  appointment_id: string;
  patient_id: string;
  scheduled_for: string;
  message: string;
  sent: boolean;
  created_at: string;
  patient?: {
    full_name: string;
    whatsapp_phone: string | null;
  };
  appointment?: {
    start_at: string;
    modality: string;
    location: string | null;
  };
}

const PendingReminders = () => {
  const navigate = useNavigate();
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const initPage = async () => {
      await checkAuth();
      await loadReminders();
    };
    initPage();
  }, []);

  const checkAuth = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      navigate("/auth");
    }
  };

  const loadReminders = async () => {
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const { data, error } = await supabase
        .from("scheduled_reminders")
        .select(`
          *,
          patient:patients(full_name, whatsapp_phone),
          appointment:appointments(start_at, modality, location)
        `)
        .eq("sent", false)
        .lte("scheduled_for", new Date().toISOString())
        .order("scheduled_for", { ascending: true });

      if (error) throw error;

      setReminders(data || []);
    } catch (error) {
      console.error("Error loading reminders:", error);
      toast({
        title: "Error",
        description: "No se pudieron cargar los recordatorios",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const sendWhatsApp = async (reminder: Reminder) => {
    try {
      if (!reminder.patient?.whatsapp_phone) {
        toast({
          title: "Error",
          description: "El paciente no tiene número de teléfono",
          variant: "destructive",
        });
        return;
      }

      const phone = reminder.patient.whatsapp_phone.replace(/\D/g, "");
      const encodedMessage = encodeURIComponent(reminder.message);
      const url = `https://wa.me/${phone}?text=${encodedMessage}`;
      window.open(url, "_blank");

      // Marcar como enviado
      const { error } = await supabase
        .from("scheduled_reminders")
        .update({ sent: true })
        .eq("id", reminder.id);

      if (error) throw error;

      // Actualizar lista local
      setReminders((prev) => prev.filter((r) => r.id !== reminder.id));

      toast({
        title: "WhatsApp abierto",
        description: "Se abrió WhatsApp con el mensaje preparado",
      });
    } catch (error) {
      console.error("Error opening WhatsApp:", error);
      toast({
        title: "Error",
        description: "No se pudo abrir WhatsApp",
        variant: "destructive",
      });
    }
  };

  const deleteReminder = async (reminderId: string) => {
    try {
      const { error } = await supabase
        .from("scheduled_reminders")
        .delete()
        .eq("id", reminderId);

      if (error) throw error;

      setReminders((prev) => prev.filter((r) => r.id !== reminderId));

      toast({
        title: "Recordatorio eliminado",
        description: "El recordatorio fue eliminado correctamente",
      });
    } catch (error) {
      console.error("Error deleting reminder:", error);
      toast({
        title: "Error",
        description: "No se pudo eliminar el recordatorio",
        variant: "destructive",
      });
    }
  };

  const formatScheduledDate = (isoDate: string) => {
    const date = new Date(isoDate);
    return date.toLocaleDateString("es-UY", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  };

  const formatAppointmentDateTime = (isoDate: string) => {
    const date = new Date(isoDate);
    return {
      date: date.toLocaleDateString("es-UY", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      }),
      time: date.toLocaleTimeString("es-UY", {
        hour: "2-digit",
        minute: "2-digit",
      }),
    };
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background p-8">
        <div className="max-w-7xl mx-auto">
          <p className="text-muted-foreground">Cargando...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-8">
      <div className="max-w-7xl mx-auto space-y-6">
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
            <h1 className="text-3xl font-bold">Recordatorios pendientes</h1>
            <p className="text-muted-foreground mt-1">
              {reminders.length} {reminders.length === 1 ? 'recordatorio pendiente' : 'recordatorios pendientes'}
            </p>
          </div>
        </div>

        {/* Reminders List */}
        <Card>
          <CardHeader>
            <CardTitle>Recordatorios para enviar</CardTitle>
          </CardHeader>
          <CardContent>
            {reminders.length === 0 ? (
              <p className="text-muted-foreground">
                No hay recordatorios pendientes para enviar hoy
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Paciente</TableHead>
                    <TableHead>Cita</TableHead>
                    <TableHead>Programado para</TableHead>
                    <TableHead>Mensaje</TableHead>
                    <TableHead className="text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {reminders.map((reminder) => {
                    const { date, time } = formatAppointmentDateTime(reminder.appointment?.start_at || "");
                    return (
                      <TableRow key={reminder.id}>
                        <TableCell className="font-medium">
                          {reminder.patient?.full_name || "-"}
                        </TableCell>
                        <TableCell>
                          <div className="space-y-1">
                            <p className="text-sm">
                              {date} - {time}
                            </p>
                            <Badge variant="outline" className="text-xs">
                              {reminder.appointment?.modality === "online" ? "Online" : "Presencial"}
                            </Badge>
                          </div>
                        </TableCell>
                        <TableCell>
                          {formatScheduledDate(reminder.scheduled_for)}
                        </TableCell>
                        <TableCell>
                          <p className="text-sm text-muted-foreground truncate max-w-xs">
                            {reminder.message}
                          </p>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex gap-2 justify-end">
                            <Button
                              size="sm"
                              onClick={() => sendWhatsApp(reminder)}
                            >
                              <Send className="h-4 w-4 mr-1" />
                              Enviar
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => deleteReminder(reminder.id)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default PendingReminders;
