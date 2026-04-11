import { useState, useEffect, useMemo, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useBusinessId } from "@/hooks/use-business-id";
import { useToast } from "@/hooks/use-toast";
import { 
  User, Calendar, CreditCard, Clock, MapPin, Video,
  Phone, Mail, Building2, ArrowLeft, FileText, 
  LayoutDashboard, Star, Heart, TrendingUp, CalendarCheck,
  ChevronRight, CheckCircle2, AlertCircle, Sun, Moon,
  Download, Share2, Copy, ExternalLink, Smartphone,
  Camera, Save, Edit2, X
} from "lucide-react";
import { formatCurrency } from "@/lib/payments";

// ---- Simulated data ----
const DEMO_PATIENT_INITIAL = {
  full_name: "Sofía Martínez",
  email: "sofia.martinez@email.com",
  whatsapp_phone: "+598 99 111 111",
  reason_for_consultation: "Manejo de ansiedad y estrés laboral",
  avatar_url: "",
  created_at: "2025-11-15",
  private_notes: "Sofía ha mostrado avances significativos en técnicas de respiración y mindfulness. Continuar trabajando en límites laborales.",
};

const today = new Date();
const addDays = (d: Date, n: number) => { const r = new Date(d); r.setDate(r.getDate() + n); return r; };
const formatDate = (d: Date) => d.toLocaleDateString("es-UY", { weekday: "long", day: "numeric", month: "long" });
const formatShort = (d: Date) => d.toLocaleDateString("es-UY", { day: "numeric", month: "long", year: "numeric" });

const UPCOMING = [
  { id: "1", date: addDays(today, 3), start: "10:00", end: "10:50", status: "confirmed", modality: "presencial", location: "Av. 18 de Julio 1234", service: "Sesión individual", notes: null },
  { id: "2", date: addDays(today, 10), start: "14:00", end: "14:50", status: "pending", modality: "online", location: null, service: "Sesión individual", notes: "Preparar ejercicio de journaling" },
];

const PAST = [
  { id: "3", date: addDays(today, -7), start: "10:00", end: "10:50", status: "completed", modality: "presencial", service: "Sesión individual", notes: "Trabajamos técnicas de grounding. Sofía reporta mejoría en episodios de ansiedad nocturna." },
  { id: "4", date: addDays(today, -14), start: "10:00", end: "10:50", status: "completed", modality: "online", service: "Sesión individual", notes: "Revisión de diario emocional. Identificamos patrones de estrés relacionados con reuniones laborales." },
  { id: "5", date: addDays(today, -21), start: "14:00", end: "14:50", status: "completed", modality: "presencial", service: "Sesión individual", notes: "Primera sesión de EMDR. Buena respuesta inicial." },
  { id: "6", date: addDays(today, -28), start: "10:00", end: "10:50", status: "completed", modality: "presencial", service: "Sesión individual", notes: null },
  { id: "7", date: addDays(today, -35), start: "10:00", end: "10:50", status: "no_show", modality: "presencial", service: "Sesión individual", notes: null },
];

const PAYMENTS = [
  { id: "1", amount: 1800, due_date: addDays(today, 5), status: "pending", paid_at: null, recurrence: "Mensual", notes: "Abril 2026" },
  { id: "2", amount: 1800, due_date: addDays(today, -25), status: "paid", paid_at: addDays(today, -24), recurrence: "Mensual", notes: "Marzo 2026" },
  { id: "3", amount: 1800, due_date: addDays(today, -55), status: "paid", paid_at: addDays(today, -53), recurrence: "Mensual", notes: "Febrero 2026" },
  { id: "4", amount: 1800, due_date: addDays(today, -86), status: "paid", paid_at: addDays(today, -86), recurrence: "Mensual", notes: "Enero 2026" },
  { id: "5", amount: 1500, due_date: addDays(today, -116), status: "paid", paid_at: addDays(today, -115), recurrence: "Mensual", notes: "Diciembre 2025" },
];

const TABS = [
  { id: "resumen", label: "Resumen", icon: LayoutDashboard },
  { id: "citas", label: "Citas", icon: Calendar },
  { id: "historial", label: "Historial", icon: FileText },
  { id: "pagos", label: "Pagos", icon: CreditCard },
  { id: "perfil", label: "Perfil", icon: User },
] as const;

