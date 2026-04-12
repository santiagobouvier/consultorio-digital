import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "@/hooks/use-toast";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Send, Trash2, Bell, Mail, MessageSquare, Check, Filter, Copy, CheckSquare } from "lucide-react";
import LoadingPage from "@/components/LoadingPage";
import { useBusinessId } from "@/hooks/use-business-id";
import { ListPagination, usePagination, ITEMS_PER_PAGE } from "@/components/ListPagination";
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

interface GroupedReminders {
  patientName: string;
  patientId: string;
  reminders: Reminder[];
  combinedMessage: string;
  phone: string | null;
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
  const [showSendAllConfirm, setShowSendAllConfirm] = useState(false);
  const [selectedForSent, setSelectedForSent] = useState<Set<string>>(new Set());
  const [currentPage, setCurrentPage] = useState(1);

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

  const { paginatedItems: pageReminders, totalPages } = usePagination(filteredReminders, currentPage);

  // Reset page on tab change
  useEffect(() => { setCurrentPage(1); }, [activeTab]);

  const pendingCount = reminders.filter(r => r.status === "pending_manual" || r.status === "scheduled").length;
  const sentCount = reminders.filter(r => r.status === "sent").length;

  // Group WhatsApp reminders by patient
  const groupedByPatient: GroupedReminders[] = (() => {
    const whatsappPending = filteredReminders.filter(
      r => r.channel === "whatsapp" && (r.status === "pending_manual" || r.status === "scheduled")
    );
    const groups = new Map<string, Reminder[]>();
    for (const r of whatsappPending) {
      const key = r.patient_id;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(r);
    }
    return Array.from(groups.entries())
      .filter(([_, rems]) => rems.length > 1)
      .map(([patientId, rems]) => ({
        patientId,
        patientName: rems[0].patient?.full_name || "Sin paciente",
        reminders: rems,
        combinedMessage: rems.map(r => r.message).join("\n\n---\n\n"),
        phone: rems[0].patient?.whatsapp_phone || null,
      }));
  })();

