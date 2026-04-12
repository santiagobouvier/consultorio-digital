import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Send, Trash2, Bell, Mail, MessageSquare, Check, Copy, CheckSquare,
  Search, Pencil, XCircle, Clock, BellRing, MailCheck, X, Plus,
} from "lucide-react";
import LoadingPage from "@/components/LoadingPage";
import { useBusinessId } from "@/hooks/use-business-id";
import { ListPagination, usePagination, ITEMS_PER_PAGE } from "@/components/ListPagination";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { format } from "date-fns";
import { es } from "date-fns/locale";

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
  const { businessId } = useBusinessId();
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("pending");
  const [showSendAllConfirm, setShowSendAllConfirm] = useState(false);
  const [selectedForSent, setSelectedForSent] = useState<Set<string>>(new Set());
  const [currentPage, setCurrentPage] = useState(1);
  const [searchQuery, setSearchQuery] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [cancelTarget, setCancelTarget] = useState<string | null>(null);

  // Edit modal state
  const [editingReminder, setEditingReminder] = useState<Reminder | null>(null);
  const [editMessage, setEditMessage] = useState("");
  const [editSaving, setEditSaving] = useState(false);

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

  // Stats
  const stats = useMemo(() => {
    const pending = reminders.filter(r => r.status === "pending_manual" || r.status === "scheduled").length;
    const sent = reminders.filter(r => r.status === "sent").length;
    const cancelled = reminders.filter(r => r.status === "cancelled").length;
    const whatsapp = reminders.filter(r => r.channel === "whatsapp").length;
    const email = reminders.filter(r => r.channel === "email").length;
    return { pending, sent, cancelled, whatsapp, email, total: reminders.length };
  }, [reminders]);

  const filteredReminders = useMemo(() => {
    let filtered = reminders;
    if (activeTab === "pending") filtered = filtered.filter(r => r.status === "pending_manual" || r.status === "scheduled");
    else if (activeTab === "sent") filtered = filtered.filter(r => r.status === "sent");
    else if (activeTab === "cancelled") filtered = filtered.filter(r => r.status === "cancelled");

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter(r =>
        (r.patient?.full_name || "").toLowerCase().includes(q) ||
        r.message.toLowerCase().includes(q)
      );
    }
    return filtered;
  }, [reminders, activeTab, searchQuery]);

  const { paginatedItems: pageReminders, totalPages } = usePagination(filteredReminders, currentPage);

  useEffect(() => { setCurrentPage(1); }, [activeTab, searchQuery]);

  // Group WhatsApp reminders by patient
  const groupedByPatient: GroupedReminders[] = useMemo(() => {
    const whatsappPending = filteredReminders.filter(
      r => r.channel === "whatsapp" && (r.status === "pending_manual" || r.status === "scheduled")
    );
    const groups = new Map<string, Reminder[]>();
    for (const r of whatsappPending) {
      if (!groups.has(r.patient_id)) groups.set(r.patient_id, []);
      groups.get(r.patient_id)!.push(r);
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
  }, [filteredReminders]);

  // Actions
  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast({ title: "✓ Copiado al portapapeles" });
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
    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(reminder.message)}`, "_blank");
    await supabase.from("scheduled_reminders").update({ status: "sent" }).eq("id", reminder.id);
    setReminders(prev => prev.map(r => r.id === reminder.id ? { ...r, status: "sent" } : r));
    toast({ title: "WhatsApp abierto y marcado como enviado" });
  };

  const markAsSent = async (reminderId: string) => {
    await supabase.from("scheduled_reminders").update({ status: "sent" }).eq("id", reminderId);
    setReminders(prev => prev.map(r => r.id === reminderId ? { ...r, status: "sent" } : r));
    setSelectedForSent(prev => { const n = new Set(prev); n.delete(reminderId); return n; });
    toast({ title: "✓ Marcado como enviado" });
  };

  const markMultipleAsSent = async (ids: string[]) => {
    for (const id of ids) {
      await supabase.from("scheduled_reminders").update({ status: "sent" }).eq("id", id);
    }
    setReminders(prev => prev.map(r => ids.includes(r.id) ? { ...r, status: "sent" } : r));
    setSelectedForSent(new Set());
    toast({ title: `✓ ${ids.length} recordatorios marcados como enviados` });
  };

  const cancelReminder = async (reminderId: string) => {
    await supabase.from("scheduled_reminders").update({ status: "cancelled" }).eq("id", reminderId);
    setReminders(prev => prev.map(r => r.id === reminderId ? { ...r, status: "cancelled" } : r));
    setCancelTarget(null);
    toast({ title: "Recordatorio cancelado" });
  };

  const deleteReminder = async (reminderId: string) => {
    try {
      const { error } = await supabase.from("scheduled_reminders").delete().eq("id", reminderId);
      if (error) throw error;
      setReminders(prev => prev.filter(r => r.id !== reminderId));
      setDeleteTarget(null);
      toast({ title: "Recordatorio eliminado" });
    } catch {
      toast({ title: "Error", description: "No se pudo eliminar", variant: "destructive" });
    }
  };

  const saveEditedMessage = async () => {
    if (!editingReminder) return;
    setEditSaving(true);
    try {
      const { error } = await supabase
        .from("scheduled_reminders")
        .update({ message: editMessage })
        .eq("id", editingReminder.id);
      if (error) throw error;
      setReminders(prev => prev.map(r => r.id === editingReminder.id ? { ...r, message: editMessage } : r));
      setEditingReminder(null);
      toast({ title: "✓ Mensaje actualizado" });
    } catch {
      toast({ title: "Error", description: "No se pudo actualizar", variant: "destructive" });
    } finally {
      setEditSaving(false);
    }
  };

  const whatsappPendingForSendAll = filteredReminders.filter(
    r => r.channel === "whatsapp" && r.status === "pending_manual" && r.patient?.whatsapp_phone
  );

  const sendAllWhatsApp = async () => {
    setShowSendAllConfirm(false);
    for (const reminder of whatsappPendingForSendAll) {
      await sendWhatsApp(reminder);
      await new Promise(resolve => setTimeout(resolve, 1500));
    }
  };

  const sendGroupedWhatsApp = async (group: GroupedReminders) => {
    if (!group.phone) return;
    const phone = group.phone.replace(/\D/g, "");
    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(group.combinedMessage)}`, "_blank");
    for (const r of group.reminders) {
      await supabase.from("scheduled_reminders").update({ status: "sent" }).eq("id", r.id);
    }
    setReminders(prev => prev.map(r =>
      group.reminders.some(gr => gr.id === r.id) ? { ...r, status: "sent" } : r
    ));
    toast({ title: `✓ ${group.reminders.length} enviados a ${group.patientName}` });
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
      <div className="max-w-4xl mx-auto p-4 sm:p-6 lg:p-8 space-y-6">

        {/* ── Hero Header ── */}
        <div className="text-center space-y-3">
          <Badge variant="outline" className="rounded-full px-4 py-1 text-xs font-medium border-primary/30 text-primary">
            <BellRing className="h-3 w-3 mr-1.5" />
            Centro de notificaciones
          </Badge>
          <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold tracking-tight">
            Recordatorios
          </h1>
          <p className="text-sm text-muted-foreground max-w-md mx-auto">
            Gestioná, editá y enviá todos los recordatorios de tus pacientes
          </p>
        </div>

        {/* ── Stats Row ── */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: "Pendientes", value: stats.pending, icon: Clock, accent: "text-orange-400" },
            { label: "Enviados", value: stats.sent, icon: MailCheck, accent: "text-green-400" },
            { label: "WhatsApp", value: stats.whatsapp, icon: MessageSquare, accent: "text-emerald-400" },
            { label: "Email", value: stats.email, icon: Mail, accent: "text-blue-400" },
          ].map((s, i) => (
            <Card key={i} className="border-border/50 bg-card/50 backdrop-blur-sm">
              <CardContent className="p-4 flex items-center gap-3">
                <div className={`p-2 rounded-xl bg-muted/50 ${s.accent}`}>
                  <s.icon className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-xl font-bold">{s.value}</p>
                  <p className="text-xs text-muted-foreground">{s.label}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* ── Search ── */}
        <div className="flex justify-center">
          <div className="relative w-full max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por paciente o mensaje..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="pl-10 rounded-2xl border-border/50 bg-card/60 backdrop-blur-sm h-11"
            />
            {searchQuery && (
              <button onClick={() => setSearchQuery("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>

        {/* ── Tabs ── */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <TabsList className="rounded-2xl">
              <TabsTrigger value="pending" className="gap-1.5 rounded-xl">
                <Bell className="h-4 w-4" />
                Pendientes
                {stats.pending > 0 && (
                  <Badge variant="secondary" className="ml-1 h-5 min-w-5 text-xs rounded-full">{stats.pending}</Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="sent" className="gap-1.5 rounded-xl">
                <Check className="h-4 w-4" />
                Enviados
              </TabsTrigger>
              <TabsTrigger value="cancelled" className="gap-1.5 rounded-xl">
                <XCircle className="h-4 w-4" />
                Cancelados
              </TabsTrigger>
              <TabsTrigger value="all" className="gap-1.5 rounded-xl">
                Todos
              </TabsTrigger>
            </TabsList>

            <div className="flex gap-2 flex-wrap">
              {selectedForSent.size > 0 && (
                <Button size="sm" variant="outline" onClick={() => markMultipleAsSent(Array.from(selectedForSent))} className="rounded-xl gap-2">
                  <CheckSquare className="h-4 w-4" />
                  Marcar {selectedForSent.size} enviados
                </Button>
              )}
              {activeTab === "pending" && whatsappPendingForSendAll.length > 0 && (
                <Button size="sm" onClick={() => setShowSendAllConfirm(true)} className="rounded-xl gap-2">
                  <Send className="h-4 w-4" />
                  Enviar todos
                </Button>
              )}
            </div>
          </div>

          <TabsContent value={activeTab} className="mt-4 space-y-4">
            {/* Grouped reminders */}
            {activeTab === "pending" && groupedByPatient.length > 0 && (
              <div className="space-y-3">
                <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Agrupados por paciente
                </h3>
                {groupedByPatient.map((group, i) => (
                  <Card key={group.patientId} className="border-primary/20 bg-primary/5 animate-fade-in" style={{ animationDelay: `${i * 60}ms` }}>
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0 space-y-1.5">
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className="rounded-full text-xs">{group.reminders.length} msgs</Badge>
                            <p className="font-semibold">{group.patientName}</p>
                          </div>
                          <p className="text-sm text-muted-foreground line-clamp-2">{group.combinedMessage.slice(0, 120)}...</p>
                        </div>
                        <div className="flex gap-2 shrink-0">
                          <Button size="sm" variant="outline" className="rounded-xl gap-1.5 h-8" onClick={() => copyToClipboard(group.combinedMessage)}>
                            <Copy className="h-3.5 w-3.5" />
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

            {/* List */}
            {filteredReminders.length === 0 ? (
              <Card className="border-dashed">
                <CardContent className="py-16 text-center">
                  <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-muted/50 flex items-center justify-center">
                    <Bell className="h-8 w-8 text-muted-foreground" />
                  </div>
                  <p className="text-muted-foreground font-medium">
                    {activeTab === "pending" ? "No hay recordatorios pendientes"
                      : activeTab === "sent" ? "No hay recordatorios enviados"
                      : activeTab === "cancelled" ? "No hay recordatorios cancelados"
                      : "No hay recordatorios"}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">Los recordatorios se crean automáticamente con cada cita</p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-3">
                {pageReminders.map((reminder, i) => {
                  const apptDt = reminder.appointment?.start_at ? formatDateTime(reminder.appointment.start_at) : null;
                  const schedDt = formatDateTime(reminder.scheduled_for);
                  const chConf = channelConfig[reminder.channel] || channelConfig.whatsapp;
                  const stConf = statusConfig[reminder.status] || statusConfig.scheduled;
                  const ChannelIcon = chConf.icon;
                  const isPending = reminder.status === "pending_manual" || reminder.status === "scheduled";
                  const isCancelled = reminder.status === "cancelled";

                  return (
                    <Card
                      key={reminder.id}
                      className={`overflow-hidden transition-all duration-300 hover:shadow-md animate-fade-in ${isCancelled ? "opacity-60" : ""}`}
                      style={{ animationDelay: `${i * 50}ms` }}
                    >
                      <CardContent className="p-4">
                        <div className="flex items-start gap-3">
                          {isPending && (
                            <div className="pt-1">
                              <Checkbox
                                checked={selectedForSent.has(reminder.id)}
                                onCheckedChange={() => toggleSelectForSent(reminder.id)}
                              />
                            </div>
                          )}

                          <div className={`p-2.5 rounded-xl shrink-0 ${chConf.color}`}>
                            <ChannelIcon className="h-4 w-4" />
                          </div>

                          <div className="flex-1 min-w-0 space-y-2">
                            <div className="flex items-start justify-between gap-2">
                              <div>
                                <p className="font-semibold">{reminder.patient?.full_name || "Sin paciente"}</p>
                                {apptDt && (
                                  <p className="text-sm text-muted-foreground">
                                    Cita: {apptDt.date} a las {apptDt.time}
                                  </p>
                                )}
                              </div>
                              <div className="flex items-center gap-1.5 shrink-0">
                                <Badge variant="outline" className={`rounded-full text-xs ${stConf.color}`}>{stConf.label}</Badge>
                                <Badge variant="outline" className="rounded-full text-xs">{typeLabels[reminder.type] || reminder.type}</Badge>
                              </div>
                            </div>

                            <p className="text-sm text-muted-foreground line-clamp-2">{reminder.message}</p>

                            <div className="flex items-center justify-between gap-2 flex-wrap">
                              <p className="text-xs text-muted-foreground">
                                {reminder.auto_send ? "⚡ Auto" : "✋ Manual"} · {schedDt.date} {schedDt.time}
                              </p>

                              <div className="flex gap-1.5">
                                {/* Edit message */}
                                {isPending && (
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    className="rounded-xl h-8 w-8 p-0"
                                    onClick={() => { setEditingReminder(reminder); setEditMessage(reminder.message); }}
                                    title="Editar mensaje"
                                  >
                                    <Pencil className="h-3.5 w-3.5" />
                                  </Button>
                                )}

                                {/* Copy */}
                                <Button size="sm" variant="ghost" className="rounded-xl h-8 w-8 p-0" onClick={() => copyToClipboard(reminder.message)} title="Copiar">
                                  <Copy className="h-3.5 w-3.5" />
                                </Button>

                                {/* Send WhatsApp */}
                                {isPending && reminder.channel === "whatsapp" && (
                                  <Button size="sm" variant="outline" className="rounded-xl gap-1.5 h-8" onClick={() => sendWhatsApp(reminder)}>
                                    <Send className="h-3.5 w-3.5" />
                                    <span className="hidden sm:inline">WhatsApp</span>
                                  </Button>
                                )}

                                {/* Mark as sent */}
                                {isPending && (
                                  <Button size="sm" variant="outline" className="rounded-xl gap-1.5 h-8" onClick={() => markAsSent(reminder.id)}>
                                    <Check className="h-3.5 w-3.5" />
                                    <span className="hidden sm:inline">Enviado</span>
                                  </Button>
                                )}

                                {/* Cancel */}
                                {isPending && (
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    className="rounded-xl h-8 w-8 p-0 text-muted-foreground hover:text-orange-400"
                                    onClick={() => setCancelTarget(reminder.id)}
                                    title="Cancelar"
                                  >
                                    <XCircle className="h-3.5 w-3.5" />
                                  </Button>
                                )}

                                {/* Delete */}
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="rounded-xl h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
                                  onClick={() => setDeleteTarget(reminder.id)}
                                  title="Eliminar"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                              </div>
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

      {/* ── Edit Message Dialog ── */}
      <Dialog open={!!editingReminder} onOpenChange={open => !open && setEditingReminder(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Editar mensaje</DialogTitle>
            <DialogDescription>
              Modificá el texto del recordatorio para {editingReminder?.patient?.full_name}
            </DialogDescription>
          </DialogHeader>
          <Textarea
            value={editMessage}
            onChange={e => setEditMessage(e.target.value)}
            rows={6}
            className="rounded-xl"
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingReminder(null)} className="rounded-xl">Cancelar</Button>
            <Button onClick={saveEditedMessage} disabled={editSaving || !editMessage.trim()} className="rounded-xl">
              {editSaving ? "Guardando..." : "Guardar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Cancel Confirmation ── */}
      <AlertDialog open={!!cancelTarget} onOpenChange={open => !open && setCancelTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancelar recordatorio</AlertDialogTitle>
            <AlertDialogDescription>
              El recordatorio se marcará como cancelado y no se enviará. Podés eliminarlo después si querés.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Volver</AlertDialogCancel>
            <AlertDialogAction onClick={() => cancelTarget && cancelReminder(cancelTarget)}>
              Cancelar recordatorio
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ── Delete Confirmation ── */}
      <AlertDialog open={!!deleteTarget} onOpenChange={open => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminar recordatorio</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción es permanente. ¿Estás seguro de que querés eliminar este recordatorio?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Volver</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleteTarget && deleteReminder(deleteTarget)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ── Send All Confirmation ── */}
      <AlertDialog open={showSendAllConfirm} onOpenChange={setShowSendAllConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Enviar todos los WhatsApp</AlertDialogTitle>
            <AlertDialogDescription>
              Se abrirán <strong>{whatsappPendingForSendAll.length}</strong> ventanas de WhatsApp de forma secuencial con 1.5s de intervalo.
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
