import { useState, useEffect, useMemo, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { usePWAInstall } from "@/hooks/use-pwa-install";
import { PortalWelcomeInstall } from "@/components/portal/PortalWelcomeInstall";
import {
  User, Calendar, CreditCard, Clock, MapPin, Video,
  Phone, Mail, Building2, FileText, LayoutDashboard,
  Heart, TrendingUp, CalendarCheck, ChevronRight,
  CheckCircle2, AlertCircle, Sun, Moon, Download,
  Smartphone, LogOut, Eye, EyeOff, Loader2
} from "lucide-react";
import { formatCurrency } from "@/lib/payments";

// ---- Theme generator ----
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
    vars["--secondary-foreground"] = "220 10% 95%";
    vars["--muted"] = "220 10% 15%";
    vars["--muted-foreground"] = "220 8% 55%";
    vars["--accent"] = "220 12% 18%";
    vars["--accent-foreground"] = "220 10% 95%";
    vars["--destructive"] = "0 84% 60%";
    vars["--destructive-foreground"] = "0 0% 100%";
    vars["--border"] = "220 10% 18%";
    vars["--input"] = "220 10% 18%";
    vars["--ring"] = primaryColor;
  } else {
    vars["--background"] = "0 0% 100%";
    vars["--foreground"] = "220 15% 10%";
    vars["--card"] = "0 0% 100%";
    vars["--card-foreground"] = "220 15% 10%";
    vars["--popover"] = "0 0% 100%";
    vars["--popover-foreground"] = "220 15% 10%";
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

interface ClinicBranding {
  id: string;
  name: string;
  displayName: string;
  specialty: string;
  contactEmail: string;
  logoUrl: string;
  lightColor: string;
  darkColor: string;
  slug: string;
}

interface PatientData {
  id: string;
  full_name: string;
  email: string | null;
  whatsapp_phone: string | null;
  avatar_url: string | null;
  reason_for_consultation: string | null;
  created_at: string;
}

const TABS = [
  { id: "resumen", label: "Resumen", icon: LayoutDashboard },
  { id: "citas", label: "Citas", icon: Calendar },
  { id: "historial", label: "Historial", icon: FileText },
  { id: "pagos", label: "Pagos", icon: CreditCard },
  { id: "perfil", label: "Perfil", icon: User },
] as const;

// =============================================
// BRANDED LOGIN COMPONENT
// =============================================
const BrandedLogin = ({
  branding,
  isDark,
  setIsDark,
  themeStyle,
  onLoginSuccess,
}: {
  branding: ClinicBranding;
  isDark: boolean;
  setIsDark: (v: boolean) => void;
  themeStyle: Record<string, string>;
  onLoginSuccess: () => void;
}) => {
  const { toast } = useToast();
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (isLogin) {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        onLoginSuccess();
      } else {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: { name },
            emailRedirectTo: `${window.location.origin}/portal/${branding.slug}`,
          },
        });
        if (error) throw error;
        toast({
          title: "Cuenta creada",
          description: "Revisá tu email para verificar tu cuenta.",
        });
      }
    } catch (err: any) {
      toast({
        title: "Error",
        description: err.message || "Ocurrió un error",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen" style={themeStyle as any}>
      <div className="min-h-screen bg-background text-foreground flex flex-col items-center justify-center p-4 transition-colors duration-300">
        {/* Theme toggle */}
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setIsDark(!isDark)}
          className="absolute top-4 right-4 h-9 w-9 rounded-full"
        >
          {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
        </Button>

        <div className="w-full max-w-sm space-y-8">
          {/* Logo & branding */}
          <div className="text-center space-y-4">
            {branding.logoUrl ? (
              <img
                src={branding.logoUrl}
                alt={branding.displayName}
                className="h-20 w-20 rounded-2xl object-cover mx-auto shadow-lg"
              />
            ) : (
              <div className="h-20 w-20 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto shadow-lg">
                <Building2 className="h-10 w-10 text-primary" />
              </div>
            )}
            <div>
              <h1 className="text-2xl font-bold text-foreground">{branding.displayName}</h1>
              {branding.specialty && (
                <p className="text-sm text-muted-foreground mt-1">{branding.specialty}</p>
              )}
            </div>
          </div>

          {/* Login/Register Card */}
          <Card className="border-border/60 shadow-xl">
            <CardHeader className="pb-4">
              <CardTitle className="text-lg text-center">
                {isLogin ? "Iniciar sesión" : "Crear cuenta"}
              </CardTitle>
              <p className="text-sm text-muted-foreground text-center">
                {isLogin
                  ? "Ingresá con tu cuenta de paciente"
                  : "Registrate para acceder a tu portal"}
              </p>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                {!isLogin && (
                  <div className="space-y-2">
                    <Label htmlFor="name">Nombre completo</Label>
                    <Input
                      id="name"
                      type="text"
                      placeholder="Tu nombre"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      required={!isLogin}
                    />
                  </div>
                )}
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="tu@email.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password">Contraseña</Label>
                  <div className="relative">
                    <Input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      minLength={6}
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7"
                      onClick={() => setShowPassword(!showPassword)}
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </Button>
                  </div>
                </div>
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  {isLogin ? "Ingresar" : "Crear cuenta"}
                </Button>
              </form>
              <Separator className="my-4" />
              <p className="text-sm text-center text-muted-foreground">
                {isLogin ? "¿No tenés cuenta?" : "¿Ya tenés cuenta?"}{" "}
                <button
                  onClick={() => setIsLogin(!isLogin)}
                  className="text-primary font-medium hover:underline"
                >
                  {isLogin ? "Registrate" : "Iniciá sesión"}
                </button>
              </p>
            </CardContent>
          </Card>

          {/* Install CTA */}
          <div className="text-center">
            <p className="text-xs text-muted-foreground">
              Powered by Tu Consultorio Digital
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

// =============================================
// MAIN PORTAL PAGE
// =============================================
const ClinicPortal = () => {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { canInstall, install, isInstalled } = usePWAInstall();

  const [loading, setLoading] = useState(true);
  const [branding, setBranding] = useState<ClinicBranding | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [session, setSession] = useState<any>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [patient, setPatient] = useState<PatientData | null>(null);
  const [patientLoading, setPatientLoading] = useState(false);
  const [patientChecked, setPatientChecked] = useState(false);
  const [tab, setTab] = useState("resumen");
  const [isDark, setIsDark] = useState(false);
  const [welcomeSeen, setWelcomeSeen] = useState<boolean>(true);

  // Cargar flag de "bienvenida vista" desde localStorage por slug.
  useEffect(() => {
    if (!slug) return;
    try {
      const key = `portal-welcome-seen:${slug}`;
      setWelcomeSeen(localStorage.getItem(key) === "1");
    } catch {
      setWelcomeSeen(true);
    }
  }, [slug]);

  const markWelcomeSeen = useCallback(() => {
    if (!slug) return;
    try {
      localStorage.setItem(`portal-welcome-seen:${slug}`, "1");
    } catch {
      /* ignore */
    }
    setWelcomeSeen(true);
  }, [slug]);

  // Appointments & payments from DB
  const [appointments, setAppointments] = useState<any[]>([]);
  const [payments, setPayments] = useState<any[]>([]);

  // Load branding
  useEffect(() => {
    if (!slug) return;
    const load = async () => {
      console.log("[ClinicPortal] Buscando portal con slug:", slug);
      const { data, error } = await supabase
        .from("businesses")
        .select("id, name, specialty, contact_email, portal_logo_url, portal_clinic_display_name, portal_primary_color, portal_dark_primary_color, public_slug, custom_subdomain")
        .or(`public_slug.eq.${slug},custom_subdomain.eq.${slug}`)
        .limit(1)
        .maybeSingle();

      if (error) {
        console.error("[ClinicPortal] Error consultando businesses:", error);
      }
      if (!data) {
        console.warn("[ClinicPortal] No se encontró ningún consultorio para el slug:", slug);
      } else {
        console.log("[ClinicPortal] Consultorio encontrado:", { id: data.id, public_slug: data.public_slug, custom_subdomain: (data as any).custom_subdomain });
      }

      if (error || !data) {
        setNotFound(true);
        setLoading(false);
        return;
      }

      setBranding({
        id: data.id,
        name: data.name,
        displayName: (data as any).portal_clinic_display_name || data.name,
        specialty: data.specialty || "",
        contactEmail: data.contact_email,
        logoUrl: (data as any).portal_logo_url || "",
        lightColor: (data as any).portal_primary_color || "176 100% 32%",
        darkColor: (data as any).portal_dark_primary_color || "176 85% 42%",
        slug: data.public_slug,
      });
      setLoading(false);
    };
    load();
  }, [slug]);

  // Inject dynamic manifest pointing to the get-clinic-manifest edge function.
  // Using a real HTTP URL (not blob:) is required so that Android/Chrome persists
  // the clinic name and icon when the PWA is installed from /portal/:slug.
  useEffect(() => {
    if (!slug) return;

    const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
    if (!projectId) return;

    const origin = window.location.origin;
    const manifestUrl = `https://${projectId}.supabase.co/functions/v1/get-clinic-manifest?slug=${encodeURIComponent(
      slug
    )}&origin=${encodeURIComponent(origin)}`;

    // Remove existing manifest links (including the static one from index.html)
    document.querySelectorAll('link[rel="manifest"]').forEach((el) => el.remove());

    const link = document.createElement("link");
    link.rel = "manifest";
    link.href = manifestUrl;
    // crossOrigin is required for manifests served from a different origin
    link.crossOrigin = "use-credentials";
    document.head.appendChild(link);

    // Also update apple-touch-icon dynamically so iOS uses the clinic logo
    let appleIcon = document.querySelector<HTMLLinkElement>('link[rel="apple-touch-icon"]');
    const previousAppleHref = appleIcon?.href;
    if (branding?.logoUrl) {
      if (!appleIcon) {
        appleIcon = document.createElement("link");
        appleIcon.rel = "apple-touch-icon";
        document.head.appendChild(appleIcon);
      }
      appleIcon.href = branding.logoUrl;
    }

    return () => {
      link.remove();
      // Restore previous apple-touch-icon to avoid leaking branding across routes
      if (appleIcon && previousAppleHref) {
        appleIcon.href = previousAppleHref;
      }
    };
  }, [slug, branding?.logoUrl]);

  // Auth listener
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, sess) => {
      setSession(sess);
      setAuthChecked(true);
    });
    supabase.auth.getSession().then(({ data: { session: sess } }) => {
      setSession(sess);
      setAuthChecked(true);
    });
    return () => subscription.unsubscribe();
  }, []);

  // Load patient data when session + branding available
  useEffect(() => {
    if (!authChecked) return;
    if (!session?.user?.id || !branding?.id) {
      // No session or branding yet → nothing to load, mark as checked only when
      // we know there's no session to query for.
      if (authChecked && !session?.user?.id) {
        setPatientChecked(true);
      }
      return;
    }

    const loadPatient = async () => {
      setPatientLoading(true);
      setPatientChecked(false);
      const { data } = await supabase
        .from("patients")
        .select("id, full_name, email, whatsapp_phone, avatar_url, reason_for_consultation, created_at")
        .eq("business_id", branding.id)
        .eq("auth_user_id", session.user.id)
        .eq("is_active", true)
        .limit(1)
        .maybeSingle();

      if (data) {
        setPatient(data);
        // Load appointments
        const { data: appts } = await supabase
          .from("appointments")
          .select("*")
          .eq("business_id", branding.id)
          .eq("patient_id", data.id)
          .order("start_at", { ascending: false });
        setAppointments(appts || []);

        // Load payments
        const { data: pays } = await supabase
          .from("payments")
          .select("*")
          .eq("business_id", branding.id)
          .eq("patient_id", data.id)
          .order("due_date", { ascending: false });
        setPayments(pays || []);
      }
      setPatientLoading(false);
      setPatientChecked(true);
    };
    loadPatient();
  }, [session?.user?.id, branding?.id, authChecked]);

  // Theme
  const themeVars = useMemo(() => {
    if (!branding) return {};
    const color = isDark ? branding.darkColor : branding.lightColor;
    return generateThemeVars(color, isDark);
  }, [isDark, branding]);

  const themeStyle = useMemo(() => {
    const style: Record<string, string> = {};
    Object.entries(themeVars).forEach(([key, value]) => {
      style[key] = value;
    });
    return style;
  }, [themeVars]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setSession(null);
    setPatient(null);
    setPatientChecked(false);
    setPatientLoading(false);
  };

  const handleInstall = async () => {
    if (canInstall) {
      await install();
    }
  };

  // Loading state
  if (loading || !authChecked) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // Not found
  if (notFound || !branding) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background text-foreground p-4">
        <Card className="max-w-sm w-full">
          <CardContent className="pt-8 pb-6 text-center space-y-3">
            <Building2 className="h-12 w-12 text-muted-foreground mx-auto" />
            <h2 className="text-xl font-bold">Este portal no está disponible</h2>
            <p className="text-sm text-muted-foreground">Verificá el link que te envió tu profesional. Si el problema persiste, contactá directamente al consultorio.</p>
            <Button variant="outline" onClick={() => navigate("/")}>Ir al inicio</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Not logged in → branded login
  if (!session) {
    // Pantalla de bienvenida + instalación PWA (solo la primera vez por slug).
    if (!welcomeSeen) {
      return (
        <PortalWelcomeInstall
          branding={{
            displayName: branding.displayName,
            specialty: branding.specialty,
            logoUrl: branding.logoUrl,
            slug: branding.slug,
          }}
          themeStyle={themeStyle}
          onContinue={markWelcomeSeen}
        />
      );
    }
    return (
      <BrandedLogin
        branding={branding}
        isDark={isDark}
        setIsDark={setIsDark}
        themeStyle={themeStyle}
        onLoginSuccess={() => {}}
      />
    );
  }

  // Logged in but patient data still loading → show spinner (avoid error flash)
  if (session && (!patientChecked || patientLoading)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // Logged in but no patient record → access denied
  if (!patient) {
    return (
      <div className="min-h-screen" style={themeStyle as any}>
        <div className="min-h-screen bg-background text-foreground flex items-center justify-center p-4">
          <Card className="max-w-sm w-full">
            <CardContent className="pt-8 pb-6 text-center space-y-3">
              <AlertCircle className="h-12 w-12 text-destructive mx-auto" />
              <h2 className="text-xl font-bold">Acceso no disponible</h2>
              <p className="text-sm text-muted-foreground">
                Tu cuenta no está vinculada como paciente de {branding.displayName}. Contactá al consultorio para que te agreguen.
              </p>
              <div className="flex gap-2 justify-center">
                <Button variant="outline" onClick={handleLogout}>
                  <LogOut className="h-4 w-4 mr-2" /> Cerrar sesión
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // ---- Helpers ----
  const initials = patient.full_name.split(" ").map(w => w[0]).join("").substring(0, 2).toUpperCase();
  const upcomingAppts = appointments.filter(a => new Date(a.start_at) >= new Date() && a.status !== "cancelled");
  const pastAppts = appointments.filter(a => new Date(a.start_at) < new Date() || a.status === "completed");
  const pendingPayments = payments.filter(p => p.status === "pending");

  const formatDate = (d: string) => new Date(d).toLocaleDateString("es-UY", { weekday: "long", day: "numeric", month: "long" });
  const formatShort = (d: string) => new Date(d).toLocaleDateString("es-UY", { day: "numeric", month: "long", year: "numeric" });
  const formatTime = (d: string) => new Date(d).toLocaleTimeString("es-UY", { hour: "2-digit", minute: "2-digit" });

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
    if (status === "paid") return <Badge className="bg-primary/90 text-primary-foreground">Pagado</Badge>;
    if (status === "overdue") return <Badge variant="destructive">Vencido</Badge>;
    return <Badge variant="secondary">Pendiente</Badge>;
  };

  // ---- Tab content ----
  const ResumenTab = () => (
    <div className="space-y-5">
      {/* Welcome - desktop */}
      <div className="hidden lg:block rounded-2xl border bg-gradient-to-br from-primary/5 via-card to-accent/5 p-8">
        <div className="flex items-center gap-6">
          <Avatar className="h-20 w-20 border-4 border-primary/20 shadow-lg">
            {patient.avatar_url && <AvatarImage src={patient.avatar_url} />}
            <AvatarFallback className="text-2xl font-bold bg-primary/10 text-primary">{initials}</AvatarFallback>
          </Avatar>
          <div>
            <h2 className="text-2xl font-bold">Hola, {patient.full_name.split(" ")[0]} 👋</h2>
            <p className="text-muted-foreground mt-1">Bienvenido/a a tu portal de {branding.displayName}.</p>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {[
          { icon: Calendar, value: upcomingAppts.length, label: "Próximas citas", accent: false },
          { icon: CalendarCheck, value: pastAppts.filter(a => a.status === "completed").length, label: "Sesiones realizadas", accent: false },
          { icon: AlertCircle, value: pendingPayments.length, label: "Pagos pendientes", accent: pendingPayments.length > 0 },
        ].map((stat, i) => (
          <Card key={i} className="hover:shadow-md transition-all border-border/60">
            <CardContent className="pt-4 pb-3 text-center">
              <div className={`inline-flex items-center justify-center h-10 w-10 rounded-full mb-2 ${stat.accent ? "bg-destructive/10" : "bg-primary/10"}`}>
                <stat.icon className={`h-5 w-5 ${stat.accent ? "text-destructive" : "text-primary"}`} />
              </div>
              <p className={`text-2xl font-bold ${stat.accent ? "text-destructive" : "text-primary"}`}>{stat.value}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{stat.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Next appointment */}
      {upcomingAppts.length > 0 && (
        <Card className="hover:shadow-md transition-all">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Calendar className="h-4 w-4 text-primary" /> Próxima cita
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-semibold text-sm capitalize">{formatDate(upcomingAppts[0].start_at)}</p>
                <p className="text-sm text-muted-foreground">{formatTime(upcomingAppts[0].start_at)} - {formatTime(upcomingAppts[0].end_at)}</p>
              </div>
              {statusBadge(upcomingAppts[0].status)}
            </div>
            {upcomingAppts[0].location && (
              <>
                <Separator className="my-3" />
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <MapPin className="h-4 w-4 shrink-0" />
                  <span>{upcomingAppts[0].location}</span>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      )}

      {/* Pending payment alert */}
      {pendingPayments.length > 0 && (
        <Card className="border-destructive/30 bg-destructive/5">
          <CardContent className="p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-destructive/10 flex items-center justify-center">
                <Clock className="h-5 w-5 text-destructive" />
              </div>
              <div>
                <p className="font-semibold text-sm">Tenés {pendingPayments.length} pago{pendingPayments.length > 1 ? "s" : ""} pendiente{pendingPayments.length > 1 ? "s" : ""}</p>
                <p className="text-xs text-muted-foreground">{formatCurrency(Number(pendingPayments[0].amount), "UYU")} — Vence {formatShort(pendingPayments[0].due_date)}</p>
              </div>
            </div>
            <Button variant="outline" size="sm" className="hidden sm:flex gap-2" onClick={() => setTab("pagos")}>
              Ver <ChevronRight className="h-4 w-4" />
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Install CTA */}
      {!isInstalled && (
        <Card className="border-primary/20 bg-primary/5">
          <CardContent className="p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                <Smartphone className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="font-semibold text-sm">Instalá la aplicación en tu dispositivo</p>
                <p className="text-xs text-muted-foreground">Accedé rápido desde tu celular, tablet o escritorio</p>
              </div>
            </div>
            {canInstall ? (
              <Button size="sm" className="gap-2" onClick={handleInstall}>
                <Download className="h-4 w-4" /> Instalar
              </Button>
            ) : (
              <p className="text-xs text-muted-foreground max-w-[140px] text-right">
                Usá "Agregar a inicio" desde el menú del navegador
              </p>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );

  const CitasTab = () => (
    <div className="space-y-4">
      <h2 className="text-lg font-bold flex items-center gap-2">
        <Calendar className="h-5 w-5 text-primary" /> Próximas citas
      </h2>
      {upcomingAppts.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Calendar className="h-12 w-12 text-muted-foreground/40 mx-auto mb-3" />
            <p className="text-muted-foreground font-medium">No tenés citas próximas</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {upcomingAppts.map(apt => (
            <Card key={apt.id} className="overflow-hidden group hover:shadow-md transition-all">
              <div className="h-1 bg-primary group-hover:h-1.5 transition-all" />
              <CardContent className="p-4 space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold text-sm capitalize">{formatDate(apt.start_at)}</p>
                    <p className="text-sm text-muted-foreground">{formatTime(apt.start_at)} - {formatTime(apt.end_at)}</p>
                  </div>
                  {statusBadge(apt.status)}
                </div>
                {apt.location && (
                  <>
                    <Separator />
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      {apt.modality === "online" ? <Video className="h-4 w-4 text-primary" /> : <MapPin className="h-4 w-4" />}
                      <span>{apt.modality === "online" ? "Sesión online" : apt.location}</span>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );

  const HistorialTab = () => (
    <div className="space-y-4">
      <h2 className="text-lg font-bold flex items-center gap-2">
        <FileText className="h-5 w-5 text-primary" /> Historial de sesiones
      </h2>
      {pastAppts.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <FileText className="h-12 w-12 text-muted-foreground/40 mx-auto mb-3" />
            <p className="text-muted-foreground font-medium">Aún no tenés sesiones anteriores</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {pastAppts.map(apt => (
            <Card key={apt.id} className="hover:shadow-sm transition-all">
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-medium text-sm capitalize">{formatDate(apt.start_at)}</p>
                    <p className="text-xs text-muted-foreground">{formatTime(apt.start_at)} - {formatTime(apt.end_at)}</p>
                  </div>
                  {statusBadge(apt.status)}
                </div>
                {apt.notes && (
                  <div className="mt-3 rounded-lg bg-muted/50 p-3 text-xs text-muted-foreground">
                    {apt.notes}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );

  const PagosTab = () => (
    <div className="space-y-4">
      <h2 className="text-lg font-bold flex items-center gap-2">
        <CreditCard className="h-5 w-5 text-primary" /> Pagos
      </h2>
      {/* List */}
      <div className="space-y-3">
        {payments.map(pay => (
          <Card key={pay.id} className="hover:shadow-sm transition-all overflow-hidden">
            <div className={`h-1 ${pay.status === "paid" ? "bg-primary" : "bg-destructive"}`} />
            <CardContent className="p-4 flex items-center justify-between">
              <div>
                <p className="font-semibold text-sm">{formatCurrency(Number(pay.amount), pay.currency || "UYU")}</p>
                <p className="text-xs text-muted-foreground">
                  {pay.notes || (pay.status === "paid" ? `Pagado ${formatShort(pay.paid_at)}` : `Vence ${formatShort(pay.due_date)}`)}
                </p>
              </div>
              {payBadge(pay.status)}
            </CardContent>
          </Card>
        ))}
        {payments.length === 0 && (
          <Card>
            <CardContent className="py-12 text-center">
              <CreditCard className="h-12 w-12 text-muted-foreground/40 mx-auto mb-3" />
              <p className="text-muted-foreground font-medium">No hay pagos registrados</p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );

  const PerfilTab = () => (
    <div className="space-y-4">
      <h2 className="text-lg font-bold flex items-center gap-2">
        <User className="h-5 w-5 text-primary" /> Mi perfil
      </h2>
      <Card>
        <CardContent className="pt-6 space-y-4">
          <div className="flex items-center gap-4">
            <Avatar className="h-16 w-16">
              {patient.avatar_url && <AvatarImage src={patient.avatar_url} />}
              <AvatarFallback className="bg-primary/10 text-primary font-bold text-lg">{initials}</AvatarFallback>
            </Avatar>
            <div>
              <p className="font-bold text-lg">{patient.full_name}</p>
              <p className="text-sm text-muted-foreground">Paciente desde {formatShort(patient.created_at)}</p>
            </div>
          </div>
          <Separator />
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <Mail className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm">{patient.email || "Sin email"}</span>
            </div>
            <div className="flex items-center gap-3">
              <Phone className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm">{patient.whatsapp_phone || "Sin WhatsApp"}</span>
            </div>
            {patient.reason_for_consultation && (
              <div className="flex items-start gap-3">
                <Heart className="h-4 w-4 text-muted-foreground mt-0.5" />
                <span className="text-sm">{patient.reason_for_consultation}</span>
              </div>
            )}
          </div>
          <Separator />
          <Button variant="outline" className="w-full gap-2" onClick={handleLogout}>
            <LogOut className="h-4 w-4" /> Cerrar sesión
          </Button>
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

  // ---- RENDER PORTAL ----
  return (
    <div className="min-h-screen" style={themeStyle as any}>
      <div className="min-h-screen bg-background text-foreground transition-colors duration-300">
        {/* Header */}
        <header className="border-b border-border bg-card sticky top-0 z-10">
          <div className="px-4 lg:px-8 py-3 lg:py-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              {branding.logoUrl ? (
                <img src={branding.logoUrl} className="h-9 w-9 rounded-lg object-cover" alt="" />
              ) : (
                <Avatar className="h-9 w-9">
                  <AvatarFallback className="bg-primary/10 text-primary font-bold">
                    {branding.displayName.substring(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
              )}
              <div>
                <h1 className="text-lg font-bold text-foreground">{branding.displayName}</h1>
                <p className="text-xs text-muted-foreground">{branding.specialty}</p>
              </div>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setIsDark(!isDark)}
              className="h-9 w-9 rounded-full"
            >
              {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </Button>
          </div>
        </header>

        <div className="lg:flex lg:gap-0 min-h-[calc(100vh-4rem)]">
          {/* Desktop Sidebar */}
          <aside className="hidden lg:flex lg:flex-col w-64 shrink-0 border-r border-border bg-card/80 sticky top-16 self-start h-[calc(100vh-4rem)]">
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
                      isActive ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
                    }`}
                  >
                    <Icon className={`h-5 w-5 ${isActive ? "text-primary" : ""}`} />
                    {t.label}
                    {t.id === "pagos" && pendingPayments.length > 0 && (
                      <span className="ml-auto bg-destructive text-destructive-foreground text-xs rounded-full h-5 w-5 flex items-center justify-center">
                        {pendingPayments.length}
                      </span>
                    )}
                  </button>
                );
              })}
            </nav>
            <div className="mt-auto p-4 border-t border-border">
              <div className="flex items-center gap-3">
                <Avatar className="h-10 w-10">
                  {patient.avatar_url && <AvatarImage src={patient.avatar_url} />}
                  <AvatarFallback className="bg-primary/10 text-primary font-bold text-sm">{initials}</AvatarFallback>
                </Avatar>
                <div className="min-w-0">
                  <p className="font-medium text-sm truncate">{patient.full_name}</p>
                  <p className="text-xs text-muted-foreground truncate">{patient.email}</p>
                </div>
              </div>
            </div>
          </aside>

          {/* Mobile Bottom Nav */}
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
                    {t.id === "pagos" && pendingPayments.length > 0 && (
                      <span className="absolute top-0 right-0 bg-destructive text-destructive-foreground text-[9px] rounded-full h-4 w-4 flex items-center justify-center font-bold">
                        {pendingPayments.length}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </nav>

          {/* Main */}
          <main className="flex-1 min-w-0 px-4 lg:px-10 py-4 lg:py-8 pb-24 lg:pb-8 max-w-[1000px]">
            {/* Mobile welcome */}
            <div className="lg:hidden flex items-center gap-3 mb-4">
              <Avatar className="h-10 w-10">
                {patient.avatar_url && <AvatarImage src={patient.avatar_url} />}
                <AvatarFallback className="bg-primary/10 text-primary font-bold text-sm">{initials}</AvatarFallback>
              </Avatar>
              <div>
                <p className="font-semibold text-sm">Hola, {patient.full_name.split(" ")[0]} 👋</p>
                <p className="text-xs text-muted-foreground">{branding.displayName}</p>
              </div>
            </div>
            {tabContent[tab]}
          </main>
        </div>
      </div>
    </div>
  );
};

export default ClinicPortal;
