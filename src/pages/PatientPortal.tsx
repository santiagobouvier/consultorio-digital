import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/hooks/use-toast";
import { PWAInstallBanner } from "@/components/PWAInstallBanner";
import { PatientBookingModal } from "@/components/PatientBookingModal";
import { NotificationActivationCard } from "@/components/NotificationActivationCard";
import { usePWAInstall } from "@/hooks/use-pwa-install";
import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import {
  User, Calendar, CreditCard, Clock, MapPin, Video,
  Phone, Mail, Building2, ArrowLeft, FileText,
  LayoutDashboard, Heart, TrendingUp, CalendarCheck,
  ChevronRight, CheckCircle2, AlertCircle, AlertTriangle, Sun, Moon,
  Download, Smartphone, Camera, Save, Edit2, X, LogOut, Plus,
} from "lucide-react";
import {
  calculatePaymentStatus,
  formatCurrency,
  getRecurrenceTypeLabel,
  RecurrenceType,
} from "@/lib/payments";

// ---- Types ----
interface PatientData {
  id: string;
  full_name: string;
  email: string | null;
  whatsapp_phone: string | null;
  reason_for_consultation: string | null;
  private_notes: string | null;
  avatar_url: string | null;
  created_at: string;
  business_id: string;
}

interface BusinessData {
  id: string;
  name: string;
  specialty: string | null;
  contact_email: string;
  portal_logo_url: string | null;
  portal_clinic_display_name: string | null;
  portal_primary_color: string | null;
  portal_dark_primary_color: string | null;
  public_slug: string | null;
}

interface Appointment {
  id: string;
  start_at: string;
  end_at: string;
  status: string;
  modality: string | null;
  location: string | null;
  notes: string | null;
  service?: { name: string } | null;
}

interface Payment {
  id: string;
  amount: number;
  currency: string;
  due_date: string;
  status: string;
  paid_at: string | null;
  recurrence_type: string;
  notes: string | null;
}

const TABS = [
  { id: "resumen", label: "Resumen", icon: LayoutDashboard },
  { id: "citas", label: "Citas", icon: Calendar },
  { id: "historial", label: "Historial", icon: FileText },
  { id: "pagos", label: "Pagos", icon: CreditCard },
  { id: "perfil", label: "Perfil", icon: User },
] as const;

// Theme generator (same as demo)
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

const formatDateLong = (d: Date) =>
  d.toLocaleDateString("es-UY", { weekday: "long", day: "numeric", month: "long" });
const formatShort = (d: Date) =>
  d.toLocaleDateString("es-UY", { day: "numeric", month: "long", year: "numeric" });