// Theme CSS variables generator
const generateThemeVars = (primaryColor: string, isDark: boolean) => {
  const vars: Record<string, string> = {};
  if (isDark) {
    vars["--background"] = "220 15% 8%";
    vars["--foreground"] = "220 10% 98%";
    vars["--card"] = "220 12% 11%";
    vars["--card-foreground"] = "220 10% 98%";
    vars["--popover"] = "220 12% 11%";
    vars["--popover-foreground"] = "220 10% 98%";
    vars["--primary"] = primaryColor;
    vars["--primary-foreground"] = "0 0% 100%";
    vars["--secondary"] = "220 12% 16%";
    vars["--secondary-foreground"] = "220 10% 98%";
    vars["--muted"] = "220 12% 16%";
    vars["--muted-foreground"] = "220 8% 65%";
    vars["--accent"] = "220 15% 18%";
    vars["--accent-foreground"] = "220 10% 90%";
    vars["--destructive"] = "0 70% 50%";
    vars["--destructive-foreground"] = "0 0% 100%";
    vars["--border"] = "220 12% 18%";
    vars["--input"] = "220 12% 18%";
    vars["--ring"] = primaryColor;
  } else {
    vars["--background"] = "220 15% 98%";
    vars["--foreground"] = "220 10% 15%";
    vars["--card"] = "0 0% 100%";
    vars["--card-foreground"] = "220 10% 15%";
    vars["--popover"] = "0 0% 100%";
    vars["--popover-foreground"] = "220 10% 15%";
    vars["--primary"] = primaryColor;
    vars["--primary-foreground"] = "0 0% 100%";
    vars["--secondary"] = "220 25% 96%";
    vars["--secondary-foreground"] = "220 10% 25%";
    vars["--muted"] = "220 15% 96%";
    vars["--muted-foreground"] = "220 8% 46%";
    vars["--accent"] = "220 30% 94%";
    vars["--accent-foreground"] = "220 10% 25%";
    vars["--destructive"] = "0 84% 60%";
    vars["--destructive-foreground"] = "0 0% 100%";
    vars["--border"] = "220 10% 90%";
    vars["--input"] = "220 10% 90%";
    vars["--ring"] = primaryColor;
  }
  return vars;
};

interface PortalBranding {
  name: string;
  specialty: string;
  contact_email: string;
  logoUrl: string;
  lightColor: string;
  darkColor: string;
  slug: string;
}

