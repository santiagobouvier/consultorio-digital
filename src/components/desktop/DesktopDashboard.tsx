// Desktop Dashboard - v2
import { useState, useEffect, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useProfessionals } from "@/hooks/use-professionals";
import { calculatePaymentStatus, formatCurrency } from "@/lib/payments";
import { format, startOfMonth, endOfMonth, addDays, isToday, isTomorrow } from "date-fns";
import { es } from "date-fns/locale";
import { toast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { MonthlyHighlights } from "@/components/MonthlyHighlights";
import { ActivationChecklist } from "@/components/ActivationChecklist";
import { PublicLinkCard } from "@/components/PublicLinkCard";
import {
  ActivationCompleteModal,
  wasActivationCelebrated,
} from "@/components/ActivationCompleteModal";
import { HelpTooltip } from "@/components/HelpTooltip";
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
  CreditCard,
  AlertTriangle,
  Clock,
  Plus,
  ArrowRight,
  DollarSign,
  UserPlus,
  TrendingUp,
  Building2,
  CalendarCheck,
  AlertCircle,
  Eye,
  FileText,
  CheckCircle2,
} from "lucide-react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip as ChartTooltip,
} from "recharts";

interface Appointment {
  id: string;
  start_at: string;
  status: string;
  patient_id: string | null;
  professional_id: string | null;
  patients: { full_name: string } | null;
  services: { name: string } | null;
}

interface Payment {
  id: string;
  patient_id: string;
  due_date: string;
  paid_at: string | null;
  status: string;
  amount: number;
  patientName?: string;
  calculatedStatus?: string;
}

interface ActiveAgendaEntry {
  id: string;
  name: string;
  color?: string;
  appointmentCount: number;
  attendedCount: number;
  isUnassigned?: boolean;
}

interface DesktopDashboardProps {
  businessId: string;
  userName: string;
}

