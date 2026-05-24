import { useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "@/hooks/use-toast";
import {
  ArrowLeft,
  Save,
  Copy,
  RotateCcw,
  UserPlus,
  Users,
  Crown,
  User,
  Link as LinkIcon,
  Check,
  Bell,
  Building2,
  MessageSquare,
  CreditCard,
} from "lucide-react";
import { NotificationActivationCard } from "@/components/NotificationActivationCard";
import { useDashboardBranding } from "@/contexts/DashboardBrandingContext";
import { ProfessionalInviteModal } from "@/components/ProfessionalInviteModal";
import { PlanUsageCard } from "@/components/PlanUsageCard";
import LoadingPage from "@/components/LoadingPage";
import { buildShareUrl } from "@/config/app";
import { PaymentPolicySettings } from "@/components/PaymentPolicySettings";

const DEFAULT_TEMPLATES = {
  reminder:
    "Hola {{paciente}}, te recuerdo tu sesión del {{fecha}} a las {{hora}}. Modalidad: {{modalidad}}. {{link}}. Cualquier cosa me escribís por acá.",
  confirmation:
    "Hola {{paciente}}, confirmo tu sesión del {{fecha}} a las {{hora}}. Modalidad: {{modalidad}}. {{link}}. Te espero!",
  postsession:
    "Hola {{paciente}}, gracias por tu sesión de hoy. Quedamos en contacto para la próxima. Saludos!",
};

const VARIABLES = [
  { key: "{{paciente}}", desc: "Nombre del paciente" },
  { key: "{{fecha}}", desc: "Fecha de la cita" },
  { key: "{{hora}}", desc: "Hora de la cita" },
  { key: "{{modalidad}}", desc: "Online o Presencial" },
  { key: "{{link}}", desc: "Link o ubicación" },
];

interface TeamMember {
  userId: string;
  role: string;
  name: string;
  email: string;
}

const ClinicSettings = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [settingsId, setSettingsId] = useState<string | null>(null);
  const [businessId, setBusinessId] = useState<string | null>(null);
  const [isOwner, setIsOwner] = useState(false);
  const [activeTab, setActiveTab] = useState(searchParams.get("tab") || "general");

  // Form state
  const [clinicName, setClinicName] = useState("");
  const [ownerName, setOwnerName] = useState("");
  const [specialty, setSpecialty] = useState("");
  const [welcomeMessage, setWelcomeMessage] = useState("");
  const [reminderMessage, setReminderMessage] = useState(DEFAULT_TEMPLATES.reminder);
  const [confirmationMessage, setConfirmationMessage] = useState(DEFAULT_TEMPLATES.confirmation);
  const [postsessionMessage, setPostsessionMessage] = useState(DEFAULT_TEMPLATES.postsession);
  const [autoAcceptBookings, setAutoAcceptBookings] = useState(false);
  const [publicSlug, setPublicSlug] = useState("");
  const [isPrivateClinic, setIsPrivateClinic] = useState(false);
  const [cancellationHoursNotice, setCancellationHoursNotice] = useState<number>(24);
  const [lateCancellationMessage, setLateCancellationMessage] = useState<string>("");
  const [defaultSessionPrice, setDefaultSessionPrice] = useState<string>("");

  // Initial snapshot to detect dirty state
  const [initialSnapshot, setInitialSnapshot] = useState<string>("");

  // Team
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [loadingTeam, setLoadingTeam] = useState(false);
  const [inviteModalOpen, setInviteModalOpen] = useState(false);
  const [registrationLinkCopied, setRegistrationLinkCopied] = useState(false);

  // Refs to know which textarea is focused for variable insertion
  const reminderRef = useRef<HTMLTextAreaElement>(null);
  const confirmationRef = useRef<HTMLTextAreaElement>(null);
  const postsessionRef = useRef<HTMLTextAreaElement>(null);
  const lastFocused = useRef<"reminder" | "confirmation" | "postsession">("reminder");

  const { refetch: refetchBranding } = useDashboardBranding();

  useEffect(() => {
    checkAuth();
    loadSettings();
  }, []);

  useEffect(() => {
    if (businessId && isOwner) loadTeamMembers();
  }, [businessId, isOwner]);

  const buildSnapshot = () =>
    JSON.stringify({
      clinicName,
      ownerName,
      specialty,
      welcomeMessage,
      reminderMessage,
      confirmationMessage,
      postsessionMessage,
      autoAcceptBookings,
      isPrivateClinic,
      cancellationHoursNotice,
      lateCancellationMessage,
      defaultSessionPrice,
    });

  const isDirty = !loading && initialSnapshot !== "" && buildSnapshot() !== initialSnapshot;

  // Warn before leaving if there are unsaved changes
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (isDirty) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [isDirty]);

  const checkAuth = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) navigate("/auth");
  };

  const loadSettings = async () => {
    try {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      let { data: business } = await supabase
        .from("businesses")
        .select("id, public_slug, owner_user_id, is_private_clinic, cancellation_hours_notice, late_cancellation_message, default_session_price")
        .eq("owner_user_id", user.id)
        .maybeSingle();

      if (!business) {
        const { data: userRole } = await supabase
          .from("user_roles")
          .select("business_id")
          .eq("user_id", user.id)
          .in("role", ["owner", "professional"])
          .maybeSingle();

        if (userRole?.business_id) {
          const { data: memberBusiness } = await supabase
            .from("businesses")
            .select("id, public_slug, owner_user_id, is_private_clinic, cancellation_hours_notice, late_cancellation_message, default_session_price")
            .eq("id", userRole.business_id)
            .single();
          business = memberBusiness;
        }
      }

      if (!business) {
        const slug = user.id.slice(0, 8);
        const { data: newBusiness, error: createError } = await supabase
          .from("businesses")
          .insert({
            owner_user_id: user.id,
            public_slug: slug,
            name: "Mi Consultorio",
            contact_email: user.email || "",
            timezone: "America/Montevideo",
          })
          .select("id, public_slug, owner_user_id, is_private_clinic")
          .single();

        if (createError) {
          toast({ title: "Error", description: "No se pudo crear el consultorio", variant: "destructive" });
          return;
        }
        business = newBusiness as any;
      }

      let loadedClinicName = "";
      let loadedSpecialty = "";
      let loadedWelcome = "";
      let loadedReminder = DEFAULT_TEMPLATES.reminder;
      let loadedConfirmation = DEFAULT_TEMPLATES.confirmation;
      let loadedPostsession = DEFAULT_TEMPLATES.postsession;
      let loadedAuto = false;

      if (business) {
        setPublicSlug(business.public_slug);
        setBusinessId(business.id);
        setIsOwner(business.owner_user_id === user.id);
        setIsPrivateClinic((business as any).is_private_clinic || false);
        setCancellationHoursNotice((business as any).cancellation_hours_notice ?? 24);
        setLateCancellationMessage((business as any).late_cancellation_message ?? "");
        const dsp = (business as any).default_session_price;
        setDefaultSessionPrice(dsp != null ? String(dsp) : "");
      }

      const { data: settings } = await supabase
        .from("clinic_settings")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();

      if (settings) {
        setSettingsId(settings.id);
        loadedClinicName = settings.clinic_name || "";
        loadedSpecialty = settings.specialty || "";
        loadedWelcome = settings.welcome_message || "";
        loadedReminder = settings.default_reminder_message || DEFAULT_TEMPLATES.reminder;
        loadedConfirmation = settings.default_confirmation_message || DEFAULT_TEMPLATES.confirmation;
        loadedPostsession = settings.default_postsession_message || DEFAULT_TEMPLATES.postsession;
        loadedAuto = settings.auto_accept_bookings || false;
      }

      setClinicName(loadedClinicName);
      // Cargar nombre personal del usuario (se muestra en "Buenos días, ...")
      const { data: ownProfile } = await supabase
        .from("profiles")
        .select("name")
        .eq("id", user.id)
        .maybeSingle();
      setOwnerName(ownProfile?.name || "");
      setSpecialty(loadedSpecialty);
      setWelcomeMessage(loadedWelcome);
      setReminderMessage(loadedReminder);
      setConfirmationMessage(loadedConfirmation);
      setPostsessionMessage(loadedPostsession);
      setAutoAcceptBookings(loadedAuto);

      setTimeout(() => setInitialSnapshot(buildSnapshot()), 0);
      // cache-bust: ensure HMR drops stale slug references
    } catch (error) {
      console.error("Error loading settings:", error);
      toast({ title: "Error", description: "No se pudo cargar la configuración", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const loadTeamMembers = async () => {
    if (!businessId) return;
    try {
      setLoadingTeam(true);
      const { data: business } = await supabase
        .from("businesses").select("owner_user_id").eq("id", businessId).single();
      if (!business) return;

      const { data: ownerProfile } = await supabase
        .from("profiles").select("id, name, email").eq("id", business.owner_user_id).maybeSingle();

      const members: TeamMember[] = [];
      if (ownerProfile) {
        members.push({ userId: ownerProfile.id, role: "owner", name: ownerProfile.name, email: ownerProfile.email });
      }

      const { data: roles } = await supabase
        .from("user_roles").select("user_id, role").eq("business_id", businessId).eq("role", "professional");

      if (roles && roles.length > 0) {
        const userIds = roles.map((r) => r.user_id);
        const { data: profiles } = await supabase
          .from("profiles").select("id, name, email").in("id", userIds);
        if (profiles) {
          for (const profile of profiles) {
            members.push({ userId: profile.id, role: "professional", name: profile.name, email: profile.email });
          }
        }
      }
      setTeamMembers(members);
    } catch (error) {
      console.error("Error loading team:", error);
    } finally {
      setLoadingTeam(false);
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const settingsData = {
        user_id: user.id,
        clinic_name: clinicName,
        specialty,
        welcome_message: welcomeMessage,
        default_reminder_message: reminderMessage,
        default_confirmation_message: confirmationMessage,
        default_postsession_message: postsessionMessage,
        auto_accept_bookings: autoAcceptBookings,
      };

      if (settingsId) {
        const { error } = await supabase.from("clinic_settings").update(settingsData).eq("id", settingsId);
        if (error) throw error;
      } else {
        const { data, error } = await supabase.from("clinic_settings").insert([settingsData]).select().single();
        if (error) throw error;
        if (data) setSettingsId(data.id);
      }

      // Actualizar nombre personal del usuario (visible en saludo del dashboard)
      if (ownerName.trim()) {
        const { error: profileError } = await supabase
          .from("profiles")
          .update({ name: ownerName.trim() })
          .eq("id", user.id);
        if (profileError) console.error("Error saving profile name:", profileError);
      }

      if (businessId) {
        const businessUpdate: Record<string, any> = {
          specialty: specialty || null,
          is_private_clinic: isPrivateClinic,
          cancellation_hours_notice: Number.isFinite(cancellationHoursNotice) ? cancellationHoursNotice : 24,
          late_cancellation_message: lateCancellationMessage.trim() || null,
          default_session_price: defaultSessionPrice.trim() === "" ? null : Number(defaultSessionPrice),
        };
        if (clinicName && clinicName.trim()) {
          businessUpdate.name = clinicName.trim();
        }
        const { error: brandError } = await supabase
          .from("businesses")
          .update(businessUpdate as any)
          .eq("id", businessId);
        if (brandError) console.error("Error saving business:", brandError);
        await refetchBranding();
      }

      setInitialSnapshot(buildSnapshot());
      toast({ title: "Guardado", description: "Tu configuración se actualizó correctamente" });
    } catch (error) {
      console.error("Error saving settings:", error);
      toast({ title: "Error", description: "No se pudo guardar la configuración", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleResetMessages = () => {
    setReminderMessage(DEFAULT_TEMPLATES.reminder);
    setConfirmationMessage(DEFAULT_TEMPLATES.confirmation);
    setPostsessionMessage(DEFAULT_TEMPLATES.postsession);
    toast({ title: "Mensajes restablecidos", description: "Acordate de guardar para aplicar los cambios." });
  };

  const insertVariable = (variable: string) => {
    const map = {
      reminder: { ref: reminderRef, value: reminderMessage, setter: setReminderMessage },
      confirmation: { ref: confirmationRef, value: confirmationMessage, setter: setConfirmationMessage },
      postsession: { ref: postsessionRef, value: postsessionMessage, setter: setPostsessionMessage },
    };
    const target = map[lastFocused.current];
    const el = target.ref.current;
    if (!el) {
      target.setter(target.value + " " + variable);
      return;
    }
    const start = el.selectionStart ?? target.value.length;
    const end = el.selectionEnd ?? target.value.length;
    const newValue = target.value.slice(0, start) + variable + target.value.slice(end);
    target.setter(newValue);
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(start + variable.length, start + variable.length);
    });
  };

  if (loading) return <LoadingPage />;

  const registrationUrl = buildShareUrl(`/registrarse-profesional?business=${publicSlug}`);

  return (
    <div className="min-h-screen bg-background pb-32">
      <div className="max-w-4xl mx-auto p-4 sm:p-6 space-y-6">
        <button
          onClick={() => navigate("/dashboard")}
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Volver al dashboard
        </button>

        {/* Header administrativo simple */}
        <div className="border-b pb-5">
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Mi Consultorio</h1>
          <p className="text-sm text-muted-foreground mt-1 truncate">
            {clinicName || "Mi Consultorio"}
            {specialty ? ` · ${specialty}` : ""}
          </p>
          {isPrivateClinic && (
            <Badge variant="secondary" className="text-[10px] mt-2">Agenda privada</Badge>
          )}
        </div>

        <PlanUsageCard businessId={businessId} />

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid grid-cols-3 sm:grid-cols-5 w-full h-auto p-1">
            <TabsTrigger value="general" className="gap-1.5 text-xs sm:text-sm py-2">
              <Building2 className="h-3.5 w-3.5" /> General
            </TabsTrigger>
            <TabsTrigger value="equipo" className="gap-1.5 text-xs sm:text-sm py-2">
              <Users className="h-3.5 w-3.5" /> Equipo
            </TabsTrigger>
            <TabsTrigger value="mensajes" className="gap-1.5 text-xs sm:text-sm py-2">
              <MessageSquare className="h-3.5 w-3.5" /> Mensajes
            </TabsTrigger>
            <TabsTrigger value="notificaciones" className="gap-1.5 text-xs sm:text-sm py-2">
              <Bell className="h-3.5 w-3.5" /> Avisos
            </TabsTrigger>
            <TabsTrigger value="pagos" className="gap-1.5 text-xs sm:text-sm py-2">
              <CreditCard className="h-3.5 w-3.5" /> Pagos
            </TabsTrigger>
          </TabsList>

          {/* TAB: GENERAL */}
          <TabsContent value="general" className="space-y-5 mt-5">
            <Card>
              <CardHeader><CardTitle className="text-base">Información del consultorio</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="ownerName">Tu nombre</Label>
                  <Input
                    id="ownerName" value={ownerName} onChange={(e) => setOwnerName(e.target.value)}
                    placeholder="Ej: Sofía Bouvier" className="h-11"
                  />
                  <p className="text-xs text-muted-foreground">
                    Es el nombre que aparece en el saludo del dashboard ("Buenos días, ...").
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="clinicName">Nombre del consultorio</Label>
                  <Input
                    id="clinicName" value={clinicName} onChange={(e) => setClinicName(e.target.value)}
                    placeholder="Ej: Consultorio Psicológico Bienestar" className="h-11"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="specialty">Especialidad</Label>
                  <Input
                    id="specialty" value={specialty} onChange={(e) => setSpecialty(e.target.value)}
                    placeholder="Ej: Psicología Clínica" className="h-11"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="welcomeMessage">Descripción</Label>
                  <Textarea
                    id="welcomeMessage" value={welcomeMessage} onChange={(e) => setWelcomeMessage(e.target.value)}
                    placeholder="Descripción opcional del consultorio que verán los pacientes." rows={3} className="resize-none"
                  />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-5 flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm font-semibold">Agenda privada</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Si está activa, los pacientes no pueden reservar turnos sin invitación previa.
                  </p>
                </div>
                <Switch checked={isPrivateClinic} onCheckedChange={setIsPrivateClinic} />
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-5 flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm font-semibold">Auto-aceptar reservas</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Las reservas de pacientes ya registrados se confirman automáticamente.
                  </p>
                </div>
                <Switch checked={autoAcceptBookings} onCheckedChange={setAutoAcceptBookings} />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Política de cancelación</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="cancellationHours">Horas mínimas de antelación</Label>
                  <Input
                    id="cancellationHours"
                    type="number"
                    min={0}
                    max={720}
                    value={cancellationHoursNotice}
                    onChange={(e) => setCancellationHoursNotice(parseInt(e.target.value || "0", 10))}
                    className="h-11 max-w-[120px]"
                  />
                  <p className="text-xs text-muted-foreground">
                    Horas mínimas de antelación para que tus pacientes puedan cancelar o reprogramar sin aviso de cancelación tardía. Default: 24.
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="lateCancellationMsg">Mensaje de cancelación tardía (opcional)</Label>
                  <Textarea
                    id="lateCancellationMsg"
                    value={lateCancellationMessage}
                    onChange={(e) => setLateCancellationMessage(e.target.value)}
                    placeholder="Ej: Las cancelaciones con menos de 24hs pueden generar cargo de la sesión."
                    rows={3}
                    className="resize-none"
                  />
                  <p className="text-xs text-muted-foreground">
                    Mensaje que se mostrará a los pacientes cuando intenten cancelar fuera del plazo.
                  </p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* TAB: EQUIPO */}
          <TabsContent value="equipo" className="space-y-5 mt-5">
            {!isOwner ? (
              <Card><CardContent className="p-8 text-center text-sm text-muted-foreground">
                Solo el propietario del consultorio puede gestionar el equipo.
              </CardContent></Card>
            ) : (
              <>
                <Card>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-base flex items-center gap-2">
                        <Users className="h-4 w-4" /> Profesionales
                      </CardTitle>
                      <Button size="sm" onClick={() => setInviteModalOpen(true)} className="gap-2">
                        <UserPlus className="h-4 w-4" /> Invitar
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {loadingTeam ? (
                      <p className="text-sm text-muted-foreground">Cargando equipo...</p>
                    ) : teamMembers.length === 0 ? (
                      <p className="text-sm text-muted-foreground">No hay profesionales registrados.</p>
                    ) : (
                      <div className="space-y-2">
                        {teamMembers.map((m) => (
                          <div key={m.userId} className="flex items-center justify-between p-3 bg-muted/50 rounded-xl">
                            <div className="flex items-center gap-3">
                              <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                                {m.role === "owner" ? <Crown className="h-5 w-5 text-primary" /> : <User className="h-5 w-5 text-muted-foreground" />}
                              </div>
                              <div>
                                <p className="font-medium text-sm">{m.name}</p>
                                <p className="text-xs text-muted-foreground">{m.email}</p>
                              </div>
                            </div>
                            <Badge variant={m.role === "owner" ? "default" : "secondary"}>
                              {m.role === "owner" ? "Propietario" : "Profesional"}
                            </Badge>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>

                {publicSlug && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base flex items-center gap-2">
                        <LinkIcon className="h-4 w-4" /> Enlace de auto-registro
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      <p className="text-xs text-muted-foreground">
                        Compartí este enlace para que profesionales creen su propia cuenta en tu consultorio.
                      </p>
                      <div className="flex gap-2">
                        <Input value={registrationUrl} readOnly className="font-mono text-xs h-11 flex-1" />
                        <Button
                          variant="outline" size="icon" className="h-11 w-11 shrink-0"
                          onClick={() => {
                            navigator.clipboard.writeText(registrationUrl);
                            setRegistrationLinkCopied(true);
                            toast({ title: "Enlace copiado" });
                            setTimeout(() => setRegistrationLinkCopied(false), 2000);
                          }}
                        >
                          {registrationLinkCopied ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                )}
              </>
            )}
          </TabsContent>

          {/* TAB: MENSAJES */}
          <TabsContent value="mensajes" className="space-y-5 mt-5">
            <Card className="border-primary/20 bg-primary/5">
              <CardContent className="p-4 space-y-2">
                <p className="text-xs font-semibold">Variables disponibles</p>
                <p className="text-xs text-muted-foreground">
                  Hacé click para insertarlas en el mensaje activo. Se reemplazan automáticamente al enviarse.
                </p>
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {VARIABLES.map((v) => (
                    <button
                      key={v.key} type="button" onClick={() => insertVariable(v.key)}
                      title={v.desc}
                      className="px-2.5 py-1 rounded-full bg-background border text-xs font-mono hover:bg-primary hover:text-primary-foreground transition-colors"
                    >
                      {v.key}
                    </button>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle className="text-base">Recordatorio</CardTitle></CardHeader>
              <CardContent>
                <Textarea
                  ref={reminderRef} value={reminderMessage}
                  onChange={(e) => setReminderMessage(e.target.value)}
                  onFocus={() => (lastFocused.current = "reminder")}
                  rows={4} className="resize-none text-sm"
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle className="text-base">Confirmación</CardTitle></CardHeader>
              <CardContent>
                <Textarea
                  ref={confirmationRef} value={confirmationMessage}
                  onChange={(e) => setConfirmationMessage(e.target.value)}
                  onFocus={() => (lastFocused.current = "confirmation")}
                  rows={4} className="resize-none text-sm"
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle className="text-base">Post-sesión</CardTitle></CardHeader>
              <CardContent>
                <Textarea
                  ref={postsessionRef} value={postsessionMessage}
                  onChange={(e) => setPostsessionMessage(e.target.value)}
                  onFocus={() => (lastFocused.current = "postsession")}
                  rows={4} className="resize-none text-sm"
                />
              </CardContent>
            </Card>

            <Button variant="outline" onClick={handleResetMessages} className="gap-2">
              <RotateCcw className="h-4 w-4" />
              Restablecer mensajes por defecto
            </Button>
          </TabsContent>

          {/* TAB: NOTIFICACIONES */}
          <TabsContent value="notificaciones" className="space-y-5 mt-5">
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Bell className="h-4 w-4" /> Notificaciones push
                </CardTitle>
                <p className="text-xs text-muted-foreground">
                  Recibí avisos en tiempo real cuando un paciente solicite o confirme una cita.
                </p>
              </CardHeader>
              <CardContent>
                <NotificationActivationCard variant="full" />
              </CardContent>
            </Card>
          </TabsContent>

          {/* TAB: PAGOS ONLINE */}
          <TabsContent value="pagos" className="space-y-5 mt-5">
            {businessId ? (
              <PaymentPolicySettings businessId={businessId} />
            ) : (
              <Card><CardContent className="p-8 text-center text-sm text-muted-foreground">
                No se encontró un consultorio asociado.
              </CardContent></Card>
            )}
          </TabsContent>
        </Tabs>
      </div>

      {isDirty && (
        <div className="fixed bottom-0 left-0 right-0 z-40 border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 shadow-lg animate-in slide-in-from-bottom duration-200">
          <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between gap-3">
            <p className="text-sm">
              <span className="font-semibold">Cambios sin guardar</span>
              <span className="text-muted-foreground"> — recordá guardar antes de salir.</span>
            </p>
            <Button onClick={handleSave} disabled={saving} className="gap-2 shrink-0">
              <Save className="h-4 w-4" />
              {saving ? "Guardando..." : "Guardar cambios"}
            </Button>
          </div>
        </div>
      )}

      {businessId && (
        <ProfessionalInviteModal
          open={inviteModalOpen}
          onOpenChange={setInviteModalOpen}
          businessId={businessId}
          onInviteCreated={loadTeamMembers}
        />
      )}
    </div>
  );
};

export default ClinicSettings;