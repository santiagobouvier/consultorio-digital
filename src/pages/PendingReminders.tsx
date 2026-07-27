import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/hooks/use-toast";
import { HelpTooltip } from "@/components/HelpTooltip";
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
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import {
  Bell, Mail, MessageSquare, Search, Pencil, XCircle, Clock, BellRing,
  X, Plus, Settings2, AlertTriangle, CheckCircle2, RotateCcw, Loader2,
} from "lucide-react";
import { RouteSkeleton } from "@/components/RouteSkeleton";
import { useBusinessId } from "@/hooks/use-business-id";
import { ListPagination, usePagination, ITEMS_PER_PAGE } from "@/components/ListPagination";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { format } from "date-fns";
import { es } from "date-fns/locale";

// Página "Recordatorios": centro de avisos automáticos.
// Los recordatorios salen SOLOS por email (Resend) y por WhatsApp (Cloud API
// oficial de Meta, plantilla aprobada con formato fijo). Acá el profesional
// ve qué va a salir, qué salió (y qué falló), y configura anticipación,
// plantilla de email y su número de contacto para WhatsApp.

interface Reminder {
  id: string;
  appointment_id: string | null;
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

const DEFAULT_TEMPLATE =
  "Hola {{paciente}}, te recuerdo tu sesión del {{fecha}} a las {{hora}}. Modalidad: {{modalidad}}. {{link}}. Cualquier cosa me escribís por acá.";

const VARIABLES = [
  { key: "{{paciente}}", desc: "Nombre del paciente" },
  { key: "{{fecha}}", desc: "Fecha de la cita" },
  { key: "{{hora}}", desc: "Hora de la cita" },
  { key: "{{modalidad}}", desc: "Online o Presencial" },
  { key: "{{link}}", desc: "Link o ubicación" },
];

const HOURS_OPTIONS = [
  { value: "1", label: "1 hora antes" },
  { value: "3", label: "3 horas antes" },
  { value: "24", label: "1 día antes" },
  { value: "48", label: "2 días antes" },
  { value: "72", label: "3 días antes" },
  { value: "168", label: "1 semana antes" },
];

const statusConfig: Record<string, { label: string; color: string }> = {
  scheduled: { label: "Programado", color: "bg-yellow-500/10 text-yellow-500 border-yellow-500/20" },
  sending: { label: "Saliendo…", color: "bg-blue-500/10 text-blue-400 border-blue-500/20" },
  sent: { label: "Enviado", color: "bg-green-500/10 text-green-500 border-green-500/20" },
  failed: { label: "Falló", color: "bg-destructive/10 text-destructive border-destructive/20" },
  cancelled: { label: "Cancelado", color: "bg-muted text-muted-foreground" },
  pending_manual: { label: "Manual (sistema anterior)", color: "bg-muted text-muted-foreground" },
};

const channelConfig: Record<string, { label: string; icon: typeof Mail }> = {
  email: { label: "Email", icon: Mail },
  whatsapp: { label: "WhatsApp", icon: MessageSquare },
};

const UPCOMING_STATUSES = ["scheduled", "sending"];

const PendingReminders = () => {
  const { businessId } = useBusinessId();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState("upcoming");
  const [currentPage, setCurrentPage] = useState(1);
  const [searchQuery, setSearchQuery] = useState("");
  const [cancelTarget, setCancelTarget] = useState<string | null>(null);

  // Edición de mensaje
  const [editingReminder, setEditingReminder] = useState<Reminder | null>(null);
  const [editMessage, setEditMessage] = useState("");
  const [editSaving, setEditSaving] = useState(false);

  // Programar aviso puntual
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createForm, setCreateForm] = useState({
    mode: "appointment" as "appointment" | "free",
    patientId: "",
    appointmentId: "",
    message: "",
    hoursBefore: "24",
    scheduledAt: "",
  });
  const [createSaving, setCreateSaving] = useState(false);