const PatientPortal = () => {
  const navigate = useNavigate();
  const { canInstall, install, isInstalled } = usePWAInstall();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [patient, setPatient] = useState<PatientData | null>(null);
  const [business, setBusiness] = useState<BusinessData | null>(null);
  const [upcomingAppointments, setUpcomingAppointments] = useState<Appointment[]>([]);
  const [pastAppointments, setPastAppointments] = useState<Appointment[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);

  const [tab, setTab] = useState<(typeof TABS)[number]["id"]>("resumen");
  const [isDark, setIsDark] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return localStorage.getItem("portal-theme") === "dark";
  });
  const [showBookingModal, setShowBookingModal] = useState(false);

  // Profile editing
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [editForm, setEditForm] = useState({
    full_name: "",
    email: "",
    whatsapp_phone: "",
    reason_for_consultation: "",
  });
  const [previewAvatar, setPreviewAvatar] = useState<string>("");
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [savingProfile, setSavingProfile] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { navigate("/auth"); return; }

      const { data: roleData } = await supabase
        .from("user_roles").select("role")
        .eq("user_id", user.id).eq("role", "patient").maybeSingle();

      if (!roleData) { navigate("/dashboard"); return; }

      const { data: patientData, error: patientError } = await supabase
        .from("patients").select("*")
        .eq("auth_user_id", user.id).maybeSingle();

      if (patientError) throw patientError;
      if (!patientData) {
        setError("No encontramos tu ficha de paciente. Contactá a tu profesional.");
        setLoading(false);
        return;
      }

      setPatient(patientData);

      // Business with branding
      const { data: businessData } = await supabase
        .from("businesses")
        .select("id, name, specialty, contact_email, portal_logo_url, portal_clinic_display_name, portal_primary_color, portal_dark_primary_color, public_slug")
        .eq("id", patientData.business_id)
        .maybeSingle();
      if (businessData) setBusiness(businessData as BusinessData);

      const now = new Date().toISOString();

      const { data: upcomingData } = await supabase
        .from("appointments")
        .select("id, start_at, end_at, status, modality, location, notes, services(name)")
        .eq("patient_id", patientData.id)
        .eq("business_id", patientData.business_id)
        .gte("start_at", now)
        .neq("status", "cancelled")
        .order("start_at", { ascending: true });
      setUpcomingAppointments((upcomingData || []).map((a: any) => ({ ...a, service: a.services })));

      const { data: pastData } = await supabase
        .from("appointments")
        .select("id, start_at, end_at, status, modality, location, notes, services(name)")
        .eq("patient_id", patientData.id)
        .eq("business_id", patientData.business_id)
        .lt("start_at", now)
        .order("start_at", { ascending: false })
        .limit(50);
      setPastAppointments((pastData || []).map((a: any) => ({ ...a, service: a.services })));

      const { data: paymentsData } = await supabase
        .from("payments")
        .select("id, amount, currency, due_date, status, paid_at, recurrence_type, notes")
        .eq("patient_id", patientData.id)
        .eq("business_id", patientData.business_id)
        .order("due_date", { ascending: false })
        .limit(50);

      if (paymentsData) {
        setPayments(paymentsData.map(p => ({
          ...p,
          status: calculatePaymentStatus({ due_date: p.due_date, paid_at: p.paid_at, status: p.status }),
        })));
      }
    } catch (err: any) {
      console.error("Error loading patient portal:", err);
      setError("Error al cargar los datos. Intentá nuevamente más tarde.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, [navigate]);

  // Persist theme preference
  useEffect(() => {
    localStorage.setItem("portal-theme", isDark ? "dark" : "light");
  }, [isDark]);

  // Branding & theme
  const branding = useMemo(() => ({
    name: business?.portal_clinic_display_name || business?.name || "Mi Consultorio",
    specialty: business?.specialty || "Salud",
    contact_email: business?.contact_email || "",
    logoUrl: business?.portal_logo_url || "",
    lightColor: business?.portal_primary_color || "176 100% 32%",
    darkColor: business?.portal_dark_primary_color || "176 85% 42%",
  }), [business]);

  const themeStyle = useMemo(() => {
    const color = isDark ? branding.darkColor : branding.lightColor;
    return generateThemeVars(color, isDark) as Record<string, string>;
  }, [isDark, branding.lightColor, branding.darkColor]);

  // Derived stats
  const totalSessions = pastAppointments.filter(a => a.status === "completed").length;
  const pendingPayments = payments.filter(p => p.status !== "paid" && p.status !== "cancelled");
  const overduePayments = pendingPayments.filter(p => p.status === "overdue");
  const pendingCount = pendingPayments.length;

  const initials = (patient?.full_name || "?")
    .split(" ").map(w => w[0]).join("").substring(0, 2).toUpperCase();

  const firstName = patient?.full_name?.split(" ")[0] || "";

  // Badges
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
    if (status === "due_soon") return <Badge className="bg-orange-500 text-white hover:bg-orange-500">Por vencer</Badge>;
    if (status === "cancelled") return <Badge variant="outline">Cancelado</Badge>;
    return <Badge variant="secondary">Pendiente</Badge>;
  };

  // Profile handlers
  const startEditing = () => {
    if (!patient) return;
    setEditForm({
      full_name: patient.full_name || "",
      email: patient.email || "",
      whatsapp_phone: patient.whatsapp_phone || "",
      reason_for_consultation: patient.reason_for_consultation || "",
    });
    setPreviewAvatar(patient.avatar_url || "");
    setAvatarFile(null);
    setIsEditingProfile(true);
  };

  const cancelEditing = () => {
    setIsEditingProfile(false);
    setPreviewAvatar("");
    setAvatarFile(null);
  };

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setAvatarFile(file);
    setPreviewAvatar(URL.createObjectURL(file));
  };

  const saveProfile = async () => {
    if (!patient) return;
    setSavingProfile(true);
    try {
      let avatar_url = patient.avatar_url;

      if (avatarFile) {
        const ext = avatarFile.name.split(".").pop();
        const path = `patient-avatars/${patient.id}-${Date.now()}.${ext}`;
        const { error: uploadError } = await supabase.storage
          .from("avatars").upload(path, avatarFile, { upsert: true });
        if (uploadError) throw uploadError;
        const { data: pub } = supabase.storage.from("avatars").getPublicUrl(path);
        avatar_url = pub.publicUrl;
      }

      const { error } = await supabase
        .from("patients")
        .update({
          full_name: editForm.full_name,
          email: editForm.email || null,
          whatsapp_phone: editForm.whatsapp_phone || null,
          reason_for_consultation: editForm.reason_for_consultation || null,
          avatar_url,
        })
        .eq("id", patient.id);

      if (error) throw error;
      setPatient({ ...patient, ...editForm, avatar_url });
      setIsEditingProfile(false);
      setAvatarFile(null);
      toast({ title: "Perfil actualizado", description: "Tus datos se guardaron correctamente." });
    } catch (err: any) {
      console.error(err);
      toast({ title: "Error", description: "No se pudo guardar. Intentá de nuevo.", variant: "destructive" });
    } finally {
      setSavingProfile(false);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/auth");
  };

  const handleInstallApp = async () => {
    if (canInstall) await install();
    else window.open(window.location.href, "_blank", "noopener,noreferrer");
  };

  // ========= Tabs =========
  const ResumenTab = () => (
    <div className="space-y-5 lg:space-y-6">
      {/* Welcome hero - desktop */}
      <div className="hidden lg:block rounded-2xl border bg-gradient-to-br from-primary/5 via-card to-accent/5 p-8">
        <div className="flex items-center gap-6">
          <Avatar className="h-20 w-20 border-4 border-primary/20 shadow-lg">
            {patient?.avatar_url ? <AvatarImage src={patient.avatar_url} /> : null}
            <AvatarFallback className="text-2xl font-bold bg-primary/10 text-primary">{initials}</AvatarFallback>
          </Avatar>
          <div>
            <h2 className="text-2xl font-bold text-foreground">Hola, {firstName} 👋</h2>
            <p className="text-muted-foreground mt-1">Acá podés ver tu resumen, próximas citas, pagos e historial.</p>
            <p className="text-xs text-muted-foreground mt-2">{branding.name} · {branding.specialty}</p>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 lg:gap-4">
        {[
          { icon: Calendar, value: upcomingAppointments.length, label: "Próximas citas", accent: false },
          { icon: CalendarCheck, value: totalSessions, label: "Sesiones realizadas", accent: false },
          { icon: AlertCircle, value: pendingCount, label: "Pagos pendientes", accent: pendingCount > 0 },
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

      {/* Push notifications activation */}
      <NotificationActivationCard variant="full" />

      {/* Two-column */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-6">
        <Card className="hover:shadow-md transition-all">
          <CardHeader className="pb-2 lg:pb-3">
            <CardTitle className="text-base lg:text-lg flex items-center gap-2">
              <Calendar className="h-4 w-4 lg:h-5 lg:w-5 text-primary" /> Próxima cita
            </CardTitle>
          </CardHeader>
          <CardContent>
            {upcomingAppointments.length === 0 ? (
              <div className="text-center py-6">
                <Calendar className="h-10 w-10 text-muted-foreground/40 mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">No tenés citas próximas</p>
                <Button variant="outline" size="sm" onClick={() => setShowBookingModal(true)} className="mt-3 gap-2">
                  <Plus className="h-4 w-4" /> Reservar ahora
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold text-sm lg:text-base capitalize">
                      {formatDateLong(parseISO(upcomingAppointments[0].start_at))}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {format(parseISO(upcomingAppointments[0].start_at), "HH:mm")} - {format(parseISO(upcomingAppointments[0].end_at), "HH:mm")} hs
                    </p>
                  </div>
                  {statusBadge(upcomingAppointments[0].status)}
                </div>
                <Separator />
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  {upcomingAppointments[0].modality === "online" || upcomingAppointments[0].modality === "virtual"
                    ? <Video className="h-4 w-4 text-primary shrink-0" />
                    : <MapPin className="h-4 w-4 shrink-0" />}
                  <span>
                    {upcomingAppointments[0].modality === "online" || upcomingAppointments[0].modality === "virtual"
                      ? "Sesión online"
                      : upcomingAppointments[0].location || "Presencial"}
                  </span>
                </div>
                {upcomingAppointments[0].service && (
                  <div className="flex items-center gap-2 text-sm text-primary">
                    <CheckCircle2 className="h-4 w-4 shrink-0" />
                    <span>{upcomingAppointments[0].service.name}</span>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="hover:shadow-md transition-all">
          <CardHeader className="pb-2 lg:pb-3">
            <CardTitle className="text-base lg:text-lg flex items-center gap-2">
              <Heart className="h-4 w-4 lg:h-5 lg:w-5 text-primary" /> Notas de tu profesional
            </CardTitle>
          </CardHeader>
          <CardContent>
            {patient?.private_notes ? (
              <div className="rounded-xl bg-muted/50 p-4 lg:p-5">
                <p className="text-sm lg:text-base text-muted-foreground leading-relaxed whitespace-pre-wrap italic">
                  "{patient.private_notes}"
                </p>
              </div>
            ) : (
              <div className="text-center py-6">
                <Heart className="h-10 w-10 text-muted-foreground/40 mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">Aún no hay notas para mostrar</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Reservar */}
      <Button onClick={() => setShowBookingModal(true)} className="w-full sm:w-auto gap-2">
        <Plus className="h-4 w-4" /> Reservar una cita
      </Button>

      {/* Pending payment */}
      {pendingCount > 0 && (
        <Card className="border-destructive/30 bg-destructive/5 hover:shadow-md transition-all">
          <CardContent className="p-4 lg:p-5 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 lg:gap-4">
              <div className="h-10 w-10 lg:h-12 lg:w-12 rounded-full bg-destructive/10 flex items-center justify-center shrink-0">
                <Clock className="h-5 w-5 lg:h-6 lg:w-6 text-destructive" />
              </div>
              <div>
                <p className="font-semibold text-sm lg:text-base">
                  Tenés {pendingCount} pago{pendingCount > 1 ? "s" : ""} pendiente{pendingCount > 1 ? "s" : ""}
                </p>
                {pendingPayments[0] && (
                  <p className="text-xs lg:text-sm text-muted-foreground">
                    {formatCurrency(pendingPayments[0].amount, pendingPayments[0].currency || "UYU")} — Vence {formatShort(parseISO(pendingPayments[0].due_date))}
                  </p>
                )}
              </div>
            </div>
            <Button variant="outline" size="sm" className="hidden sm:flex gap-2" onClick={() => setTab("pagos")}>
              Ver pagos <ChevronRight className="h-4 w-4" />
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Install CTA */}
      {!isInstalled && (
        <Card className="border-primary/20 bg-primary/5 hover:shadow-md transition-all">
          <CardContent className="p-4 lg:p-5 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 lg:gap-4">
              <div className="h-10 w-10 lg:h-12 lg:w-12 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                <Smartphone className="h-5 w-5 lg:h-6 lg:w-6 text-primary" />
              </div>
              <div>
                <p className="font-semibold text-sm lg:text-base">Instalá la aplicación en tu dispositivo</p>
                <p className="text-xs lg:text-sm text-muted-foreground">Accedé rápido desde tu celular, tablet o escritorio</p>
              </div>
            </div>
            <Button size="sm" className="gap-2" onClick={handleInstallApp}>
              <Download className="h-4 w-4" /> Instalar
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );

  const CitasTab = () => (
    <div className="space-y-4 lg:space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg lg:text-xl font-bold flex items-center gap-2">
          <Calendar className="h-5 w-5 text-primary" /> Próximas citas
        </h2>
        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="text-xs">{upcomingAppointments.length} programadas</Badge>
          <Button size="sm" onClick={() => setShowBookingModal(true)} className="gap-2">
            <Plus className="h-4 w-4" /> Reservar
          </Button>
        </div>
      </div>

      {upcomingAppointments.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Calendar className="h-12 w-12 text-muted-foreground/40 mx-auto mb-3" />
            <p className="text-muted-foreground font-medium">No tenés citas próximas</p>
            <p className="text-xs text-muted-foreground mt-1">Reservá una con tu profesional cuando quieras.</p>
            <Button variant="outline" size="sm" onClick={() => setShowBookingModal(true)} className="mt-4 gap-2">
              <Plus className="h-4 w-4" /> Reservar ahora
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {upcomingAppointments.map(apt => (
            <Card key={apt.id} className="hover:shadow-md transition-all overflow-hidden group">
              <div className="h-1 bg-primary group-hover:h-1.5 transition-all" />
              <CardContent className="p-4 lg:p-6 space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold text-sm lg:text-base capitalize">
                      {formatDateLong(parseISO(apt.start_at))}
                    </p>
                    <p className="text-sm text-muted-foreground mt-0.5">
                      {format(parseISO(apt.start_at), "HH:mm")} - {format(parseISO(apt.end_at), "HH:mm")} hs
                    </p>
                  </div>
                  {statusBadge(apt.status)}
                </div>
                <Separator />
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    {apt.modality === "online" || apt.modality === "virtual"
                      ? <Video className="h-4 w-4 text-primary shrink-0" />
                      : <MapPin className="h-4 w-4 shrink-0" />}
                    <span>
                      {apt.modality === "online" || apt.modality === "virtual"
                        ? "Sesión online"
                        : apt.location || "Presencial"}
                    </span>
                  </div>
                  {apt.service && (
                    <div className="flex items-center gap-2 text-sm text-primary">
                      <CheckCircle2 className="h-4 w-4 shrink-0" />
                      <span>{apt.service.name}</span>
                    </div>
                  )}
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
        <Badge variant="secondary" className="text-xs">{pastAppointments.length} sesiones</Badge>
      </div>

      {pastAppointments.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <FileText className="h-12 w-12 text-muted-foreground/40 mx-auto mb-3" />
            <p className="text-muted-foreground font-medium">Aún no tenés historial</p>
            <p className="text-xs text-muted-foreground mt-1">Tus sesiones realizadas aparecerán acá.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="relative space-y-0">
          {pastAppointments.map((apt, idx) => (
            <div key={apt.id} className="relative flex gap-4 lg:gap-6">
              <div className="flex flex-col items-center">
                <div className={`h-3 w-3 rounded-full shrink-0 mt-5 ${
                  apt.status === "completed" ? "bg-primary"
                  : apt.status === "no_show" ? "bg-destructive"
                  : "bg-muted-foreground"
                }`} />
                {idx < pastAppointments.length - 1 && <div className="w-px flex-1 bg-border min-h-[2rem]" />}
              </div>

              <Card className={`flex-1 mb-3 hover:shadow-md transition-all ${apt.status === "no_show" ? "opacity-60" : ""}`}>
                <CardContent className="p-4 lg:p-5">
                  <div className="flex flex-col sm:flex-row sm:items-start gap-2 sm:gap-4">
                    <div className="sm:w-40 shrink-0">
                      <p className="font-semibold text-sm">{formatShort(parseISO(apt.start_at))}</p>
                      <p className="text-xs text-muted-foreground">
                        {format(parseISO(apt.start_at), "HH:mm")} - {format(parseISO(apt.end_at), "HH:mm")} hs
                      </p>
                      <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                        {statusBadge(apt.status)}
                        {apt.modality && (
                          <Badge variant="outline" className="text-[10px] gap-1">
                            {apt.modality === "online" || apt.modality === "virtual"
                              ? <><Video className="h-2.5 w-2.5" /> Online</>
                              : <><MapPin className="h-2.5 w-2.5" /> Presencial</>}
                          </Badge>
                        )}
                      </div>
                    </div>
                    <div className="flex-1 min-w-0">
                      {apt.service && <p className="text-xs text-primary font-medium mb-1.5">{apt.service.name}</p>}
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
      )}
    </div>
  );

  const PagosTab = () => (
    <div className="space-y-4 lg:space-y-6">
      {payments.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <CreditCard className="h-12 w-12 text-muted-foreground/40 mx-auto mb-3" />
            <p className="text-muted-foreground font-medium">No hay pagos registrados</p>
            <p className="text-xs text-muted-foreground mt-1">Tu historial de pagos aparecerá acá.</p>
          </CardContent>
        </Card>
      ) : (
        <>
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
                  {payments.map((p, i) => (
                    <div key={p.id} className={`grid grid-cols-5 gap-4 px-5 py-4 items-center text-sm ${i !== payments.length - 1 ? "border-b" : ""} hover:bg-muted/30 transition-colors`}>
                      <span className="font-medium">{p.notes || getRecurrenceTypeLabel(p.recurrence_type as RecurrenceType)}</span>
                      <span className="font-semibold">{formatCurrency(p.amount, p.currency || "UYU")}</span>
                      <span className="text-muted-foreground">{formatShort(parseISO(p.due_date))}</span>
                      <span>{payBadge(p.status)}</span>
                      <span className="text-muted-foreground">{p.paid_at ? formatShort(parseISO(p.paid_at)) : "—"}</span>
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
            {payments.map(p => (
              <Card key={p.id} className="hover:shadow-md transition-all overflow-hidden">
                <div className={`h-0.5 ${p.status === "paid" ? "bg-primary" : p.status === "overdue" ? "bg-destructive" : "bg-muted-foreground"}`} />
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div>
                      <p className="font-bold text-base">{formatCurrency(p.amount, p.currency || "UYU")}</p>
                      <p className="text-xs font-medium text-foreground/80 mt-0.5">{p.notes || getRecurrenceTypeLabel(p.recurrence_type as RecurrenceType)}</p>
                    </div>
                    {payBadge(p.status)}
                  </div>
                  <Separator className="my-2" />
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>Vence: {formatShort(parseISO(p.due_date))}</span>
                    {p.paid_at && <span className="text-primary">✓ Pagado: {formatShort(parseISO(p.paid_at))}</span>}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </>
      )}
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
                <Button variant="ghost" size="sm" className="gap-1 text-xs" onClick={cancelEditing} disabled={savingProfile}>
                  <X className="h-3.5 w-3.5" /> Cancelar
                </Button>
                <Button size="sm" className="gap-1 text-xs" onClick={saveProfile} disabled={savingProfile}>
                  <Save className="h-3.5 w-3.5" /> {savingProfile ? "Guardando..." : "Guardar"}
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
                {(isEditingProfile ? previewAvatar : patient?.avatar_url) ? (
                  <AvatarImage src={isEditingProfile ? previewAvatar : (patient?.avatar_url || "")} />
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
            <div className="min-w-0">
              {isEditingProfile ? (
                <Input
                  value={editForm.full_name}
                  onChange={e => setEditForm(f => ({ ...f, full_name: e.target.value }))}
                  className="h-9 text-base font-bold"
                  placeholder="Nombre completo"
                />
              ) : (
                <p className="font-bold text-base lg:text-lg truncate">{patient?.full_name}</p>
              )}
              {patient?.created_at && (
                <p className="text-xs lg:text-sm text-muted-foreground mt-1">
                  Paciente desde {format(parseISO(patient.created_at), "MMMM yyyy", { locale: es })}
                </p>
              )}
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
                {isEditingProfile ? (
                  <Input
                    value={editForm.email}
                    onChange={e => setEditForm(f => ({ ...f, email: e.target.value }))}
                    className="h-8 mt-1 text-sm"
                    placeholder="tu@email.com"
                    type="email"
                  />
                ) : (
                  <p className="font-medium truncate">{patient?.email || <span className="text-muted-foreground italic">Sin especificar</span>}</p>
                )}
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
                  <p className="font-medium">{patient?.whatsapp_phone || <span className="text-muted-foreground italic">Sin especificar</span>}</p>
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
                    {patient?.reason_for_consultation || <span className="text-muted-foreground italic">Sin especificar</span>}
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
            <div className="min-w-0">
              <p className="font-bold text-base lg:text-lg truncate">{branding.name}</p>
              <p className="text-sm text-muted-foreground capitalize truncate">{branding.specialty}</p>
            </div>
          </div>
          {branding.contact_email && (
            <div className="flex items-center gap-3 text-sm">
              <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center shrink-0">
                <Mail className="h-4 w-4 text-muted-foreground" />
              </div>
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground">Contacto</p>
                <p className="font-medium truncate">{branding.contact_email}</p>
              </div>
            </div>
          )}
          <Separator />
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-xl bg-muted/40 p-4 text-center">
              <p className="text-xl font-bold text-primary">{totalSessions}</p>
              <p className="text-xs text-muted-foreground mt-1">Sesiones</p>
            </div>
            <div className="rounded-xl bg-muted/40 p-4 text-center">
              <p className="text-xl font-bold">{upcomingAppointments.length + pastAppointments.length}</p>
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

  // ========= Loading / Error =========
  if (loading) {
    return (
      <div className="min-h-screen bg-background p-4 space-y-4">
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6 text-center">
            <AlertTriangle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground">{error}</p>
            <Button variant="outline" className="mt-4" onClick={() => navigate("/auth")}>Volver al inicio</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // ========= Main render =========
  return (
    <div className="min-h-screen" style={themeStyle as any}>
      <div className="min-h-screen bg-background text-foreground transition-colors duration-300">
        {/* Header */}
        <header className="border-b border-border bg-card sticky top-0 z-20">
          <div className="px-4 lg:px-8 py-3 lg:py-4 flex items-center justify-between">
            <div className="flex items-center gap-3 lg:gap-4 min-w-0">
              {branding.logoUrl ? (
                <img src={branding.logoUrl} className="h-9 w-9 lg:h-10 lg:w-10 rounded-lg object-cover shrink-0" alt="" />
              ) : (
                <Avatar className="h-9 w-9 lg:h-10 lg:w-10 shrink-0">
                  <AvatarFallback className="bg-primary/10 text-primary font-bold">
                    {branding.name.substring(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
              )}
              <div className="min-w-0">
                <h1 className="text-lg lg:text-xl font-bold text-foreground truncate">{branding.name}</h1>
                <p className="text-xs lg:text-sm text-muted-foreground truncate">{branding.specialty}</p>
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
              <Button variant="outline" size="sm" onClick={handleLogout} className="gap-2">
                <LogOut className="h-4 w-4" />
                <span className="hidden sm:inline">Salir</span>
              </Button>
            </div>
          </div>
        </header>

        {/* Prominent install banner — visible on entry (all tabs) */}
        <div className="px-4 lg:px-8 pt-3">
          <PWAInstallBanner
            variant="inline"
            storageKey="pwa_install_banner_dismissed_patient"
            autoOpenIOS
          />
        </div>

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
                  {patient?.avatar_url ? <AvatarImage src={patient.avatar_url} /> : null}
                  <AvatarFallback className="bg-primary/10 text-primary font-bold text-sm">{initials}</AvatarFallback>
                </Avatar>
                <div className="min-w-0">
                  <p className="font-medium text-sm truncate text-foreground">{patient?.full_name}</p>
                  <p className="text-xs text-muted-foreground truncate">{patient?.email || ""}</p>
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
                {patient?.avatar_url ? <AvatarImage src={patient.avatar_url} /> : null}
                <AvatarFallback className="bg-primary/10 text-primary font-bold text-sm">{initials}</AvatarFallback>
              </Avatar>
              <div className="min-w-0">
                <p className="font-semibold text-sm text-foreground truncate">Hola, {firstName} 👋</p>
                <p className="text-xs text-muted-foreground truncate">{branding.name}</p>
              </div>
            </div>

            {tabContent[tab]}
          </main>
        </div>

        {patient && business && (
          <PatientBookingModal
            open={showBookingModal}
            onOpenChange={setShowBookingModal}
            businessId={business.id}
            patientId={patient.id}
            onSuccess={() => loadData()}
          />
        )}
      </div>
    </div>
  );
};

export default PatientPortal;
