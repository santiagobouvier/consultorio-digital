import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { toast } from "@/hooks/use-toast";
import { ArrowLeft, Save, Copy, ExternalLink, RotateCcw, UserPlus, Users, Crown, User, Link, Check, Paintbrush, Upload, Bell } from "lucide-react";
import { NotificationActivationCard } from "@/components/NotificationActivationCard";
import { useDashboardBranding } from "@/contexts/DashboardBrandingContext";
import { DomainSettingsCard } from "@/components/DomainSettingsCard";
import { ProfessionalInviteModal } from "@/components/ProfessionalInviteModal";
import { Badge } from "@/components/ui/badge";
import { PlanUsageCard } from "@/components/PlanUsageCard";
import LoadingPage from "@/components/LoadingPage";

const DEFAULT_TEMPLATES = {
  reminder: "Hola {{paciente}}, te recuerdo tu sesión del {{fecha}} a las {{hora}}. Modalidad: {{modalidad}}. {{link}}. Cualquier cosa me escribís por acá.",
  confirmation: "Hola {{paciente}}, confirmo tu sesión del {{fecha}} a las {{hora}}. Modalidad: {{modalidad}}. {{link}}. Te espero!",
  postsession: "Hola {{paciente}}, gracias por tu sesión de hoy. Quedamos en contacto para la próxima. Saludos!",
};

interface TeamMember {
  userId: string;
  role: string;
  name: string;
  email: string;
}