  // ── Configuración (clinic_settings del profesional) ──
  const [settingsRowId, setSettingsRowId] = useState<string | null>(null);
  const [settingsLoading, setSettingsLoading] = useState(true);
  const [autoEmail, setAutoEmail] = useState(true);
  const [autoWhatsapp, setAutoWhatsapp] = useState(true);
  const [waContactPhone, setWaContactPhone] = useState("");
  const [hoursBefore, setHoursBefore] = useState("24");
  const [template, setTemplate] = useState(DEFAULT_TEMPLATE);
  const [settingsSnapshot, setSettingsSnapshot] = useState("");
  const [settingsSaving, setSettingsSaving] = useState(false);
  const templateRef = useRef<HTMLTextAreaElement>(null);

  const settingsDirty = useMemo(
    () => JSON.stringify({ autoEmail, autoWhatsapp, waContactPhone, hoursBefore, template }) !== settingsSnapshot,
    [autoEmail, autoWhatsapp, waContactPhone, hoursBefore, template, settingsSnapshot]
  );

  useEffect(() => {
    const loadSettings = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;
        const { data } = await supabase
          .from("clinic_settings")
          .select("id, reminder_hours_before, auto_email_reminders, auto_whatsapp_reminders, whatsapp_contact_phone, default_reminder_message")
          .eq("user_id", user.id)
          .maybeSingle();
        const loadedAuto = data?.auto_email_reminders ?? true;
        const loadedAutoWa = data?.auto_whatsapp_reminders ?? true;
        const loadedWaPhone = data?.whatsapp_contact_phone ?? "";
        const loadedHours = String(data?.reminder_hours_before ?? 24);
        const loadedTemplate = data?.default_reminder_message || DEFAULT_TEMPLATE;
        setSettingsRowId(data?.id ?? null);
        setAutoEmail(loadedAuto);
        setAutoWhatsapp(loadedAutoWa);
        setWaContactPhone(loadedWaPhone);
        setHoursBefore(loadedHours);
        setTemplate(loadedTemplate);
        setSettingsSnapshot(JSON.stringify({ autoEmail: loadedAuto, autoWhatsapp: loadedAutoWa, waContactPhone: loadedWaPhone, hoursBefore: loadedHours, template: loadedTemplate }));
      } catch (e) {
        console.error("Error cargando configuración de recordatorios:", e);
      } finally {
        setSettingsLoading(false);
      }
    };
    void loadSettings();
  }, []);

  const saveSettings = async () => {
    setSettingsSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const payload = {
        auto_email_reminders: autoEmail,
        auto_whatsapp_reminders: autoWhatsapp,
        whatsapp_contact_phone: waContactPhone.trim() || null,
        reminder_hours_before: parseInt(hoursBefore),
        default_reminder_message: template.trim() || DEFAULT_TEMPLATE,
      };
      if (settingsRowId) {
        const { error } = await supabase.from("clinic_settings").update(payload).eq("id", settingsRowId);
        if (error) throw error;
      } else {
        const { data, error } = await supabase
          .from("clinic_settings")
          .insert([{ user_id: user.id, ...payload }])
          .select("id")
          .single();
        if (error) throw error;
        setSettingsRowId(data.id);
      }
      setSettingsSnapshot(JSON.stringify({ autoEmail, autoWhatsapp, waContactPhone, hoursBefore, template }));
      toast({ title: "Configuración guardada", description: "Aplica a los recordatorios de las próximas citas." });
    } catch (e) {
      console.error(e);
      toast({ title: "Error", description: "No se pudo guardar la configuración", variant: "destructive" });
    } finally {
      setSettingsSaving(false);
    }
  };

  const insertVariable = (variable: string) => {
    const desc = VARIABLES.find((v) => v.key === variable)?.desc?.toLowerCase() || "dato real";
    const el = templateRef.current;
    if (!el) {
      setTemplate((t) => t + " " + variable);
    } else {
      const start = el.selectionStart ?? template.length;
      const end = el.selectionEnd ?? template.length;
      setTemplate(template.slice(0, start) + variable + template.slice(end));
      requestAnimationFrame(() => {
        el.focus();
        el.setSelectionRange(start + variable.length, start + variable.length);
      });
    }
    // Feedback claro: que se note que el botón AGREGÓ algo al mensaje.
    toast({
      title: `Se agregó ${variable} al mensaje`,
      description: `Cuando el aviso salga, se reemplaza por: ${desc}. Si lo tocaste sin querer, borralo del texto.`,
    });
  };

  // ── Recordatorios ──
  const { data: reminders = [], isLoading: loading } = useQuery({
    queryKey: ["reminders", businessId],
    queryFn: async () => {
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
      return (data as unknown as Reminder[]) || [];
    },
    enabled: !!businessId,
    staleTime: 30_000,
    gcTime: 300_000,
    refetchOnWindowFocus: true,
  });

  // Pacientes y citas para "Programar aviso"
  const { data: patientsAndAppts } = useQuery({
    queryKey: ["reminders_create_data", businessId],
    queryFn: async () => {
      const [pRes, aRes] = await Promise.all([
        supabase.from("patients").select("id, full_name, email").eq("business_id", businessId!).eq("is_active", true).order("full_name"),
        supabase.from("appointments").select("id, start_at, patient_id").eq("business_id", businessId!).gte("start_at", new Date().toISOString()).order("start_at", { ascending: true }).limit(100),
      ]);
      return { patients: pRes.data || [], appointments: aRes.data || [] };
    },
    enabled: !!businessId,
    staleTime: 60_000,
  });

  const patients = patientsAndAppts?.patients || [];
  const upcomingAppointments = patientsAndAppts?.appointments || [];

  const invalidateReminders = () =>
    queryClient.invalidateQueries({ queryKey: ["reminders", businessId] });

  const updateReminderLocal = (id: string, updates: Partial<Reminder>) => {
    queryClient.setQueryData(["reminders", businessId], (old: Reminder[] | undefined) =>
      (old || []).map((r) => (r.id === id ? { ...r, ...updates } : r))
    );
  };

  const upcoming = useMemo(
    () => reminders.filter((r) => UPCOMING_STATUSES.includes(r.status)),
    [reminders]
  );
  const history = useMemo(
    () =>
      reminders
        .filter((r) => !UPCOMING_STATUSES.includes(r.status))
        .sort((a, b) => b.scheduled_for.localeCompare(a.scheduled_for)),
    [reminders]
  );
  const failedCount = useMemo(() => history.filter((r) => r.status === "failed").length, [history]);

  const filteredReminders = useMemo(() => {
    let list = activeTab === "upcoming" ? upcoming : history;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(
        (r) =>
          (r.patient?.full_name || "").toLowerCase().includes(q) ||
          r.message.toLowerCase().includes(q)
      );
    }
    return list;
  }, [upcoming, history, activeTab, searchQuery]);

  const { paginatedItems: pageReminders, totalPages } = usePagination(filteredReminders, currentPage);

  useEffect(() => { setCurrentPage(1); }, [activeTab, searchQuery]);

  // ── Acciones ──
  const cancelReminder = async (reminderId: string) => {
    await supabase.from("scheduled_reminders").update({ status: "cancelled" }).eq("id", reminderId);
    updateReminderLocal(reminderId, { status: "cancelled" });
    setCancelTarget(null);
    toast({ title: "Aviso cancelado", description: "No se va a enviar." });
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
      updateReminderLocal(editingReminder.id, { message: editMessage });
      setEditingReminder(null);
      toast({ title: "✓ Mensaje actualizado" });
    } catch {
      toast({ title: "Error", description: "No se pudo actualizar", variant: "destructive" });
    } finally {
      setEditSaving(false);
    }
  };

  const retryFailed = async (reminder: Reminder) => {
    // Volver a programarlo: el robot lo toma en la próxima pasada (cada 5 min).
    if (reminder.channel === "whatsapp" ? !reminder.patient?.whatsapp_phone : !reminder.patient?.email) {
      toast({
        title: reminder.channel === "whatsapp" ? "El paciente no tiene WhatsApp" : "El paciente no tiene email",
        description: reminder.channel === "whatsapp"
          ? "Cargale un teléfono en su ficha y después reintentá."
          : "Cargale un email en su ficha y después reintentá.",
        variant: "destructive",
      });
      return;
    }
    await supabase.from("scheduled_reminders").update({ status: "scheduled" }).eq("id", reminder.id);
    updateReminderLocal(reminder.id, { status: "scheduled" });
    toast({ title: "Reintentando", description: "Sale en los próximos minutos." });
  };

  const createManualReminder = async () => {
    if (!businessId || !createForm.patientId || !createForm.message.trim()) return;
    if (createForm.mode === "appointment" && !createForm.appointmentId) return;
    if (createForm.mode === "free" && !createForm.scheduledAt) return;
    setCreateSaving(true);
    try {
      let scheduledFor: Date;
      let appointmentId: string | null = null;

      if (createForm.mode === "appointment") {
        const appt = upcomingAppointments.find((a) => a.id === createForm.appointmentId);
        if (!appt) throw new Error("Cita no encontrada");
        scheduledFor = new Date(appt.start_at);
        scheduledFor.setHours(scheduledFor.getHours() - parseInt(createForm.hoursBefore));
        appointmentId = createForm.appointmentId;
      } else {
        scheduledFor = new Date(createForm.scheduledAt);
        if (isNaN(scheduledFor.getTime()) || scheduledFor.getTime() <= Date.now()) {
          toast({ title: "Fecha inválida", description: "Elegí una fecha y hora futura.", variant: "destructive" });
          setCreateSaving(false);
          return;
        }
      }

      const { error } = await supabase.from("scheduled_reminders").insert({
        appointment_id: appointmentId,
        patient_id: createForm.patientId,
        business_id: businessId,
        scheduled_for: scheduledFor.toISOString(),
        message: createForm.message,
        channel: "email",
        type: "reminder",
        status: "scheduled",
        auto_send: true,
      });
      if (error) throw error;

      invalidateReminders();
      setShowCreateModal(false);
      setCreateForm({ mode: "appointment", patientId: "", appointmentId: "", message: "", hoursBefore: "24", scheduledAt: "" });
      toast({ title: "✓ Aviso programado", description: "Sale solo por email en la fecha elegida." });
    } catch (err) {
      console.error(err);
      toast({ title: "Error", description: "No se pudo programar el aviso", variant: "destructive" });
    } finally {
      setCreateSaving(false);
    }
  };

  const selectedPatientForCreate = patients.find((p) => p.id === createForm.patientId);
  const appointmentsForPatient = upcomingAppointments.filter((a) => a.patient_id === createForm.patientId);
  const createPatientHasEmail = !!selectedPatientForCreate?.email;

  const formatDateTime = (isoDate: string) => {
    const date = new Date(isoDate);
    return {
      date: date.toLocaleDateString("es-UY", { day: "2-digit", month: "2-digit", year: "numeric" }),
      time: date.toLocaleTimeString("es-UY", { hour: "2-digit", minute: "2-digit" }),
    };
  };

  if (!businessId) return <RouteSkeleton />;

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto w-full max-w-[1500px] p-4 sm:p-6 lg:p-8 space-y-6">

        {/* ── Encabezado de página ── */}
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3 min-w-0">
            <span className="h-11 w-11 rounded-2xl flex items-center justify-center shrink-0" style={{ background: "hsla(22, 90%, 58%, 0.14)" }}>
              <BellRing className="h-5 w-5" style={{ color: "hsl(22 90% 58%)" }} />
            </span>
            <div className="min-w-0">
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight inline-flex items-center gap-2">
                Recordatorios
                <HelpTooltip id="reminders" />
              </h1>
              <p className="text-sm text-muted-foreground">
                Tus pacientes reciben el aviso solos — acá ves qué va a salir y qué salió.
              </p>
            </div>
          </div>
          <Button onClick={() => setShowCreateModal(true)} className="hidden sm:inline-flex gap-2 rounded-xl h-11 px-5 font-semibold shadow-md shadow-primary/20">
            <Plus className="h-4 w-4" />
            Programar aviso
          </Button>
        </div>

        {/* Desktop: listas protagonistas (2/3) + configuración al costado */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        <div className="order-1 lg:order-2 space-y-6">
        {/* ── Configuración ── */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Settings2 className="h-4 w-4 text-primary" />
              Cómo se envían
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            {settingsLoading ? (
              <div className="py-6 flex items-center justify-center text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin mr-2" /> Cargando...
              </div>
            ) : (
              <>
                {/* Canales apilados: la tarjeta vive en un panel angosto */}
                <div className="space-y-2.5">
                  {/* Canal email */}
                  <div className="flex items-center justify-between gap-3 rounded-lg border p-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="p-2 rounded-lg bg-blue-500/10 text-blue-400 shrink-0">
                        <Mail className="h-4 w-4" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium">Email automático</p>
                        <p className="text-xs text-muted-foreground">Se envía solo, sin que hagas nada</p>
                      </div>
                    </div>
                    <Switch checked={autoEmail} onCheckedChange={setAutoEmail} className="shrink-0" />
                  </div>

                  {/* Canal WhatsApp (API oficial de Meta) */}
                  <div className="rounded-lg border p-3 space-y-3">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="p-2 rounded-lg bg-green-500/10 text-green-500 shrink-0">
                          <MessageSquare className="h-4 w-4" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-medium">WhatsApp automático</p>
                          <p className="text-xs text-muted-foreground">Se envía solo, desde el número oficial del sistema</p>
                        </div>
                      </div>
                      <Switch checked={autoWhatsapp} onCheckedChange={setAutoWhatsapp} className="shrink-0" />
                    </div>
                    {autoWhatsapp && (
                      <div className="space-y-1.5">
                        <Label htmlFor="wa-contact-phone">Tu WhatsApp de contacto (va dentro del mensaje)</Label>
                        <Input
                          id="wa-contact-phone"
                          value={waContactPhone}
                          onChange={(e) => setWaContactPhone(e.target.value)}
                          placeholder="098 123 456"
                          inputMode="tel"
                          className="rounded-xl"
                        />
                        <p className="text-xs text-muted-foreground">
                          El recordatorio automático le dice al paciente:{" "}
                          <span className="italic">
                            "Si necesitás reprogramar o cancelar, escribile a tu profesional: <strong>este número</strong>"
                          </span>
                          . Poné acá tu WhatsApp personal o el de tu consultorio — donde quieras
                          recibir las consultas de tus pacientes. (El número que envía los avisos es
                          automático y no recibe respuestas.)
                        </p>
                        {!waContactPhone.trim() && (
                          <p className="text-xs text-destructive font-medium">
                            Sin tu número, los avisos por WhatsApp no salen.
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-4">
                  <div className="space-y-1.5">
                    <Label>Anticipación</Label>
                    <Select value={hoursBefore} onValueChange={setHoursBefore}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {HOURS_OPTIONS.map((o) => (
                          <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">Cuánto antes de la cita sale el aviso.</p>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Mensaje del recordatorio por email</Label>
                  <p className="text-xs text-muted-foreground">
                    Las etiquetas como <span className="font-mono">{"{{paciente}}"}</span> son
                    comodines: cuando el aviso sale, se cambian solas por el dato real de cada
                    cita (el nombre, la fecha…). El de WhatsApp no se edita acá: usa un formato
                    fijo aprobado por Meta.
                  </p>
                  <Textarea
                    ref={templateRef}
                    value={template}
                    onChange={(e) => setTemplate(e.target.value)}
                    rows={3}
                    className="resize-none text-sm"
                  />
                  <p className="text-xs text-muted-foreground">
                    Tocá una etiqueta para <strong>agregarla</strong> al mensaje, donde tengas el cursor:
                  </p>
                  <div className="flex flex-wrap items-center gap-1.5">
                    {VARIABLES.map((v) => (
                      <button
                        key={v.key}
                        type="button"
                        onClick={() => insertVariable(v.key)}
                        title={`Agregar al mensaje · ${v.desc}`}
                        className="px-2.5 py-1 rounded-full bg-muted border text-xs font-mono hover:bg-primary hover:text-primary-foreground transition-colors"
                      >
                        + {v.key}
                      </button>
                    ))}
                    <button
                      type="button"
                      onClick={() => setTemplate(DEFAULT_TEMPLATE)}
                      className="ml-auto inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                    >
                      <RotateCcw className="h-3 w-3" /> Restaurar sugerido
                    </button>
                  </div>
                </div>

                <div className="flex justify-end">
                  <Button onClick={saveSettings} disabled={!settingsDirty || settingsSaving} className="gap-2">
                    {settingsSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                    Guardar configuración
                  </Button>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        </div>

        {/* Columna principal: búsqueda + listas */}
        <div className="order-2 lg:order-1 lg:col-span-2 space-y-4">
        {/* ── Búsqueda ── */}
        <div className="relative w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por paciente o mensaje..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 rounded-2xl h-11"
          />
          {searchQuery && (
            <button onClick={() => setSearchQuery("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* ── Tabs ── */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <TabsList className="rounded-2xl">
              <TabsTrigger value="upcoming" className="gap-1.5 rounded-xl">
                <Clock className="h-4 w-4" />
                Próximos
                {upcoming.length > 0 && (
                  <Badge variant="secondary" className="ml-1 h-5 min-w-5 text-xs rounded-full">{upcoming.length}</Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="history" className="gap-1.5 rounded-xl">
                <CheckCircle2 className="h-4 w-4" />
                Historial
                {failedCount > 0 && (
                  <Badge variant="destructive" className="ml-1 h-5 min-w-5 text-xs rounded-full">{failedCount}</Badge>
                )}
              </TabsTrigger>
            </TabsList>

            <Button size="sm" variant="outline" onClick={() => setShowCreateModal(true)} className="sm:hidden rounded-xl gap-2">
              <Plus className="h-4 w-4" />
              Programar aviso
            </Button>
          </div>

          <TabsContent value={activeTab} className="mt-4 space-y-4">
            {loading ? (
              <Card>
                <CardContent className="py-16 flex items-center justify-center text-muted-foreground">
                  <Loader2 className="h-5 w-5 animate-spin mr-2" /> Cargando...
                </CardContent>
              </Card>
            ) : filteredReminders.length === 0 ? (
              <Card className="border-dashed">
                <CardContent className="py-16 text-center">
                  <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-muted/50 flex items-center justify-center">
                    <Bell className="h-8 w-8 text-muted-foreground" />
                  </div>
                  <p className="text-muted-foreground font-medium">
                    {activeTab === "upcoming" ? "No hay avisos programados" : "Todavía no salió ningún aviso"}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Se crean solos cuando se agenda o confirma una cita.
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-3">
                {pageReminders.map((reminder) => {
                  const apptDt = reminder.appointment?.start_at ? formatDateTime(reminder.appointment.start_at) : null;
                  const schedDt = formatDateTime(reminder.scheduled_for);
                  const chConf = channelConfig[reminder.channel] || channelConfig.email;
                  const stConf = statusConfig[reminder.status] || statusConfig.scheduled;
                  const ChannelIcon = chConf.icon;
                  const isUpcoming = UPCOMING_STATUSES.includes(reminder.status);
                  const isFailed = reminder.status === "failed";

                  return (
                    <Card key={reminder.id} className={`overflow-hidden transition-all hover:shadow-md ${reminder.status === "cancelled" ? "opacity-60" : ""}`}>
                      <CardContent className="p-4">
                        <div className="flex items-start gap-3">
                          <div className="p-2.5 rounded-xl shrink-0 bg-muted/50 text-muted-foreground">
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
                              <Badge variant="outline" className={`rounded-full text-xs shrink-0 ${stConf.color}`}>
                                {stConf.label}
                              </Badge>
                            </div>

                            <p className="text-sm text-muted-foreground line-clamp-2">{reminder.message}</p>

                            {isFailed && (
                              <div className="flex items-start gap-2 rounded-lg bg-destructive/5 border border-destructive/20 p-2.5 text-xs text-destructive">
                                <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                                <span>
                                  {reminder.channel === "whatsapp" ? (
                                    <>
                                      No se pudo enviar por WhatsApp. Lo más común: el paciente no tiene teléfono cargado en su ficha
                                      {reminder.patient?.whatsapp_phone ? "" : " (este paciente no tiene)"}, o falta tu número de contacto en la configuración.
                                    </>
                                  ) : (
                                    <>
                                      No se pudo enviar. Lo más común: el paciente no tiene email cargado en su ficha
                                      {reminder.patient?.email ? "" : " (este paciente no tiene)"}.
                                    </>
                                  )}
                                </span>
                              </div>
                            )}

                            <div className="flex items-center justify-between gap-2 flex-wrap">
                              <p className="text-xs text-muted-foreground">
                                {isUpcoming ? "Sale el" : "Programado para el"} {schedDt.date} a las {schedDt.time} · {chConf.label}
                              </p>

                              <div className="flex gap-1.5">
                                {isUpcoming && (
                                  <>
                                    {/* WhatsApp usa plantilla fija aprobada por Meta: no se edita el texto */}
                                    {reminder.channel !== "whatsapp" && (
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      className="rounded-xl h-8 gap-1.5"
                                      onClick={() => { setEditingReminder(reminder); setEditMessage(reminder.message); }}
                                    >
                                      <Pencil className="h-3.5 w-3.5" />
                                      <span className="hidden sm:inline">Editar</span>
                                    </Button>
                                    )}
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      className="rounded-xl h-8 gap-1.5 text-muted-foreground hover:text-destructive"
                                      onClick={() => setCancelTarget(reminder.id)}
                                    >
                                      <XCircle className="h-3.5 w-3.5" />
                                      <span className="hidden sm:inline">Cancelar</span>
                                    </Button>
                                  </>
                                )}
                                {isFailed && (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="rounded-xl h-8 gap-1.5"
                                    onClick={() => retryFailed(reminder)}
                                  >
                                    <RotateCcw className="h-3.5 w-3.5" />
                                    Reintentar
                                  </Button>
                                )}
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
        </div>
      </div>

      {/* ── Editar mensaje ── */}
      <Dialog open={!!editingReminder} onOpenChange={(open) => !open && setEditingReminder(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Editar mensaje</DialogTitle>
            <DialogDescription>
              Solo cambia este aviso puntual para {editingReminder?.patient?.full_name}.
            </DialogDescription>
          </DialogHeader>
          <Textarea value={editMessage} onChange={(e) => setEditMessage(e.target.value)} rows={6} className="rounded-xl" />
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingReminder(null)} className="rounded-xl">Cancelar</Button>
            <Button onClick={saveEditedMessage} disabled={editSaving || !editMessage.trim()} className="rounded-xl">
              {editSaving ? "Guardando..." : "Guardar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Confirmar cancelación ── */}
      <AlertDialog open={!!cancelTarget} onOpenChange={(open) => !open && setCancelTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancelar este aviso</AlertDialogTitle>
            <AlertDialogDescription>
              El paciente no va a recibir este recordatorio. La cita no se toca.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Volver</AlertDialogCancel>
            <AlertDialogAction onClick={() => cancelTarget && cancelReminder(cancelTarget)}>
              Sí, cancelar aviso
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ── Programar aviso puntual ── */}
      <Dialog open={showCreateModal} onOpenChange={setShowCreateModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Programar un aviso</DialogTitle>
            <DialogDescription>Sale solo por email en la fecha que elijas.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Tipo</Label>
              <ToggleGroup
                type="single"
                value={createForm.mode}
                onValueChange={(v) => {
                  if (!v) return;
                  setCreateForm((f) => ({ ...f, mode: v as "appointment" | "free" }));
                }}
                className="grid grid-cols-2 gap-2 w-full"
              >
                <ToggleGroupItem value="appointment" className="rounded-xl border data-[state=on]:bg-primary data-[state=on]:text-primary-foreground">
                  Para una cita
                </ToggleGroupItem>
                <ToggleGroupItem value="free" className="rounded-xl border data-[state=on]:bg-primary data-[state=on]:text-primary-foreground">
                  Mensaje libre
                </ToggleGroupItem>
              </ToggleGroup>
            </div>

            <div className="space-y-2">
              <Label>Paciente</Label>
              <Select value={createForm.patientId} onValueChange={(v) => setCreateForm((f) => ({ ...f, patientId: v, appointmentId: "" }))}>
                <SelectTrigger className="rounded-xl"><SelectValue placeholder="Seleccionar paciente" /></SelectTrigger>
                <SelectContent>
                  {patients.map((p) => (
                    <SelectItem key={p.id} value={p.id}>{p.full_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {selectedPatientForCreate && !createPatientHasEmail && (
                <p className="text-xs text-destructive">
                  Este paciente no tiene email cargado — el aviso no le va a llegar. Cargale un email en su ficha primero.
                </p>
              )}
            </div>

            {createForm.mode === "appointment" && createForm.patientId && (
              <div className="space-y-2">
                <Label>Cita próxima</Label>
                {appointmentsForPatient.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    Este paciente no tiene citas próximas. Cambiá a <span className="font-medium text-foreground">"Mensaje libre"</span>.
                  </p>
                ) : (
                  <Select value={createForm.appointmentId} onValueChange={(v) => setCreateForm((f) => ({ ...f, appointmentId: v }))}>
                    <SelectTrigger className="rounded-xl"><SelectValue placeholder="Seleccionar cita" /></SelectTrigger>
                    <SelectContent>
                      {appointmentsForPatient.map((a) => (
                        <SelectItem key={a.id} value={a.id}>
                          {format(new Date(a.start_at), "d MMM yyyy · HH:mm", { locale: es })}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
            )}

            {createForm.mode === "appointment" ? (
              <div className="space-y-2">
                <Label>Anticipación</Label>
                <Select value={createForm.hoursBefore} onValueChange={(v) => setCreateForm((f) => ({ ...f, hoursBefore: v }))}>
                  <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {HOURS_OPTIONS.map((o) => (
                      <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : (
              <div className="space-y-2">
                <Label>Fecha y hora de envío</Label>
                <Input
                  type="datetime-local"
                  value={createForm.scheduledAt}
                  min={new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16)}
                  onChange={(e) => setCreateForm((f) => ({ ...f, scheduledAt: e.target.value }))}
                  className="rounded-xl"
                />
              </div>
            )}

            <div className="space-y-2">
              <Label>Mensaje</Label>
              <Textarea
                value={createForm.message}
                onChange={(e) => setCreateForm((f) => ({ ...f, message: e.target.value }))}
                rows={4}
                className="rounded-xl"
                placeholder={selectedPatientForCreate ? `Hola ${selectedPatientForCreate.full_name}, te recuerdo...` : "Escribí el mensaje del aviso..."}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateModal(false)} className="rounded-xl">Cancelar</Button>
            <Button
              onClick={createManualReminder}
              disabled={
                createSaving ||
                !createForm.patientId ||
                !createPatientHasEmail ||
                !createForm.message.trim() ||
                (createForm.mode === "appointment" && !createForm.appointmentId) ||
                (createForm.mode === "free" && !createForm.scheduledAt)
              }
              className="rounded-xl"
            >
              {createSaving ? "Programando..." : "Programar aviso"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default PendingReminders;
