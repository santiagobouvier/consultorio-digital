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
  appointmentId: string;
  patientName: string;
  patientPhone: string;
  appointmentDate: string;
  appointmentTime: string;
  modality: string;
  location: string | null;
  scheduledDate: string;
  message: string;
  createdAt: string;
}

const PendingReminders = () => {
  const navigate = useNavigate();
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkAuth();
    loadReminders();
  }, []);

  const checkAuth = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      navigate("/auth");
    }
  };

  const loadReminders = () => {
    try {
      const stored = localStorage.getItem("pending_reminders");
      if (!stored) {
        setReminders([]);
        return;
      }

      const allReminders: Reminder[] = JSON.parse(stored);
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      // Filtrar solo recordatorios cuya fecha programada sea hoy o anterior
      const dueReminders = allReminders.filter((reminder) => {
        const scheduledDate = new Date(reminder.scheduledDate);
        scheduledDate.setHours(0, 0, 0, 0);
        return scheduledDate <= today;
      });

      setReminders(dueReminders);
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

  const sendWhatsApp = (reminder: Reminder) => {
    try {
      const phone = reminder.patientPhone.replace(/\D/g, "");
      const encodedMessage = encodeURIComponent(reminder.message);
      const url = `https://web.whatsapp.com/send?phone=${phone}&text=${encodedMessage}`;
      window.open(url, "_blank");

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

  const deleteReminder = (reminderId: string) => {
    try {
      const stored = localStorage.getItem("pending_reminders");
      if (!stored) return;

      const allReminders: Reminder[] = JSON.parse(stored);
      const updatedReminders = allReminders.filter((r) => r.id !== reminderId);
      
      localStorage.setItem("pending_reminders", JSON.stringify(updatedReminders));
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
          <h1 className="text-3xl font-bold">Recordatorios pendientes</h1>
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
                  {reminders.map((reminder) => (
                    <TableRow key={reminder.id}>
                      <TableCell className="font-medium">
                        {reminder.patientName}
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          <p className="text-sm">
                            {reminder.appointmentDate} - {reminder.appointmentTime}
                          </p>
                          <Badge variant="outline" className="text-xs">
                            {reminder.modality === "online" ? "Online" : "Presencial"}
                          </Badge>
                        </div>
                      </TableCell>
                      <TableCell>
                        {formatScheduledDate(reminder.scheduledDate)}
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
                  ))}
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