export const DesktopDashboard = ({ businessId, userName: propUserName }: DesktopDashboardProps) => {
  const navigate = useNavigate();
  const { professionals, loading: professionalsLoading, isOwner } = useProfessionals(businessId);
  const { logoUrl: brandLogoUrl } = useDashboardBranding();
  const pendingRequestsCount = usePendingRequestsCount();

  // Data state
  const [businessName, setBusinessName] = useState("");
  const [isDemo, setIsDemo] = useState(false);
  const [selectedProfessionalId, setSelectedProfessionalId] = useState<string>("all");
  
  // KPIs
  const [todayAppointmentsCount, setTodayAppointmentsCount] = useState(0);
  const [activePatientsCount, setActivePatientsCount] = useState(0);
  const [collectedThisMonth, setCollectedThisMonth] = useState(0);
  const [overduePaymentsCount, setOverduePaymentsCount] = useState(0);
  const [overdueAmount, setOverdueAmount] = useState(0);
  
  // Lists
  const [upcomingAppointments, setUpcomingAppointments] = useState<Appointment[]>([]);
  const [pendingPayments, setPendingPayments] = useState<Payment[]>([]);
  const [todayAppointments, setTodayAppointments] = useState<(Appointment & { end_at?: string | null })[]>([]);
  // Series para mini-gráficos y el gráfico del mes
  const [paidRecent, setPaidRecent] = useState<Array<{ amount: number; paid_at: string }>>([]);
  const [apptsRecent, setApptsRecent] = useState<Array<{ start_at: string }>>([]);
  
  const [dataLoading, setDataLoading] = useState(true);
  const [showActivationDone, setShowActivationDone] = useState(false);

  const userName = propUserName;

  const fetchDashboardData = useCallback(async () => {
    if (!businessId) return;

    try {
      setDataLoading(true);

      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);
      const dayAfterTomorrow = addDays(today, 2);
      const monthStart = startOfMonth(new Date());
      const monthEnd = endOfMonth(new Date());

      // ── Parallelizar todas las consultas independientes ──
      const last35 = addDays(today, -35);
      const last42 = addDays(today, -42);

      const [
        businessRes,
        todayApptsRes,
        upcomingApptsRes,
        patientsCountRes,
        paidPaymentsRes,
        pendingPaymentsRes,
        paidRecentRes,
        apptsRecentRes,
      ] = await Promise.all([
        supabase.from("businesses").select("name, is_demo").eq("id", businessId).single(),
        supabase.from("appointments").select(`id, start_at, end_at, status, patient_id, professional_id, patients (full_name), services (name)`, { count: 'exact' }).eq("business_id", businessId).gte("start_at", today.toISOString()).lt("start_at", tomorrow.toISOString()).not("status", "in", '("cancelled")').order("start_at", { ascending: true }),
        supabase.from("appointments").select(`id, start_at, status, patient_id, professional_id, patients (full_name), services (name)`).eq("business_id", businessId).gte("start_at", new Date().toISOString()).lt("start_at", dayAfterTomorrow.toISOString()).not("status", "in", '("cancelled","attended")').order("start_at", { ascending: true }).limit(5),
        supabase.from("patients").select("id", { count: 'exact', head: true }).eq("business_id", businessId).eq("is_active", true),
        supabase.from("payments").select("amount").eq("business_id", businessId).not("paid_at", "is", null).gte("paid_at", monthStart.toISOString()).lte("paid_at", monthEnd.toISOString()),
        supabase.from("payments").select("id, patient_id, due_date, paid_at, status, amount").eq("business_id", businessId).neq("status", "cancelled").is("paid_at", null),
        // Series livianas para mini-gráficos y el gráfico del mes
        (supabase as any).from("payments").select("amount, paid_at").eq("business_id", businessId).not("paid_at", "is", null).gte("paid_at", last35.toISOString()),
        (supabase as any).from("appointments").select("start_at").eq("business_id", businessId).gte("start_at", last42.toISOString()).lt("start_at", tomorrow.toISOString()).not("status", "in", '("cancelled")'),
      ]);

      // Process results
      if (businessRes.data) {
        setBusinessName(businessRes.data.name);
        setIsDemo(businessRes.data.is_demo || false);
      }

      setTodayAppointmentsCount(todayApptsRes.count || 0);
      setTodayAppointments((todayApptsRes.data || []) as any);
      setUpcomingAppointments(upcomingApptsRes.data || []);
      setActivePatientsCount(patientsCountRes.count || 0);
      setCollectedThisMonth(paidPaymentsRes.data?.reduce((sum, p) => sum + (p.amount || 0), 0) || 0);
      setPaidRecent(((paidRecentRes as any).data || []) as Array<{ amount: number; paid_at: string }>);
      setApptsRecent(((apptsRecentRes as any).data || []) as Array<{ start_at: string }>);

      // Process pending payments
      const payments = pendingPaymentsRes.data;
      if (payments && payments.length > 0) {
        const patientIds = [...new Set(payments.map(p => p.patient_id))];
        const { data: patients } = await supabase
          .from("patients")
          .select("id, full_name")
          .in("id", patientIds);

        const patientMap = new Map(patients?.map(p => [p.id, p.full_name]) || []);

        const paymentsWithNames = payments.map(p => ({
          ...p,
          patientName: patientMap.get(p.patient_id) || "Desconocido",
          calculatedStatus: calculatePaymentStatus(p),
        }));

        setPendingPayments(paymentsWithNames);

        const overdue = paymentsWithNames.filter(p => p.calculatedStatus === "overdue");
        setOverduePaymentsCount(overdue.length);
        setOverdueAmount(overdue.reduce((sum, p) => sum + (p.amount || 0), 0));
      } else {
        setPendingPayments([]);
        setOverduePaymentsCount(0);
        setOverdueAmount(0);
      }
    } catch (error) {
      console.error("Error fetching dashboard data:", error);
      toast({
        title: "Error",
        description: "No se pudo cargar la información",
        variant: "destructive",
      });
    } finally {
      setDataLoading(false);
    }
  }, [businessId]);

  useEffect(() => {
    if (businessId) {
      fetchDashboardData();
    }
  }, [businessId, fetchDashboardData]);

  // Active professionals today
  const activeProfessionalsToday = useMemo<ActiveAgendaEntry[]>(() => {
    const grouped = new Map<string, ActiveAgendaEntry>();

    todayAppointments.forEach((appointment) => {
      const professional = professionals.find((p) => p.userId === appointment.professional_id);
      const key = professional?.id ?? "unassigned";
      const current = grouped.get(key) ?? {
        id: key,
        name: professional?.name ?? "Sin asignar",
        color: professional?.color,
        appointmentCount: 0,
        attendedCount: 0,
        isUnassigned: !professional,
      };

      current.appointmentCount += 1;
      if (appointment.status === "attended") {
        current.attendedCount += 1;
      }

      grouped.set(key, current);
    });

    return Array.from(grouped.values());
  }, [todayAppointments, professionals]);

  // Agenda occupation (% of day with appointments)
  const agendaOccupation = useMemo(() => {
    const totalSlots = 8; // assume 8 hour work day
    const occupiedSlots = todayAppointmentsCount;
    return Math.min(Math.round((occupiedSlots / totalSlots) * 100), 100);
  }, [todayAppointmentsCount]);

  // ── Línea de tiempo de HOY: bloques posicionados sobre una regla horaria ──
  const timeline = useMemo(() => {
    const valid = todayAppointments.filter((a) => a.status !== "cancelled");
    let startHour = 8;
    let endHour = 20;
    for (const a of valid) {
      const s = new Date(a.start_at);
      const e = a.end_at ? new Date(a.end_at) : new Date(s.getTime() + 60 * 60000);
      startHour = Math.min(startHour, s.getHours());
      endHour = Math.max(endHour, e.getMinutes() > 0 ? e.getHours() + 1 : e.getHours());
    }
    const totalMin = (endHour - startHour) * 60;
    const toPct = (d: Date) =>
      Math.max(0, Math.min(100, (((d.getHours() - startHour) * 60 + d.getMinutes()) / totalMin) * 100));

    const blocks = valid.map((a) => {
      const s = new Date(a.start_at);
      const e = a.end_at ? new Date(a.end_at) : new Date(s.getTime() + 60 * 60000);
      const prof = professionals.find((p) => p.userId === a.professional_id);
      return {
        id: a.id,
        left: toPct(s),
        width: Math.max(3.5, toPct(e) - toPct(s)),
        time: format(s, "HH:mm"),
        name: (a.patients?.full_name || "Sin paciente").split(" ")[0],
        service: a.services?.name || null,
        attended: a.status === "attended",
        past: e.getTime() < Date.now(),
        color: prof?.color || null,
      };
    });

    const now = new Date();
    const nowPct =
      now.getHours() >= startHour && now.getHours() < endHour ? toPct(now) : null;
    const hours: number[] = [];
    for (let h = startHour; h <= endHour; h += 2) hours.push(h);

    const next = blocks.find((b) => !b.past && !b.attended);
    return { blocks, nowPct, hours, startHour, endHour, next };
  }, [todayAppointments, professionals]);

  // ── Mini-series de los KPIs ──
  const collectedSpark = useMemo(() => {
    const days = 14;
    const byDay = new Map<string, number>();
    for (const p of paidRecent) {
      const k = new Date(p.paid_at).toDateString();
      byDay.set(k, (byDay.get(k) || 0) + (p.amount || 0));
    }
    const out: number[] = [];
    for (let i = days - 1; i >= 0; i--) {
      const d = addDays(new Date(), -i);
      out.push(byDay.get(d.toDateString()) || 0);
    }
    const max = Math.max(...out, 1);
    return out.map((v) => v / max);
  }, [paidRecent]);

  const citasSpark = useMemo(() => {
    const weeks = 6;
    const counts = new Array(weeks).fill(0);
    const now = Date.now();
    for (const a of apptsRecent) {
      const diffDays = Math.floor((now - new Date(a.start_at).getTime()) / 86400000);
      const w = weeks - 1 - Math.floor(diffDays / 7);
      if (w >= 0 && w < weeks) counts[w]++;
    }
    const max = Math.max(...counts, 1);
    return counts.map((v) => v / max);
  }, [apptsRecent]);

  // ── Gráfico del mes: cobrado acumulado + proyección (por cobrar) ──
  const monthChart = useMemo(() => {
    const now = new Date();
    const todayDay = now.getDate();
    const daysInMonth = endOfMonth(now).getDate();
    const monthIdx = now.getMonth();
    const year = now.getFullYear();

    const paidByDay = new Array(daysInMonth + 1).fill(0);
    for (const p of paidRecent) {
      const d = new Date(p.paid_at);
      if (d.getMonth() === monthIdx && d.getFullYear() === year) {
        paidByDay[d.getDate()] += p.amount || 0;
      }
    }
    const pendingByDay = new Array(daysInMonth + 1).fill(0);
    for (const p of pendingPayments) {
      if (p.paid_at) continue;
      const d = new Date(p.due_date);
      if (d.getMonth() === monthIdx && d.getFullYear() === year) {
        // Vencidos de días pasados: se proyectan como cobrables desde hoy
        pendingByDay[Math.max(d.getDate(), todayDay)] += p.amount || 0;
      }
    }

    // Cobrado acumulado hasta hoy; desde hoy, proyección = cobrado de hoy +
    // pendientes acumulados según su vencimiento.
    const data: Array<{ day: number; cobrado: number | null; proyeccion: number | null }> = [];
    let cum = 0;
    for (let d = 1; d <= todayDay; d++) cum += paidByDay[d];
    const cobradoHoy = cum;

    let running = 0;
    let projCum = 0;
    for (let d = 1; d <= daysInMonth; d++) {
      running += paidByDay[d];
      let proyeccion: number | null = null;
      if (d >= todayDay) {
        projCum += pendingByDay[d];
        proyeccion = cobradoHoy + projCum;
      }
      data.push({ day: d, cobrado: d <= todayDay ? running : null, proyeccion });
    }
    const projectedTotal = data[daysInMonth - 1]?.proyeccion ?? cobradoHoy;
    return { data, projectedTotal };
  }, [paidRecent, pendingPayments]);

  // ── "Requiere tu atención": alertas unificadas y priorizadas ──
  const overdueTop = useMemo(
    () =>
      pendingPayments
        .filter((p) => p.calculatedStatus === "overdue")
        .sort((a, b) => (b.amount || 0) - (a.amount || 0))
        .slice(0, 3),
    [pendingPayments],
  );

  const tomorrowUnconfirmed = useMemo(
    () =>
      upcomingAppointments.filter(
        (a) => isTomorrow(new Date(a.start_at)) && (a.status === "pending" || a.status === "scheduled"),
      ),
    [upcomingAppointments],
  );

  const attentionCount =
    (pendingRequestsCount > 0 ? 1 : 0) +
    (overduePaymentsCount > 0 ? 1 : 0) +
    (tomorrowUnconfirmed.length > 0 ? 1 : 0);

  const formatTime = (datetime: string) => {
    return format(new Date(datetime), "HH:mm", { locale: es });
  };

  const getDateLabel = (datetime: string) => {
    const date = new Date(datetime);
    if (isToday(date)) return "Hoy";
    if (isTomorrow(date)) return "Mañana";
    return format(date, "EEE d", { locale: es });
  };

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return "Buenos días";
    if (hour < 19) return "Buenas tardes";
    return "Buenas noches";
  };

  const loading = professionalsLoading;

  if (loading || dataLoading) {
    return (
      <div className="min-h-screen bg-background p-10">
        <div className="max-w-[1400px] mx-auto space-y-10">
          <Skeleton className="h-24 w-full rounded-2xl" />
          <div className="grid grid-cols-4 gap-6">
            {[...Array(4)].map((_, i) => (
              <Skeleton key={i} className="h-36 rounded-2xl" />
            ))}
          </div>
          <div className="grid grid-cols-2 gap-8">
            <Skeleton className="h-96 rounded-2xl" />
            <Skeleton className="h-96 rounded-2xl" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/30">
      {/* Header Superior: hero con la marca del consultorio */}
      <header className="relative overflow-hidden border-b border-border/50">
        <div className="absolute inset-0 bg-card/50 backdrop-blur-sm" />
        {/* Degradado de marca, sutil, que se funde con el fondo */}
        <div
          className="absolute -top-28 -left-20 w-[520px] h-[340px] pointer-events-none"
          style={{ background: "radial-gradient(ellipse at center, hsl(var(--primary) / 0.16), transparent 70%)" }}
        />
        <div
          className="absolute -top-24 left-[38%] w-[420px] h-[280px] pointer-events-none"
          style={{ background: "radial-gradient(ellipse at center, hsl(var(--primary) / 0.07), transparent 70%)" }}
        />
        <div className="relative max-w-[1400px] mx-auto px-10 py-7">
          <div className="flex items-center justify-between">
            {/* Left: Logo del consultorio + saludo + nombre + fecha */}
            <div className="flex items-center gap-5">
              {brandLogoUrl ? (
                <img
                  src={brandLogoUrl}
                  alt="Logo"
                  className="h-16 w-16 rounded-2xl object-cover ring-2 ring-primary/25"
                  style={{ boxShadow: "0 10px 34px -8px hsl(var(--primary) / 0.45)" }}
                />
              ) : (
                <div
                  className="h-16 w-16 rounded-2xl bg-primary/10 ring-2 ring-primary/25 flex items-center justify-center"
                  style={{ boxShadow: "0 10px 34px -8px hsl(var(--primary) / 0.35)" }}
                >
                  <Building2 className="h-8 w-8 text-primary" />
                </div>
              )}
              <div>
                <p className="text-muted-foreground text-sm font-medium">
                  {getGreeting()}, {userName.split(" ")[0]}
                </p>
                <h1 className="text-3xl font-bold text-foreground tracking-tight leading-tight">
                  {businessName}
                </h1>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {(() => {
                    const d = format(new Date(), "EEEE d 'de' MMMM", { locale: es });
                    return d.charAt(0).toUpperCase() + d.slice(1);
                  })()}
                </p>
              </div>
            </div>

            {/* Center: Professional Selector (if multiple) */}
            {professionals.length > 1 && (
              <div className="flex items-center gap-3">
                <span className="text-sm text-muted-foreground">Ver como:</span>
                <Select value={selectedProfessionalId} onValueChange={setSelectedProfessionalId}>
                  <SelectTrigger className="w-[200px] h-11">
                    <SelectValue placeholder="Todos los profesionales" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos los profesionales</SelectItem>
                    {professionals.map((prof) => (
                      <SelectItem key={prof.id} value={prof.userId}>
                        <div className="flex items-center gap-2">
                          <div
                            className="w-2.5 h-2.5 rounded-full"
                            style={{ backgroundColor: prof.color || "#00b5b5" }}
                          />
                          {prof.name}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Right: aviso de solicitudes + CTA principal */}
            <div className="flex items-center gap-3">
              {pendingRequestsCount > 0 && (
                <button
                  onClick={() => navigate("/solicitudes")}
                  className="flex items-center gap-2 h-11 px-4 rounded-full border border-amber-500/40 bg-amber-500/10 text-amber-600 dark:text-amber-400 hover:bg-amber-500/20 transition-colors"
                >
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-500 opacity-60" />
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500" />
                  </span>
                  <span className="text-sm font-semibold">
                    {pendingRequestsCount} solicitud{pendingRequestsCount !== 1 ? "es" : ""} esperando
                  </span>
                </button>
              )}
              <Button
                size="lg"
                className="h-12 px-8 gap-3 text-base font-semibold shadow-lg shadow-primary/20 hover:shadow-xl hover:shadow-primary/30 transition-all"
                onClick={() => navigate("/agenda")}
              >
                <CalendarDays className="h-5 w-5" />
                Ver agenda
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-[1400px] mx-auto px-10 py-10 space-y-10">
        <ActivationChecklist
          businessId={businessId}
          onAllDone={() => {
            if (!wasActivationCelebrated(businessId)) {
              setShowActivationDone(true);
            }
          }}
        />
        <ActivationCompleteModal
          businessId={businessId}
          open={showActivationDone}
          onClose={() => setShowActivationDone(false)}
        />

        {/* Link de la web pública — siempre a mano */}
        <PublicLinkCard businessId={businessId} />

        {/* KPIs Row - 4 Large Cards (cada una lleva a su módulo) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {/* Citas hoy */}
          <Card onClick={() => navigate("/agenda")} className="cursor-pointer relative overflow-hidden group p-6 rounded-2xl border border-border/60 bg-card shadow-[0_1px_3px_rgba(0,0,0,0.04),0_8px_24px_-12px_rgba(0,0,0,0.08)] hover:shadow-[0_2px_6px_rgba(0,0,0,0.06),0_16px_40px_-16px_rgba(0,165,160,0.18)] hover:-translate-y-0.5 transition-all duration-300">
            <div aria-hidden className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-primary/70 via-primary to-primary/70" />
            <div className="absolute -top-10 -right-10 w-40 h-40 bg-primary/5 rounded-full blur-2xl group-hover:bg-primary/10 transition-colors" />
            <div className="relative">
              <div className="flex items-start justify-between mb-5">
                <div className="h-12 w-12 rounded-2xl bg-primary/10 ring-1 ring-primary/15 flex items-center justify-center">
                  <CalendarCheck className="h-6 w-6 text-primary" />
                </div>
                {/* Mini-barras: citas por semana (últimas 6) */}
                <div className="flex items-end gap-1 h-9" aria-hidden>
                  {citasSpark.map((v, i) => (
                    <span
                      key={i}
                      className={`w-1.5 rounded-full ${i === citasSpark.length - 1 ? "bg-primary" : "bg-primary/25"}`}
                      style={{ height: `${Math.max(12, v * 100)}%` }}
                    />
                  ))}
                </div>
              </div>
              <p className="text-[2.5rem] leading-none font-bold text-foreground tracking-tight tabular-nums">
                {todayAppointmentsCount}
              </p>
              <p className="text-sm font-medium text-muted-foreground mt-3 inline-flex items-center gap-1">
                Citas hoy
                <HelpTooltip id="dashboardTodayAppointments" />
              </p>
            </div>
          </Card>

          {/* Pacientes activos */}
          <Card onClick={() => navigate("/patients")} className="cursor-pointer relative overflow-hidden group p-6 rounded-2xl border border-border/60 bg-card shadow-[0_1px_3px_rgba(0,0,0,0.04),0_8px_24px_-12px_rgba(0,0,0,0.08)] hover:shadow-[0_2px_6px_rgba(0,0,0,0.06),0_16px_40px_-16px_rgba(0,0,0,0.12)] hover:-translate-y-0.5 transition-all duration-300">
            <div aria-hidden className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-secondary-foreground/30 via-secondary-foreground/50 to-secondary-foreground/30" />
            <div className="absolute -top-10 -right-10 w-40 h-40 bg-secondary/60 rounded-full blur-2xl group-hover:bg-secondary transition-colors" />
            <div className="relative">
              <div className="flex items-center justify-between mb-5">
                <div className="h-12 w-12 rounded-2xl bg-secondary ring-1 ring-secondary-foreground/10 flex items-center justify-center">
                  <Users className="h-6 w-6 text-secondary-foreground" />
                </div>
              </div>
              <p className="text-[2.5rem] leading-none font-bold text-foreground tracking-tight tabular-nums">
                {activePatientsCount}
              </p>
              <p className="text-sm font-medium text-muted-foreground mt-3 inline-flex items-center gap-1">
                Pacientes activos
                <HelpTooltip id="dashboardActivePatients" />
              </p>
            </div>
          </Card>

          {/* Cobrado este mes */}
          <Card onClick={() => navigate("/pagos?status=paid&period=this_month")} className="cursor-pointer relative overflow-hidden group p-6 rounded-2xl border border-border/60 bg-card shadow-[0_1px_3px_rgba(0,0,0,0.04),0_8px_24px_-12px_rgba(0,0,0,0.08)] hover:shadow-[0_2px_6px_rgba(0,0,0,0.06),0_16px_40px_-16px_rgba(34,197,94,0.18)] hover:-translate-y-0.5 transition-all duration-300">
            <div aria-hidden className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-green-500/60 via-green-500 to-green-500/60" />
            <div className="absolute -top-10 -right-10 w-40 h-40 bg-green-500/10 rounded-full blur-2xl group-hover:bg-green-500/15 transition-colors" />
            <div className="relative">
              <div className="flex items-start justify-between mb-5">
                <div className="h-12 w-12 rounded-2xl bg-green-500/10 ring-1 ring-green-500/20 flex items-center justify-center">
                  <TrendingUp className="h-6 w-6 text-green-600" />
                </div>
                {/* Mini-barras: cobrado por día (últimos 14) */}
                <div className="flex items-end gap-[3px] h-9" aria-hidden>
                  {collectedSpark.map((v, i) => (
                    <span
                      key={i}
                      className={`w-1 rounded-full ${v > 0 ? "bg-green-500/70" : "bg-muted-foreground/15"}`}
                      style={{ height: `${Math.max(10, v * 100)}%` }}
                    />
                  ))}
                </div>
              </div>
              <p className="text-[2.25rem] leading-none font-bold text-foreground tracking-tight tabular-nums">
                {formatCurrency(collectedThisMonth)}
              </p>
              <p className="text-sm font-medium text-muted-foreground mt-3 inline-flex items-center gap-1">
                Cobrado este mes
                <HelpTooltip id="dashboardMonthlyIncome" />
              </p>
            </div>
          </Card>

          {/* Pagos vencidos */}
          <Card onClick={() => navigate(overduePaymentsCount > 0 ? "/pagos?status=overdue" : "/pagos")} className={`cursor-pointer relative overflow-hidden group p-6 rounded-2xl border bg-card shadow-[0_1px_3px_rgba(0,0,0,0.04),0_8px_24px_-12px_rgba(0,0,0,0.08)] hover:-translate-y-0.5 transition-all duration-300 ${overduePaymentsCount > 0 ? 'border-destructive/30 bg-destructive/[0.04] hover:shadow-[0_2px_6px_rgba(0,0,0,0.06),0_16px_40px_-16px_rgba(239,68,68,0.25)]' : 'border-border/60 hover:shadow-[0_2px_6px_rgba(0,0,0,0.06),0_16px_40px_-16px_rgba(0,0,0,0.12)]'}`}>
            <div aria-hidden className={`absolute inset-x-0 top-0 h-1 ${overduePaymentsCount > 0 ? 'bg-gradient-to-r from-destructive/70 via-destructive to-destructive/70' : 'bg-gradient-to-r from-muted-foreground/20 via-muted-foreground/30 to-muted-foreground/20'}`} />
            <div className={`absolute -top-10 -right-10 w-40 h-40 rounded-full blur-2xl transition-colors ${overduePaymentsCount > 0 ? 'bg-destructive/10 group-hover:bg-destructive/15' : 'bg-muted/50'}`} />
            <div className="relative">
              <div className="flex items-center justify-between mb-5">
                <div className={`h-12 w-12 rounded-2xl flex items-center justify-center ring-1 ${overduePaymentsCount > 0 ? 'bg-destructive/10 ring-destructive/20' : 'bg-muted ring-border'}`}>
                  <AlertTriangle className={`h-6 w-6 ${overduePaymentsCount > 0 ? 'text-destructive' : 'text-muted-foreground'}`} />
                </div>
              </div>
              <p className={`text-[2.5rem] leading-none font-bold tracking-tight tabular-nums ${overduePaymentsCount > 0 ? 'text-destructive' : 'text-foreground'}`}>
                {overduePaymentsCount}
              </p>
              <p className="text-sm font-medium text-muted-foreground mt-3 inline-flex items-center gap-1 flex-wrap">
                Pagos vencidos
                {overduePaymentsCount > 0 && (
                  <span className="text-destructive ml-1 font-semibold">
                    ({formatCurrency(overdueAmount)})
                  </span>
                )}
                <HelpTooltip id="dashboardOverduePayments" />
              </p>
            </div>
          </Card>
        </div>

        {/* Central Block - 2 Columns */}
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 lg:gap-8">
          {/* Left: Tu día (línea de tiempo) + Próximas citas */}
          <Card className="lg:col-span-3 rounded-2xl border border-border/60 bg-card shadow-[0_1px_3px_rgba(0,0,0,0.04),0_8px_24px_-12px_rgba(0,0,0,0.08)] overflow-hidden">
            <CardHeader className="pb-4 border-b border-border/50 bg-gradient-to-r from-card to-muted/20">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg font-semibold flex items-center gap-3 tracking-tight">
                  <span className="h-9 w-9 rounded-xl bg-primary/10 ring-1 ring-primary/15 flex items-center justify-center">
                    <Clock className="h-4.5 w-4.5 text-primary" />
                  </span>
                  Tu día
                </CardTitle>
                {timeline.next ? (
                  <Badge className="text-[11px] font-semibold px-2.5 py-1 rounded-full bg-primary/10 text-primary border border-primary/20">
                    Próxima: {timeline.next.time} · {timeline.next.name}
                  </Badge>
                ) : timeline.blocks.length > 0 ? (
                  <Badge variant="secondary" className="text-[11px] font-medium px-2.5 py-1 rounded-full">
                    Día completado ✓
                  </Badge>
                ) : null}
              </div>
            </CardHeader>
            <CardContent className="p-6 pb-4">
              {/* Línea de tiempo de hoy */}
              {timeline.blocks.length === 0 ? (
                <div className="flex items-center justify-between rounded-xl border border-dashed border-border/60 bg-muted/20 px-5 py-4 mb-5">
                  <div>
                    <p className="font-medium text-foreground">Hoy no tenés citas</p>
                    <p className="text-xs text-muted-foreground mt-0.5">Día libre en la agenda</p>
                  </div>
                  <Button size="sm" variant="outline" className="gap-1.5" onClick={() => navigate("/agenda")}>
                    <Plus className="h-3.5 w-3.5" /> Agendar
                  </Button>
                </div>
              ) : (
                <div className="mb-6">
                  <div className="relative h-[76px]">
                    {/* Guías de horas */}
                    {timeline.hours.map((h) => {
                      const left = ((h - timeline.startHour) / (timeline.endHour - timeline.startHour)) * 100;
                      return (
                        <div key={h} className="absolute top-0 bottom-0" style={{ left: `${left}%` }}>
                          <div className="h-full w-px bg-border/40" />
                        </div>
                      );
                    })}
                    {/* Bloques de citas */}
                    {timeline.blocks.map((b) => (
                      <button
                        key={b.id}
                        onClick={() => navigate("/agenda")}
                        title={`${b.time} · ${b.name}${b.service ? ` · ${b.service}` : ""}`}
                        className={`absolute top-1.5 bottom-1.5 rounded-lg border px-2 text-left overflow-hidden transition-all hover:shadow-md hover:-translate-y-0.5 ${
                          b.attended || b.past
                            ? "bg-muted/60 border-border/60"
                            : "bg-primary/12 border-primary/30"
                        }`}
                        style={{
                          left: `${b.left}%`,
                          width: `${b.width}%`,
                          borderLeftWidth: 3,
                          borderLeftColor: b.color || (b.attended || b.past ? "hsl(var(--muted-foreground) / 0.4)" : "hsl(var(--primary))"),
                          background: !b.attended && !b.past ? "hsl(var(--primary) / 0.12)" : undefined,
                        }}
                      >
                        <span className={`block text-[10px] font-bold tabular-nums leading-tight mt-1 ${b.attended || b.past ? "text-muted-foreground" : "text-primary"}`}>
                          {b.time}
                        </span>
                        <span className={`block text-[11px] font-medium truncate leading-tight ${b.attended || b.past ? "text-muted-foreground" : "text-foreground"}`}>
                          {b.name}
                        </span>
                        {b.attended && (
                          <CheckCircle2 className="h-3 w-3 text-muted-foreground mt-0.5" />
                        )}
                      </button>
                    ))}
                    {/* Ahora */}
                    {timeline.nowPct !== null && (
                      <div className="absolute top-0 bottom-0 z-10 pointer-events-none" style={{ left: `${timeline.nowPct}%` }}>
                        <div className="h-full w-[2px] bg-primary shadow-[0_0_8px_hsl(var(--primary)/0.6)]" />
                        <div className="absolute -top-1 -translate-x-1/2 left-[1px] w-2.5 h-2.5 rounded-full bg-primary ring-2 ring-card" />
                      </div>
                    )}
                  </div>
                  {/* Etiquetas de horas */}
                  <div className="relative h-4 mt-1">
                    {timeline.hours.map((h) => {
                      const left = ((h - timeline.startHour) / (timeline.endHour - timeline.startHour)) * 100;
                      return (
                        <span
                          key={h}
                          className="absolute -translate-x-1/2 text-[10px] text-muted-foreground tabular-nums"
                          style={{ left: `${left}%` }}
                        >
                          {String(h).padStart(2, "0")}:00
                        </span>
                      );
                    })}
                  </div>
                </div>
              )}

              <p className="text-[11px] font-semibold text-muted-foreground/80 mb-3 uppercase tracking-wider">
                Próximas citas · hoy y mañana
              </p>
              {upcomingAppointments.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <div className="h-16 w-16 rounded-2xl bg-muted/50 flex items-center justify-center mb-4">
                    <CalendarCheck className="h-8 w-8 text-muted-foreground/50" />
                  </div>
                  <p className="text-lg font-medium text-foreground mb-1">Todo al día</p>
                  <p className="text-sm text-muted-foreground">No hay citas pendientes</p>
                </div>
              ) : (
                <div className="space-y-2.5">
                  {upcomingAppointments.map((apt) => {
                    const professional = professionals.find(p => p.userId === apt.professional_id);
                    const dateLabel = getDateLabel(apt.start_at);
                    return (
                      <div
                        key={apt.id}
                        className="flex items-center gap-4 p-4 rounded-xl border border-border/40 bg-gradient-to-r from-muted/20 to-transparent hover:border-primary/30 hover:from-primary/[0.04] hover:to-transparent hover:shadow-sm transition-all group cursor-pointer"
                        onClick={() => navigate("/agenda")}
                      >
                        {/* Time block */}
                        <div className="flex flex-col items-center min-w-[70px]">
                          <span className={`text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full mb-1 ${
                            dateLabel === "Hoy" 
                              ? "bg-primary/10 text-primary ring-1 ring-primary/20" 
                              : "bg-muted text-muted-foreground ring-1 ring-border/60"
                          }`}>
                            {dateLabel}
                          </span>
                          <span className="text-xl font-bold text-foreground tabular-nums tracking-tight">
                            {formatTime(apt.start_at)}
                          </span>
                        </div>

                        {/* Divider */}
                        <div className="h-12 w-px bg-border/50" />

                        {/* Patient info */}
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-foreground text-base truncate">
                            {apt.patients?.full_name || "Sin paciente"}
                          </p>
                          <div className="flex items-center gap-3 mt-1">
                            {apt.services?.name && (
                              <span className="text-xs text-muted-foreground">
                                {apt.services.name}
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Professional */}
                        {professional && (
                          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-card border border-border/60 shadow-sm">
                            <div
                              className="w-2.5 h-2.5 rounded-full"
                              style={{ backgroundColor: professional.color || "#00b5b5" }}
                            />
                            <span className="text-xs font-medium text-foreground/80">
                              {professional.name.split(" ")[0]}
                            </span>
                          </div>
                        )}

                        {/* Arrow */}
                        <ArrowRight className="h-5 w-5 text-muted-foreground/50 group-hover:text-primary group-hover:translate-x-1 transition-all" />
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Right: Requiere tu atención + Estado del consultorio */}
          <div className="lg:col-span-2 space-y-6">
          <Card className={`rounded-2xl border overflow-hidden shadow-[0_1px_3px_rgba(0,0,0,0.04),0_8px_24px_-12px_rgba(0,0,0,0.08)] ${attentionCount > 0 ? "border-amber-500/30" : "border-border/60"}`}>
            <CardHeader className="pb-4 border-b border-border/50 bg-gradient-to-r from-card to-muted/20">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg font-semibold flex items-center gap-3 tracking-tight">
                  <span className={`h-9 w-9 rounded-xl flex items-center justify-center ring-1 ${attentionCount > 0 ? "bg-amber-500/10 ring-amber-500/20" : "bg-green-500/10 ring-green-500/20"}`}>
                    {attentionCount > 0 ? (
                      <AlertCircle className="h-4.5 w-4.5 text-amber-600 dark:text-amber-400" />
                    ) : (
                      <CheckCircle2 className="h-4.5 w-4.5 text-green-600" />
                    )}
                  </span>
                  Requiere tu atención
                </CardTitle>
                {attentionCount > 0 && (
                  <Badge className="rounded-full bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30 text-[11px] font-bold">
                    {attentionCount}
                  </Badge>
                )}
              </div>
            </CardHeader>
            <CardContent className="p-4 space-y-2.5">
              {attentionCount === 0 ? (
                <div className="flex items-center gap-3 p-3.5 rounded-xl bg-green-500/[0.08] border border-green-500/25">
                  <div className="h-9 w-9 rounded-lg bg-green-500/15 flex items-center justify-center shrink-0">
                    <div className="h-2.5 w-2.5 rounded-full bg-green-500 shadow-[0_0_0_4px_rgba(34,197,94,0.18)]" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-green-700 dark:text-green-400">Todo en orden</p>
                    <p className="text-xs text-muted-foreground mt-0.5">Nada espera tu respuesta</p>
                  </div>
                </div>
              ) : (
                <>
                  {pendingRequestsCount > 0 && (
                    <button
                      onClick={() => navigate("/solicitudes")}
                      className="w-full flex items-center gap-3 p-3.5 rounded-xl bg-amber-500/[0.08] border border-amber-500/30 hover:bg-amber-500/[0.14] transition-all group text-left"
                    >
                      <div className="h-9 w-9 rounded-lg bg-amber-500/15 flex items-center justify-center shrink-0">
                        <FileText className="h-4.5 w-4.5 text-amber-600 dark:text-amber-400" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-amber-700 dark:text-amber-300">
                          {pendingRequestsCount} solicitud{pendingRequestsCount !== 1 ? "es" : ""} esperando
                        </p>
                        <p className="text-xs text-muted-foreground mt-0.5">Pacientes aguardan tu respuesta</p>
                      </div>
                      <ArrowRight className="h-4 w-4 text-amber-600 dark:text-amber-400 group-hover:translate-x-0.5 transition-transform shrink-0" />
                    </button>
                  )}
                  {overduePaymentsCount > 0 && (
                    <button
                      onClick={() => navigate("/pagos")}
                      className="w-full flex items-center gap-3 p-3.5 rounded-xl bg-destructive/[0.08] border border-destructive/25 hover:bg-destructive/[0.12] transition-all group text-left"
                    >
                      <div className="h-9 w-9 rounded-lg bg-destructive/15 flex items-center justify-center shrink-0">
                        <AlertCircle className="h-4.5 w-4.5 text-destructive" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-destructive">
                          Te deben {formatCurrency(overdueAmount)}
                        </p>
                        <p className="text-xs text-muted-foreground mt-0.5 truncate">
                          {overdueTop.map((p) => (p.patientName || "").split(" ")[0]).join(", ")}
                          {overduePaymentsCount > overdueTop.length ? ` y ${overduePaymentsCount - overdueTop.length} más` : ""}
                        </p>
                      </div>
                      <ArrowRight className="h-4 w-4 text-destructive group-hover:translate-x-0.5 transition-transform shrink-0" />
                    </button>
                  )}
                  {tomorrowUnconfirmed.length > 0 && (
                    <button
                      onClick={() => navigate("/agenda")}
                      className="w-full flex items-center gap-3 p-3.5 rounded-xl bg-primary/[0.06] border border-primary/25 hover:bg-primary/[0.1] transition-all group text-left"
                    >
                      <div className="h-9 w-9 rounded-lg bg-primary/12 flex items-center justify-center shrink-0">
                        <CalendarDays className="h-4.5 w-4.5 text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-foreground">
                          {tomorrowUnconfirmed.length} cita{tomorrowUnconfirmed.length !== 1 ? "s" : ""} de mañana sin confirmar
                        </p>
                        <p className="text-xs text-muted-foreground mt-0.5">Revisalas en la agenda</p>
                      </div>
                      <ArrowRight className="h-4 w-4 text-primary group-hover:translate-x-0.5 transition-transform shrink-0" />
                    </button>
                  )}
                </>
              )}
            </CardContent>
          </Card>

          {/* Estado del consultorio */}
          <Card className="rounded-2xl border border-border/60 bg-card shadow-[0_1px_3px_rgba(0,0,0,0.04),0_8px_24px_-12px_rgba(0,0,0,0.08)] overflow-hidden">
            <CardHeader className="pb-4 border-b border-border/50 bg-gradient-to-r from-card to-muted/20">
              <CardTitle className="text-lg font-semibold flex items-center gap-3 tracking-tight">
                <span className="h-9 w-9 rounded-xl bg-primary/10 ring-1 ring-primary/15 flex items-center justify-center">
                  <Building2 className="h-4.5 w-4.5 text-primary" />
                </span>
                Estado del consultorio
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6 space-y-6">
              {/* Profesionales activos */}
              <div>
                <p className="text-[11px] font-semibold text-muted-foreground/80 mb-3 uppercase tracking-wider">
                  Profesionales activos hoy
                </p>
                {activeProfessionalsToday.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-2">
                    Sin profesionales con citas hoy
                  </p>
                ) : (
                  <div className="space-y-2">
                    {activeProfessionalsToday.map((prof) => {
                      return (
                        <div
                          key={prof.id}
                          className="flex items-center justify-between p-3 rounded-xl border border-border/40 bg-muted/20 hover:bg-muted/40 transition-colors"
                        >
                          <div className="flex items-center gap-3">
                            <Avatar className="h-9 w-9 ring-2 ring-card shadow-sm">
                              <AvatarFallback 
                                className="text-xs font-semibold"
                                style={{ 
                                  backgroundColor: prof.isUnassigned ? "hsl(var(--warning) / 0.18)" : `${prof.color}20`,
                                  color: prof.isUnassigned ? "hsl(var(--warning))" : prof.color || "#00b5b5"
                                }}
                              >
                                {prof.isUnassigned ? "SA" : getInitials(prof.name)}
                              </AvatarFallback>
                            </Avatar>
                            <span className="font-medium text-foreground text-sm">
                              {prof.name.split(" ")[0]}
                            </span>
                          </div>
                          <Badge variant="secondary" className="text-[11px] font-medium tabular-nums">
                            {prof.attendedCount}/{prof.appointmentCount} atendidas
                          </Badge>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Ocupación de agenda */}
              <div>
                <p className="text-[11px] font-semibold text-muted-foreground/80 mb-3 uppercase tracking-wider">
                  Ocupación de agenda
                </p>
                <div className="p-4 rounded-xl border border-border/40 bg-muted/20">
                  <div className="flex items-end justify-between mb-3">
                    <span className="text-sm font-medium text-foreground">Hoy</span>
                    <span className="text-2xl font-bold text-primary tabular-nums leading-none">{agendaOccupation}<span className="text-sm text-muted-foreground font-medium ml-0.5">%</span></span>
                  </div>
                  <div className="h-2 rounded-full bg-muted overflow-hidden">
                    <div 
                      className="h-full rounded-full bg-gradient-to-r from-primary/80 to-primary transition-all duration-700"
                      style={{ width: `${agendaOccupation}%` }}
                    />
                  </div>
                </div>
              </div>

            </CardContent>
          </Card>
          </div>
        </div>

        {/* Ingresos del mes: cobrado acumulado + proyección */}
        <Card className="rounded-2xl border border-border/60 bg-card shadow-[0_1px_3px_rgba(0,0,0,0.04),0_8px_24px_-12px_rgba(0,0,0,0.08)] overflow-hidden">
          <CardHeader className="pb-2 border-b border-border/50 bg-gradient-to-r from-card to-muted/20">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <CardTitle className="text-lg font-semibold flex items-center gap-3 tracking-tight">
                <span className="h-9 w-9 rounded-xl bg-primary/10 ring-1 ring-primary/15 flex items-center justify-center">
                  <TrendingUp className="h-4.5 w-4.5 text-primary" />
                </span>
                Ingresos del mes
              </CardTitle>
              <div className="flex items-center gap-4 text-xs text-muted-foreground">
                <span className="inline-flex items-center gap-1.5">
                  <span className="w-3 h-[3px] rounded-full bg-primary inline-block" /> Cobrado
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="w-3 h-[3px] rounded-full inline-block" style={{ background: "hsl(var(--primary) / 0.45)" }} /> Proyección
                </span>
                <Badge variant="secondary" className="rounded-full text-[11px] font-semibold tabular-nums">
                  Proyectado: {formatCurrency(monthChart.projectedTotal)}
                </Badge>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-4 pt-5">
            <div className="h-[220px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={monthChart.data} margin={{ top: 5, right: 10, left: 10, bottom: 0 }}>
                  <defs>
                    <linearGradient id="gradCobrado" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis
                    dataKey="day"
                    tickLine={false}
                    axisLine={false}
                    tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                    interval={4}
                  />
                  <YAxis hide />
                  <ChartTooltip
                    formatter={(value: number, name: string) => [
                      formatCurrency(Number(value)),
                      name === "cobrado" ? "Cobrado" : "Proyección",
                    ]}
                    labelFormatter={(d) => `Día ${d}`}
                    contentStyle={{
                      background: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: 12,
                      fontSize: 12,
                      color: "hsl(var(--foreground))",
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="proyeccion"
                    stroke="hsl(var(--primary) / 0.45)"
                    strokeWidth={2}
                    strokeDasharray="6 4"
                    fill="none"
                    dot={false}
                    connectNulls={false}
                  />
                  <Area
                    type="monotone"
                    dataKey="cobrado"
                    stroke="hsl(var(--primary))"
                    strokeWidth={2.5}
                    fill="url(#gradCobrado)"
                    dot={false}
                    connectNulls={false}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Demo Patient Portal Banner */}
        {isDemo && (
          <Card 
            className="border-accent bg-accent/10 hover:bg-accent/20 transition-all cursor-pointer"
            onClick={() => navigate("/portal-paciente/demo")}
          >
            <CardContent className="p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-accent/20">
                  <Eye className="h-5 w-5 text-accent-foreground" />
                </div>
                <div>
                  <p className="font-semibold text-foreground">Demo Portal del Paciente</p>
                  <p className="text-sm text-muted-foreground">Mirá cómo ven tus pacientes su portal personal</p>
                </div>
              </div>
              <ArrowRight className="h-5 w-5 text-muted-foreground" />
            </CardContent>
          </Card>
        )}

        {/* Quick Actions Row */}
        <div className="grid grid-cols-3 gap-6">
          <Button
            size="lg"
            className="h-16 gap-4 text-base font-semibold shadow-md hover:shadow-lg transition-all"
            onClick={() => navigate("/agenda")}
          >
            <Plus className="h-5 w-5" />
            Nueva cita
          </Button>
          <Button
            size="lg"
            variant="outline"
            className="h-16 gap-4 text-base font-semibold bg-card hover:bg-muted/50 transition-all"
            onClick={() => navigate("/patients")}
          >
            <UserPlus className="h-5 w-5 text-primary" />
            Nuevo paciente
          </Button>
          <Button
            size="lg"
            variant="outline"
            className="h-16 gap-4 text-base font-semibold bg-card hover:bg-muted/50 transition-all"
            onClick={() => navigate("/pagos")}
          >
            <DollarSign className="h-5 w-5 text-primary" />
            Registrar pago
          </Button>
        </div>

        {/* Monthly Highlights Section - Secondary visual block */}
        <MonthlyHighlights businessId={businessId} className="pt-4" />
      </main>
    </div>
  );
};