const ClinicSettings = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [settingsId, setSettingsId] = useState<string | null>(null);
  const [businessId, setBusinessId] = useState<string | null>(null);
  const [isOwner, setIsOwner] = useState(false);
  
  const [clinicName, setClinicName] = useState("");
  const [specialty, setSpecialty] = useState("");
  const [welcomeMessage, setWelcomeMessage] = useState("");
  const [reminderMessage, setReminderMessage] = useState(DEFAULT_TEMPLATES.reminder);
  const [confirmationMessage, setConfirmationMessage] = useState(DEFAULT_TEMPLATES.confirmation);
  const [postsessionMessage, setPostsessionMessage] = useState(DEFAULT_TEMPLATES.postsession);
  const [logoUrl, setLogoUrl] = useState("");
  
  // Team management
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [loadingTeam, setLoadingTeam] = useState(false);
  const [inviteModalOpen, setInviteModalOpen] = useState(false);
  const [registrationLinkCopied, setRegistrationLinkCopied] = useState(false);
  const [coverImageUrl, setCoverImageUrl] = useState("");
  const [autoAcceptBookings, setAutoAcceptBookings] = useState(false);
  const [publicSlug, setPublicSlug] = useState("");

  // Private clinic info
  const [isPrivateClinic, setIsPrivateClinic] = useState(false);

  // Dashboard branding
  const [dashboardColor, setDashboardColor] = useState("176 100% 32%");
  const [dashboardLogoUrl, setDashboardLogoUrl] = useState("");
  const [dashboardDisplayName, setDashboardDisplayName] = useState("");
  const [uploadingDashLogo, setUploadingDashLogo] = useState(false);
  const { refetch: refetchBranding } = useDashboardBranding();

  useEffect(() => {
    checkAuth();
    loadSettings();
  }, []);

  useEffect(() => {
    if (businessId && isOwner) {
      loadTeamMembers();
    }
  }, [businessId, isOwner]);

  const checkAuth = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      navigate("/auth");
    }
  };

  const loadSettings = async () => {
    try {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Load or create business - check both owner and member
      // Include private clinic fields for display
      let { data: business } = await supabase
        .from("businesses")
        .select("id, public_slug, owner_user_id, is_private_clinic, custom_subdomain, custom_domain, dashboard_primary_color, dashboard_logo_url, dashboard_display_name")
        .eq("owner_user_id", user.id)
        .maybeSingle();

      // If no business as owner, check if member via user_roles
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

      // If still no business exists, create one
      if (!business) {
        const slug = user.id.slice(0, 8);
        const { data: newBusiness, error: createError } = await supabase
          .from("businesses")
          .insert({
            owner_user_id: user.id,
            public_slug: slug,
            name: "Mi Consultorio",
            contact_email: user.email || "",
            timezone: "America/Montevideo"
          })
          .select("id, public_slug, owner_user_id, is_private_clinic, custom_subdomain, custom_domain, dashboard_primary_color, dashboard_logo_url, dashboard_display_name")
          .single();

        if (createError) {
          console.error("Error creating business:", createError);
          toast({
            title: "Error",
            description: "No se pudo crear el consultorio",
            variant: "destructive"
          });
          return;
        }

        business = newBusiness as any;
      }

      if (business) {
        setPublicSlug(business.public_slug);
        setBusinessId(business.id);
        setIsOwner(business.owner_user_id === user.id);
        setIsPrivateClinic((business as any).is_private_clinic || false);
        // Load dashboard branding
        setDashboardColor((business as any).dashboard_primary_color || "176 100% 32%");
        setDashboardLogoUrl((business as any).dashboard_logo_url || "");
        setDashboardDisplayName((business as any).dashboard_display_name || "");
      }

      const { data: settings, error } = await supabase
        .from("clinic_settings")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();

      if (error) {
        console.error("Error loading settings:", error);
        return;
      }

      if (settings) {
        setSettingsId(settings.id);
        setClinicName(settings.clinic_name || "");
        setSpecialty(settings.specialty || "");
        setWelcomeMessage(settings.welcome_message || "");
        setReminderMessage(settings.default_reminder_message || DEFAULT_TEMPLATES.reminder);
        setConfirmationMessage(settings.default_confirmation_message || DEFAULT_TEMPLATES.confirmation);
        setPostsessionMessage(settings.default_postsession_message || DEFAULT_TEMPLATES.postsession);
        setLogoUrl(settings.logo_url || "");
        setCoverImageUrl(settings.cover_image_url || "");
        setAutoAcceptBookings(settings.auto_accept_bookings || false);
      }
    } catch (error) {
      console.error("Error loading settings:", error);
      toast({
        title: "Error",
        description: "No se pudo cargar la configuración del consultorio",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const loadTeamMembers = async () => {
    if (!businessId) return;
    
    try {
      setLoadingTeam(true);
      
      // Get the business owner info
      const { data: business } = await supabase
        .from("businesses")
        .select("owner_user_id")
        .eq("id", businessId)
        .single();

      if (!business) return;

      // Get owner profile
      const { data: ownerProfile } = await supabase
        .from("profiles")
        .select("id, name, email")
        .eq("id", business.owner_user_id)
        .maybeSingle();

      const members: TeamMember[] = [];
      
      if (ownerProfile) {
        members.push({
          userId: ownerProfile.id,
          role: "owner",
          name: ownerProfile.name,
          email: ownerProfile.email
        });
      }

      // Get professionals from user_roles
      const { data: roles } = await supabase
        .from("user_roles")
        .select("user_id, role")
        .eq("business_id", businessId)
        .eq("role", "professional");

      if (roles && roles.length > 0) {
        const userIds = roles.map(r => r.user_id);
        const { data: profiles } = await supabase
          .from("profiles")
          .select("id, name, email")
          .in("id", userIds);

        if (profiles) {
          for (const profile of profiles) {
            members.push({
              userId: profile.id,
              role: "professional",
              name: profile.name,
              email: profile.email
            });
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
        specialty: specialty,
        welcome_message: welcomeMessage,
        default_reminder_message: reminderMessage,
        default_confirmation_message: confirmationMessage,
        default_postsession_message: postsessionMessage,
        logo_url: logoUrl,
        cover_image_url: coverImageUrl,
        auto_accept_bookings: autoAcceptBookings,
      };

      if (settingsId) {
        const { error } = await supabase
          .from("clinic_settings")
          .update(settingsData)
          .eq("id", settingsId);

        if (error) throw error;
      } else {
        const { data, error } = await supabase
          .from("clinic_settings")
          .insert([settingsData])
          .select()
          .single();

        if (error) throw error;
        if (data) setSettingsId(data.id);
      }

      // Save dashboard branding to business
      if (businessId) {
        const { error: brandError } = await supabase
          .from("businesses")
          .update({
            dashboard_primary_color: dashboardColor || "176 100% 32%",
            dashboard_logo_url: dashboardLogoUrl || null,
            dashboard_display_name: dashboardDisplayName || null,
          } as any)
          .eq("id", businessId);

        if (brandError) console.error("Error saving branding:", brandError);
        
        // Refresh branding context
        await refetchBranding();
      }

      toast({
        title: "Éxito",
        description: "Configuración guardada correctamente",
      });
    } catch (error) {
      console.error("Error saving settings:", error);
      toast({
        title: "Error",
        description: "No se pudo guardar la configuración",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    setReminderMessage(DEFAULT_TEMPLATES.reminder);
    setConfirmationMessage(DEFAULT_TEMPLATES.confirmation);
    setPostsessionMessage(DEFAULT_TEMPLATES.postsession);
    toast({
      title: "Mensajes restablecidos",
      description: "Se restauraron los mensajes por defecto",
    });
  };

  const copyPublicUrl = () => {
    navigator.clipboard.writeText(`${window.location.origin}/consultorio/${publicSlug}`);
    toast({
      title: "URL copiada",
      description: "La URL se copió al portapapeles",
    });
  };

  if (loading) {
    return <LoadingPage />;
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-2xl mx-auto p-4 sm:p-6 space-y-5">
        {/* Header */}
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate("/dashboard")}
            className="shrink-0"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-xl sm:text-2xl font-bold">Mi Consultorio</h1>
        </div>

        {/* Plan y Uso */}
        <PlanUsageCard businessId={businessId} />

        {/* URL Pública */}
        {publicSlug && (
          <Card className="mobile-card border-primary/30 bg-primary/5">
            <CardContent className="p-4 sm:p-5 space-y-3">
              <p className="text-sm font-semibold text-foreground">Tu página pública</p>
              <p className="text-xs text-muted-foreground">
                Compartí esta URL para que pacientes puedan solicitar citas
              </p>
              <div className="flex gap-2">
                <Input
                  value={`${window.location.origin}/consultorio/${publicSlug}`}
                  readOnly
                  className="font-mono text-xs h-11 rounded-xl flex-1"
                />
                <Button
                  variant="outline"
                  size="icon"
                  onClick={copyPublicUrl}
                  className="h-11 w-11 rounded-xl shrink-0"
                >
                  <Copy className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => window.open(`/consultorio/${publicSlug}`, "_blank")}
                  className="h-11 w-11 rounded-xl shrink-0"
                >
                  <ExternalLink className="h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Notificaciones Push */}
        <Card className="mobile-card">
          <CardHeader className="px-0 pt-0 pb-4 sm:px-6 sm:pt-6">
            <CardTitle className="text-lg font-bold flex items-center gap-2">
              <Bell className="h-5 w-5" />
              Notificaciones
            </CardTitle>
          </CardHeader>
          <CardContent className="px-0 pb-0 sm:px-6 sm:pb-6">
            <NotificationActivationCard variant="full" />
          </CardContent>
        </Card>

        {/* Domain Settings */}
        {isOwner && businessId && (
          <DomainSettingsCard businessId={businessId} isOwner={isOwner} />
        )}

        {/* Profesionales del consultorio */}
        {isOwner && (
          <Card className="mobile-card">
            <CardHeader className="px-0 pt-0 pb-4 sm:px-6 sm:pt-6">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg font-bold flex items-center gap-2">
                  <Users className="h-5 w-5" />
                  Profesionales del consultorio
                </CardTitle>
                <Button
                  size="sm"
                  onClick={() => setInviteModalOpen(true)}
                  className="gap-2"
                >
                  <UserPlus className="h-4 w-4" />
                  Invitar
                </Button>
              </div>
            </CardHeader>
            <CardContent className="px-0 pb-0 sm:px-6 sm:pb-6 space-y-3">
              {loadingTeam ? (
                <p className="text-sm text-muted-foreground">Cargando equipo...</p>
              ) : teamMembers.length === 0 ? (
                <p className="text-sm text-muted-foreground">No hay profesionales registrados.</p>
              ) : (
                <div className="space-y-2">
                  {teamMembers.map((member) => (
                    <div
                      key={member.userId}
                      className="flex items-center justify-between p-3 bg-muted/50 rounded-xl"
                    >
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                          {member.role === "owner" ? (
                            <Crown className="h-5 w-5 text-primary" />
                          ) : (
                            <User className="h-5 w-5 text-muted-foreground" />
                          )}
                        </div>
                        <div>
                          <p className="font-medium text-sm">{member.name}</p>
                          <p className="text-xs text-muted-foreground">{member.email}</p>
                        </div>
                      </div>
                      <Badge variant={member.role === "owner" ? "default" : "secondary"}>
                        {member.role === "owner" ? "Propietario" : "Profesional"}
                      </Badge>
                    </div>
                  ))}
                </div>
              )}

              {/* Registration Link Section */}
              {publicSlug && (
                <div className="mt-4 pt-4 border-t border-border">
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Link className="h-4 w-4 text-muted-foreground" />
                      <p className="text-sm font-semibold">Enlace de registro para profesionales</p>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Compartí este enlace para que los profesionales creen su propia cuenta
                    </p>
                    <div className="flex gap-2">
                      <Input
                        value={`${window.location.origin}/registrarse-profesional?business=${publicSlug}`}
                        readOnly
                        className="font-mono text-xs h-11 rounded-xl flex-1"
                      />
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={() => {
                          navigator.clipboard.writeText(`${window.location.origin}/registrarse-profesional?business=${publicSlug}`);
                          setRegistrationLinkCopied(true);
                          toast({
                            title: "Enlace copiado",
                            description: "El enlace de registro se copió al portapapeles",
                          });
                          setTimeout(() => setRegistrationLinkCopied(false), 2000);
                        }}
                        className="h-11 w-11 rounded-xl shrink-0"
                      >
                        {registrationLinkCopied ? (
                          <Check className="h-4 w-4 text-green-500" />
                        ) : (
                          <Copy className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Información básica */}
        <Card className="mobile-card">
          <CardHeader className="px-0 pt-0 pb-4 sm:px-6 sm:pt-6">
            <CardTitle className="text-lg font-bold">Información básica</CardTitle>
          </CardHeader>
          <CardContent className="px-0 pb-0 sm:px-6 sm:pb-6 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="clinicName" className="text-sm font-semibold">Nombre del consultorio</Label>
              <Input
                id="clinicName"
                value={clinicName}
                onChange={(e) => setClinicName(e.target.value)}
                placeholder="Ej: Consultorio Psicológico Bienestar"
                className="h-12 text-base rounded-xl"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="specialty" className="text-sm font-semibold">Especialidad</Label>
              <Input
                id="specialty"
                value={specialty}
                onChange={(e) => setSpecialty(e.target.value)}
                placeholder="Ej: Psicología Clínica"
                className="h-12 text-base rounded-xl"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="welcomeMessage" className="text-sm font-semibold">Mensaje de bienvenida</Label>
              <Textarea
                id="welcomeMessage"
                value={welcomeMessage}
                onChange={(e) => setWelcomeMessage(e.target.value)}
                placeholder="Mensaje opcional para nuevos pacientes"
                rows={3}
                className="text-base rounded-xl resize-none"
              />
            </div>
          </CardContent>
        </Card>

        {/* Imágenes */}
        <Card className="mobile-card">
          <CardHeader className="px-0 pt-0 pb-4 sm:px-6 sm:pt-6">
            <CardTitle className="text-lg font-bold">Imágenes</CardTitle>
          </CardHeader>
          <CardContent className="px-0 pb-0 sm:px-6 sm:pb-6 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="logoUrl" className="text-sm font-semibold">URL del logo</Label>
              <Input
                id="logoUrl"
                value={logoUrl}
                onChange={(e) => setLogoUrl(e.target.value)}
                placeholder="https://ejemplo.com/logo.png"
                className="h-12 text-base rounded-xl"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="coverImageUrl" className="text-sm font-semibold">URL de imagen de portada</Label>
              <Input
                id="coverImageUrl"
                value={coverImageUrl}
                onChange={(e) => setCoverImageUrl(e.target.value)}
                placeholder="https://ejemplo.com/portada.jpg"
                className="h-12 text-base rounded-xl"
              />
            </div>
          </CardContent>
        </Card>

        {/* Reservas automáticas */}
        <Card className="mobile-card">
          <CardContent className="px-0 py-0 sm:px-6 sm:py-6">
            <div className="flex items-center justify-between gap-4">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-foreground">Auto-aceptar reservas</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Las reservas de pacientes ya registrados se confirmarán automáticamente
                </p>
              </div>
              <Switch
                checked={autoAcceptBookings}
                onCheckedChange={setAutoAcceptBookings}
              />
            </div>
          </CardContent>
        </Card>

        {/* Dashboard Branding */}
        <Card className="mobile-card border-primary/20">
          <CardHeader className="px-0 pt-0 pb-4 sm:px-6 sm:pt-6">
            <CardTitle className="text-lg font-bold flex items-center gap-2">
              <Paintbrush className="h-5 w-5 text-primary" />
              Personalización del Panel
            </CardTitle>
            <p className="text-sm text-muted-foreground mt-1">
              Personalizá los colores y logo de tu panel de gestión (independiente del portal del paciente)
            </p>
          </CardHeader>
          <CardContent className="px-0 pb-0 sm:px-6 sm:pb-6 space-y-4">
            <div className="space-y-2">
              <Label className="text-sm font-semibold">Nombre visible</Label>
              <Input
                value={dashboardDisplayName}
                onChange={(e) => setDashboardDisplayName(e.target.value)}
                placeholder="Ej: Mi Consultorio"
                className="h-12 text-base rounded-xl"
              />
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-semibold">Logo del navegador</Label>
              <p className="text-xs text-muted-foreground">
                Aparece en el header del panel y reemplaza el ícono de calendario por defecto.
              </p>

              {/* Upload from device */}
              <div className="flex flex-col sm:flex-row gap-2 items-stretch sm:items-center">
                <label className="inline-flex items-center justify-center gap-2 h-12 px-4 rounded-xl border border-border bg-muted/40 hover:bg-muted cursor-pointer text-sm font-medium transition-colors">
                  <Upload className="h-4 w-4" />
                  {uploadingDashLogo ? "Subiendo..." : "Subir imagen"}
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    disabled={uploadingDashLogo}
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (!file || !businessId) return;
                      try {
                        setUploadingDashLogo(true);
                        const ext = file.name.split(".").pop() || "png";
                        const path = `portal-logos/${businessId}-dashboard-${Date.now()}.${ext}`;
                        const { error: upErr } = await supabase.storage
                          .from("avatars")
                          .upload(path, file, { upsert: true, contentType: file.type });
                        if (upErr) throw upErr;
                        const { data: pub } = supabase.storage.from("avatars").getPublicUrl(path);
                        setDashboardLogoUrl(pub.publicUrl);
                        toast({ title: "Logo subido", description: "Recordá guardar los cambios." });
                      } catch (err: any) {
                        console.error("Upload error:", err);
                        toast({
                          title: "Error",
                          description: err?.message || "No se pudo subir la imagen",
                          variant: "destructive",
                        });
                      } finally {
                        setUploadingDashLogo(false);
                        e.target.value = "";
                      }
                    }}
                  />
                </label>
                {dashboardLogoUrl && (
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => setDashboardLogoUrl("")}
                    className="h-12 rounded-xl text-destructive hover:text-destructive"
                  >
                    Quitar logo
                  </Button>
                )}
              </div>

              {/* Or paste URL */}
              <Input
                value={dashboardLogoUrl}
                onChange={(e) => setDashboardLogoUrl(e.target.value)}
                placeholder="…o pegá una URL: https://ejemplo.com/logo.png"
                className="h-12 text-base rounded-xl"
              />
              {dashboardLogoUrl && (
                <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-xl">
                  <img src={dashboardLogoUrl} alt="Logo preview" className="w-10 h-10 rounded-lg object-cover" />
                  <span className="text-sm text-muted-foreground">Vista previa del logo</span>
                </div>
              )}
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-semibold">Color principal (HSL)</Label>
              <div className="flex items-center gap-3">
                <Input
                  value={dashboardColor}
                  onChange={(e) => setDashboardColor(e.target.value)}
                  placeholder="176 100% 32%"
                  className="h-12 text-base rounded-xl flex-1"
                />
                <div
                  className="w-12 h-12 rounded-xl border border-border shrink-0"
                  style={{ background: `hsl(${dashboardColor})` }}
                />
              </div>
              <p className="text-xs text-muted-foreground">Formato: hue saturation% lightness% (ej: 220 80% 50% para azul)</p>
              {/* Quick color presets */}
              <div className="flex flex-wrap gap-2 pt-1">
                {[
                  { label: "Teal", value: "176 100% 32%" },
                  { label: "Azul", value: "220 80% 50%" },
                  { label: "Violeta", value: "270 70% 50%" },
                  { label: "Rosa", value: "330 75% 55%" },
                  { label: "Naranja", value: "25 90% 50%" },
                  { label: "Verde", value: "150 70% 40%" },
                ].map((preset) => (
                  <button
                    key={preset.label}
                    type="button"
                    onClick={() => setDashboardColor(preset.value)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-border text-xs font-medium hover:bg-muted transition-colors"
                  >
                    <div
                      className="w-3 h-3 rounded-full"
                      style={{ background: `hsl(${preset.value})` }}
                    />
                    {preset.label}
                  </button>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="mobile-card">
          <CardHeader className="px-0 pt-0 pb-4 sm:px-6 sm:pt-6">
            <CardTitle className="text-lg font-bold">Variables disponibles</CardTitle>
          </CardHeader>
          <CardContent className="px-0 pb-0 sm:px-6 sm:pb-6">
            <div className="grid grid-cols-1 gap-2 text-sm">
              <div className="flex items-center gap-3 p-2 bg-muted/50 rounded-lg">
                <code className="bg-background px-2 py-1 rounded text-xs font-mono">{"{{paciente}}"}</code>
                <span className="text-muted-foreground text-xs">Nombre del paciente</span>
              </div>
              <div className="flex items-center gap-3 p-2 bg-muted/50 rounded-lg">
                <code className="bg-background px-2 py-1 rounded text-xs font-mono">{"{{fecha}}"}</code>
                <span className="text-muted-foreground text-xs">Fecha de la cita</span>
              </div>
              <div className="flex items-center gap-3 p-2 bg-muted/50 rounded-lg">
                <code className="bg-background px-2 py-1 rounded text-xs font-mono">{"{{hora}}"}</code>
                <span className="text-muted-foreground text-xs">Hora de la cita</span>
              </div>
              <div className="flex items-center gap-3 p-2 bg-muted/50 rounded-lg">
                <code className="bg-background px-2 py-1 rounded text-xs font-mono">{"{{modalidad}}"}</code>
                <span className="text-muted-foreground text-xs">Online o Presencial</span>
              </div>
              <div className="flex items-center gap-3 p-2 bg-muted/50 rounded-lg">
                <code className="bg-background px-2 py-1 rounded text-xs font-mono">{"{{link}}"}</code>
                <span className="text-muted-foreground text-xs">Link o ubicación</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Mensajes personalizados */}
        <Card className="mobile-card">
          <CardHeader className="px-0 pt-0 pb-4 sm:px-6 sm:pt-6">
            <CardTitle className="text-lg font-bold">Mensaje de recordatorio</CardTitle>
          </CardHeader>
          <CardContent className="px-0 pb-0 sm:px-6 sm:pb-6">
            <Textarea
              value={reminderMessage}
              onChange={(e) => setReminderMessage(e.target.value)}
              rows={4}
              className="text-base rounded-xl resize-none"
            />
          </CardContent>
        </Card>

        <Card className="mobile-card">
          <CardHeader className="px-0 pt-0 pb-4 sm:px-6 sm:pt-6">
            <CardTitle className="text-lg font-bold">Mensaje de confirmación</CardTitle>
          </CardHeader>
          <CardContent className="px-0 pb-0 sm:px-6 sm:pb-6">
            <Textarea
              value={confirmationMessage}
              onChange={(e) => setConfirmationMessage(e.target.value)}
              rows={4}
              className="text-base rounded-xl resize-none"
            />
          </CardContent>
        </Card>

        <Card className="mobile-card">
          <CardHeader className="px-0 pt-0 pb-4 sm:px-6 sm:pt-6">
            <CardTitle className="text-lg font-bold">Mensaje post-sesión</CardTitle>
          </CardHeader>
          <CardContent className="px-0 pb-0 sm:px-6 sm:pb-6">
            <Textarea
              value={postsessionMessage}
              onChange={(e) => setPostsessionMessage(e.target.value)}
              rows={4}
              className="text-base rounded-xl resize-none"
            />
          </CardContent>
        </Card>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-3 pb-8">
          <Button
            variant="outline"
            onClick={handleReset}
            className="h-12 rounded-xl text-base font-semibold flex-1"
          >
            <RotateCcw className="h-4 w-4 mr-2" />
            Restablecer mensajes
          </Button>
          <Button
            onClick={handleSave}
            disabled={saving}
            className="h-12 rounded-xl text-base font-semibold flex-1"
          >
            <Save className="h-4 w-4 mr-2" />
            {saving ? "Guardando..." : "Guardar cambios"}
          </Button>
        </div>
      </div>

      {/* Modal para invitar profesionales */}
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