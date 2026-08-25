// Desktop Dashboard - v3 "Tu día"
// Centro de comando del día del profesional: la sesión de ahora/próxima como
// protagonista, la línea del día, y una cola de pendientes accionables.
// Todo se actualiza en tiempo real (Supabase Realtime + reloj interno),
// sin recargar la página.
import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useProfessionals } from "@/hooks/use-professionals";
import { calculatePaymentStatus, formatCurrency } from "@/lib/payments";
import { createPaymentLink } from "@/lib/payment-links";
import { openWhatsApp } from "@/lib/whatsapp";
import { format, startOfMonth, endOfMonth, addDays, isTomorrow } from "date-fns";
import { es } from "date-fns/locale";
import { toast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ActivationChecklist } from "@/components/ActivationChecklist";
import { PublicLinkCard } from "@/components/PublicLinkCard";
import { PaymentLinkMenu } from "@/components/PaymentLinkMenu";
import { AppointmentDetailModal } from "@/components/calendar/AppointmentDetailModal";
import {
  ActivationCompleteModal,
  wasActivationCelebrated,
} from "@/components/ActivationCompleteModal";
import { useDashboardBranding } from "@/contexts/DashboardBrandingContext";
import { usePendingRequestsCount } from "@/hooks/use-pending-requests-count";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  CalendarDays,
  Users,
  Clock,
  ArrowRight,
  Building2,
  MessageCircle,
  StickyNote,
  Video,
  MapPin,
  User,
  Inbox,
  AlertTriangle,
  Wallet,
  Sparkles,
  CalendarClock,
  CheckCircle2,
} from "lucide-react";

interface Appointment {
  id: string;
  start_at: string;
  end_at: string | null;
  status: string;
  modality: string | null;
  location: string | null;
  payment_status: string | null;
  patient_id: string | null;
  service_id: string | null;
  professional_id: string | null;
  recurrence_group_id?: string | null;
  patients: { full_name: string; whatsapp_phone: string | null; email?: string | null; avatar_url?: string | null } | null;
  services: { name: string } | null;
}

interface Payment {
  id: string;
  patient_id: string;
  appointment_id: string | null;
  due_date: string;
  paid_at: string | null;
  status: string;
  amount: number;
  patientName?: string;
  patientPhone?: string | null;
  calculatedStatus?: string;
}

interface DesktopDashboardProps {
  businessId: string;
  userName: string;
}

const CANCELLED = ["cancelled", "cancelled_by_patient"];

// Tipografía de display (misma familia visual que la ficha de paciente)
const GROTESK = { fontFamily: "'Space Grotesk', sans-serif" } as const;

/** "en 3 min" / "en 2 h 15 min" */
const formatCountdown = (ms: number) => {
  const min = Math.max(1, Math.round(ms / 60000));
  if (min < 60) return `en ${min} min`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m > 0 ? `en ${h} h ${m} min` : `en ${h} h`;
};

