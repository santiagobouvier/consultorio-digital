import { useEffect, useState } from "react";
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
  Bell,
  Building2,
  CreditCard,
  ShieldCheck,
} from "lucide-react";
import { NotificationActivationCard } from "@/components/NotificationActivationCard";
import { useDashboardBranding } from "@/contexts/DashboardBrandingContext";
import LoadingPage from "@/components/LoadingPage";
import { PaymentPolicySettings } from "@/components/PaymentPolicySettings";

const ClinicSettings = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [settingsId, setSettingsId] = useState<string | null>(null);
  const [businessId, setBusinessId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState(searchParams.get("tab") || "general");

  // Form state
  const [clinicName, setClinicName] = useState("");
  const [ownerName, setOwnerName] = useState("");
  const [specialty, setSpecialty] = useState("");
  const [welcomeMessage, setWelcomeMessage] = useState("");
  const [isPrivateClinic, setIsPrivateClinic] = useState(false);
  const [contactEmail, setContactEmail] = useState("");
  const [cancellationHoursNotice, setCancellationHoursNotice] = useState<number>(24);
  const [lateCancellationMessage, setLateCancellationMessage] = useState<string>("");
  const [defaultSessionPrice, setDefaultSessionPrice] = useState<string>("");
  // Ventana de reservas online (aplica solo a la reserva pública y al portal;
  // en tu panel vos agendás cuando quieras)
  const [minBookingNoticeHours, setMinBookingNoticeHours] = useState<number>(24);
  const [maxBookingHorizonDays, setMaxBookingHorizonDays] = useState<number>(60);
  // Lead del recordatorio automático (para advertir el cruce de ventanas)
  const [reminderHoursBefore, setReminderHoursBefore] = useState<number>(24);

  // Initial snapshot to detect dirty state
  const [initialSnapshot, setInitialSnapshot] = useState<string>("");

  const { refetch: refetchBranding } = useDashboardBranding();

  useEffect(() => {
    checkAuth();
    loadSettings();
  }, []);

  const buildSnapshot = () =>
    JSON.stringify({
      clinicName,
      ownerName,
      specialty,
      welcomeMessage,
      contactEmail,
      isPrivateClinic,
      cancellationHoursNotice,
      lateCancellationMessage,
      defaultSessionPrice,
      minBookingNoticeHours,
      maxBookingHorizonDays,
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
        .select("id, public_slug, owner_user_id, is_private_clinic, cancellation_hours_notice, late_cancellation_message, default_session_price, contact_email, min_booking_notice_hours, max_booking_horizon_days")
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
            .select("id, public_slug, owner_user_id, is_private_clinic, cancellation_hours_notice, late_cancellation_message, default_session_price, contact_email, min_booking_notice_hours, max_booking_horizon_days")
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

      if (business) {
        setBusinessId(business.id);
        setIsPrivateClinic((business as any).is_private_clinic || false);
        setContactEmail((business as any).contact_email || "");
        setCancellationHoursNotice((business as any).cancellation_hours_notice ?? 24);
        setLateCancellationMessage((business as any).late_cancellation_message ?? "");
        const dsp = (business as any).default_session_price;
        setDefaultSessionPrice(dsp != null ? String(dsp) : "");
        setMinBookingNoticeHours((business as any).min_booking_notice_hours ?? 24);
        setMaxBookingHorizonDays((business as any).max_booking_horizon_days ?? 60);
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
        setReminderHoursBefore((settings as any).reminder_hours_before ?? 24);
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

      // Snapshot inicial construido con los valores RECIÉN CARGADOS (no con
      // el estado, que en este render todavía tiene los defaults). El viejo
      // setTimeout(buildSnapshot) capturaba los defaults → la página se creía
      // "con cambios sin guardar" siempre, y el navegador preguntaba al salir
      // (ej: al conectar Mercado Pago). El orden de claves debe calcar
      // buildSnapshot().
      setInitialSnapshot(JSON.stringify({
        clinicName: loadedClinicName,
        ownerName: ownProfile?.name || "",
        specialty: loadedSpecialty,
        welcomeMessage: loadedWelcome,
        contactEmail: (business as any)?.contact_email || "",
        isPrivateClinic: (business as any)?.is_private_clinic || false,
        cancellationHoursNotice: (business as any)?.cancellation_hours_notice ?? 24,
        lateCancellationMessage: (business as any)?.late_cancellation_message ?? "",
        defaultSessionPrice:
          (business as any)?.default_session_price != null
            ? String((business as any).default_session_price)
            : "",
        minBookingNoticeHours: (business as any)?.min_booking_notice_hours ?? 24,
        maxBookingHorizonDays: (business as any)?.max_booking_horizon_days ?? 60,
      }));
    } catch (error) {
      console.error("Error loading settings:", error);
      toast({ title: "Error", description: "No se pudo cargar la configuración", variant: "destructive" });
    } finally {
      setLoading(false);
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
          contact_email: contactEmail.trim() || null,
          cancellation_hours_notice: Number.isFinite(cancellationHoursNotice) ? cancellationHoursNotice : 24,
          late_cancellation_message: lateCancellationMessage.trim() || null,
          default_session_price: defaultSessionPrice.trim() === "" ? null : Number(defaultSessionPrice),
          min_booking_notice_hours: Number.isFinite(minBookingNoticeHours)
            ? Math.min(Math.max(minBookingNoticeHours, 0), 720) : 24,
          max_booking_horizon_days: Number.isFinite(maxBookingHorizonDays)
            ? Math.min(Math.max(maxBookingHorizonDays, 1), 365) : 60,
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

  if (loading) return <LoadingPage />;

  return (
    <div className="min-h-screen bg-background pb-32">
      <div className="mx-auto w-full max-w-[1500px] p-4 sm:p-6 space-y-6">
        {/* Encabezado de página */}
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3 min-w-0">
            <span className="h-11 w-11 rounded-2xl flex items-center justify-center shrink-0" style={{ background: "hsla(215, 15%, 65%, 0.16)" }}>
              <Building2 className="h-5 w-5" style={{ color: "hsl(215 15% 65%)" }} />
            </span>
            <div className="min-w-0">
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Mi Consultorio</h1>
              <p className="text-sm text-muted-foreground truncate">
                {clinicName || "Mi Consultorio"}
                {specialty ? ` · ${specialty}` : ""}
                {isPrivateClinic ? " · Agenda privada" : ""}
              </p>
            </div>
          </div>
          <button
            onClick={() => navigate("/dashboard")}
            className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Volver al dashboard
          </button>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full sm:w-auto sm:inline-grid h-auto p-1 grid-cols-3">
            <TabsTrigger value="general" className="gap-1.5 text-xs sm:text-sm py-2 sm:px-6">
              <Building2 className="h-3.5 w-3.5" /> General
            </TabsTrigger>
            <TabsTrigger value="notificaciones" className="gap-1.5 text-xs sm:text-sm py-2 sm:px-6">
              <Bell className="h-3.5 w-3.5" /> Avisos
            </TabsTrigger>
            <TabsTrigger value="pagos" className="gap-1.5 text-xs sm:text-sm py-2 sm:px-6">
              <CreditCard className="h-3.5 w-3.5" /> Pagos
            </TabsTrigger>
          </TabsList>

          {/* TAB: GENERAL — dos columnas en desktop */}
          <TabsContent value="general" className="mt-5">
            <div className="grid grid-cols-1 lg:grid-cols-5 gap-5 items-start">
            <div className="lg:col-span-3">
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
                  <Label htmlFor="contactEmail">Email de avisos</Label>
                  <Input
                    id="contactEmail" type="email" value={contactEmail}
                    onChange={(e) => setContactEmail(e.target.value)}
                    placeholder="tu@email.com" className="h-11"
                  />
                  <p className="text-xs text-muted-foreground">
                    A esta casilla te llegan los avisos de cada reserva, solicitud y reprogramación.
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="welcomeMessage">Descripción</Label>
                  <Textarea
                    id="welcomeMessage" value={welcomeMessage} onChange={(e) => setWelcomeMessage(e.target.value)}
                    placeholder="Descripción opcional del consultorio que verán los pacientes." rows={3} className="resize-none"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="defaultSessionPrice">Tarifa por sesión (UYU)</Label>
                  <div className="relative max-w-[200px]">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">$</span>
                    <Input
                      id="defaultSessionPrice"
                      type="number"
                      min={0}
                      step={1}
                      value={defaultSessionPrice}
                      onChange={(e) => setDefaultSessionPrice(e.target.value)}
                      placeholder="0"
                      className="h-11 pl-7"
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Es tu tarifa única: se usa al crear citas desde el panel y para los cobros online,
                    salvo que la cita o el tipo de sesión tengan su propio precio.
                  </p>
                </div>
              </CardContent>
            </Card>

            </div>

            <div className="lg:col-span-2 space-y-5">
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

            {/* Protección de agenda: la config más importante para el día a
                día — bien grande, con color y ejemplos vivos, imposible no
                entenderla */}
            <Card className="border-primary/30 bg-primary/[0.04]">
              <CardHeader>
                <CardTitle className="text-lg font-bold flex items-center gap-2.5">
                  <span className="h-9 w-9 rounded-xl bg-primary/15 flex items-center justify-center shrink-0">
                    <ShieldCheck className="h-5 w-5 text-primary" />
                  </span>
                  Protegé tu agenda de reservas sobre la hora
                </CardTitle>
                <p className="text-sm text-muted-foreground mt-1">
                  Sin esto, alguien puede reservarte a las 20:55 la sesión de las 21:00 y agarrarte
                  desprevenido. Acá definís cuánto aviso previo exigís. Aplica a tu web pública y al
                  portal — <span className="font-medium text-foreground">en tu panel vos agendás cuando quieras</span>.
                </p>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* ── Anticipación mínima ── */}
                <div className="space-y-3 rounded-xl border border-border/60 bg-background p-4">
                  <Label htmlFor="minBookingNotice" className="text-base font-bold">
                    ¿Con cuánto aviso previo te pueden reservar?
                  </Label>
                  <p className="text-sm text-muted-foreground -mt-1">
                    Los horarios más cercanos que esto <span className="font-semibold text-foreground">desaparecen</span> de
                    la reserva online: nadie te puede reservar de golpe.
                  </p>
                  <div className="flex items-center gap-2 flex-wrap">
                    {[2, 12, 24, 48].map((h) => (
                      <button
                        key={h}
                        type="button"
                        onClick={() => setMinBookingNoticeHours(h)}
                        className={`px-3.5 py-1.5 rounded-full text-sm font-semibold border transition-colors ${
                          minBookingNoticeHours === h
                            ? "bg-primary text-primary-foreground border-primary"
                            : "border-border text-muted-foreground hover:border-primary/50 hover:text-foreground"
                        }`}
                      >
                        {h} h
                      </button>
                    ))}
                    <div className="flex items-center gap-1.5">
                      <Input
                        id="minBookingNotice"
                        type="number"
                        min={0}
                        max={720}
                        value={minBookingNoticeHours}
                        onChange={(e) => setMinBookingNoticeHours(parseInt(e.target.value || "0", 10))}
                        className="h-9 w-[80px] text-center font-semibold"
                      />
                      <span className="text-sm text-muted-foreground">horas</span>
                    </div>
                  </div>
                  {Number.isFinite(minBookingNoticeHours) && minBookingNoticeHours >= 0 && (
                    <p className="text-sm font-medium text-primary bg-primary/10 border border-primary/20 rounded-lg px-3 py-2">
                      ✓ Con {minBookingNoticeHours} horas: lo más pronto que te pueden reservar ahora
                      mismo es el{" "}
                      {new Date(Date.now() + minBookingNoticeHours * 3600000).toLocaleString("es-UY", {
                        weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit",
                      })} hs.
                    </p>
                  )}
                  {Number.isFinite(minBookingNoticeHours) &&
                    Number.isFinite(reminderHoursBefore) &&
                    minBookingNoticeHours < reminderHoursBefore && (
                    <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-3 text-xs text-amber-700 dark:text-amber-300">
                      <p className="font-semibold">Ojo con los recordatorios</p>
                      <p className="mt-1">
                        Tu recordatorio automático sale {reminderHoursBefore} horas antes de la sesión.
                        Las reservas que entren con menos de {reminderHoursBefore} horas de anticipación
                        no van a recibir recordatorio automático (la confirmación sí les llega).
                        Podés dejarlo así a propósito, pero que no te sorprenda.
                      </p>
                    </div>
                  )}
                </div>

                {/* ── Horizonte máximo ── */}
                <div className="space-y-3 rounded-xl border border-border/60 bg-background p-4">
                  <Label htmlFor="maxBookingHorizon" className="text-base font-bold">
                    ¿Hasta cuándo a futuro te pueden reservar?
                  </Label>
                  <p className="text-sm text-muted-foreground -mt-1">
                    Para que no te reserven un turno para dentro de cuatro meses cuando ni sabés
                    cómo va a estar tu agenda.
                  </p>
                  <div className="flex items-center gap-2 flex-wrap">
                    {[30, 60, 90].map((d) => (
                      <button
                        key={d}
                        type="button"
                        onClick={() => setMaxBookingHorizonDays(d)}
                        className={`px-3.5 py-1.5 rounded-full text-sm font-semibold border transition-colors ${
                          maxBookingHorizonDays === d
                            ? "bg-primary text-primary-foreground border-primary"
                            : "border-border text-muted-foreground hover:border-primary/50 hover:text-foreground"
                        }`}
                      >
                        {d} días
                      </button>
                    ))}
                    <div className="flex items-center gap-1.5">
                      <Input
                        id="maxBookingHorizon"
                        type="number"
                        min={1}
                        max={365}
                        value={maxBookingHorizonDays}
                        onChange={(e) => setMaxBookingHorizonDays(parseInt(e.target.value || "0", 10))}
                        className="h-9 w-[80px] text-center font-semibold"
                      />
                      <span className="text-sm text-muted-foreground">días</span>
                    </div>
                  </div>
                  {Number.isFinite(maxBookingHorizonDays) && maxBookingHorizonDays > 0 && (
                    <p className="text-sm font-medium text-primary bg-primary/10 border border-primary/20 rounded-lg px-3 py-2">
                      ✓ Se puede reservar hasta el{" "}
                      {new Date(Date.now() + maxBookingHorizonDays * 86400000).toLocaleDateString("es-UY", {
                        weekday: "long", day: "numeric", month: "long",
                      })} inclusive.
                    </p>
                  )}
                </div>
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
            </div>
            </div>
          </TabsContent>

          {/* TAB: NOTIFICACIONES */}
          <TabsContent value="notificaciones" className="mt-5">
            <Card className="lg:max-w-2xl">
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Bell className="h-4 w-4" /> Notificaciones push
                </CardTitle>
                <p className="text-xs text-muted-foreground">
                  Recibí avisos en tiempo real cuando un paciente solicite o confirme una cita.
                </p>
              </CardHeader>
              <CardContent>
                <NotificationActivationCard variant="full" audience="professional" />
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
          <div className="max-w-[1500px] mx-auto px-4 sm:px-6 py-3 flex items-center justify-between gap-3">
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

    </div>
  );
};

export default ClinicSettings;