  const hasGroupedReminders = groupedByPatient.length > 0;

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast({ title: "Mensaje copiado al portapapeles" });
    } catch {
      toast({ title: "Error", description: "No se pudo copiar", variant: "destructive" });
    }
  };

  const sendWhatsApp = async (reminder: Reminder) => {
    if (!reminder.patient?.whatsapp_phone) {
      toast({ title: "Error", description: "El paciente no tiene teléfono", variant: "destructive" });
      return;
    }
    const phone = reminder.patient.whatsapp_phone.replace(/\D/g, "");
    const url = `https://wa.me/${phone}?text=${encodeURIComponent(reminder.message)}`;
    window.open(url, "_blank");

    await supabase.from("scheduled_reminders").update({ status: "sent" }).eq("id", reminder.id);
    setReminders((prev) => prev.map((r) => r.id === reminder.id ? { ...r, status: "sent" } : r));
    toast({ title: "WhatsApp abierto", description: "Se marcó como enviado" });
  };

  const markAsSent = async (reminderId: string) => {
    await supabase.from("scheduled_reminders").update({ status: "sent" }).eq("id", reminderId);
    setReminders((prev) => prev.map((r) => r.id === reminderId ? { ...r, status: "sent" } : r));
    setSelectedForSent(prev => { const n = new Set(prev); n.delete(reminderId); return n; });
    toast({ title: "Marcado como enviado" });
  };

  const markMultipleAsSent = async (ids: string[]) => {
    for (const id of ids) {
      await supabase.from("scheduled_reminders").update({ status: "sent" }).eq("id", id);
    }
    setReminders(prev => prev.map(r => ids.includes(r.id) ? { ...r, status: "sent" } : r));
    setSelectedForSent(new Set());
    toast({ title: `${ids.length} recordatorios marcados como enviados` });
  };

  const deleteReminder = async (reminderId: string) => {
    try {
      const { error } = await supabase.from("scheduled_reminders").delete().eq("id", reminderId);
      if (error) throw error;
      setReminders((prev) => prev.filter((r) => r.id !== reminderId));
      toast({ title: "Recordatorio eliminado" });
    } catch (error) {
      toast({ title: "Error", description: "No se pudo eliminar", variant: "destructive" });
    }
  };

  const whatsappPendingForSendAll = filteredReminders.filter(
    (r) => r.channel === "whatsapp" && r.status === "pending_manual" && r.patient?.whatsapp_phone
  );

  const sendAllWhatsApp = async () => {
    setShowSendAllConfirm(false);
    for (const reminder of whatsappPendingForSendAll) {
      await sendWhatsApp(reminder);
      await new Promise((resolve) => setTimeout(resolve, 1500));
    }
  };

  const sendGroupedWhatsApp = async (group: GroupedReminders) => {
    if (!group.phone) return;
    const phone = group.phone.replace(/\D/g, "");
    const url = `https://wa.me/${phone}?text=${encodeURIComponent(group.combinedMessage)}`;
    window.open(url, "_blank");

    for (const r of group.reminders) {
      await supabase.from("scheduled_reminders").update({ status: "sent" }).eq("id", r.id);
    }
    setReminders(prev => prev.map(r =>
      group.reminders.some(gr => gr.id === r.id) ? { ...r, status: "sent" } : r
    ));
    toast({ title: `${group.reminders.length} recordatorios enviados a ${group.patientName}` });
  };

  const formatDateTime = (isoDate: string) => {
    const date = new Date(isoDate);
    return {
      date: date.toLocaleDateString("es-UY", { day: "2-digit", month: "2-digit", year: "numeric" }),
      time: date.toLocaleTimeString("es-UY", { hour: "2-digit", minute: "2-digit" }),
    };
  };

  const toggleSelectForSent = (id: string) => {
    setSelectedForSent(prev => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id); else n.add(id);
      return n;
    });
  };

  if (loading) return <LoadingPage />;

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-4xl mx-auto p-4 sm:p-6 lg:p-8 space-y-5">
        <div>
          <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold">Recordatorios</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Gestión centralizada de recordatorios por email y WhatsApp
          </p>
        </div>

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

            <div className="flex gap-2">
              {selectedForSent.size > 0 && (
                <Button size="sm" variant="outline" onClick={() => markMultipleAsSent(Array.from(selectedForSent))} className="rounded-xl gap-2">
                  <CheckSquare className="h-4 w-4" />
                  Marcar {selectedForSent.size} como enviados
                </Button>
              )}
              {activeTab === "pending" && whatsappPendingForSendAll.length > 0 && (
                <Button size="sm" onClick={() => setShowSendAllConfirm(true)} className="rounded-xl gap-2">
                  <Send className="h-4 w-4" />
                  Enviar todos WhatsApp
                </Button>
              )}
            </div>
          </div>

          <TabsContent value={activeTab} className="mt-4">
            {/* Grouped reminders section */}
            {activeTab === "pending" && hasGroupedReminders && (
              <div className="mb-4 space-y-3">
                <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                  Agrupados por paciente
                </h3>
                {groupedByPatient.map(group => (
                  <Card key={group.patientId} className="border-primary/20">
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0 space-y-2">
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className="rounded-full">{group.reminders.length} recordatorios</Badge>
                            <p className="font-semibold">{group.patientName}</p>
                          </div>
                          <p className="text-sm text-muted-foreground line-clamp-2">{group.combinedMessage.slice(0, 120)}...</p>
                        </div>
                        <div className="flex gap-2 shrink-0">
                          <Button size="sm" variant="outline" className="rounded-xl gap-1.5 h-8" onClick={() => copyToClipboard(group.combinedMessage)}>
                            <Copy className="h-3.5 w-3.5" />
                            Copiar
                          </Button>
                          {group.phone && (
                            <Button size="sm" className="rounded-xl gap-1.5 h-8" onClick={() => sendGroupedWhatsApp(group)}>
                              <Send className="h-3.5 w-3.5" />
                              Enviar junto
                            </Button>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}

            {filteredReminders.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <Bell className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">
                    {activeTab === "pending" ? "No hay recordatorios pendientes"
                      : activeTab === "sent" ? "No hay recordatorios enviados"
                      : "No hay recordatorios"}
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-3">
                {pageReminders.map((reminder) => {
                  const apptDt = reminder.appointment?.start_at ? formatDateTime(reminder.appointment.start_at) : null;
                  const schedDt = formatDateTime(reminder.scheduled_for);
                  const chConf = channelConfig[reminder.channel] || channelConfig.whatsapp;
                  const stConf = statusConfig[reminder.status] || statusConfig.scheduled;
                  const ChannelIcon = chConf.icon;
                  const isPending = reminder.status === "pending_manual" || reminder.status === "scheduled";

                  return (
                    <Card key={reminder.id} className="overflow-hidden">
                      <CardContent className="p-4">
                        <div className="flex items-start gap-3">
                          {/* Checkbox for bulk mark as sent */}
                          {isPending && (
                            <div className="pt-1">
                              <Checkbox
                                checked={selectedForSent.has(reminder.id)}
                                onCheckedChange={() => toggleSelectForSent(reminder.id)}
                              />
                            </div>
                          )}

                          <div className={`p-2 rounded-lg shrink-0 ${chConf.color}`}>
                            <ChannelIcon className="h-4 w-4" />
                          </div>

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

                              {isPending && (
                                <div className="flex gap-2">
                                  {/* Copy message button */}
                                  <Button size="sm" variant="ghost" className="rounded-xl gap-1.5 h-8" onClick={() => copyToClipboard(reminder.message)}>
                                    <Copy className="h-3.5 w-3.5" />
                                    <span className="hidden sm:inline">Copiar</span>
                                  </Button>

                                  {reminder.channel === "whatsapp" && (
                                    <Button size="sm" variant="outline" className="rounded-xl gap-1.5 h-8" onClick={() => sendWhatsApp(reminder)}>
                                      <Send className="h-3.5 w-3.5" />
                                      WhatsApp
                                    </Button>
                                  )}

                                  <Button size="sm" variant="outline" className="rounded-xl gap-1.5 h-8" onClick={() => markAsSent(reminder.id)}>
                                    <Check className="h-3.5 w-3.5" />
                                    <span className="hidden sm:inline">Enviado</span>
                                  </Button>

                                  <Button size="sm" variant="ghost" className="rounded-xl h-8 w-8 p-0 text-muted-foreground hover:text-destructive" onClick={() => deleteReminder(reminder.id)}>
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
            <ListPagination
              currentPage={currentPage}
              totalPages={totalPages}
              onPageChange={setCurrentPage}
              totalItems={filteredReminders.length}
              pageSize={ITEMS_PER_PAGE}
            />
          </TabsContent>
        </Tabs>
      </div>

      {/* Send All Confirmation Dialog */}
      <AlertDialog open={showSendAllConfirm} onOpenChange={setShowSendAllConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Enviar todos los WhatsApp</AlertDialogTitle>
            <AlertDialogDescription>
              Se abrirán <strong>{whatsappPendingForSendAll.length}</strong> ventanas de WhatsApp de forma secuencial.
              Cada mensaje se enviará con un intervalo de 1.5 segundos.
              <br /><br />
              ¿Deseas continuar?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={sendAllWhatsApp}>
              Enviar {whatsappPendingForSendAll.length} mensajes
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default PendingReminders;
