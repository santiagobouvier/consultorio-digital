import { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { usePWAInstall } from "@/hooks/use-pwa-install";
import { PortalWelcomeInstall } from "@/components/portal/PortalWelcomeInstall";
import { PatientBookingModal } from "@/components/PatientBookingModal";
import { Building2, Sun, Moon, Eye, EyeOff, Loader2, AlertCircle, LogOut, ArrowLeft, MessageCircle } from "lucide-react";
import {
  PatientPortalView,
  type PortalBranding,
  type PortalPatient,
  type PortalAppointment,
  type PortalPayment,
  type ProfileEditData,
} from "@/components/portal/PatientPortalView";
import { getRecurrenceTypeLabel, RecurrenceType, formatCurrency } from "@/lib/payments";
import { cacheClinicBrand } from "@/lib/clinic-brand-cache";

interface ClinicBrandingFull extends PortalBranding {
  id: string;
  displayName: string;
  slug: string;
}

// Theme generator (light variant for the BrandedLogin screen)
const generateThemeVars = (primaryColor: string, isDark: boolean) => {
  const vars: Record<string, string> = {};
  if (isDark) {
    vars["--background"] = "220 15% 8%";
    vars["--foreground"] = "220 10% 98%";
    vars["--card"] = "220 12% 11%";
    vars["--card-foreground"] = "220 10% 98%";
    vars["--primary"] = primaryColor;
    vars["--primary-foreground"] = "0 0% 100%";
    vars["--muted"] = "220 10% 15%";
    vars["--muted-foreground"] = "220 8% 55%";
    vars["--border"] = "220 10% 18%";
    vars["--input"] = "220 10% 18%";
    vars["--ring"] = primaryColor;
  } else {
    vars["--background"] = "0 0% 100%";
    vars["--foreground"] = "220 15% 10%";
    vars["--card"] = "0 0% 100%";
    vars["--card-foreground"] = "220 15% 10%";
    vars["--primary"] = primaryColor;
    vars["--primary-foreground"] = "0 0% 100%";
    vars["--muted"] = "220 15% 96%";
    vars["--muted-foreground"] = "220 8% 46%";
    vars["--border"] = "220 10% 90%";
    vars["--input"] = "220 10% 90%";
    vars["--ring"] = primaryColor;
  }
  return vars;
};

const BrandedLogin = ({
  branding, isDark, setIsDark, themeStyle,
}: {
  branding: ClinicBrandingFull;
  isDark: boolean;
  setIsDark: (v: boolean) => void;
  themeStyle: Record<string, string>;
}) => {
  const { toast } = useToast();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  // WhatsApp del profesional: para el que todavía no tiene usuario
  const [contactPhone, setContactPhone] = useState<string | null>(null);

  useEffect(() => {
    if (!branding.slug) return;
    (async () => {
      const { data } = await (supabase as any).rpc("get_portal_contact_phone", {
        p_slug: branding.slug,
      });
      if (typeof data === "string" && data.trim()) setContactPhone(data.trim());
    })();
  }, [branding.slug]);

  const openAccessWhatsApp = () => {
    if (!contactPhone) return;
    const digits = contactPhone.replace(/\D/g, "");
    const phone = digits.startsWith("0")
      ? "598" + digits.slice(1)
      : digits.startsWith("598") || digits.length > 9
        ? digits
        : "598" + digits;
    const msg = encodeURIComponent(
      `Hola! Quiero acceso al portal de pacientes de ${branding.displayName}.`
    );
    window.open(`https://wa.me/${phone}?text=${msg}`, "_blank");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
    } catch (err: any) {
      toast({ title: "Error", description: err.message || "Ocurrió un error", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen" style={themeStyle as any}>
      <div className="min-h-screen bg-background text-foreground flex flex-col items-center justify-center p-4 transition-colors duration-300">
        <Button
          variant="ghost"
          onClick={() => navigate("/")}
          className="absolute top-4 left-4 h-11 min-w-11 px-3 gap-1.5 rounded-full text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          <span className="text-sm">Volver</span>
        </Button>
        <Button variant="ghost" size="icon" onClick={() => setIsDark(!isDark)} className="absolute top-4 right-4 h-9 w-9 rounded-full">
          {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
        </Button>
        <div className="w-full max-w-sm space-y-8">
          <div className="text-center space-y-4">
            {branding.logoUrl ? (
              <img src={branding.logoUrl} alt={branding.displayName} className="h-20 w-20 rounded-2xl object-cover mx-auto shadow-lg" />
            ) : (
              <div className="h-20 w-20 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto shadow-lg">
                <Building2 className="h-10 w-10 text-primary" />
              </div>
            )}
            <div>
              <h1 className="text-2xl font-bold text-foreground">{branding.displayName}</h1>
              {branding.specialty && <p className="text-sm text-muted-foreground mt-1">{branding.specialty}</p>}
            </div>
          </div>
          <Card className="border-border/60 shadow-xl">
            <CardHeader className="pb-4">
              <CardTitle className="text-lg text-center">Iniciar sesión</CardTitle>
              <p className="text-sm text-muted-foreground text-center">
                Ingresá con tu cuenta de paciente
              </p>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input id="email" type="email" placeholder="tu@email.com" value={email} onChange={e => setEmail(e.target.value)} required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password">Contraseña</Label>
                  <div className="relative">
                    <Input id="password" type={showPassword ? "text" : "password"} placeholder="••••••••" value={password} onChange={e => setPassword(e.target.value)} required minLength={6} />
                    <Button type="button" variant="ghost" size="icon" className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7" onClick={() => setShowPassword(!showPassword)}>
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </Button>
                  </div>
                </div>
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Ingresar
                </Button>
              </form>
              {/* Sin usuario todavía: camino directo al WhatsApp del profesional */}
              <div className="mt-5 pt-4 border-t border-border/60 text-center space-y-2.5">
                <p className="text-xs text-muted-foreground">¿Todavía no tenés usuario?</p>
                {contactPhone ? (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={openAccessWhatsApp}
                    className="w-full gap-2 rounded-xl border-emerald-500/40 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/10 hover:text-emerald-600"
                  >
                    <MessageCircle className="h-4 w-4" />
                    Pedir acceso por WhatsApp
                  </Button>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    Pedile la invitación de acceso a tu profesional.
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
          <div className="text-center">
            <p className="text-xs text-muted-foreground">Powered by Tu Consultorio Digital</p>
          </div>
        </div>
      </div>
    </div>
  );
};

const ClinicPortal = () => {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { toast } = useToast();
  const { canInstall, install, isInstalled } = usePWAInstall();

  const [loading, setLoading] = useState(true);
  const [branding, setBranding] = useState<ClinicBrandingFull | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [session, setSession] = useState<any>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [patient, setPatient] = useState<PortalPatient | null>(null);
  const [patientLoading, setPatientLoading] = useState(false);
  const [patientChecked, setPatientChecked] = useState(false);
  // La sesión del navegador es de un PROFESIONAL de este consultorio (dueño o
  // miembro) que abrió su propio portal — merece una pantalla propia, no el
  // error de "no tenés ficha de paciente".
  const [isProfessionalViewer, setIsProfessionalViewer] = useState(false);
  // Watchdog: si algún spinner queda girando demasiado, ofrecemos recargar.
  const [gateTimedOut, setGateTimedOut] = useState(false);
  const [isDark, setIsDark] = useState(true);
  const [welcomeSeen, setWelcomeSeen] = useState<boolean>(true);
  const [payingAppointment, setPayingAppointment] = useState<string | null>(null);
  const [payingPaymentIds, setPayingPaymentIds] = useState<string[]>([]);
  const [mpConnected, setMpConnected] = useState(false);
  const [confirmBatch, setConfirmBatch] = useState<{ ids: string[]; total: number; currency: string; items: { id: string; label: string; amount: number }[] } | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [focusOverdueTick, _setFocusOverdueTick] = useState(0);

  const [upcomingAppointments, setUpcomingAppointments] = useState<PortalAppointment[]>([]);
  const [pastAppointments, setPastAppointments] = useState<PortalAppointment[]>([]);
  const [payments, setPayments] = useState<PortalPayment[]>([]);
  const [showBookingModal, setShowBookingModal] = useState(false);
  const [rescheduleTarget, setRescheduleTarget] = useState<PortalAppointment | null>(null);

  useEffect(() => {
    if (!slug) return;
    try {
      setWelcomeSeen(localStorage.getItem(`portal-welcome-seen:${slug}`) === "1");
    } catch { setWelcomeSeen(true); }
  }, [slug]);

  const markWelcomeSeen = useCallback(() => {
    if (!slug) return;
    try { localStorage.setItem(`portal-welcome-seen:${slug}`, "1"); } catch {}
    setWelcomeSeen(true);
  }, [slug]);

  const reloadPatientData = useCallback(async (patientId: string, bizId: string) => {
    const nowIso = new Date().toISOString();
    // Solo patient_note: las "Notas internas" de la cita nunca llegan al portal
    const { data: appts } = await supabase
      .from("appointments")
      .select("id, start_at, end_at, status, modality, location, patient_note, payment_status, services(name)")
      .eq("business_id", bizId)
      .eq("patient_id", patientId)
      .order("start_at", { ascending: false });

    const all = (appts || []).map((a: any): PortalAppointment => ({
      id: a.id, start_at: a.start_at, end_at: a.end_at, status: a.status,
      modality: a.modality, location: a.location, notes: a.patient_note,
      service_name: a.services?.name ?? null, payment_status: a.payment_status,
    }));
    setUpcomingAppointments(all.filter(a => a.start_at >= nowIso && a.status !== "cancelled").reverse());
    setPastAppointments(all.filter(a => a.start_at < nowIso || a.status === "completed"));

    const { data: pays } = await supabase
      .from("payments")
      .select("id, amount, currency, due_date, status, paid_at, recurrence_type, notes, appointment_id, method")
      .eq("business_id", bizId)
      .eq("patient_id", patientId)
      .order("due_date", { ascending: false });
    setPayments((pays || []).map((p: any): PortalPayment => ({
      id: p.id, amount: Number(p.amount), currency: p.currency || "UYU",
      due_date: p.due_date, status: p.status, paid_at: p.paid_at,
      recurrence_label: getRecurrenceTypeLabel(p.recurrence_type as RecurrenceType),
      notes: p.notes, appointment_id: p.appointment_id, method: p.method,
    })));
  }, []);

  // Payment success callback
  useEffect(() => {
    const paymentStatus = searchParams.get("payment");
    const apptId = searchParams.get("appointment_id");
    const isBatch = searchParams.get("batch");
    if (!paymentStatus) return;
    if (paymentStatus === "success") {
      toast({
        title: "¡Pago confirmado! 🎉",
        description: isBatch ? "Tus pagos fueron registrados exitosamente." : "Tu pago se procesó correctamente.",
      });
      setTimeout(() => {
        if (patient && branding) reloadPatientData(patient.id, branding.id);
      }, 2000);
    } else if (paymentStatus === "pending") {
      toast({
        title: "Pago en proceso",
        description: "Tu pago está siendo procesado. Te avisamos cuando se confirme.",
      });
    } else if (paymentStatus === "failure") {
      toast({
        title: "No pudimos procesar el pago",
        description: "Intentá de nuevo o contactá a tu profesional si el problema persiste.",
        variant: "destructive",
      });
    } else if (paymentStatus === "cancelled") {
      toast({
        title: "Pago cancelado",
        description: "Podés intentarlo de nuevo cuando quieras.",
      });
    }
    searchParams.delete("payment");
    searchParams.delete("appointment_id");
    searchParams.delete("payment_id");
    searchParams.delete("batch");
    setSearchParams(searchParams, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  // Load branding
  useEffect(() => {
    if (!slug) return;
    (async () => {
      const { data, error } = await supabase
        .from("businesses_public_branding")
        .select("id, name, specialty, portal_logo_url, portal_clinic_display_name, portal_primary_color, portal_dark_primary_color, public_slug, custom_subdomain, cancellation_hours_notice, late_cancellation_message")
        .or(`public_slug.eq.${slug},custom_subdomain.eq.${slug}`)
        .limit(1).maybeSingle();
      if (error || !data) {
        setNotFound(true); setLoading(false); return;
      }
      setBranding({
        id: data.id,
        name: (data as any).portal_clinic_display_name || data.name,
        displayName: (data as any).portal_clinic_display_name || data.name,
        specialty: data.specialty || "",
        contactEmail: null,
        logoUrl: (data as any).portal_logo_url || "",
        lightColor: (data as any).portal_primary_color || "176 100% 32%",
        darkColor: (data as any).portal_dark_primary_color || "176 85% 42%",
        slug: data.public_slug,
        cancellationHoursNotice: (data as any).cancellation_hours_notice ?? 24,
        lateCancellationMessage: (data as any).late_cancellation_message ?? null,
      });
      // La pantalla de carga usa esta marca en las próximas visitas
      cacheClinicBrand(slug, {
        logoUrl: (data as any).portal_logo_url || null,
        color: (data as any).portal_primary_color || null,
      });
      setLoading(false);
    })();
  }, [slug]);

  // Check if clinic has MP connected
  useEffect(() => {
    if (!branding?.id) return;
    (async () => {
      // RPC segura: los pacientes no pueden leer payment_policies (ahí vive el
      // token secreto de MP); esta función devuelve solo conectado + política.
      const { data } = await (supabase as any).rpc("get_portal_payment_config", {
        p_business_id: branding.id,
      });
      const config = Array.isArray(data) ? data[0] : data;
      // Con política "Sin pago previo" no se ofrece pagar online, aunque MP esté conectado
      setMpConnected(!!config?.mp_connected && config?.policy_type !== "none");
    })();
  }, [branding?.id]);

  // Inject dynamic manifest
  useEffect(() => {
    if (!slug) return;
    const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
    if (!projectId) return;
    const origin = window.location.origin;
    const manifestUrl = `https://${projectId}.supabase.co/functions/v1/get-clinic-manifest?slug=${encodeURIComponent(slug)}&origin=${encodeURIComponent(origin)}`;

    const previousManifestLinks = Array.from(
      document.querySelectorAll<HTMLLinkElement>('link[rel="manifest"]'),
    ).map(el => ({ href: el.href, crossOrigin: el.crossOrigin }));
    document.querySelectorAll('link[rel="manifest"]').forEach(el => el.remove());

    const link = document.createElement("link");
    link.rel = "manifest";
    link.href = manifestUrl;
    link.crossOrigin = "anonymous";
    document.head.appendChild(link);

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

    // iOS toma el nombre de la app instalada de este meta (no del manifest en
    // versiones viejas): mientras el portal está montado, la app se llama como
    // el consultorio, no "Tu Consultorio".
    let appleTitle = document.querySelector<HTMLMetaElement>('meta[name="apple-mobile-web-app-title"]');
    const previousAppleTitle = appleTitle?.content;
    if (branding?.name) {
      if (!appleTitle) {
        appleTitle = document.createElement("meta");
        appleTitle.name = "apple-mobile-web-app-title";
        document.head.appendChild(appleTitle);
      }
      appleTitle.content = branding.name;
    }

    return () => {
      link.remove();
      previousManifestLinks.forEach(({ href, crossOrigin }) => {
        const restored = document.createElement("link");
        restored.rel = "manifest";
        restored.href = href;
        if (crossOrigin) restored.crossOrigin = crossOrigin;
        document.head.appendChild(restored);
      });
      if (appleIcon && previousAppleHref) appleIcon.href = previousAppleHref;
      if (appleTitle && previousAppleTitle) appleTitle.content = previousAppleTitle;
    };
  }, [slug, branding?.logoUrl, branding?.name]);

  // Auth listener. Con timeout de seguridad: si getSession() se cuelga
  // (candados de sesión con varias pestañas abiertas), el portal NO queda
  // girando para siempre — sigue como visitante y muestra el login.
  useEffect(() => {
    let cancelled = false;
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, sess) => {
      if (cancelled) return;
      setSession(sess); setAuthChecked(true);
    });
    const failOpen = window.setTimeout(() => {
      if (!cancelled) setAuthChecked(true);
    }, 3500);
    supabase.auth.getSession().then(({ data: { session: sess } }) => {
      if (cancelled) return;
      setSession(sess); setAuthChecked(true);
    }).catch(() => {
      if (!cancelled) setAuthChecked(true);
    });
    return () => {
      cancelled = true;
      window.clearTimeout(failOpen);
      subscription.unsubscribe();
    };
  }, []);

  // Load patient
  useEffect(() => {
    if (!authChecked) return;
    if (!session?.user?.id || !branding?.id) {
      if (authChecked && !session?.user?.id) setPatientChecked(true);
      return;
    }
    (async () => {
      setPatientLoading(true); setPatientChecked(false);
      const { data } = await supabase
        .from("patients")
        .select("id, full_name, email, whatsapp_phone, avatar_url, reason_for_consultation, private_notes, created_at")
        .eq("business_id", branding.id)
        .eq("auth_user_id", session.user.id)
        .eq("is_active", true)
        .limit(1).maybeSingle();
      if (data) {
        setPatient(data as PortalPatient);
        await reloadPatientData(data.id, branding.id);
      } else {
        // ¿Es el profesional del consultorio mirando su propio portal?
        try {
          const { data: owned } = await supabase
            .from("businesses")
            .select("id")
            .eq("id", branding.id)
            .eq("owner_user_id", session.user.id)
            .maybeSingle();
          let member = !!owned;
          if (!member) {
            const { data: role } = await supabase
              .from("user_roles")
              .select("id")
              .eq("business_id", branding.id)
              .eq("user_id", session.user.id)
              .maybeSingle();
            member = !!role;
          }
          setIsProfessionalViewer(member);
        } catch {
          setIsProfessionalViewer(false);
        }
      }
      setPatientLoading(false); setPatientChecked(true);
    })();
  }, [session?.user?.id, branding?.id, authChecked, reloadPatientData]);

  // Watchdog de los spinners de arranque: pasados 10s ofrecemos recargar en
  // vez de girar infinito (colgadas de red o de sesión con multi-pestaña).
  const bootGating =
    loading || !authChecked || (!!session && !!branding && (!patientChecked || patientLoading));
  useEffect(() => {
    if (!bootGating) {
      setGateTimedOut(false);
      return;
    }
    const t = window.setTimeout(() => setGateTimedOut(true), 10000);
    return () => window.clearTimeout(t);
  }, [bootGating]);

  const themeStyleLogin = (() => {
    if (!branding) return {};
    const color = isDark ? branding.darkColor : branding.lightColor;
    return generateThemeVars(color, isDark);
  })();

  const handleLogout = async () => {
    // scope local: cierra la sesión de ESTE navegador solamente. El global
    // revocaba también la sesión del celular del paciente (u otras compus).
    await supabase.auth.signOut({ scope: "local" });
    setSession(null); setPatient(null); setIsProfessionalViewer(false);
    setPatientLoading(false); setPatientChecked(false);
  };

  const handlePaySession = async (appointmentId: string) => {
    if (!branding) return;
    try {
      setPayingAppointment(appointmentId);
      const { data: existingPayment } = await supabase
        .from("payments")
        .select("id, mp_preference_id")
        .eq("appointment_id", appointmentId)
        .eq("status", "pending")
        .not("mp_preference_id", "is", null)
        .maybeSingle();
      if (existingPayment?.mp_preference_id) {
        window.location.href = `https://www.mercadopago.com.uy/checkout/v1/redirect?pref_id=${existingPayment.mp_preference_id}`;
        return;
      }
      const { data, error } = await supabase.functions.invoke("create-session-payment", {
        body: { appointment_id: appointmentId, business_id: branding.id },
      });
      if (error) throw error;
      if (data?.init_point) window.location.href = data.init_point;
      else throw new Error("No checkout URL received");
    } catch (err: any) {
      console.error("Payment error:", err);
      toast({ title: "Error", description: "No se pudo iniciar el pago. Intentá de nuevo.", variant: "destructive" });
      setPayingAppointment(null);
    }
  };

  const startBatchCheckout = async (paymentIds: string[]) => {
    if (!branding) return;
    try {
      setPayingPaymentIds(paymentIds);
      const { data, error } = await supabase.functions.invoke("create-patient-payment", {
        body: { business_id: branding.id, payment_ids: paymentIds },
      });
      if (error) throw error;
      if (data?.init_point) {
        window.location.href = data.init_point;
      } else {
        throw new Error("No checkout URL received");
      }
    } catch (err: any) {
      console.error("Batch payment error:", err);
      toast({ title: "Error", description: "No se pudo iniciar el pago. Intentá de nuevo.", variant: "destructive" });
      setPayingPaymentIds([]);
    }
  };

  const handlePayPayments = async (paymentIds: string[]) => {
    if (paymentIds.length === 0) return;
    if (paymentIds.length === 1) {
      await startBatchCheckout(paymentIds);
      return;
    }
    // Show confirmation modal for batch
    const selected = payments.filter(p => paymentIds.includes(p.id));
    const total = selected.reduce((s, p) => s + Number(p.amount), 0);
    const currency = selected[0]?.currency || "UYU";
    setConfirmBatch({
      ids: paymentIds,
      total,
      currency,
      items: selected.map(p => ({
        id: p.id,
        label: p.notes || p.recurrence_label || "Pago",
        amount: Number(p.amount),
      })),
    });
  };

  const handleSaveProfile = async (data: ProfileEditData, avatarFile: File | null) => {
    if (!patient) return;
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
      const { error } = await supabase.from("patients").update({
        full_name: data.full_name,
        email: data.email || null,
        whatsapp_phone: data.whatsapp_phone || null,
        reason_for_consultation: data.reason_for_consultation || null,
        avatar_url,
      }).eq("id", patient.id);
      if (error) throw error;
      setPatient({ ...patient, ...data, email: data.email || null, whatsapp_phone: data.whatsapp_phone || null, reason_for_consultation: data.reason_for_consultation || null, avatar_url });
      toast({ title: "Perfil actualizado", description: "Tus datos se guardaron correctamente." });
    } catch (err: any) {
      console.error(err);
      toast({ title: "Error", description: "No se pudo guardar. Intentá de nuevo.", variant: "destructive" });
    }
  };

  const handleCancelAppointment = async (appointmentId: string, reason: string) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const { data: aptRow } = await supabase
        .from("appointments")
        .select("availability_slot_id")
        .eq("id", appointmentId)
        .maybeSingle();
      const { error } = await supabase.from("appointments").update({
        status: "cancelled_by_patient",
        cancelled_at: new Date().toISOString(),
        cancelled_by: user?.id || null,
        cancellation_reason: reason || null,
      }).eq("id", appointmentId);
      if (error) throw error;
      if (aptRow?.availability_slot_id) {
        await supabase.from("availability_slots")
          .update({ status: "available" })
          .eq("id", aptRow.availability_slot_id);
      }
      toast({ title: "Cita cancelada", description: "Avisamos al profesional." });
      if (patient && branding) await reloadPatientData(patient.id, branding.id);
    } catch (err: any) {
      console.error(err);
      // Trigger de la base: cancelación fuera del plazo del consultorio
      const windowClosed = String(err?.message || "").includes("cancellation_window_closed");
      toast({
        title: windowClosed ? "Ya no se puede cancelar desde acá" : "Error",
        description: windowClosed
          ? "Falta poco para tu cita: para cancelarla contactá directamente a tu profesional."
          : "No se pudo cancelar la cita.",
        variant: "destructive",
      });
    }
  };

  const handleRescheduleAppointment = (apt: PortalAppointment) => {
    setRescheduleTarget(apt);
    setShowBookingModal(true);
  };

  // Red de seguridad: un arranque colgado ofrece recargar, nunca gira infinito.
  if (bootGating && gateTimedOut) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background text-foreground p-4">
        <Card className="max-w-sm w-full">
          <CardContent className="pt-8 pb-6 text-center space-y-3">
            <AlertCircle className="h-10 w-10 text-muted-foreground mx-auto" />
            <h2 className="text-lg font-bold">Está tardando más de lo normal</h2>
            <p className="text-sm text-muted-foreground">
              Puede ser tu conexión. Recargá la página para reintentar.
            </p>
            <Button onClick={() => window.location.reload()} className="w-full">
              Recargar página
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (loading || !authChecked) {
    return <div className="min-h-screen flex items-center justify-center bg-background"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>;
  }
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
  if (!session) {
    if (!welcomeSeen) {
      return (
        <PortalWelcomeInstall
          branding={{ displayName: branding.displayName, specialty: branding.specialty, logoUrl: branding.logoUrl, slug: branding.slug }}
          themeStyle={themeStyleLogin}
          onContinue={markWelcomeSeen}
        />
      );
    }
    return <BrandedLogin branding={branding} isDark={isDark} setIsDark={setIsDark} themeStyle={themeStyleLogin} />;
  }
  if (session && (!patientChecked || patientLoading)) {
    return <div className="min-h-screen flex items-center justify-center bg-background"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>;
  }
  if (!patient && isProfessionalViewer) {
    // El profesional abrió su propio portal con la sesión del panel. OJO: acá
    // NUNCA cerramos sesión global — eso mataría el panel en las otras
    // pestañas. Si quiere probar el login de pacientes, se le avisa el costo.
    return (
      <div className="min-h-screen" style={themeStyleLogin as any}>
        <div className="min-h-screen bg-background text-foreground flex items-center justify-center p-4">
          <Card className="max-w-md w-full">
            <CardContent className="pt-8 pb-6 text-center space-y-4">
              {branding.logoUrl ? (
                <img src={branding.logoUrl} alt="" className="h-14 w-14 rounded-2xl object-cover mx-auto" />
              ) : (
                <Building2 className="h-12 w-12 text-primary mx-auto" />
              )}
              <div className="space-y-1.5">
                <h2 className="text-xl font-bold">Este es el portal de tus pacientes</h2>
                <p className="text-sm text-muted-foreground">
                  Estás con tu sesión de profesional de {branding.displayName}, así que no hay una
                  ficha de paciente para mostrar. Tus pacientes entran acá con su propio acceso y
                  ven sus citas, pagos y reservas.
                </p>
              </div>
              <Button className="w-full" onClick={() => navigate("/dashboard")}>
                Volver a mi panel
              </Button>
              <p className="text-xs text-muted-foreground leading-relaxed">
                ¿Querés probar el login de pacientes? Abrí este link en una ventana de incógnito,
                o cerrá sesión — ojo: eso también cierra tu panel en este navegador.
              </p>
              <Button variant="ghost" size="sm" onClick={handleLogout} className="text-muted-foreground">
                <LogOut className="h-4 w-4 mr-2" /> Cerrar sesión igual
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  if (!patient) {
    return (
      <div className="min-h-screen" style={themeStyleLogin as any}>
        <div className="min-h-screen bg-background text-foreground flex items-center justify-center p-4">
          <Card className="max-w-sm w-full">
            <CardContent className="pt-8 pb-6 text-center space-y-3">
              <AlertCircle className="h-12 w-12 text-destructive mx-auto" />
              <h2 className="text-xl font-bold">Acceso no disponible</h2>
              <p className="text-sm text-muted-foreground">No tenés una ficha de paciente en este consultorio. Contactá a {branding.displayName} para que te agreguen.</p>
              <div className="flex gap-2 justify-center">
                <Button variant="outline" onClick={handleLogout}><LogOut className="h-4 w-4 mr-2" /> Cerrar sesión</Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <PatientPortalView
      branding={branding}
      patient={patient}
      upcomingAppointments={upcomingAppointments}
      pastAppointments={pastAppointments}
      payments={payments}
      isDark={isDark}
      onToggleDark={() => setIsDark(d => !d)}
      canInstall={canInstall}
      isInstalled={isInstalled}
      onInstallApp={() => { if (canInstall) install(); }}
      headerAction="logout"
      onLogout={handleLogout}
      onSaveProfile={handleSaveProfile}
      onPaySession={handlePaySession}
      payingAppointmentId={payingAppointment}
      onPayPayments={handlePayPayments}
      payingPaymentIds={payingPaymentIds}
      mpConnected={mpConnected}
      focusOverdueTick={focusOverdueTick}
      onBookAppointment={() => { setRescheduleTarget(null); setShowBookingModal(true); }}
      onCancelAppointment={handleCancelAppointment}
      onRescheduleAppointment={handleRescheduleAppointment}
      extras={branding && patient && (
        <>
          <PatientBookingModal
            open={showBookingModal}
            onOpenChange={(o) => { setShowBookingModal(o); if (!o) setRescheduleTarget(null); }}
            businessId={branding.id}
            patientId={patient.id}
            rescheduleAppointment={rescheduleTarget ? { id: rescheduleTarget.id, start_at: rescheduleTarget.start_at, end_at: rescheduleTarget.end_at } : null}
            onSuccess={() => { if (patient && branding) reloadPatientData(patient.id, branding.id); }}
            branding={{ name: branding.displayName || branding.name, logoUrl: branding.logoUrl, cancellationHoursNotice: branding.cancellationHoursNotice }}
          />
          <Dialog open={!!confirmBatch} onOpenChange={(o) => { if (!o) setConfirmBatch(null); }}>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>Confirmar pago</DialogTitle>
                <DialogDescription>
                  Vas a pagar {confirmBatch?.items.length} pagos en una sola transacción.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-2 max-h-60 overflow-y-auto py-2">
                {confirmBatch?.items.map(item => (
                  <div key={item.id} className="flex items-center justify-between text-sm border-b last:border-b-0 pb-2 last:pb-0">
                    <span className="truncate pr-2">{item.label}</span>
                    <span className="font-semibold shrink-0">{formatCurrency(item.amount, confirmBatch.currency)}</span>
                  </div>
                ))}
              </div>
              <div className="flex items-center justify-between border-t pt-3">
                <span className="text-sm font-medium">Total</span>
                <span className="text-lg font-bold">{confirmBatch && formatCurrency(confirmBatch.total, confirmBatch.currency)}</span>
              </div>
              <DialogFooter className="gap-2 sm:gap-2">
                <Button variant="outline" onClick={() => setConfirmBatch(null)} disabled={payingPaymentIds.length > 0}>
                  Cancelar
                </Button>
                <Button
                  onClick={async () => {
                    if (!confirmBatch) return;
                    const ids = confirmBatch.ids;
                    setConfirmBatch(null);
                    await startBatchCheckout(ids);
                  }}
                  disabled={payingPaymentIds.length > 0}
                >
                  Confirmar y pagar
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </>
      )}
    />
  );
};

export default ClinicPortal;