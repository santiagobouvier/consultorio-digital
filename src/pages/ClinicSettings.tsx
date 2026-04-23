import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
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
  ExternalLink,
  RotateCcw,
  UserPlus,
  Users,
  Crown,
  User,
  Link as LinkIcon,
  Check,
  Paintbrush,
  Upload,
  Bell,
  Building2,
  Globe,
  MessageSquare,
  Image as ImageIcon,
  Trash2,
  Loader2,
  CheckCircle2,
  XCircle,
} from "lucide-react";
import { NotificationActivationCard } from "@/components/NotificationActivationCard";
import { useDashboardBranding } from "@/contexts/DashboardBrandingContext";
import { DomainSettingsCard } from "@/components/DomainSettingsCard";
import { ProfessionalInviteModal } from "@/components/ProfessionalInviteModal";
import { PlanUsageCard } from "@/components/PlanUsageCard";
import LoadingPage from "@/components/LoadingPage";
import { buildShareUrl } from "@/config/app";
import { useBusinessPublicWeb } from "@/hooks/use-business-public-web";

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

const COLOR_PRESETS = [
  { label: "Teal", value: "176 100% 32%" },
  { label: "Azul", value: "220 80% 50%" },
  { label: "Violeta", value: "270 70% 50%" },
  { label: "Rosa", value: "330 75% 55%" },
  { label: "Naranja", value: "25 90% 50%" },
  { label: "Verde", value: "150 70% 40%" },
];

interface TeamMember {
  userId: string;
  role: string;
  name: string;
  email: string;
}

// Convert HSL string ("176 100% 32%") to hex for <input type="color">
const hslToHex = (hslStr: string): string => {
  try {
    const parts = hslStr.replace(/%/g, "").trim().split(/\s+/);
    const h = parseFloat(parts[0]);
    const s = parseFloat(parts[1]) / 100;
    const l = parseFloat(parts[2]) / 100;
    const c = (1 - Math.abs(2 * l - 1)) * s;
    const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
    const m = l - c / 2;
    let r = 0, g = 0, b = 0;
    if (h < 60) [r, g, b] = [c, x, 0];
    else if (h < 120) [r, g, b] = [x, c, 0];
    else if (h < 180) [r, g, b] = [0, c, x];
    else if (h < 240) [r, g, b] = [0, x, c];
    else if (h < 300) [r, g, b] = [x, 0, c];
    else [r, g, b] = [c, 0, x];
    const toHex = (v: number) =>
      Math.round((v + m) * 255).toString(16).padStart(2, "0");
    return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
  } catch {
    return "#00a5a0";
  }
};

const hexToHsl = (hex: string): string => {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  let h = 0, s = 0;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = (g - b) / d + (g < b ? 6 : 0); break;
      case g: h = (b - r) / d + 2; break;
      case b: h = (r - g) / d + 4; break;
    }
    h *= 60;
  }
  return `${Math.round(h)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`;
};

