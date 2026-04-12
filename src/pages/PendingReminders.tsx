import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import { Send, Trash2, Bell, Mail, MessageSquare, Check, Filter } from "lucide-react";
import LoadingPage from "@/components/LoadingPage";
import { useBusinessId } from "@/hooks/use-business-id";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface Reminder {
  id: string;
  appointment_id: string;
  patient_id: string;
  business_id: string;
  scheduled_for: string;
  message: string;
  channel: string;
  type: string;
  status: string;
  auto_send: boolean;
  created_at: string;
  patient?: {
    full_name: string;
    whatsapp_phone: string | null;
    email: string | null;
  };
  appointment?: {
    start_at: string;
    modality: string;
    location: string | null;
  };
}

const channelConfig: Record<string, { label: string; icon: typeof Mail; color: string }> = {
  email: { label: "Email", icon: Mail, color: "bg-blue-500/10 text-blue-400 border-blue-500/20" },
  whatsapp: { label: "WhatsApp", icon: MessageSquare, color: "bg-green-500/10 text-green-400 border-green-500/20" },
};

const typeLabels: Record<string, string> = {
  reminder: "Recordatorio",
  confirmation: "Confirmación",
  postsession: "Post-sesión",
  payment: "Cobro",
};

const statusConfig: Record<string, { label: string; color: string }> = {
  scheduled: { label: "Programado", color: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20" },
  pending_manual: { label: "Pendiente", color: "bg-orange-500/10 text-orange-400 border-orange-500/20" },
  sent: { label: "Enviado", color: "bg-green-500/10 text-green-400 border-green-500/20" },
  cancelled: { label: "Cancelado", color: "bg-muted text-muted-foreground" },
};

const PendingReminders = () => {
  const navigate = useNavigate();
  const { businessId } = useBusinessId();
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("pending");

  useEffect(() => {
    if (businessId) loadReminders();
  }, [businessId]);

  const loadReminders = async () => {
    try {
      const { data, error } = await supabase
        .from("scheduled_reminders")
        .select(`
          *,
          patient:patients(full_name, whatsapp_phone, email),
          appointment:appointments(start_at, modality, location)
        `)
        .eq("business_id", businessId!)
        .order("scheduled_for", { ascending: true });

      if (error) throw error;
      setReminders((data as unknown as Reminder[]) || []);
    } catch (error) {
      console.error("Error loading reminders:", error);
      toast({ title: "Error", description: "No se pudieron cargar los recordatorios", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const filteredReminders = reminders.filter((r) => {
    if (activeTab === "pending") return r.status === "pending_manual" || r.status === "scheduled";
    if (activeTab === "sent") return r.status === "sent";
    return true;
  });

  const pendingCount = reminders.filter(r => r.status === "pending_manual" || r.status === "scheduled").length;
  const sentCount = reminders.filter(r => r.status === "sent").length;

  const sendWhatsApp = async (reminder: Reminder) => {
    if (!reminder.patient?.whatsapp_phone) {
      toast({ title: "Error", description: "El paciente no tiene teléfono", variant: "destructive" });
      return;
    }
    const phone = reminder.patient.whatsapp_phone.replace(/\D/g, "");
    const url = `https://wa.me/${phone}?text=${encodeURIComponent(reminder.message)}`;
    window.open(url, "_blank");

    await supabase
      .from("scheduled_reminders")
      .update({ status: "sent" })
      .eq("id", reminder.id);

    setReminders((prev) => prev.map((r) => r.id === reminder.id ? { ...r, status: "sent" } : r));
    toast({ title: "WhatsApp abierto", description: "Se marcó como enviado" });
  };

  const markAsSent = async (reminder: Reminder) => {
    await supabase
      .from("scheduled_reminders")
      .update({ status: "sent" })
      .eq("id", reminder.id);

    setReminders((prev) => prev.map((r) => r.id === reminder.id ? { ...r, status: "sent" } : r));
    toast({ title: "Marcado como enviado" });
  };

  const deleteReminder = async (reminderId: string) => {
    try {
      const { error } = await supabase
        .from("scheduled_reminders")
        .delete()
        .eq("id", reminderId);
      if (error) throw error;
      setReminders((prev) => prev.filter((r) => r.id !== reminderId));
      toast({ title: "Recordatorio eliminado" });
    } catch (error) {
      toast({ title: "Error", description: "No se pudo eliminar", variant: "destructive" });
    }
  };

  const sendAllWhatsApp = async () => {
    const whatsappPending = filteredReminders.filter(
      (r) => r.channel === "whatsapp" && r.status === "pending_manual" && r.patient?.whatsapp_phone
    );
    for (const reminder of whatsappPending) {
      await sendWhatsApp(reminder);
      // Small delay between opens
      await new Promise((resolve) => setTimeout(resolve, 1500));
    }
  };

  const formatDateTime = (isoDate: string) => {
    const date = new Date(isoDate);
    return {
      date: date.toLocaleDateString("es-UY", { day: "2-digit", month: "2-digit", year: "numeric" }),
      time: date.toLocaleTimeString("es-UY", { hour: "2-digit", minute: "2-digit" }),
    };
  };

  if (loading) return <LoadingPage />;

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-4xl mx-auto p-4 sm:p-6 lg:p-8 space-y-5">
        {/* Header */}
        <div>
          <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold">Recordatorios</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Gestión centralizada de recordatorios por email y WhatsApp
          </p>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <TabsList>
              <TabsTrigger value="pending" className="gap-2">
                <Bell className="h-4 w-4" />
                Pendientes
                {pendingCount > 0 && (
                  <Badge variant="secondary" className="ml-1 h-5 min-w-5 flex items-center justify-center text-xs rounded-full">
                    {pendingCount}
                  </Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="sent" className="gap-2">
                <Check className="h-4 w-4" />
                Enviados ({sentCount})
              </TabsTrigger>
              <TabsTrigger value="all" className="gap-2">
                <Filter className="h-4 w-4" />
                Todos
              </TabsTrigger>
            </TabsList>

            {activeTab === "pending" && filteredReminders.some(r => r.channel === "whatsapp" && r.status === "pending_manual") && (
              <Button size="sm" onClick={sendAllWhatsApp} className="rounded-xl gap-2">
                <Send className="h-4 w-4" />
                Enviar todos WhatsApp
              </Button>
            )}
          </div>

          <TabsContent value={activeTab} className="mt-4">
            {filteredReminders.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <Bell className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">
                    {activeTab === "pending"
                      ? "No hay recordatorios pendientes"
                      : activeTab === "sent"
                      ? "No hay recordatorios enviados"
                      : "No hay recordatorios"}
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-3">
                {filteredReminders.map((reminder) => {
                  const apptDt = reminder.appointment?.start_at
                    ? formatDateTime(reminder.appointment.start_at)
                    : null;
                  const schedDt = formatDateTime(reminder.scheduled_for);
                  const chConf = channelConfig[reminder.channel] || channelConfig.whatsapp;
                  const stConf = statusConfig[reminder.status] || statusConfig.scheduled;
                  const ChannelIcon = chConf.icon;

                  return (
                    <Card key={reminder.id} className="overflow-hidden">
                      <CardContent className="p-4">
                        <div className="flex items-start gap-3">
                          {/* Channel icon */}
                          <div className={`p-2 rounded-lg shrink-0 ${chConf.color}`}>
                            <ChannelIcon className="h-4 w-4" />
                          </div>

                          {/* Content */}
                          <div className="flex-1 min-w-0 space-y-2">
                            <div className="flex items-start justify-between gap-2">
                              <div>
                                <p className="font-semibold text-foreground">
                                  {reminder.patient?.full_name || "Sin paciente"}
                                </p>
                                {apptDt && (
                                  <p className="text-sm text-muted-foreground">
                                    Cita: {apptDt.date} a las {apptDt.time}
                                  </p>
                                )}
                              </div>
                              <div className="flex items-center gap-2 shrink-0">
                                <Badge variant="outline" className={`rounded-full text-xs ${stConf.color}`}>
                                  {stConf.label}
                                </Badge>
                                <Badge variant="outline" className="rounded-full text-xs">
                                  {typeLabels[reminder.type] || reminder.type}
                                </Badge>
                              </div>
                            </div>

                            <p className="text-sm text-muted-foreground line-clamp-2">{reminder.message}</p>

                            <div className="flex items-center justify-between gap-2">
                              <p className="text-xs text-muted-foreground">
                                {reminder.auto_send ? "⚡ Auto" : "✋ Manual"} · Programado: {schedDt.date} {schedDt.time}
                              </p>

                              {(reminder.status === "pending_manual" || reminder.status === "scheduled") && (
                                <div className="flex gap-2">
                                  {reminder.channel === "whatsapp" && (
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      className="rounded-xl gap-1.5 h-8"
                                      onClick={() => sendWhatsApp(reminder)}
                                    >
                                      <Send className="h-3.5 w-3.5" />
                                      WhatsApp
                                    </Button>
                                  )}
                                  {reminder.channel === "email" && (
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      className="rounded-xl gap-1.5 h-8"
                                      onClick={() => markAsSent(reminder)}
                                    >
                                      <Check className="h-3.5 w-3.5" />
                                      Marcar enviado
                                    </Button>
                                  )}
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    className="rounded-xl h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
                                    onClick={() => deleteReminder(reminder.id)}
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </Button>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default PendingReminders;