const PatientPortalDemo = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { businessId, loading: bizLoading } = useBusinessId(false);
  const [tab, setTab] = useState("resumen");
  const [isDark, setIsDark] = useState(false);
  const [showInstallPanel, setShowInstallPanel] = useState(false);
  const [branding, setBranding] = useState<PortalBranding>({
    name: "Consultorio Demo",
    specialty: "Psicología Clínica",
    contact_email: "demo@consultorio.com",
    logoUrl: "",
    lightColor: "176 100% 32%",
    darkColor: "176 85% 42%",
    slug: "",
  });

  // Profile editing state
  const [demoPatient, setDemoPatient] = useState(DEMO_PATIENT_INITIAL);
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [editForm, setEditForm] = useState({ whatsapp_phone: "", reason_for_consultation: "" });
  const [previewAvatar, setPreviewAvatar] = useState<string>("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load branding from DB
  useEffect(() => {
    const loadBranding = async () => {
      let query = supabase
        .from("businesses")
        .select("name, specialty, contact_email, portal_logo_url, portal_clinic_display_name, portal_primary_color, portal_dark_primary_color, public_slug, is_demo");
      
      if (businessId) {
        query = query.eq("id", businessId);
      } else {
        query = query.eq("is_demo", true);
      }

      const { data } = await query.limit(1).maybeSingle();
      if (data) {
        setBranding({
          name: (data as any).portal_clinic_display_name || data.name || "Mi Consultorio",
          specialty: data.specialty || "Salud",
          contact_email: data.contact_email || "",
          logoUrl: (data as any).portal_logo_url || "",
          lightColor: (data as any).portal_primary_color || "176 100% 32%",
          darkColor: (data as any).portal_dark_primary_color || "176 85% 42%",
          slug: data.public_slug || "",
        });
      }
    };
    loadBranding();
  }, [businessId]);

  // Apply theme CSS variables
  const themeVars = useMemo(() => {
    const color = isDark ? branding.darkColor : branding.lightColor;
    return generateThemeVars(color, isDark);
  }, [isDark, branding.lightColor, branding.darkColor]);

  const themeStyle = useMemo(() => {
    const style: Record<string, string> = {};
    Object.entries(themeVars).forEach(([key, value]) => {
      style[key] = value;
    });
    return style;
  }, [themeVars]);

  const totalSessions = PAST.filter(a => a.status === "completed").length;
  const totalPaid = PAYMENTS.filter(p => p.status === "paid").reduce((s, p) => s + p.amount, 0);
  const pendingCount = PAYMENTS.filter(p => p.status === "pending").length;

  const portalUrl = branding.slug
    ? `${window.location.origin}/portal-paciente/demo?clinic=${branding.slug}`
    : `${window.location.origin}/portal-paciente/demo`;

  const handleCopyLink = () => {
    navigator.clipboard.writeText(portalUrl);
    toast({ title: "Link copiado", description: "Compartí este link con tus pacientes" });
  };

  const initials = demoPatient.full_name.split(" ").map(w => w[0]).join("").substring(0, 2).toUpperCase();

  const statusBadge = (status: string) => {
    const map: Record<string, { variant: "default" | "secondary" | "destructive" | "outline"; label: string }> = {
      pending: { variant: "secondary", label: "Pendiente" },
      confirmed: { variant: "default", label: "Confirmada" },
      completed: { variant: "outline", label: "Completada" },
      cancelled: { variant: "destructive", label: "Cancelada" },
      no_show: { variant: "destructive", label: "Ausente" },
    };
    const c = map[status] || { variant: "secondary" as const, label: status };
    return <Badge variant={c.variant}>{c.label}</Badge>;
  };

  const payBadge = (status: string) => {
    if (status === "paid") return <Badge className="bg-primary/90 text-primary-foreground hover:bg-primary/90">Pagado</Badge>;
    if (status === "overdue") return <Badge variant="destructive">Vencido</Badge>;
    return <Badge variant="secondary">Pendiente</Badge>;
  };

  // Profile edit handlers
  const startEditing = () => {
    setEditForm({
      whatsapp_phone: demoPatient.whatsapp_phone,
      reason_for_consultation: demoPatient.reason_for_consultation,
    });
    setPreviewAvatar(demoPatient.avatar_url);
    setIsEditingProfile(true);
  };

  const cancelEditing = () => {
    setIsEditingProfile(false);
    setPreviewAvatar("");
  };

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    setPreviewAvatar(url);
  };

  const saveProfile = () => {
    setDemoPatient(prev => ({
      ...prev,
      whatsapp_phone: editForm.whatsapp_phone,
      reason_for_consultation: editForm.reason_for_consultation,
      avatar_url: previewAvatar,
    }));
    setIsEditingProfile(false);
    toast({ title: "Perfil actualizado", description: "Los cambios se guardaron correctamente" });
  };

  // ---- Tab Content ----

  const ResumenTab = () => (
    <div className="space-y-5 lg:space-y-6">
      {/* Welcome hero - desktop */}
      <div className="hidden lg:block rounded-2xl border bg-gradient-to-br from-primary/5 via-card to-accent/5 p-8">
        <div className="flex items-center gap-6">
          <Avatar className="h-20 w-20 border-4 border-primary/20 shadow-lg">
            {demoPatient.avatar_url ? <AvatarImage src={demoPatient.avatar_url} /> : null}
            <AvatarFallback className="text-2xl font-bold bg-primary/10 text-primary">{initials}</AvatarFallback>
          </Avatar>
          <div>
            <h2 className="text-2xl font-bold text-foreground">Hola, {demoPatient.full_name.split(" ")[0]} 👋</h2>
            <p className="text-muted-foreground mt-1">Acá podés ver tu resumen, próximas citas, pagos e historial.</p>
            <p className="text-xs text-muted-foreground mt-2">{branding.name} · {branding.specialty}</p>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-4">
        {[
          { icon: Calendar, value: UPCOMING.length, label: "Próximas citas", accent: false },
          { icon: CalendarCheck, value: totalSessions, label: "Sesiones realizadas", accent: false },
          { icon: AlertCircle, value: pendingCount, label: "Pagos pendientes", accent: true },
          { icon: TrendingUp, value: formatCurrency(totalPaid, "UYU"), label: "Total pagado", accent: false },
        ].map((stat, i) => (
          <Card key={i} className="group hover:shadow-md transition-all border-border/60">
            <CardContent className="pt-4 pb-3 lg:pt-6 lg:pb-4 text-center">
              <div className={`inline-flex items-center justify-center h-10 w-10 rounded-full mb-2 lg:mb-3 ${stat.accent ? "bg-destructive/10" : "bg-primary/10"}`}>
                <stat.icon className={`h-5 w-5 ${stat.accent ? "text-destructive" : "text-primary"}`} />
              </div>
              <p className={`text-2xl lg:text-3xl font-bold ${stat.accent ? "text-destructive" : "text-primary"}`}>{stat.value}</p>
              <p className="text-xs lg:text-sm text-muted-foreground mt-0.5">{stat.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Two-column */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-6">
        <Card className="hover:shadow-md transition-all">
          <CardHeader className="pb-2 lg:pb-3">
            <CardTitle className="text-base lg:text-lg flex items-center gap-2">
              <Calendar className="h-4 w-4 lg:h-5 lg:w-5 text-primary" /> Próxima cita
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-semibold text-sm lg:text-base capitalize">{formatDate(UPCOMING[0].date)}</p>
                  <p className="text-sm text-muted-foreground">{UPCOMING[0].start} - {UPCOMING[0].end} hs</p>
                </div>
                {statusBadge(UPCOMING[0].status)}
              </div>
              <Separator />
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <MapPin className="h-4 w-4 shrink-0" />
                <span>{UPCOMING[0].location || "Presencial"}</span>
              </div>
              <div className="flex items-center gap-2 text-sm text-primary">
                <CheckCircle2 className="h-4 w-4 shrink-0" />
                <span>{UPCOMING[0].service}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="hover:shadow-md transition-all">
          <CardHeader className="pb-2 lg:pb-3">
            <CardTitle className="text-base lg:text-lg flex items-center gap-2">
              <Heart className="h-4 w-4 lg:h-5 lg:w-5 text-primary" /> Notas de tu profesional
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="rounded-xl bg-muted/50 p-4 lg:p-5">
              <p className="text-sm lg:text-base text-muted-foreground leading-relaxed whitespace-pre-wrap italic">
                "{demoPatient.private_notes}"
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Pending payment */}
      {pendingCount > 0 && (
        <Card className="border-destructive/30 bg-destructive/5 hover:shadow-md transition-all">
          <CardContent className="p-4 lg:p-5 flex items-center justify-between">
            <div className="flex items-center gap-3 lg:gap-4">
              <div className="h-10 w-10 lg:h-12 lg:w-12 rounded-full bg-destructive/10 flex items-center justify-center shrink-0">
                <Clock className="h-5 w-5 lg:h-6 lg:w-6 text-destructive" />
              </div>
              <div>
                <p className="font-semibold text-sm lg:text-base">Tenés {pendingCount} pago{pendingCount > 1 ? "s" : ""} pendiente{pendingCount > 1 ? "s" : ""}</p>
                <p className="text-xs lg:text-sm text-muted-foreground">{formatCurrency(1800, "UYU")} — Vence {formatShort(PAYMENTS[0].due_date)}</p>
              </div>
            </div>
            <Button variant="outline" size="sm" className="hidden sm:flex gap-2" onClick={() => setTab("pagos")}>
              Ver pagos <ChevronRight className="h-4 w-4" />
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Install CTA */}
      <Card className="border-primary/20 bg-primary/5 hover:shadow-md transition-all">
        <CardContent className="p-4 lg:p-5 flex items-center justify-between">
          <div className="flex items-center gap-3 lg:gap-4">
            <div className="h-10 w-10 lg:h-12 lg:w-12 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
              <Smartphone className="h-5 w-5 lg:h-6 lg:w-6 text-primary" />
            </div>
            <div>
              <p className="font-semibold text-sm lg:text-base">Instalá la aplicación en tu dispositivo</p>
              <p className="text-xs lg:text-sm text-muted-foreground">Accedé rápido desde tu celular, tablet o escritorio</p>
            </div>
          </div>
          <Button size="sm" className="gap-2" onClick={() => setShowInstallPanel(true)}>
            <Download className="h-4 w-4" /> Instalar
          </Button>
        </CardContent>
      </Card>
    </div>
  );

  const CitasTab = () => (
    <div className="space-y-4 lg:space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg lg:text-xl font-bold flex items-center gap-2">
          <Calendar className="h-5 w-5 text-primary" /> Próximas citas
        </h2>
        <Badge variant="secondary" className="text-xs">{UPCOMING.length} programadas</Badge>
      </div>

      {UPCOMING.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Calendar className="h-12 w-12 text-muted-foreground/40 mx-auto mb-3" />
            <p className="text-muted-foreground font-medium">No tenés citas próximas</p>
            <p className="text-xs text-muted-foreground mt-1">Tu profesional agendará tu próxima sesión.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {UPCOMING.map(apt => (
            <Card key={apt.id} className="hover:shadow-md transition-all overflow-hidden group">
              <div className="h-1 bg-primary group-hover:h-1.5 transition-all" />
              <CardContent className="p-4 lg:p-6 space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold text-sm lg:text-base capitalize">{formatDate(apt.date)}</p>
                    <p className="text-sm text-muted-foreground mt-0.5">{apt.start} - {apt.end} hs</p>
                  </div>
                  {statusBadge(apt.status)}
                </div>
                <Separator />
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    {apt.modality === "online" ? <Video className="h-4 w-4 text-primary shrink-0" /> : <MapPin className="h-4 w-4 shrink-0" />}
                    <span>{apt.modality === "online" ? "Sesión online" : apt.location || "Presencial"}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-primary">
                    <CheckCircle2 className="h-4 w-4 shrink-0" />
                    <span>{apt.service}</span>
                  </div>
                </div>
                {apt.notes && (
                  <div className="rounded-xl bg-muted/50 p-3 text-xs text-muted-foreground flex items-start gap-2">
                    <span className="shrink-0">💡</span>
                    <span>{apt.notes}</span>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );

  const HistorialTab = () => (
    <div className="space-y-4 lg:space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg lg:text-xl font-bold flex items-center gap-2">
          <FileText className="h-5 w-5 text-primary" /> Historial de sesiones
        </h2>
        <Badge variant="secondary" className="text-xs">{PAST.length} sesiones</Badge>
      </div>

      {/* Timeline style */}
      <div className="relative space-y-0">
        {PAST.map((apt, idx) => (
          <div key={apt.id} className="relative flex gap-4 lg:gap-6">
            {/* Timeline line */}
            <div className="flex flex-col items-center">
              <div className={`h-3 w-3 rounded-full shrink-0 mt-5 ${apt.status === "completed" ? "bg-primary" : apt.status === "no_show" ? "bg-destructive" : "bg-muted-foreground"}`} />
              {idx < PAST.length - 1 && <div className="w-px flex-1 bg-border min-h-[2rem]" />}
            </div>

            <Card className={`flex-1 mb-3 hover:shadow-md transition-all ${apt.status === "no_show" ? "opacity-60" : ""}`}>
              <CardContent className="p-4 lg:p-5">
                <div className="flex flex-col sm:flex-row sm:items-start gap-2 sm:gap-4">
                  <div className="sm:w-40 shrink-0">
                    <p className="font-semibold text-sm">{formatShort(apt.date)}</p>
                    <p className="text-xs text-muted-foreground">{apt.start} - {apt.end} hs</p>
                    <div className="flex items-center gap-2 mt-1.5">
                      {statusBadge(apt.status)}
                      <Badge variant="outline" className="text-[10px] gap-1">
                        {apt.modality === "online" ? <><Video className="h-2.5 w-2.5" /> Online</> : <><MapPin className="h-2.5 w-2.5" /> Presencial</>}
                      </Badge>
                    </div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-primary font-medium mb-1.5">{apt.service}</p>
                    {apt.notes ? (
                      <div className="rounded-xl bg-muted/40 p-3">
                        <p className="text-xs lg:text-sm text-foreground leading-relaxed whitespace-pre-wrap">{apt.notes}</p>
                      </div>
                    ) : (
                      <p className="text-xs text-muted-foreground italic">Sin notas para esta sesión</p>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        ))}
      </div>
    </div>
  );

  const PagosTab = () => (
    <div className="space-y-4 lg:space-y-6">
      {/* Summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 lg:gap-4">
        <Card className="border-primary/20">
          <CardContent className="p-4 text-center">
            <p className="text-2xl lg:text-3xl font-bold text-primary">{formatCurrency(totalPaid, "UYU")}</p>
            <p className="text-xs text-muted-foreground mt-1">Total pagado</p>
          </CardContent>
        </Card>
        <Card className={pendingCount > 0 ? "border-destructive/30" : ""}>
          <CardContent className="p-4 text-center">
            <p className={`text-2xl lg:text-3xl font-bold ${pendingCount > 0 ? "text-destructive" : "text-foreground"}`}>{pendingCount}</p>
            <p className="text-xs text-muted-foreground mt-1">Pendiente{pendingCount !== 1 ? "s" : ""}</p>
          </CardContent>
        </Card>
        <Card className="hidden lg:block">
          <CardContent className="p-4 text-center">
            <p className="text-2xl lg:text-3xl font-bold text-foreground">{PAYMENTS.length}</p>
            <p className="text-xs text-muted-foreground mt-1">Total registros</p>
          </CardContent>
        </Card>
      </div>

      {/* Desktop table */}
      <div className="hidden lg:block">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <CreditCard className="h-5 w-5 text-primary" /> Detalle de pagos
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="border rounded-xl overflow-hidden">
              <div className="grid grid-cols-5 gap-4 px-5 py-3 bg-muted/50 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                <span>Concepto</span><span>Monto</span><span>Vencimiento</span><span>Estado</span><span>Fecha de pago</span>
              </div>
              {PAYMENTS.map((p, i) => (
                <div key={p.id} className={`grid grid-cols-5 gap-4 px-5 py-4 items-center text-sm ${i !== PAYMENTS.length - 1 ? "border-b" : ""} hover:bg-muted/30 transition-colors`}>
                  <span className="font-medium">{p.notes || p.recurrence}</span>
                  <span className="font-semibold">{formatCurrency(p.amount, "UYU")}</span>
                  <span className="text-muted-foreground">{formatShort(p.due_date)}</span>
                  <span>{payBadge(p.status)}</span>
                  <span className="text-muted-foreground">{p.paid_at ? formatShort(p.paid_at) : "—"}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Mobile cards */}
      <div className="lg:hidden space-y-3">
        <h3 className="text-base font-bold flex items-center gap-2">
          <CreditCard className="h-4 w-4 text-primary" /> Detalle de pagos
        </h3>
        {PAYMENTS.map(p => (
          <Card key={p.id} className="hover:shadow-md transition-all overflow-hidden">
            <div className={`h-0.5 ${p.status === "paid" ? "bg-primary" : p.status === "pending" ? "bg-muted-foreground" : "bg-destructive"}`} />
            <CardContent className="p-4">
              <div className="flex items-start justify-between gap-2 mb-2">
                <div>
                  <p className="font-bold text-base">{formatCurrency(p.amount, "UYU")}</p>
                  <p className="text-xs font-medium text-foreground/80 mt-0.5">{p.notes || p.recurrence}</p>
                </div>
                {payBadge(p.status)}
              </div>
              <Separator className="my-2" />
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>Vence: {formatShort(p.due_date)}</span>
                {p.paid_at && <span className="text-primary">✓ Pagado: {formatShort(p.paid_at)}</span>}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );

  const PerfilTab = () => (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-6">
      <Card className="hover:shadow-md transition-all">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base lg:text-lg flex items-center gap-2">
              <User className="h-4 w-4 lg:h-5 lg:w-5 text-primary" /> Mi perfil
            </CardTitle>
            {!isEditingProfile ? (
              <Button variant="ghost" size="sm" className="gap-2 text-xs" onClick={startEditing}>
                <Edit2 className="h-3.5 w-3.5" /> Editar
              </Button>
            ) : (
              <div className="flex items-center gap-1">
                <Button variant="ghost" size="sm" className="gap-1 text-xs" onClick={cancelEditing}>
                  <X className="h-3.5 w-3.5" /> Cancelar
                </Button>
                <Button size="sm" className="gap-1 text-xs" onClick={saveProfile}>
                  <Save className="h-3.5 w-3.5" /> Guardar
                </Button>
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4 lg:space-y-5">
          {/* Avatar + name */}
          <div className="flex items-center gap-4 pb-4 border-b">
            <div className="relative group">
              <Avatar className="h-16 w-16 lg:h-20 lg:w-20 border-4 border-primary/20 shadow-md">
                {(isEditingProfile ? previewAvatar : demoPatient.avatar_url) ? (
                  <AvatarImage src={isEditingProfile ? previewAvatar : demoPatient.avatar_url} />
                ) : null}
                <AvatarFallback className="text-xl lg:text-2xl font-bold bg-primary/10 text-primary">{initials}</AvatarFallback>
              </Avatar>
              {isEditingProfile && (
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="absolute inset-0 flex items-center justify-center bg-foreground/40 rounded-full opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                >
                  <Camera className="h-5 w-5 text-primary-foreground" />
                </button>
              )}
              <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarChange} />
            </div>
            <div>
              <p className="font-bold text-base lg:text-lg">{demoPatient.full_name}</p>
              <p className="text-xs lg:text-sm text-muted-foreground">Paciente desde noviembre 2025</p>
            </div>
          </div>

          {/* Fields */}
          <div className="space-y-4">
            <div className="flex items-center gap-3 text-sm">
              <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center shrink-0">
                <Mail className="h-4 w-4 text-muted-foreground" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs text-muted-foreground">Email</p>
                <p className="font-medium truncate">{demoPatient.email}</p>
              </div>
            </div>

            <div className="flex items-center gap-3 text-sm">
              <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center shrink-0">
                <Phone className="h-4 w-4 text-muted-foreground" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs text-muted-foreground">WhatsApp</p>
                {isEditingProfile ? (
                  <Input
                    value={editForm.whatsapp_phone}
                    onChange={e => setEditForm(f => ({ ...f, whatsapp_phone: e.target.value }))}
                    className="h-8 mt-1 text-sm"
                    placeholder="+598 99 ..."
                  />
                ) : (
                  <p className="font-medium">{demoPatient.whatsapp_phone || "—"}</p>
                )}
              </div>
            </div>

            <Separator />

            <div>
              <p className="text-xs text-muted-foreground mb-2">Motivo de consulta <span className="text-muted-foreground/60">(opcional)</span></p>
              {isEditingProfile ? (
                <Textarea
                  value={editForm.reason_for_consultation}
                  onChange={e => setEditForm(f => ({ ...f, reason_for_consultation: e.target.value }))}
                  className="text-sm min-h-[80px]"
                  placeholder="Contale a tu profesional tu motivo de consulta..."
                />
              ) : (
                <div className="rounded-xl bg-muted/40 p-3 lg:p-4">
                  <p className="text-sm lg:text-base leading-relaxed">
                    {demoPatient.reason_for_consultation || <span className="text-muted-foreground italic">Sin especificar</span>}
                  </p>
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="hover:shadow-md transition-all">
        <CardHeader className="pb-3">
          <CardTitle className="text-base lg:text-lg flex items-center gap-2">
            <Building2 className="h-4 w-4 lg:h-5 lg:w-5 text-primary" /> Mi consultorio
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 lg:space-y-5">
          <div className="flex items-center gap-4 pb-4 border-b">
            {branding.logoUrl ? (
              <img src={branding.logoUrl} className="h-16 w-16 lg:h-20 lg:w-20 rounded-xl object-cover shadow-md" alt="" />
            ) : (
              <div className="h-16 w-16 lg:h-20 lg:w-20 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                <Building2 className="h-8 w-8 lg:h-10 lg:w-10 text-primary" />
              </div>
            )}
            <div>
              <p className="font-bold text-base lg:text-lg">{branding.name}</p>
              <p className="text-sm text-muted-foreground capitalize">{branding.specialty}</p>
            </div>
          </div>
          <div className="flex items-center gap-3 text-sm">
            <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center shrink-0">
              <Mail className="h-4 w-4 text-muted-foreground" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Contacto</p>
              <p className="font-medium">{branding.contact_email}</p>
            </div>
          </div>
          <Separator />
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-xl bg-muted/40 p-4 text-center">
              <p className="text-xl font-bold text-primary">{totalSessions}</p>
              <p className="text-xs text-muted-foreground mt-1">Sesiones</p>
            </div>
            <div className="rounded-xl bg-muted/40 p-4 text-center">
              <p className="text-xl font-bold">{UPCOMING.length + PAST.length}</p>
              <p className="text-xs text-muted-foreground mt-1">Total citas</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );

  const tabContent: Record<string, JSX.Element> = {
    resumen: <ResumenTab />,
    citas: <CitasTab />,
    historial: <HistorialTab />,
    pagos: <PagosTab />,
    perfil: <PerfilTab />,
  };

  return (
    <div className="min-h-screen" style={themeStyle as any}>
      <div className="min-h-screen bg-background text-foreground transition-colors duration-300">
        {/* Demo Banner */}
        <div className="bg-primary text-primary-foreground text-center py-2 px-4 text-sm font-medium">
          <Star className="inline h-4 w-4 mr-1 -mt-0.5" />
          Demo — Así ve un paciente su portal personal
        </div>

        {/* Header */}
        <header className="border-b border-border bg-card sticky top-0 z-10">
          <div className="px-4 lg:px-8 py-3 lg:py-4 flex items-center justify-between">
            <div className="flex items-center gap-3 lg:gap-4">
              {branding.logoUrl ? (
                <img src={branding.logoUrl} className="h-9 w-9 lg:h-10 lg:w-10 rounded-lg object-cover" alt="" />
              ) : (
                <Avatar className="h-9 w-9 lg:h-10 lg:w-10">
                  <AvatarFallback className="bg-primary/10 text-primary font-bold">
                    {branding.name.substring(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
              )}
              <div>
                <h1 className="text-lg lg:text-xl font-bold text-foreground">{branding.name}</h1>
                <p className="text-xs lg:text-sm text-muted-foreground">{branding.specialty}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setIsDark(!isDark)}
                className="h-9 w-9 rounded-full"
                title={isDark ? "Cambiar a modo claro" : "Cambiar a modo oscuro"}
              >
                {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setShowInstallPanel(!showInstallPanel)}
                className="h-9 w-9 rounded-full"
                title="Compartir / Instalar"
              >
                <Share2 className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="sm" onClick={() => navigate("/dashboard")} className="gap-2">
                <ArrowLeft className="h-4 w-4" />
                <span className="hidden sm:inline">Volver</span>
              </Button>
            </div>
          </div>
        </header>

        {/* Install/Share Panel */}
        {showInstallPanel && (
          <div className="border-b border-border bg-card px-4 lg:px-8 py-4 animate-fade-in">
            <div className="max-w-2xl mx-auto">
              <div className="flex items-center gap-3 mb-3">
                <Smartphone className="h-5 w-5 text-primary" />
                <h3 className="font-semibold text-foreground">Instalá la aplicación de {branding.name}</h3>
              </div>
              <p className="text-sm text-muted-foreground mb-4">
                Compartí este link con tus pacientes. Al abrirlo, podrán instalar la aplicación en su celular, tablet o escritorio con el logo y nombre de tu consultorio.
              </p>
              <div className="flex items-center gap-2">
                <div className="flex-1 bg-muted rounded-lg px-3 py-2 text-sm text-foreground font-mono truncate border border-border">
                  {portalUrl}
                </div>
                <Button size="sm" variant="outline" className="gap-2 shrink-0" onClick={handleCopyLink}>
                  <Copy className="h-4 w-4" /> Copiar
                </Button>
                <Button size="sm" className="gap-2 shrink-0" onClick={() => {
                  if (navigator.share) {
                    navigator.share({ title: branding.name, text: `Accedé a tu portal de ${branding.name}`, url: portalUrl });
                  } else {
                    handleCopyLink();
                  }
                }}>
                  <ExternalLink className="h-4 w-4" /> Compartir
                </Button>
              </div>
              <div className="mt-3 p-3 rounded-xl bg-primary/5 border border-primary/10">
                <p className="text-xs text-muted-foreground">
                  <strong className="text-foreground">💡 Tip:</strong> En iPhone: "Compartir → Agregar a inicio". En Android: menú "⋮ → Instalar app". En escritorio: buscar el ícono de instalación en la barra de navegación del navegador.
                </p>
              </div>
            </div>
          </div>
        )}

        <div className="lg:flex lg:gap-0 min-h-[calc(100vh-6rem)]">
          {/* Desktop Sidebar */}
          <aside className="hidden lg:flex lg:flex-col w-72 shrink-0 border-r border-border bg-card/80 backdrop-blur-sm sticky top-16 self-start h-[calc(100vh-4rem)]">
            <nav className="p-4 space-y-1">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider px-3 mb-3">Navegación</p>
              {TABS.map(t => {
                const Icon = t.icon;
                const isActive = tab === t.id;
                return (
                  <button
                    key={t.id}
                    onClick={() => setTab(t.id)}
                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all ${
                      isActive 
                        ? "bg-primary/10 text-primary shadow-sm" 
                        : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
                    }`}
                  >
                    <Icon className={`h-5 w-5 ${isActive ? "text-primary" : ""}`} />
                    {t.label}
                    {t.id === "pagos" && pendingCount > 0 && (
                      <span className="ml-auto bg-destructive text-destructive-foreground text-xs rounded-full h-5 w-5 flex items-center justify-center">
                        {pendingCount}
                      </span>
                    )}
                  </button>
                );
              })}
            </nav>

            <div className="mt-auto p-4 border-t border-border">
              <div className="flex items-center gap-3">
                <Avatar className="h-10 w-10">
                  {demoPatient.avatar_url ? <AvatarImage src={demoPatient.avatar_url} /> : null}
                  <AvatarFallback className="bg-primary/10 text-primary font-bold text-sm">{initials}</AvatarFallback>
                </Avatar>
                <div className="min-w-0">
                  <p className="font-medium text-sm truncate text-foreground">{demoPatient.full_name}</p>
                  <p className="text-xs text-muted-foreground truncate">{demoPatient.email}</p>
                </div>
              </div>
            </div>
          </aside>

          {/* Mobile Bottom Nav Bar */}
          <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-50 border-t border-border bg-card/95 backdrop-blur-xl safe-area-bottom">
            <div className="flex justify-around items-end px-1 pt-1.5 pb-2">
              {TABS.map(t => {
                const Icon = t.icon;
                const isActive = tab === t.id;
                return (
                  <button
                    key={t.id}
                    onClick={() => setTab(t.id)}
                    className={`relative flex flex-col items-center gap-0.5 px-3 py-1 text-[10px] font-medium transition-all ${
                      isActive ? "text-primary scale-105" : "text-muted-foreground"
                    }`}
                  >
                    <div className={`p-1.5 rounded-xl transition-colors ${isActive ? "bg-primary/12" : ""}`}>
                      <Icon className={`h-5 w-5 ${isActive ? "text-primary" : ""}`} />
                    </div>
                    <span>{t.label}</span>
                    {t.id === "pagos" && pendingCount > 0 && (
                      <span className="absolute top-0 right-0 bg-destructive text-destructive-foreground text-[9px] rounded-full h-4 w-4 flex items-center justify-center font-bold">
                        {pendingCount}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </nav>

          {/* Main Content */}
          <main className="flex-1 min-w-0 px-4 lg:px-10 xl:px-16 py-4 lg:py-8 pb-24 lg:pb-8 max-w-[1200px]">
            {/* Mobile welcome */}
            <div className="lg:hidden flex items-center gap-3 mb-4">
              <Avatar className="h-10 w-10">
                {demoPatient.avatar_url ? <AvatarImage src={demoPatient.avatar_url} /> : null}
                <AvatarFallback className="bg-primary/10 text-primary font-bold text-sm">{initials}</AvatarFallback>
              </Avatar>
              <div>
                <p className="font-semibold text-sm text-foreground">Hola, {demoPatient.full_name.split(" ")[0]} 👋</p>
                <p className="text-xs text-muted-foreground">{branding.name}</p>
              </div>
            </div>

            {tabContent[tab]}
          </main>
        </div>
      </div>
    </div>
  );
};

export default PatientPortalDemo;