const ClinicSettings = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [settingsId, setSettingsId] = useState<string | null>(null);
  const [businessId, setBusinessId] = useState<string | null>(null);
  const [isOwner, setIsOwner] = useState(false);
  const [activeTab, setActiveTab] = useState("general");

  // Form state
  const [clinicName, setClinicName] = useState("");
  const [specialty, setSpecialty] = useState("");
  const [welcomeMessage, setWelcomeMessage] = useState("");
  const [reminderMessage, setReminderMessage] = useState(DEFAULT_TEMPLATES.reminder);
  const [confirmationMessage, setConfirmationMessage] = useState(DEFAULT_TEMPLATES.confirmation);
  const [postsessionMessage, setPostsessionMessage] = useState(DEFAULT_TEMPLATES.postsession);
  const [logoUrl, setLogoUrl] = useState("");
  const [coverImageUrl, setCoverImageUrl] = useState("");
  const [autoAcceptBookings, setAutoAcceptBookings] = useState(false);
  const [publicSlug, setPublicSlug] = useState("");
  const [initialSlug, setInitialSlug] = useState("");
  const [slugStatus, setSlugStatus] = useState<"idle" | "checking" | "available" | "taken" | "invalid">("idle");
  const [isPrivateClinic, setIsPrivateClinic] = useState(false);
  const [dashboardColor, setDashboardColor] = useState("176 100% 32%");
  const [dashboardLogoUrl, setDashboardLogoUrl] = useState("");
  const [dashboardDisplayName, setDashboardDisplayName] = useState("");

  // Initial snapshot to detect dirty state
  const [initialSnapshot, setInitialSnapshot] = useState<string>("");
  const [uploadingClinicLogo, setUploadingClinicLogo] = useState(false);
  const [uploadingCover, setUploadingCover] = useState(false);
  const [uploadingDashLogo, setUploadingDashLogo] = useState(false);

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
  const { hasPublicWeb } = useBusinessPublicWeb();

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
      specialty,
      welcomeMessage,
      reminderMessage,
      confirmationMessage,
      postsessionMessage,
      logoUrl,
      coverImageUrl,
      autoAcceptBookings,
      dashboardColor,
      dashboardLogoUrl,
      dashboardDisplayName,
      publicSlug,
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
        .select("id, public_slug, owner_user_id, is_private_clinic, custom_subdomain, custom_domain, dashboard_primary_color, dashboard_logo_url, dashboard_display_name")
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
            .select("id, public_slug, owner_user_id, is_private_clinic, custom_subdomain, custom_domain, dashboard_primary_color, dashboard_logo_url, dashboard_display_name")
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
          .select("id, public_slug, owner_user_id, is_private_clinic, custom_subdomain, custom_domain, dashboard_primary_color, dashboard_logo_url, dashboard_display_name")
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
      let loadedLogo = "";
      let loadedCover = "";
      let loadedAuto = false;

      if (business) {
        setPublicSlug(business.public_slug);
        setInitialSlug(business.public_slug);
        setBusinessId(business.id);
        setIsOwner(business.owner_user_id === user.id);
        setIsPrivateClinic((business as any).is_private_clinic || false);
        setDashboardColor((business as any).dashboard_primary_color || "176 100% 32%");
        setDashboardLogoUrl((business as any).dashboard_logo_url || "");
        setDashboardDisplayName((business as any).dashboard_display_name || "");
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
        loadedLogo = settings.logo_url || "";
        loadedCover = settings.cover_image_url || "";
        loadedAuto = settings.auto_accept_bookings || false;
      }

      setClinicName(loadedClinicName);
      setSpecialty(loadedSpecialty);
      setWelcomeMessage(loadedWelcome);
      setReminderMessage(loadedReminder);
      setConfirmationMessage(loadedConfirmation);
      setPostsessionMessage(loadedPostsession);
      setLogoUrl(loadedLogo);
      setCoverImageUrl(loadedCover);
      setAutoAcceptBookings(loadedAuto);

      // Snapshot AFTER all state set
      setTimeout(() => setInitialSnapshot(buildSnapshot()), 0);
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
        logo_url: logoUrl,
        cover_image_url: coverImageUrl,
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

      if (businessId) {
        const businessUpdate: Record<string, any> = {
          dashboard_primary_color: dashboardColor || "176 100% 32%",
          dashboard_logo_url: dashboardLogoUrl || null,
          dashboard_display_name: dashboardDisplayName || null,
          specialty: specialty || null,
        };
        // Only update name if user provided one (avoid overwriting with empty string)
        if (clinicName && clinicName.trim()) {
          businessUpdate.name = clinicName.trim();
        }
        const { error: brandError } = await supabase
          .from("businesses")
          .update(businessUpdate as any)
          .eq("id", businessId);
        if (brandError) console.error("Error saving branding:", brandError);
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

  const copyPublicUrl = () => {
    navigator.clipboard.writeText(buildShareUrl(`/portal/${publicSlug}`));
    toast({ title: "URL copiada", description: "La URL se copió al portapapeles" });
  };

  // Generic uploader for clinic logo / cover / dashboard logo
  const uploadImage = async (
    file: File,
    kind: "clinic-logo" | "cover" | "dashboard-logo",
    setter: (url: string) => void,
    setBusy: (b: boolean) => void
  ) => {
    if (!businessId) return;
    try {
      setBusy(true);
      const ext = file.name.split(".").pop() || "png";
      const path = `portal-logos/${businessId}-${kind}-${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from("avatars").upload(path, file, { upsert: true, contentType: file.type });
      if (upErr) throw upErr;
      const { data: pub } = supabase.storage.from("avatars").getPublicUrl(path);
      setter(pub.publicUrl);
      toast({ title: "Imagen subida", description: "Recordá guardar los cambios." });
    } catch (err: any) {
      toast({ title: "Error", description: err?.message || "No se pudo subir la imagen", variant: "destructive" });
    } finally {
      setBusy(false);
    }
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

  const initials = (clinicName || "Mi Consultorio")
    .split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase();
  const displayLogo = dashboardLogoUrl || logoUrl;
  const portalUrl = buildShareUrl(`/portal/${publicSlug}`);
  const registrationUrl = buildShareUrl(`/registrarse-profesional?business=${publicSlug}`);

  return (
    <div className="min-h-screen bg-background pb-32">
      <div className="max-w-4xl mx-auto p-4 sm:p-6 space-y-6">
        {/* Back link */}
        <button
          onClick={() => navigate("/dashboard")}
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Volver al dashboard
        </button>

        {/* Header administrativo */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between border-b pb-5">
          <div className="min-w-0">
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Mi Consultorio</h1>
            <p className="text-sm text-muted-foreground mt-1 truncate">
              {clinicName || "Mi Consultorio"}
              {specialty ? ` · ${specialty}` : ""}
            </p>
            {isPrivateClinic && (
              <Badge variant="secondary" className="text-[10px] mt-2">Clínica privada</Badge>
            )}
          </div>
          <div className="flex flex-wrap gap-2 sm:shrink-0">
            <Button variant="outline" size="sm" onClick={copyPublicUrl} className="gap-2">
              <Copy className="h-3.5 w-3.5" />
              Copiar URL del portal de pacientes
            </Button>
            <Button variant="outline" size="sm" onClick={() => window.open(portalUrl, "_blank")} className="gap-2">
              <ExternalLink className="h-3.5 w-3.5" />
              Ver portal de pacientes
            </Button>
          </div>
        </div>

        {/* Plan y uso */}
        <PlanUsageCard businessId={businessId} />

        {/* TABS */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid grid-cols-2 sm:grid-cols-5 w-full h-auto p-1">
            <TabsTrigger value="general" className="gap-1.5 text-xs sm:text-sm py-2">
              <Building2 className="h-3.5 w-3.5" /> General
            </TabsTrigger>
            <TabsTrigger value="equipo" className="gap-1.5 text-xs sm:text-sm py-2">
              <Users className="h-3.5 w-3.5" /> Equipo
            </TabsTrigger>
            <TabsTrigger value="marca" className="gap-1.5 text-xs sm:text-sm py-2">
              <Paintbrush className="h-3.5 w-3.5" /> Marca
            </TabsTrigger>
            <TabsTrigger value="mensajes" className="gap-1.5 text-xs sm:text-sm py-2">
              <MessageSquare className="h-3.5 w-3.5" /> Mensajes
            </TabsTrigger>
            <TabsTrigger value="notificaciones" className="gap-1.5 text-xs sm:text-sm py-2">
              <Bell className="h-3.5 w-3.5" /> Avisos
            </TabsTrigger>
          </TabsList>

          {/* TAB: GENERAL */}
          <TabsContent value="general" className="space-y-5 mt-5">
            <Card>
              <CardHeader><CardTitle className="text-base">Información del consultorio</CardTitle></CardHeader>
              <CardContent className="space-y-4">
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
                  <Label htmlFor="welcomeMessage">Mensaje de bienvenida</Label>
                  <Textarea
                    id="welcomeMessage" value={welcomeMessage} onChange={(e) => setWelcomeMessage(e.target.value)}
                    placeholder="Mensaje opcional que verán los nuevos pacientes en tu portal" rows={3} className="resize-none"
                  />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle className="text-base flex items-center gap-2"><LinkIcon className="h-4 w-4" /> Tu página pública</CardTitle></CardHeader>
              <CardContent className="space-y-2">
                <p className="text-xs text-muted-foreground">Compartí esta URL para que pacientes puedan solicitar citas.</p>
                <div className="flex gap-2">
                  <Input value={portalUrl} readOnly className="font-mono text-xs h-11 flex-1" />
                  <Button variant="outline" size="icon" onClick={copyPublicUrl} className="h-11 w-11 shrink-0">
                    <Copy className="h-4 w-4" />
                  </Button>
                  <Button variant="outline" size="icon" onClick={() => window.open(portalUrl, "_blank")} className="h-11 w-11 shrink-0">
                    <ExternalLink className="h-4 w-4" />
                  </Button>
                </div>
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

          {/* TAB: MARCA Y DOMINIO */}
          <TabsContent value="marca" className="space-y-5 mt-5">
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Paintbrush className="h-4 w-4" /> Personalización del panel
                </CardTitle>
                <p className="text-xs text-muted-foreground">
                  Estos cambios afectan tu panel de gestión (no el portal del paciente).
                </p>
              </CardHeader>
              <CardContent className="space-y-5">
                {/* Live preview */}
                <div className="rounded-xl border bg-muted/30 p-4 flex items-center gap-3">
                  <div className="h-12 w-12 rounded-xl flex items-center justify-center overflow-hidden shrink-0"
                       style={{ backgroundColor: `hsl(${dashboardColor})` }}>
                    {dashboardLogoUrl
                      ? <img src={dashboardLogoUrl} alt="" className="w-full h-full object-cover" />
                      : <span className="text-white font-bold text-sm">{initials}</span>}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-muted-foreground">Vista previa</p>
                    <p className="font-semibold truncate">{dashboardDisplayName || clinicName || "Mi Consultorio"}</p>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Nombre visible en el panel</Label>
                  <Input
                    value={dashboardDisplayName} onChange={(e) => setDashboardDisplayName(e.target.value)}
                    placeholder="Ej: Mi Consultorio" className="h-11"
                  />
                </div>

                <div className="space-y-2">
                  <Label className="flex items-center gap-2"><ImageIcon className="h-4 w-4" /> Logo del panel</Label>
                  <div className="flex flex-col sm:flex-row gap-2">
                    <label className="inline-flex items-center justify-center gap-2 h-11 px-4 rounded-md border bg-muted/40 hover:bg-muted cursor-pointer text-sm font-medium transition-colors">
                      <Upload className="h-4 w-4" />
                      {uploadingDashLogo ? "Subiendo..." : "Subir imagen"}
                      <input
                        type="file" accept="image/*" className="hidden" disabled={uploadingDashLogo}
                        onChange={(e) => {
                          const f = e.target.files?.[0];
                          if (f) uploadImage(f, "dashboard-logo", setDashboardLogoUrl, setUploadingDashLogo);
                          e.target.value = "";
                        }}
                      />
                    </label>
                    {dashboardLogoUrl && (
                      <Button type="button" variant="ghost" onClick={() => setDashboardLogoUrl("")}
                        className="h-11 text-destructive hover:text-destructive gap-2">
                        <Trash2 className="h-4 w-4" /> Quitar
                      </Button>
                    )}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Color principal</Label>
                  <div className="flex items-center gap-3">
                    <input
                      type="color"
                      value={hslToHex(dashboardColor)}
                      onChange={(e) => setDashboardColor(hexToHsl(e.target.value))}
                      className="h-11 w-14 rounded-md border cursor-pointer bg-transparent"
                    />
                    <Input
                      value={dashboardColor} onChange={(e) => setDashboardColor(e.target.value)}
                      placeholder="176 100% 32%" className="h-11 font-mono text-sm flex-1"
                    />
                  </div>
                  <div className="flex flex-wrap gap-2 pt-1">
                    {COLOR_PRESETS.map((preset) => (
                      <button
                        key={preset.label} type="button" onClick={() => setDashboardColor(preset.value)}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-medium hover:bg-muted transition-colors"
                      >
                        <div className="w-3 h-3 rounded-full" style={{ background: `hsl(${preset.value})` }} />
                        {preset.label}
                      </button>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <ImageIcon className="h-4 w-4" /> Marca del portal del paciente
                </CardTitle>
                <p className="text-xs text-muted-foreground">
                  Estos elementos se muestran a tus pacientes cuando entran a su portal.
                </p>
              </CardHeader>
              <CardContent className="space-y-5">
                {/* Clinic logo */}
                <div className="space-y-2">
                  <Label>Logo del portal</Label>
                  <div className="flex items-center gap-3">
                    <div className="h-16 w-16 rounded-xl border bg-muted/30 flex items-center justify-center overflow-hidden shrink-0">
                      {logoUrl ? <img src={logoUrl} alt="" className="w-full h-full object-cover" />
                        : <ImageIcon className="h-6 w-6 text-muted-foreground" />}
                    </div>
                    <div className="flex flex-wrap gap-2 flex-1">
                      <label className="inline-flex items-center justify-center gap-2 h-10 px-4 rounded-md border bg-muted/40 hover:bg-muted cursor-pointer text-sm font-medium transition-colors">
                        <Upload className="h-4 w-4" />
                        {uploadingClinicLogo ? "Subiendo..." : "Subir"}
                        <input
                          type="file" accept="image/*" className="hidden" disabled={uploadingClinicLogo}
                          onChange={(e) => {
                            const f = e.target.files?.[0];
                            if (f) uploadImage(f, "clinic-logo", setLogoUrl, setUploadingClinicLogo);
                            e.target.value = "";
                          }}
                        />
                      </label>
                      {logoUrl && (
                        <Button type="button" variant="ghost" size="sm" onClick={() => setLogoUrl("")}
                          className="text-destructive hover:text-destructive gap-2 h-10">
                          <Trash2 className="h-4 w-4" /> Quitar
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {hasPublicWeb && isOwner && businessId && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Globe className="h-4 w-4" /> Dominio personalizado
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <DomainSettingsCard businessId={businessId} isOwner={isOwner} />
                </CardContent>
              </Card>
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
        </Tabs>
      </div>

      {/* Sticky save bar */}
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