export const DesktopDashboard = ({ businessId, userName: propUserName }: DesktopDashboardProps) => {
  const navigate = useNavigate();
  const { professionals, loading: professionalsLoading } = useProfessionals(businessId);
  const { logoUrl: brandLogoUrl } = useDashboardBranding();
  const pendingRequestsCount = usePendingRequestsCount();

  const [businessName, setBusinessName] = useState("");
  const [publicSlug, setPublicSlug] = useState<string | null>(null);
  const [selectedProfessionalId, setSelectedProfessionalId] = useState<string>("all");

  // Datos del día (hoy + ayer para detectar notas pendientes)
  const [appts, setAppts] = useState<Appointment[]>([]);
  const [upcomingAppointments, setUpcomingAppointments] = useState<Appointment[]>([]);
  const [pendingPayments, setPendingPayments] = useState<Payment[]>([]);
  const [notedAppointmentIds, setNotedAppointmentIds] = useState<Set<string>>(new Set());
  const [mpConnected, setMpConnected] = useState(false);

  // KPIs
  const [activePatientsCount, setActivePatientsCount] = useState(0);
  const [collectedThisMonth, setCollectedThisMonth] = useState(0);
  const [paidRecent, setPaidRecent] = useState<Array<{ amount: number; paid_at: string }>>([]);
  const [apptsRecent, setApptsRecent] = useState<Array<{ start_at: string }>>([]);

  const [dataLoading, setDataLoading] = useState(true);
  // Cita abierta en el modal de detalle (decisiones del día sin salir del dashboard)
  const [selectedApt, setSelectedApt] = useState<Appointment | null>(null);
  const [showActivationDone, setShowActivationDone] = useState(false);

  // Reloj interno: mueve la cuenta regresiva, el EN CURSO y la línea de AHORA
  const [nowTick, setNowTick] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNowTick(Date.now()), 30000);
    return () => clearInterval(t);
  }, []);

  const userName = propUserName;

  const fetchDashboardData = useCallback(async (silent = false) => {
    if (!businessId) return;
    try {
      if (!silent) setDataLoading(true);

      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const yesterday = addDays(today, -1);
      const tomorrow = addDays(today, 1);
      const dayAfter = addDays(today, 3);
      const monthStart = startOfMonth(new Date());
      const monthEnd = endOfMonth(new Date());
      const last35 = addDays(today, -35);

      const [businessRes, apptsRes, upcomingRes, patientsCountRes, paidMonthRes, pendingPaymentsRes, paidRecentRes, apptsRecentRes, policyRes] =
        await Promise.all([
          supabase.from("businesses").select("name, public_slug").eq("id", businessId).single(),
          // Ayer + hoy completos: el día de hoy para la línea de tiempo,
          // ayer para detectar sesiones sin nota clínica.
          supabase
            .from("appointments")
            .select(`id, start_at, end_at, status, modality, location, payment_status, patient_id, service_id, professional_id, recurrence_group_id, patients (full_name, whatsapp_phone, email, avatar_url), services (name)`)
            .eq("business_id", businessId)
            .gte("start_at", yesterday.toISOString())
            .lt("start_at", tomorrow.toISOString())
            .order("start_at", { ascending: true }),
          // Próximas 72 hs (para el hero cuando hoy no hay nada)
          supabase
            .from("appointments")
            .select(`id, start_at, end_at, status, modality, location, payment_status, patient_id, service_id, professional_id, recurrence_group_id, patients (full_name, whatsapp_phone, email, avatar_url), services (name)`)
            .eq("business_id", businessId)
            .gte("start_at", new Date().toISOString())
            .lt("start_at", dayAfter.toISOString())
            .not("status", "in", '("cancelled","cancelled_by_patient")')
            .order("start_at", { ascending: true })
            .limit(6),
          supabase.from("patients").select("id", { count: "exact", head: true }).eq("business_id", businessId).eq("is_active", true),
          supabase.from("payments").select("amount").eq("business_id", businessId).not("paid_at", "is", null).gte("paid_at", monthStart.toISOString()).lte("paid_at", monthEnd.toISOString()),
          supabase.from("payments").select("id, patient_id, appointment_id, due_date, paid_at, status, amount").eq("business_id", businessId).neq("status", "cancelled").is("paid_at", null),
          (supabase as any).from("payments").select("amount, paid_at").eq("business_id", businessId).not("paid_at", "is", null).gte("paid_at", last35.toISOString()),
          (supabase as any).from("appointments").select("start_at").eq("business_id", businessId).gte("start_at", addDays(today, -7).toISOString()).lt("start_at", tomorrow.toISOString()).not("status", "in", '("cancelled","cancelled_by_patient")'),
          supabase.from("payment_policies").select("mp_connected").eq("business_id", businessId).maybeSingle(),
        ]);

      if (businessRes.data) {
        setBusinessName(businessRes.data.name);
        setPublicSlug((businessRes.data as any).public_slug ?? null);
      }

      const allAppts = (apptsRes.data || []) as any as Appointment[];
      setAppts(allAppts);
      setUpcomingAppointments((upcomingRes.data || []) as any as Appointment[]);
      setActivePatientsCount(patientsCountRes.count || 0);
      setCollectedThisMonth(paidMonthRes.data?.reduce((s, p) => s + (p.amount || 0), 0) || 0);
      setPaidRecent(((paidRecentRes as any).data || []) as Array<{ amount: number; paid_at: string }>);
      setApptsRecent(((apptsRecentRes as any).data || []) as Array<{ start_at: string }>);
      setMpConnected(Boolean((policyRes.data as any)?.mp_connected));

      // Notas clínicas de las sesiones de ayer/hoy → detectar "sin nota"
      const pastIds = allAppts
        .filter((a) => !CANCELLED.includes(a.status))
        .map((a) => a.id);
      if (pastIds.length > 0) {
        const { data: notes } = await supabase
          .from("session_notes")
          .select("appointment_id")
          .in("appointment_id", pastIds);
        setNotedAppointmentIds(new Set((notes || []).map((n: any) => n.appointment_id).filter(Boolean)));
      } else {
        setNotedAppointmentIds(new Set());
      }

      // Pagos pendientes con nombre y teléfono del paciente
      const payments = pendingPaymentsRes.data as any as Payment[] | null;
      if (payments && payments.length > 0) {
        const patientIds = [...new Set(payments.map((p) => p.patient_id))];
        const { data: patients } = await supabase
          .from("patients")
          .select("id, full_name, whatsapp_phone")
          .in("id", patientIds);
        const patientMap = new Map((patients || []).map((p: any) => [p.id, p]));
        setPendingPayments(
          payments.map((p) => ({
            ...p,
            patientName: (patientMap.get(p.patient_id) as any)?.full_name || "Desconocido",
            patientPhone: (patientMap.get(p.patient_id) as any)?.whatsapp_phone || null,
            calculatedStatus: calculatePaymentStatus(p as any),
          })),
        );
      } else {
        setPendingPayments([]);
      }
    } catch (error) {
      console.error("Error fetching dashboard data:", error);
      if (!silent) {
        toast({ title: "Error", description: "No se pudo cargar la información", variant: "destructive" });
      }
    } finally {
      if (!silent) setDataLoading(false);
    }
  }, [businessId]);

  useEffect(() => {
    if (businessId) fetchDashboardData();
  }, [businessId, fetchDashboardData]);

  // ── Tiempo real: la base avisa y el dashboard se refresca solo ──
  const refetchTimer = useRef<ReturnType<typeof setTimeout>>();
  useEffect(() => {
    if (!businessId) return;
    const scheduleRefetch = () => {
      clearTimeout(refetchTimer.current);
      refetchTimer.current = setTimeout(() => fetchDashboardData(true), 500);
    };
    const channel = supabase
      .channel(`dashboard-live-${businessId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "appointments", filter: `business_id=eq.${businessId}` }, scheduleRefetch)
      .on("postgres_changes", { event: "*", schema: "public", table: "payments", filter: `business_id=eq.${businessId}` }, scheduleRefetch)
      .on("postgres_changes", { event: "*", schema: "public", table: "session_notes", filter: `business_id=eq.${businessId}` }, scheduleRefetch)
      .subscribe();
    // Respaldo: al volver a la pestaña, refrescar
    const onVisible = () => {
      if (document.visibilityState === "visible") scheduleRefetch();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      supabase.removeChannel(channel);
      document.removeEventListener("visibilitychange", onVisible);
      clearTimeout(refetchTimer.current);
    };
  }, [businessId, fetchDashboardData]);

  // ── Derivados del día (dependen del reloj) ──
  const todayStart = useMemo(() => {
    const d = new Date(nowTick);
    d.setHours(0, 0, 0, 0);
    return d.getTime();
  }, [nowTick]);

  const filterByProfessional = useCallback(
    (list: Appointment[]) =>
      selectedProfessionalId === "all" ? list : list.filter((a) => a.professional_id === selectedProfessionalId),
    [selectedProfessionalId],
  );

  const todayAppts = useMemo(
    () => filterByProfessional(appts.filter((a) => new Date(a.start_at).getTime() >= todayStart)),
    [appts, todayStart, filterByProfessional],
  );

  const endOf = (a: Appointment) =>
    a.end_at ? new Date(a.end_at).getTime() : new Date(a.start_at).getTime() + 3600000;

  const activeToday = useMemo(() => todayAppts.filter((a) => !CANCELLED.includes(a.status)), [todayAppts]);

  const currentSession = useMemo(
    () => activeToday.find((a) => new Date(a.start_at).getTime() <= nowTick && nowTick < endOf(a)),
    [activeToday, nowTick],
  );
  const nextSession = useMemo(
    () => activeToday.find((a) => new Date(a.start_at).getTime() > nowTick),
    [activeToday, nowTick],
  );
  const doneCount = useMemo(
    () => activeToday.filter((a) => endOf(a) <= nowTick || a.status === "attended").length,
    [activeToday, nowTick],
  );

  // Sesiones (ayer/hoy) ya pasadas y sin nota clínica
  const sessionsWithoutNote = useMemo(
    () =>
      filterByProfessional(appts).filter(
        (a) =>
          !CANCELLED.includes(a.status) &&
          endOf(a) <= nowTick &&
          !notedAppointmentIds.has(a.id),
      ),
    [appts, notedAppointmentIds, nowTick, filterByProfessional],
  );

  const overduePayments = useMemo(
    () => pendingPayments.filter((p) => p.calculatedStatus === "overdue").sort((a, b) => (b.amount || 0) - (a.amount || 0)),
    [pendingPayments],
  );
  const dueTodayPayments = useMemo(
    () =>
      pendingPayments.filter(
        (p) => p.calculatedStatus !== "overdue" && new Date(p.due_date).toDateString() === new Date(nowTick).toDateString(),
      ),
    [pendingPayments, nowTick],
  );
  const overdueAmount = useMemo(() => overduePayments.reduce((s, p) => s + (p.amount || 0), 0), [overduePayments]);

  const collectedToday = useMemo(() => {
    const t = new Date(nowTick).toDateString();
    return paidRecent.filter((p) => new Date(p.paid_at).toDateString() === t).reduce((s, p) => s + (p.amount || 0), 0);
  }, [paidRecent, nowTick]);

  const weekApptsCount = apptsRecent.length;

  // Cobrado por día (últimos 14) y citas por día (últimos 7), normalizados
  const collectedSpark = useMemo(() => {
    const byDay = new Map<string, number>();
    for (const p of paidRecent) {
      const k = new Date(p.paid_at).toDateString();
      byDay.set(k, (byDay.get(k) || 0) + (p.amount || 0));
    }
    const out: number[] = [];
    for (let i = 13; i >= 0; i--) out.push(byDay.get(addDays(new Date(), -i).toDateString()) || 0);
    const max = Math.max(...out, 1);
    return out.map((v) => v / max);
  }, [paidRecent]);

  const citasSpark = useMemo(() => {
    const byDay = new Map<string, number>();
    for (const a of apptsRecent) {
      const k = new Date(a.start_at).toDateString();
      byDay.set(k, (byDay.get(k) || 0) + 1);
    }
    const out: number[] = [];
    for (let i = 6; i >= 0; i--) out.push(byDay.get(addDays(new Date(), -i).toDateString()) || 0);
    const max = Math.max(...out, 1);
    return out.map((v) => v / max);
  }, [apptsRecent]);

  const pendingCount =
    (pendingRequestsCount > 0 ? 1 : 0) + overduePayments.length + dueTodayPayments.length + sessionsWithoutNote.length;

  // Pago pendiente vinculado a una cita (para el botón Cobrar del hero)
  const paymentForAppointment = useCallback(
    (aptId: string) => pendingPayments.find((p) => p.appointment_id === aptId),
    [pendingPayments],
  );

  // Compartir el link de reservas: lo más directo para llenar la agenda
  const shareBookingLink = async () => {
    if (!publicSlug) {
      toast({ title: "Configurá tu web primero", description: "Definí el nombre público en Personalizar portal." });
      return;
    }
    const url = `${window.location.origin}/consultorio/${publicSlug}/reservar`;
    try {
      if (navigator.share) {
        await navigator.share({ title: businessName || "Reservar sesión", url });
        return;
      }
      throw new Error("no-share");
    } catch {
      try {
        await navigator.clipboard.writeText(url);
        toast({ title: "Link de reservas copiado ✓", description: "Pegalo en WhatsApp, Instagram o donde quieras." });
      } catch {
        toast({ title: "Tu link de reservas", description: url });
      }
    }
  };

  const getGreeting = () => {
    const hour = new Date(nowTick).getHours();
    if (hour < 12) return "Buenos días";
    if (hour < 19) return "Buenas tardes";
    return "Buenas noches";
  };

  const firstName = (n?: string | null) => (n || "").split(" ")[0];

  const initialsOf = (n?: string | null) =>
    (n || "?")
      .split(" ")
      .map((x) => x[0])
      .join("")
      .slice(0, 2)
      .toUpperCase();

  // Anillo de progreso del día (sesiones realizadas / total)
  const DayRing = ({ done, total, size = 76, onDark = false }: { done: number; total: number; size?: number; onDark?: boolean }) => {
    const pct = total > 0 ? Math.min(1, done / total) : 0;
    const r = 30;
    const c = 2 * Math.PI * r;
    return (
      <div className="relative shrink-0" style={{ width: size, height: size }}>
        <svg viewBox="0 0 72 72" className="-rotate-90" style={{ width: size, height: size }}>
          <circle cx="36" cy="36" r={r} fill="none" strokeWidth="5.5" className={onDark ? "stroke-white/15" : "stroke-muted"} />
          <circle
            cx="36" cy="36" r={r} fill="none" strokeWidth="5.5" strokeLinecap="round"
            className={onDark ? "stroke-[#34d399] transition-[stroke-dashoffset] duration-700" : "stroke-primary transition-[stroke-dashoffset] duration-700"}
            strokeDasharray={c} strokeDashoffset={c * (1 - pct)}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className={`font-bold tabular-nums leading-none ${size >= 90 ? "text-2xl" : "text-lg"} ${onDark ? "text-white" : ""}`}>{done}</span>
          <span className={`text-[9px] font-medium mt-0.5 ${onDark ? "text-white/50" : "text-muted-foreground"}`}>de {total}</span>
        </div>
      </div>
    );
  };

  // Mini-barras para los KPIs (serie normalizada 0..1)
  const SparkBars = ({ data, accent = false }: { data: number[]; accent?: boolean }) => (
    <div className="flex items-end gap-[3px] h-8" aria-hidden>
      {data.map((v, i) => (
        <span
          key={i}
          className={`w-[5px] rounded-full ${
            i === data.length - 1 ? (accent ? "bg-primary" : "bg-foreground/60") : accent ? "bg-primary/25" : "bg-foreground/15"
          }`}
          style={{ height: `${Math.max(14, v * 100)}%` }}
        />
      ))}
    </div>
  );

  const modalityChip = (m: string | null) =>
    m ? (
      <span className="inline-flex items-center gap-1">
        {m === "online" ? <Video className="h-3.5 w-3.5" /> : <MapPin className="h-3.5 w-3.5" />}
        {m === "online" ? "Online" : "Presencial"}
      </span>
    ) : null;

  // ── Acciones rápidas de una sesión (hero) ──
  const SessionActions = ({ apt, onDark = false }: { apt: Appointment; onDark?: boolean }) => {
    const payment = paymentForAppointment(apt.id);
    const cls = onDark
      ? "rounded-xl gap-1.5 h-9 border-white/15 bg-white/[0.08] text-white hover:bg-white/[0.18] hover:text-white"
      : "rounded-xl gap-1.5 h-9";
    return (
      <div className="flex items-center gap-2 flex-wrap">
        {apt.patient_id && (
          <Button size="sm" variant="outline" className={cls} onClick={() => navigate(`/patients/${apt.patient_id}`)}>
            <User className="h-4 w-4" /> Ver ficha
          </Button>
        )}
        {apt.patients?.whatsapp_phone && (
          <Button
            size="sm"
            variant="outline"
            className={cls}
            onClick={() =>
              openWhatsApp(
                apt.patients!.whatsapp_phone!,
                `Hola ${firstName(apt.patients?.full_name)}! Te escribo por tu sesión de hoy a las ${format(new Date(apt.start_at), "HH:mm")} hs.`,
              )
            }
          >
            <MessageCircle className="h-4 w-4" /> WhatsApp
          </Button>
        )}
        {apt.patient_id && !notedAppointmentIds.has(apt.id) && (
          <Button size="sm" variant="outline" className={cls} onClick={() => navigate(`/patients/${apt.patient_id}`)}>
            <StickyNote className="h-4 w-4" /> Escribir nota
          </Button>
        )}
        {payment && (
          <PaymentLinkMenu
            patientPhone={payment.patientPhone || apt.patients?.whatsapp_phone || null}
            patientName={payment.patientName || apt.patients?.full_name || ""}
            getPaymentLink={mpConnected ? () => createPaymentLink(businessId, [payment.id]) : undefined}
          />
        )}
      </div>
    );
  };

  // ── Fila de la línea del día ──
  const timelineRows = useMemo(() => {
    const rows: Array<
      | { kind: "apt"; apt: Appointment; state: "done" | "now" | "next" | "cancelled" }
      | { kind: "gap"; minutes: number; id: string }
    > = [];
    let lastEnd: number | null = null;
    for (const apt of todayAppts) {
      const s = new Date(apt.start_at).getTime();
      if (lastEnd !== null && !CANCELLED.includes(apt.status)) {
        const gapMin = Math.round((s - lastEnd) / 60000);
        if (gapMin >= 45) rows.push({ kind: "gap", minutes: gapMin, id: `gap-${apt.id}` });
      }
      const state = CANCELLED.includes(apt.status)
        ? "cancelled"
        : s <= nowTick && nowTick < endOf(apt)
        ? "now"
        : endOf(apt) <= nowTick
        ? "done"
        : "next";
      rows.push({ kind: "apt", apt, state });
      if (!CANCELLED.includes(apt.status)) lastEnd = endOf(apt);
    }
    return rows;
  }, [todayAppts, nowTick]);

  const formatGap = (min: number) => (min >= 60 ? `${Math.floor(min / 60)} h ${min % 60 ? `${min % 60} min` : ""}`.trim() : `${min} min`);

  const loading = professionalsLoading || dataLoading;

  if (loading) {
    return (
      <div className="dark min-h-screen p-10" style={{ background: "#070d0a" }}>
        <div className="max-w-screen-2xl mx-auto space-y-8">
          <Skeleton className="h-20 w-full rounded-2xl" />
          <div className="grid grid-cols-[1fr_400px] gap-6">
            <div className="space-y-6">
              <Skeleton className="h-52 rounded-2xl" />
              <Skeleton className="h-80 rounded-2xl" />
            </div>
            <Skeleton className="h-[500px] rounded-2xl" />
          </div>
        </div>
      </div>
    );
  }

  const tomorrowIso = format(addDays(new Date(nowTick), 1), "yyyy-MM-dd");
  const tomorrowFirst = upcomingAppointments.find((a) => isTomorrow(new Date(a.start_at)));

  return (
    <div
      className="dark min-h-screen"
      style={{ background: "#070d0a", fontFamily: "'Instrument Sans', 'Plus Jakarta Sans', sans-serif" }}
    >
      <style>{`
        @keyframes dashDrift {
          0%, 100% { transform: translate(0, 0) scale(1); }
          50% { transform: translate(40px, -30px) scale(1.15); }
        }
        @media (prefers-reduced-motion: reduce) {
          .dash-glow { animation: none !important; }
        }
      `}</style>
      {/* ══════════ BANDA HERO: el cockpit del día ══════════ */}
      <section className="relative overflow-hidden text-white" style={{ borderBottom: "1px solid rgba(140,200,170,0.12)" }}>
        <div
          className="absolute inset-0"
          style={{ background: "linear-gradient(160deg, #0e1d15, #0a1410 55%, #081009)" }}
        />
        <div
          className="dash-glow absolute -top-32 right-[8%] w-[560px] h-[420px] pointer-events-none rounded-full"
          style={{
            background: "radial-gradient(ellipse at center, rgba(52,211,153,0.22), transparent 65%)",
            filter: "blur(10px)",
            animation: "dashDrift 14s ease-in-out infinite",
          }}
        />
        <div
          className="dash-glow absolute -bottom-40 -left-24 w-[440px] h-[360px] pointer-events-none rounded-full"
          style={{
            background: "radial-gradient(ellipse at center, rgba(20,184,166,0.14), transparent 65%)",
            filter: "blur(10px)",
            animation: "dashDrift 18s ease-in-out infinite reverse",
          }}
        />

        <div className="relative max-w-screen-2xl mx-auto px-10 pt-7 pb-16">
          {/* Fila superior: marca · fecha/reloj · acciones */}
          <div className="flex items-center justify-between gap-6">
            <div className="flex items-center gap-4 min-w-0">
              {brandLogoUrl ? (
                <img src={brandLogoUrl} alt="Logo" className="h-12 w-12 rounded-xl object-cover ring-2 ring-white/20" />
              ) : (
                <div className="h-12 w-12 rounded-xl bg-white/10 ring-2 ring-white/15 flex items-center justify-center">
                  <Building2 className="h-6 w-6 text-[#34d399]" />
                </div>
              )}
              <div className="min-w-0">
                <p className="text-white/55 text-xs font-medium">
                  {getGreeting()}, {userName.split(" ")[0]} 👋
                </p>
                <h1 className="text-lg font-bold tracking-tight leading-tight truncate">{businessName}</h1>
              </div>
            </div>
            <div className="hidden lg:flex items-center gap-3 text-right">
              <div>
                <p className="text-sm font-semibold capitalize text-white/85">
                  {format(new Date(nowTick), "EEEE d 'de' MMMM", { locale: es })}
                </p>
                <p className="text-[11px] text-white/45">Consultorio Digital</p>
              </div>
              <div className="text-4xl font-extrabold tabular-nums tracking-tight pl-3 border-l border-white/15" style={GROTESK}>
                {format(new Date(nowTick), "HH:mm")}
              </div>
            </div>
            <div className="flex items-center gap-3 shrink-0">
              {professionals.length > 1 && (
                <Select value={selectedProfessionalId} onValueChange={setSelectedProfessionalId}>
                  <SelectTrigger className="w-[180px] h-10 rounded-xl border-white/15 bg-white/[0.07] text-white">
                    <SelectValue placeholder="Todos" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos los profesionales</SelectItem>
                    {professionals.map((prof) => (
                      <SelectItem key={prof.id} value={prof.userId}>
                        <div className="flex items-center gap-2">
                          <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: prof.color || "#00b5b5" }} />
                          {prof.name}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              <button
                className="h-10 px-5 inline-flex items-center gap-2 rounded-xl font-semibold text-sm transition hover:brightness-110 active:scale-[0.98]"
                style={{
                  background: "linear-gradient(135deg, #34d399, #14b8a6)",
                  color: "#04150d",
                  boxShadow: "0 8px 24px rgba(52,211,153,0.25)",
                }}
                onClick={() => navigate("/agenda")}
              >
                <CalendarDays className="h-4 w-4" />
                Ver agenda
              </button>
            </div>
          </div>

          {/* Marquesina: el estado del día, en grande */}
          <div className="mt-9 flex items-end justify-between gap-10 flex-wrap">
            <div className="min-w-0 flex-1">
              {currentSession ? (
                <>
                  <div className="flex items-center gap-2.5 mb-3">
                    <span className="relative flex h-3 w-3">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#34d399] opacity-60" />
                      <span className="relative inline-flex rounded-full h-3 w-3 bg-[#34d399]" />
                    </span>
                    <span className="text-xs font-bold tracking-[0.22em] text-[#34d399]">EN SESIÓN</span>
                    <span className="text-xs text-white/50">
                      hasta las {format(new Date(endOf(currentSession)), "HH:mm")} hs
                    </span>
                  </div>
                  <h2 className="text-[42px] leading-none font-extrabold tracking-tight truncate" style={GROTESK}>
                    {currentSession.patients?.full_name || "Sin paciente"}
                  </h2>
                  <p className="text-sm text-white/60 mt-3 flex items-center gap-2 flex-wrap">
                    {format(new Date(currentSession.start_at), "HH:mm")} – {format(new Date(endOf(currentSession)), "HH:mm")} hs
                    {currentSession.services?.name && <>· {currentSession.services.name}</>}
                    {modalityChip(currentSession.modality) && <>· {modalityChip(currentSession.modality)}</>}
                    {nextSession && (
                      <>· después {format(new Date(nextSession.start_at), "HH:mm")} con {firstName(nextSession.patients?.full_name)}</>
                    )}
                  </p>
                  <div className="mt-5">
                    <SessionActions apt={currentSession} onDark />
                  </div>
                </>
              ) : nextSession ? (
                <>
                  <p className="text-xs font-bold tracking-[0.22em] text-[#34d399] mb-3">PRÓXIMA SESIÓN</p>
                  <div className="flex items-baseline gap-4 flex-wrap">
                    <span className="text-[52px] leading-none font-extrabold tabular-nums tracking-tight" style={GROTESK}>
                      {format(new Date(nextSession.start_at), "HH:mm")}
                    </span>
                    <span className="text-xl font-semibold text-[#34d399]">
                      {formatCountdown(new Date(nextSession.start_at).getTime() - nowTick)}
                    </span>
                  </div>
                  <p className="text-xl font-bold mt-3 truncate">{nextSession.patients?.full_name || "Sin paciente"}</p>
                  <p className="text-sm text-white/60 mt-1 flex items-center gap-2 flex-wrap">
                    {nextSession.services?.name || "Sesión"}
                    {modalityChip(nextSession.modality) && <>· {modalityChip(nextSession.modality)}</>}
                  </p>
                  <div className="mt-5">
                    <SessionActions apt={nextSession} onDark />
                  </div>
                </>
              ) : activeToday.length > 0 ? (
                <>
                  <p className="text-xs font-bold tracking-[0.22em] text-[#34d399] mb-3 flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4" /> DÍA COMPLETADO
                  </p>
                  <div className="flex items-baseline gap-3 flex-wrap">
                    <span className="text-[52px] leading-none font-extrabold tabular-nums tracking-tight" style={GROTESK}>
                      {formatCurrency(collectedToday)}
                    </span>
                    <span className="text-sm text-white/55">cobrado hoy</span>
                  </div>
                  <p className="text-sm text-white/60 mt-3">
                    {activeToday.length} {activeToday.length === 1 ? "sesión realizada" : "sesiones realizadas"}
                    {tomorrowFirst
                      ? ` · mañana arrancás ${format(new Date(tomorrowFirst.start_at), "HH:mm")} hs con ${firstName(tomorrowFirst.patients?.full_name)}`
                      : " · mañana no tenés sesiones agendadas"}
                  </p>
                  <div className="mt-5">
                    <Button
                      variant="outline"
                      className="rounded-xl gap-2 h-9 border-white/15 bg-white/[0.08] text-white hover:bg-white/[0.18] hover:text-white"
                      onClick={() => navigate(`/agenda?date=${tomorrowIso}`)}
                    >
                      Ver el día de mañana <ArrowRight className="h-4 w-4" />
                    </Button>
                  </div>
                </>
              ) : (
                <>
                  <p className="text-xs font-bold tracking-[0.22em] text-[#34d399] mb-3" style={GROTESK}>
                    HOY LIBRE
                  </p>
                  <h2 className="text-[36px] leading-tight font-extrabold tracking-tight" style={GROTESK}>
                    Sin sesiones para hoy
                  </h2>
                  <p className="text-sm text-white/60 mt-2">
                    {upcomingAppointments.length > 0
                      ? `La próxima es ${format(new Date(upcomingAppointments[0].start_at), "EEEE d 'a las' HH:mm", { locale: es })} hs con ${firstName(upcomingAppointments[0].patients?.full_name)}.`
                      : "Aprovechá para compartir tu link de reservas y llenar la semana."}
                  </p>
                  <div className="mt-5 flex items-center gap-2 flex-wrap">
                    <Button
                      variant="outline"
                      className="rounded-xl gap-2 h-9 border-white/15 bg-white/[0.08] text-white hover:bg-white/[0.18] hover:text-white"
                      onClick={() => navigate("/agenda")}
                    >
                      <CalendarDays className="h-4 w-4" /> Ir a la agenda
                    </Button>
                    <Button
                      variant="outline"
                      className="rounded-xl gap-2 h-9 border-white/15 bg-white/[0.08] text-white hover:bg-white/[0.18] hover:text-white"
                      onClick={shareBookingLink}
                    >
                      <ArrowRight className="h-4 w-4 rotate-[-45deg]" /> Compartir link
                    </Button>
                  </div>
                </>
              )}
            </div>

            {/* Panel derecho de la banda: anillo + chips de vidrio */}
            <div className="flex items-center gap-7 shrink-0">
              <DayRing done={doneCount} total={Math.max(activeToday.length, 1)} size={104} onDark />
              <div className="space-y-2.5">
                {[
                  { label: "Cobrado hoy", value: formatCurrency(collectedToday) },
                  { label: "Pendientes", value: String(pendingCount) },
                  { label: "Citas esta semana", value: String(weekApptsCount) },
                ].map((c) => (
                  <div key={c.label} className="rounded-xl border border-white/10 bg-white/[0.06] backdrop-blur-sm px-4 py-2 min-w-[170px]">
                    <p className="text-[9px] font-semibold uppercase tracking-[0.14em] text-white/45" style={GROTESK}>{c.label}</p>
                    <p className="text-base font-bold tabular-nums" style={GROTESK}>{c.value}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ══════════ CUERPO: tarjetas montadas sobre la banda ══════════ */}
      <main className="relative z-10 max-w-screen-2xl mx-auto px-10 -mt-7 pb-10 space-y-6">
        <ActivationChecklist
          businessId={businessId}
          onAllDone={() => {
            if (!wasActivationCelebrated(businessId)) setShowActivationDone(true);
          }}
        />
        <ActivationCompleteModal businessId={businessId} open={showActivationDone} onClose={() => setShowActivationDone(false)} />

        <div className="grid grid-cols-1 xl:grid-cols-[1fr_400px] gap-6 items-start">
          {/* ── Columna principal ── */}
          <div className="space-y-6 min-w-0">
            {/* La línea del día */}
            <Card className="rounded-2xl shadow-[0_18px_50px_-24px_rgba(0,0,0,0.45)]">
              <CardContent className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-bold flex items-center gap-2.5">
                    <span className="h-8 w-8 rounded-xl bg-primary/10 flex items-center justify-center">
                      <Clock className="h-4 w-4 text-primary" />
                    </span>
                    La línea del día
                  </h3>
                  <span className="text-xs text-muted-foreground tabular-nums">
                    {doneCount} de {activeToday.length} realizadas
                  </span>
                </div>
                {todayAppts.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-border py-8 text-center space-y-3">
                    <p className="text-sm text-muted-foreground">Sin citas para hoy</p>
                    <div className="flex items-center justify-center gap-2 flex-wrap px-4">
                      <Button variant="outline" size="sm" className="rounded-xl gap-1.5 h-9" onClick={() => navigate("/agenda")}>
                        + Agendar cita
                      </Button>
                      <Button variant="outline" size="sm" className="rounded-xl gap-1.5 h-9" onClick={shareBookingLink}>
                        Compartir link de reservas
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="relative">
                    <div className="absolute left-[7px] top-2 bottom-2 w-px bg-border" aria-hidden />
                    <div className="space-y-1.5">
                      {timelineRows.map((row) =>
                        row.kind === "gap" ? (
                          <div key={row.id} className="relative pl-7 py-1">
                            <span className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground border border-dashed border-border rounded-full px-3 py-1">
                              <Clock className="h-3 w-3" /> {formatGap(row.minutes)} libre
                            </span>
                          </div>
                        ) : (
                          <div
                            key={row.apt.id}
                            role="button"
                            onClick={() => setSelectedApt(row.apt)}
                            className={`relative pl-7 py-2.5 pr-3 rounded-xl cursor-pointer transition-all hover:bg-muted/50 ${
                              row.state === "now"
                                ? "bg-primary/[0.07] ring-1 ring-primary/35 shadow-[0_10px_30px_-14px_hsl(var(--primary)/0.5)]"
                                : ""
                            } ${row.state === "cancelled" ? "opacity-45" : ""}`}
                          >
                            <span
                              className={`absolute left-[2px] top-1/2 -translate-y-1/2 w-[11px] h-[11px] rounded-full ring-4 ring-background ${
                                row.state === "done"
                                  ? "bg-emerald-500"
                                  : row.state === "now"
                                  ? "bg-primary"
                                  : row.state === "cancelled"
                                  ? "bg-muted-foreground/40"
                                  : "bg-primary/40"
                              }`}
                              aria-hidden
                            />
                            <div className="flex items-center justify-between gap-3">
                              <div className="flex items-center gap-3 min-w-0">
                                <span className="w-11 shrink-0">
                                  <span className={`block text-sm font-bold tabular-nums leading-tight ${row.state === "cancelled" ? "line-through" : ""}`}>
                                    {format(new Date(row.apt.start_at), "HH:mm")}
                                  </span>
                                  <span className="block text-[10px] text-muted-foreground tabular-nums leading-tight">
                                    {format(new Date(endOf(row.apt)), "HH:mm")}
                                  </span>
                                </span>
                                <div className="min-w-0">
                                  <p className="text-sm font-semibold truncate">
                                    {row.apt.patients?.full_name || "Sin paciente"}
                                  </p>
                                  <p className="text-[11px] text-muted-foreground truncate">
                                    {row.apt.services?.name || "Sesión"}
                                    {row.apt.modality && ` · ${row.apt.modality === "online" ? "Online" : "Presencial"}`}
                                  </p>
                                </div>
                              </div>
                              <div className="shrink-0">
                                {row.state === "done" && (
                                  <Badge className="text-[10px] bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30 hover:bg-emerald-500/15">
                                    Realizada
                                  </Badge>
                                )}
                                {row.state === "now" && <Badge className="text-[10px]">EN CURSO</Badge>}
                                {row.state === "next" && (
                                  <Badge variant="secondary" className="text-[10px] text-muted-foreground">
                                    {formatCountdown(new Date(row.apt.start_at).getTime() - nowTick)}
                                  </Badge>
                                )}
                                {row.state === "cancelled" && (
                                  <Badge variant="secondary" className="text-[10px] text-muted-foreground">
                                    Cancelada
                                  </Badge>
                                )}
                              </div>
                            </div>
                          </div>
                        ),
                      )}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Números con pulso */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {[
                {
                  icon: Wallet, label: "Cobrado hoy", value: formatCurrency(collectedToday), to: "/pagos",
                  cls: "text-emerald-600 dark:text-emerald-400", spark: null as number[] | null, accent: "from-emerald-500/50 via-emerald-500 to-emerald-500/50",
                },
                {
                  icon: Wallet, label: "Cobrado este mes", value: formatCurrency(collectedThisMonth), to: "/pagos",
                  cls: "", spark: collectedSpark, accent: "from-primary/50 via-primary to-primary/50",
                },
                {
                  icon: CalendarDays, label: "Citas esta semana", value: String(weekApptsCount), to: "/agenda",
                  cls: "", spark: citasSpark, accent: "from-primary/50 via-primary to-primary/50",
                },
                {
                  icon: AlertTriangle, label: "Vencido por reclamar",
                  value: overdueAmount > 0 ? formatCurrency(overdueAmount) : "—", to: "/pagos",
                  cls: overdueAmount > 0 ? "text-rose-600 dark:text-rose-400" : "text-muted-foreground",
                  spark: null, accent: overdueAmount > 0 ? "from-rose-500/50 via-rose-500 to-rose-500/50" : "from-border via-border to-border",
                },
              ].map((k) => (
                <Card
                  key={k.label}
                  onClick={() => navigate(k.to)}
                  className="relative overflow-hidden rounded-2xl cursor-pointer group hover:shadow-[0_14px_40px_-16px_rgba(0,0,0,0.35)] hover:-translate-y-0.5 transition-all duration-300"
                >
                  <div aria-hidden className={`absolute inset-x-0 top-0 h-[3px] bg-gradient-to-r ${k.accent}`} />
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                          <k.icon className="h-3.5 w-3.5" /> {k.label}
                        </p>
                        <p className={`text-[22px] font-bold tabular-nums tracking-tight mt-1.5 ${k.cls}`} style={GROTESK}>{k.value}</p>
                      </div>
                      {k.spark && <SparkBars data={k.spark} accent />}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>

          {/* ── Columna derecha: PARA HOY ── */}
          <div className="space-y-6">
            <Card className="relative overflow-hidden rounded-2xl shadow-[0_18px_50px_-24px_rgba(0,0,0,0.45)]">
              <div aria-hidden className="absolute inset-x-0 top-0 h-[3px] bg-gradient-to-r from-primary/50 via-primary to-primary/50" />
              <CardContent className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-bold flex items-center gap-2.5">
                    <span className="h-8 w-8 rounded-xl bg-primary/10 flex items-center justify-center">
                      <Inbox className="h-4 w-4 text-primary" />
                    </span>
                    Para hoy
                  </h3>
                  {pendingCount > 0 && (
                    <Badge variant="outline" className="text-[11px] text-amber-600 dark:text-amber-400 border-amber-500/40">
                      {pendingCount} pendiente{pendingCount !== 1 ? "s" : ""}
                    </Badge>
                  )}
                </div>

                {pendingCount === 0 ? (
                  <div className="py-10 text-center">
                    <Sparkles className="h-8 w-8 mx-auto mb-3 text-primary/50" />
                    <p className="text-sm font-semibold">Estás al día</p>
                    <p className="text-xs text-muted-foreground mt-1">Nada espera una acción tuya ahora mismo.</p>
                  </div>
                ) : (
                  <div className="space-y-5">
                    {pendingRequestsCount > 0 && (
                      <div>
                        <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1.5">
                          <Inbox className="h-3 w-3" /> Solicitudes
                        </p>
                        <button
                          onClick={() => navigate("/solicitudes")}
                          className="w-full text-left rounded-xl border border-amber-500/35 bg-amber-500/[0.07] hover:bg-amber-500/[0.13] transition-colors p-3.5 flex items-center gap-3"
                        >
                          <span className="relative flex h-2.5 w-2.5 shrink-0">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-500 opacity-60" />
                            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-amber-500" />
                          </span>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold">
                              {pendingRequestsCount} solicitud{pendingRequestsCount !== 1 ? "es" : ""} esperando
                            </p>
                            <p className="text-[11px] text-muted-foreground">Reservas y reprogramaciones por aprobar</p>
                          </div>
                          <ArrowRight className="h-4 w-4 text-muted-foreground shrink-0" />
                        </button>
                      </div>
                    )}

                    {(overduePayments.length > 0 || dueTodayPayments.length > 0) && (
                      <div>
                        <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1.5">
                          <Wallet className="h-3 w-3" /> Cobros por reclamar
                        </p>
                        <div className="space-y-2">
                          {overduePayments.slice(0, 4).map((p) => (
                            <div key={p.id} className="rounded-xl border border-rose-500/30 bg-rose-500/[0.05] p-3.5 flex items-center gap-3">
                              <AlertTriangle className="h-4 w-4 text-rose-500 shrink-0" />
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-semibold truncate">{p.patientName}</p>
                                <p className="text-[11px] text-muted-foreground">
                                  <b className="text-rose-600 dark:text-rose-400">{formatCurrency(p.amount)}</b> · venció el{" "}
                                  {format(new Date(p.due_date), "d MMM", { locale: es })}
                                </p>
                              </div>
                              <PaymentLinkMenu
                                patientPhone={p.patientPhone || null}
                                patientName={p.patientName || ""}
                                getPaymentLink={mpConnected ? () => createPaymentLink(businessId, [p.id]) : undefined}
                                compact
                              />
                            </div>
                          ))}
                          {dueTodayPayments.slice(0, 3).map((p) => (
                            <div key={p.id} className="rounded-xl border border-amber-500/30 bg-amber-500/[0.05] p-3.5 flex items-center gap-3">
                              <Wallet className="h-4 w-4 text-amber-500 shrink-0" />
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-semibold truncate">{p.patientName}</p>
                                <p className="text-[11px] text-muted-foreground">
                                  <b>{formatCurrency(p.amount)}</b> · vence hoy
                                </p>
                              </div>
                              <PaymentLinkMenu
                                patientPhone={p.patientPhone || null}
                                patientName={p.patientName || ""}
                                getPaymentLink={mpConnected ? () => createPaymentLink(businessId, [p.id]) : undefined}
                                compact
                              />
                            </div>
                          ))}
                          {overduePayments.length > 4 && (
                            <button onClick={() => navigate("/pagos")} className="w-full text-center text-xs font-medium text-primary hover:underline py-1">
                              Ver los {overduePayments.length} pagos vencidos →
                            </button>
                          )}
                        </div>
                      </div>
                    )}

                    {sessionsWithoutNote.length > 0 && (
                      <div>
                        <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1.5">
                          <StickyNote className="h-3 w-3" /> Notas clínicas sin escribir
                        </p>
                        <div className="space-y-2">
                          {sessionsWithoutNote.slice(0, 3).map((a) => (
                            <button
                              key={a.id}
                              onClick={() => a.patient_id && navigate(`/patients/${a.patient_id}`)}
                              className="w-full text-left rounded-xl border border-border hover:border-primary/40 hover:bg-primary/[0.03] transition-colors p-3.5 flex items-center gap-3"
                            >
                              <StickyNote className="h-4 w-4 text-primary shrink-0" />
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-semibold truncate">{a.patients?.full_name || "Sin paciente"}</p>
                                <p className="text-[11px] text-muted-foreground capitalize">
                                  sesión de {new Date(a.start_at).getTime() >= todayStart ? "hoy" : "ayer"} ·{" "}
                                  {format(new Date(a.start_at), "HH:mm")} hs · tocá para escribirla
                                </p>
                              </div>
                              <ArrowRight className="h-4 w-4 text-muted-foreground shrink-0" />
                            </button>
                          ))}
                          {sessionsWithoutNote.length > 3 && (
                            <p className="text-center text-[11px] text-muted-foreground">
                              y {sessionsWithoutNote.length - 3} más
                            </p>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Mañana, de reojo */}
            {(() => {
              const tomorrowList = upcomingAppointments.filter((a) => isTomorrow(new Date(a.start_at)));
              if (tomorrowList.length === 0) return null;
              return (
                <Card className="rounded-2xl">
                  <CardContent className="p-5">
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
                      <CalendarClock className="h-3.5 w-3.5" /> Mañana · {tomorrowList.length}{" "}
                      {tomorrowList.length === 1 ? "sesión" : "sesiones"}
                    </p>
                    <div className="space-y-2">
                      {tomorrowList.slice(0, 3).map((a) => (
                        <div
                          key={a.id}
                          role="button"
                          onClick={() => setSelectedApt(a)}
                          className="flex items-center gap-3 text-sm rounded-lg px-1 py-0.5 -mx-1 cursor-pointer hover:bg-muted/50 transition-colors"
                        >
                          <span className="font-bold tabular-nums text-muted-foreground w-11">
                            {format(new Date(a.start_at), "HH:mm")}
                          </span>
                          <span className="truncate">{a.patients?.full_name || "Sin paciente"}</span>
                        </div>
                      ))}
                      {tomorrowList.length > 3 && (
                        <p className="text-[11px] text-muted-foreground pl-14">y {tomorrowList.length - 3} más</p>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })()}

            {/* Pacientes activos, chiquito */}
            <Card onClick={() => navigate("/patients")} className="rounded-2xl cursor-pointer hover:shadow-md transition-all">
              <CardContent className="p-5 flex items-center justify-between">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                  <Users className="h-3.5 w-3.5" /> Pacientes activos
                </p>
                <p className="text-lg font-bold tabular-nums">{activePatientsCount}</p>
              </CardContent>
            </Card>

            {/* Link público, discreto al final */}
            <PublicLinkCard businessId={businessId} />
          </div>
        </div>

        {/* Detalle de la cita: cobrar, reprogramar, cancelar — sin salir del dashboard */}
        <AppointmentDetailModal
          appointment={selectedApt as any}
          open={!!selectedApt}
          onClose={() => setSelectedApt(null)}
          businessId={businessId}
          onPaymentRegistered={() => fetchDashboardData(true)}
        />
      </main>
    </div>
  );
};
