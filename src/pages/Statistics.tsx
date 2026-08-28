import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  AlertTriangle,
  BarChart3,
  TrendingDown,
  UserX,
  DollarSign,
  Users,
  CalendarCheck,
  Percent,
  Download,
  TrendingUp,
  Activity,
  ArrowUpRight,
  ArrowDownRight,
  Minus,
  MessageCircle,
  FileDown,
  Target,
  Timer,
  Globe,
  CalendarDays,
} from "lucide-react";
import LoadingPage from "@/components/LoadingPage";
import { useBusinessId } from "@/hooks/use-business-id";
import { useProfessionals } from "@/hooks/use-professionals";
import { buildShareUrl } from "@/config/app";
import { ListPagination, usePagination, ITEMS_PER_PAGE } from "@/components/ListPagination";
import { HelpTooltip } from "@/components/HelpTooltip";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
  LineChart,
  Line,
  CartesianGrid,
  Legend,
  LabelList,
} from "recharts";
import { exportCSV, todayDateString } from "@/lib/csv-export";
import { buildStatisticsPdf } from "@/lib/statistics-pdf";
import { useDashboardBranding } from "@/contexts/DashboardBrandingContext";

type PeriodKey = "30d" | "90d" | "year" | "all";

interface HourData {
  hour: string;
  count: number;
}
interface NoShowMonth {
  month: string;
  total: number;
  noShow: number;
  rate: number;
}
interface InactivePatient {
  id: string;
  full_name: string;
  email: string | null;
  lastAppointment: string | null;
  daysSinceLast: number;
}
interface RevenueMonth {
  month: string;
  cobrado: number;
  pendiente: number;
}
interface RetentionMonth {
  month: string;
  nuevos: number;
  recurrentes: number;
}
interface ProfessionalRow {
  userId: string;
  name: string;
  color: string;
  citas: number;
  ingresos: number;
  noShowRate: number;
}

const PERIOD_LABELS: Record<PeriodKey, string> = {
  "30d": "Últimos 30 días",
  "90d": "Últimos 90 días",
  year: "Último año",
  all: "Histórico",
};

const formatCurrency = (n: number) =>
  new Intl.NumberFormat("es-UY", { style: "currency", currency: "UYU", maximumFractionDigits: 0 }).format(n);

const monthKeyToLabel = (key: string) => {
  const [y, m] = key.split("-");
  const months = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
  return `${months[parseInt(m) - 1]} ${y.slice(2)}`;
};

const Statistics = () => {
  const navigate = useNavigate();
  const { businessId, loading: bizLoading } = useBusinessId();
  const { professionals } = useProfessionals(businessId);
  const { displayName, primaryColor } = useDashboardBranding();
  const [period, setPeriod] = useState<PeriodKey>("90d");
  // Vista activa: la historia de tu plata, tu agenda o tus pacientes
  const [view, setView] = useState<"finanzas" | "actividad" | "pacientes">("finanzas");
  const [loading, setLoading] = useState(true);
  const [exportingPDF, setExportingPDF] = useState(false);
  const reportRef = useRef<HTMLDivElement>(null);

  // Raw data
  const [appointments, setAppointments] = useState<Array<{ start_at: string; end_at: string | null; status: string; professional_id: string | null; patient_id: string | null; source: string | null }>>([]);
  const [payments, setPayments] = useState<Array<{ amount: number; status: string; due_date: string; paid_at: string | null; patient_id: string }>>([]);
  // Semana tipo activa: la capacidad de agenda sale de acá (Horarios 2.0),
  // ya no de casilleros pregenerados.
  const [templates, setTemplates] = useState<any[]>([]);
  const [allPatients, setAllPatients] = useState<Array<{ id: string; full_name: string; email: string | null; is_active: boolean; whatsapp_phone: string | null }>>([]);
  const [publicSlug, setPublicSlug] = useState<string | null>(null);

  useEffect(() => {
    if (businessId) loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [businessId]);

  const loadAll = async () => {
    setLoading(true);
    try {
      const [{ data: appts }, { data: pays }, { data: tpls }, { data: pts }, { data: biz }] = await Promise.all([
        supabase
          .from("appointments")
          .select("start_at, end_at, status, professional_id, patient_id, source")
          .eq("business_id", businessId!),
        supabase
          .from("payments")
          .select("amount, status, due_date, paid_at, patient_id")
          .eq("business_id", businessId!),
        supabase
          .from("availability_templates")
          .select("*")
          .eq("business_id", businessId!)
          .eq("is_active", true),
        supabase
          .from("patients")
          .select("id, full_name, email, is_active, whatsapp_phone")
          .eq("business_id", businessId!),
        supabase
          .from("businesses")
          .select("public_slug")
          .eq("id", businessId!)
          .maybeSingle(),
      ]);
      setAppointments(appts || []);
      setPayments((pays || []).map((p) => ({ ...p, amount: Number(p.amount) })));
      setTemplates(tpls || []);
      setAllPatients(pts || []);
      setPublicSlug(biz?.public_slug || null);
    } catch (e) {
      console.error("Stats load error:", e);
    } finally {
      setLoading(false);
    }
  };

  const periodStart = useMemo(() => {
    const now = new Date();
    if (period === "30d") return new Date(now.getTime() - 30 * 86400000);
    if (period === "90d") return new Date(now.getTime() - 90 * 86400000);
    if (period === "year") return new Date(now.getTime() - 365 * 86400000);
    return new Date(0);
  }, [period]);

  // Filtered datasets by period
  const apptsInPeriod = useMemo(
    () => appointments.filter((a) => new Date(a.start_at) >= periodStart && new Date(a.start_at) <= new Date()),
    [appointments, periodStart]
  );
  const paymentsInPeriod = useMemo(
    () =>
      payments.filter((p) => {
        const ref = p.paid_at ? new Date(p.paid_at) : new Date(p.due_date);
        return ref >= periodStart;
      }),
    [payments, periodStart]
  );
  // === Ocupación (Horarios 2.0): horas con cita ÷ horas de la semana tipo ===
  const weeklyCapacityMinutes = useMemo(() => {
    const toMin = (t: string | null) => {
      if (!t) return 0;
      const [h, m] = String(t).split(":").map(Number);
      return (h || 0) * 60 + (m || 0);
    };
    let total = 0;
    for (const t of templates) {
      for (const day of ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"]) {
        // Formato nuevo: bloques libres por día en day_blocks
        const jb = t.day_blocks?.[day];
        if (Array.isArray(jb)) {
          for (const b of jb) {
            const s = toMin(Array.isArray(b) ? b[0] : null);
            const e = toMin(Array.isArray(b) ? b[1] : null);
            if (e > s) total += e - s;
          }
          continue;
        }
        if (!t[`${day}_enabled`]) continue;
        const s1 = toMin(t[`${day}_start_1`]);
        const e1 = toMin(t[`${day}_end_1`]);
        if (e1 > s1) total += e1 - s1;
        const s2 = toMin(t[`${day}_start_2`]);
        const e2 = toMin(t[`${day}_end_2`]);
        if (e2 > s2) total += e2 - s2;
      }
    }
    return total;
  }, [templates]);

  // Ocupación por semana: minutos con cita de cada semana / capacidad semanal.
  // Las semanas sin citas cuentan como 0% (desde la primera cita del período).
  const occupancyData = useMemo(() => {
    if (weeklyCapacityMinutes <= 0) return [] as Array<{ week: string; ocupacion: number }>;
    const valid = apptsInPeriod.filter((a) => a.status !== "cancelled" && a.status !== "no_show" && a.end_at);
    if (valid.length === 0) return [] as Array<{ week: string; ocupacion: number }>;

    const mondayOf = (d: Date) => {
      const m = new Date(d);
      const day = m.getDay() || 7;
      m.setDate(m.getDate() - day + 1);
      m.setHours(0, 0, 0, 0);
      return m;
    };
    const keyOf = (d: Date) =>
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

    const bookedByWeek = new Map<string, number>();
    let firstStart = Infinity;
    for (const a of valid) {
      const start = new Date(a.start_at);
      const mins = Math.max(0, (new Date(a.end_at!).getTime() - start.getTime()) / 60000);
      const key = keyOf(mondayOf(start));
      bookedByWeek.set(key, (bookedByWeek.get(key) ?? 0) + mins);
      if (start.getTime() < firstStart) firstStart = start.getTime();
    }

    const out: Array<{ week: string; ocupacion: number }> = [];
    const cursor = mondayOf(new Date(firstStart));
    const now = new Date();
    while (cursor <= now) {
      const key = keyOf(cursor);
      out.push({
        week: key.slice(5).replace("-", "/"),
        ocupacion: Math.min(100, Math.round(((bookedByWeek.get(key) ?? 0) / weeklyCapacityMinutes) * 100)),
      });
      cursor.setDate(cursor.getDate() + 7);
    }
    return out.slice(-12);
  }, [apptsInPeriod, weeklyCapacityMinutes]);

  // === KPIs ===
  const kpis = useMemo(() => {
    const validAppts = apptsInPeriod.filter((a) => a.status !== "cancelled");
    const totalCitas = validAppts.length;
    const cobrado = paymentsInPeriod.filter((p) => p.status === "paid").reduce((s, p) => s + p.amount, 0);
    const pendiente = payments.filter((p) => p.status === "pending").reduce((s, p) => s + p.amount, 0);
    const noShow = validAppts.filter((a) => a.status === "no_show").length;
    const noShowRate = totalCitas > 0 ? Math.round((noShow / totalCitas) * 100) : 0;
    const activePatients = allPatients.filter((p) => p.is_active).length;
    const occupancy = occupancyData.length
      ? Math.round(occupancyData.reduce((s, w) => s + w.ocupacion, 0) / occupancyData.length)
      : 0;
    return { totalCitas, cobrado, pendiente, noShowRate, activePatients, occupancy };
  }, [apptsInPeriod, paymentsInPeriod, payments, allPatients, occupancyData]);

  // === Tendencias vs el período anterior de igual duración ===
  const trends = useMemo(() => {
    if (period === "all") return null;
    const now = new Date();
    const len = now.getTime() - periodStart.getTime();
    const prevStart = new Date(periodStart.getTime() - len);
    const inPrev = (iso: string) => {
      const t = new Date(iso).getTime();
      return t >= prevStart.getTime() && t < periodStart.getTime();
    };

    const prevAppts = appointments.filter((a) => a.status !== "cancelled" && inPrev(a.start_at));
    const prevCitas = prevAppts.length;
    const prevNoShow = prevAppts.filter((a) => a.status === "no_show").length;
    const prevNoShowRate = prevCitas > 0 ? (prevNoShow / prevCitas) * 100 : 0;
    const prevCobrado = payments
      .filter((p) => p.status === "paid" && p.paid_at && inPrev(p.paid_at))
      .reduce((s, p) => s + p.amount, 0);

    const pct = (cur: number, prev: number) =>
      prev > 0 ? Math.round(((cur - prev) / prev) * 100) : null;

    return {
      citas: pct(kpis.totalCitas, prevCitas),
      cobrado: pct(kpis.cobrado, prevCobrado),
      // Ausencias: diferencia en puntos porcentuales (subir es malo)
      ausencias: prevCitas > 0 ? Math.round((kpis.noShowRate - prevNoShowRate) * 10) / 10 : null,
    };
  }, [period, periodStart, appointments, payments, kpis]);

  // === Proyección del mes en curso: cobrado + lo que vence este mes ===
  const monthProjection = useMemo(() => {
    const now = new Date();
    const mStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const mEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    const inMonth = (iso: string | null) => {
      if (!iso) return false;
      const d = new Date(iso);
      return d >= mStart && d < mEnd;
    };
    const cobrado = payments
      .filter((p) => p.status === "paid" && inMonth(p.paid_at))
      .reduce((s, p) => s + p.amount, 0);
    const porCobrar = payments
      .filter((p) => !p.paid_at && p.status !== "cancelled" && inMonth(p.due_date))
      .reduce((s, p) => s + p.amount, 0);
    return { cobrado, porCobrar, total: cobrado + porCobrar };
  }, [payments]);

  // === Pagos vencidos (total histórico, para la pestaña Finanzas) ===
  const overdueInfo = useMemo(() => {
    const od = payments.filter((p) => p.status === "overdue");
    return { count: od.length, total: od.reduce((s, p) => s + p.amount, 0) };
  }, [payments]);

  // === Demora promedio de cobro (días entre vencimiento y pago) ===
  const collectionDelay = useMemo(() => {
    const paid = paymentsInPeriod.filter((p) => p.paid_at);
    if (!paid.length) return null;
    const avg =
      paid.reduce(
        (s, p) => s + Math.max(0, (new Date(p.paid_at!).getTime() - new Date(p.due_date).getTime()) / 86400000),
        0
      ) / paid.length;
    return Math.round(avg * 10) / 10;
  }, [paymentsInPeriod]);

  // === Origen de las reservas del período ===
  const sourceData = useMemo(() => {
    const counts = { panel: 0, publica: 0, portal: 0 };
    for (const a of apptsInPeriod) {
      if (a.status === "cancelled") continue;
      if (a.source === "public_booking" || a.source === "web") counts.publica++;
      else if (a.source === "patient_portal") counts.portal++;
      else counts.panel++;
    }
    const total = counts.panel + counts.publica + counts.portal;
    return { ...counts, total };
  }, [apptsInPeriod]);

  // === Distribución por día de la semana ===
  const weekdayData = useMemo(() => {
    const labels = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
    const counts = [0, 0, 0, 0, 0, 0, 0];
    for (const a of apptsInPeriod) {
      if (a.status === "cancelled") continue;
      counts[new Date(a.start_at).getDay()]++;
    }
    const order = [1, 2, 3, 4, 5, 6, 0]; // lunes primero
    return order.map((i) => ({ day: labels[i], count: counts[i] }));
  }, [apptsInPeriod]);

  // === Revenue by month ===
  const revenueData: RevenueMonth[] = useMemo(() => {
    const map = new Map<string, { cobrado: number; pendiente: number }>();
    for (const p of paymentsInPeriod) {
      const ref = p.paid_at ? new Date(p.paid_at) : new Date(p.due_date);
      const key = `${ref.getFullYear()}-${String(ref.getMonth() + 1).padStart(2, "0")}`;
      if (!map.has(key)) map.set(key, { cobrado: 0, pendiente: 0 });
      const m = map.get(key)!;
      if (p.status === "paid") m.cobrado += p.amount;
      else if (p.status === "pending") m.pendiente += p.amount;
    }
    return Array.from(map.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => ({ month: monthKeyToLabel(k), cobrado: Math.round(v.cobrado), pendiente: Math.round(v.pendiente) }));
  }, [paymentsInPeriod]);

  // === Hour distribution ===
  const hourData: HourData[] = useMemo(() => {
    const counts: Record<number, number> = {};
    for (let h = 0; h < 24; h++) counts[h] = 0;
    for (const a of apptsInPeriod) {
      if (a.status === "cancelled") continue;
      counts[new Date(a.start_at).getHours()]++;
    }
    return Object.entries(counts)
      .filter(([, c]) => c > 0)
      .map(([h, c]) => ({ hour: `${h.padStart(2, "0")}:00`, count: c }))
      .sort((a, b) => a.hour.localeCompare(b.hour));
  }, [apptsInPeriod]);

  const maxHourCount = Math.max(...hourData.map((h) => h.count), 1);

  // === No-show trend (current month vs previous month) ===
  const noShowTrend = useMemo(() => {
    const now = new Date();
    const curKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    const prevDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const prevKey = `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, "0")}`;
    const buckets = new Map<string, { total: number; noShow: number }>();
    for (const a of appointments) {
      if (a.status === "cancelled") continue;
      const d = new Date(a.start_at);
      const k = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      if (k !== curKey && k !== prevKey) continue;
      if (!buckets.has(k)) buckets.set(k, { total: 0, noShow: 0 });
      const m = buckets.get(k)!;
      m.total++;
      if (a.status === "no_show") m.noShow++;
    }
    const cur = buckets.get(curKey);
    const prev = buckets.get(prevKey);
    const curRate = cur && cur.total > 0 ? (cur.noShow / cur.total) * 100 : 0;
    const prevRate = prev && prev.total > 0 ? (prev.noShow / prev.total) * 100 : 0;
    const delta = curRate - prevRate;
    return { curRate: Math.round(curRate), prevRate: Math.round(prevRate), delta: Math.round(delta * 10) / 10 };
  }, [appointments]);

  // Portal link for WhatsApp message
  const portalUrl = useMemo(() => {
    if (!publicSlug) return "";
    return buildShareUrl(`/portal/${publicSlug}`);
  }, [publicSlug]);

  const sendWhatsAppToInactive = (patient: InactivePatient & { whatsapp_phone?: string | null }) => {
    const phone = (patient.whatsapp_phone || "").replace(/\D/g, "");
    if (!phone) return;
    const firstName = patient.full_name.split(" ")[0];
    const linkPart = portalUrl ? ` Podés reservar tu turno desde ${portalUrl}` : "";
    const message = `Hola ${firstName}, hace un tiempo que no nos vemos. ¿Querés retomar las sesiones?${linkPart}`;
    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(message)}`, "_blank");
  };


  // === No-show by month ===
  const noShowData: NoShowMonth[] = useMemo(() => {
    const map = new Map<string, { total: number; noShow: number }>();
    for (const a of apptsInPeriod) {
      if (a.status === "cancelled") continue;
      const d = new Date(a.start_at);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      if (!map.has(key)) map.set(key, { total: 0, noShow: 0 });
      const m = map.get(key)!;
      m.total++;
      if (a.status === "no_show") m.noShow++;
    }
    return Array.from(map.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => ({
        month: monthKeyToLabel(k),
        total: v.total,
        noShow: v.noShow,
        rate: v.total > 0 ? Math.round((v.noShow / v.total) * 100) : 0,
      }));
  }, [apptsInPeriod]);

  // === New vs returning patients ===
  const retentionData: RetentionMonth[] = useMemo(() => {
    // first appointment date per patient (over ALL history)
    const firstByPatient = new Map<string, Date>();
    for (const a of appointments) {
      if (a.status === "cancelled") continue;
      const pid = (a as any).patient_id as string | undefined;
      // appointments query above doesn't include patient_id; recompute from payments+appts? -> use payments to derive
    }
    // Use payments.patient_id + due_date as proxy is not ideal. Instead, group apptsInPeriod by month and detect first-ever via payments map
    const firstSeen = new Map<string, string>(); // patient_id -> first month key
    const sortedPays = [...payments].sort((a, b) => new Date(a.due_date).getTime() - new Date(b.due_date).getTime());
    for (const p of sortedPays) {
      if (!firstSeen.has(p.patient_id)) {
        const d = new Date(p.due_date);
        firstSeen.set(p.patient_id, `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
      }
    }

    const map = new Map<string, { nuevos: Set<string>; recurrentes: Set<string> }>();
    for (const p of paymentsInPeriod) {
      const d = new Date(p.due_date);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      if (!map.has(key)) map.set(key, { nuevos: new Set(), recurrentes: new Set() });
      const bucket = map.get(key)!;
      if (firstSeen.get(p.patient_id) === key) bucket.nuevos.add(p.patient_id);
      else bucket.recurrentes.add(p.patient_id);
    }
    return Array.from(map.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => ({ month: monthKeyToLabel(k), nuevos: v.nuevos.size, recurrentes: v.recurrentes.size }));
  }, [payments, paymentsInPeriod, appointments]);

  // === Per-professional performance ===
  const professionalRows: ProfessionalRow[] = useMemo(() => {
    if (professionals.length === 0) return [];
    const apptsByProf = new Map<string, { citas: number; noShow: number }>();
    for (const a of apptsInPeriod) {
      if (a.status === "cancelled") continue;
      const key = a.professional_id || "__sin__";
      if (!apptsByProf.has(key)) apptsByProf.set(key, { citas: 0, noShow: 0 });
      const r = apptsByProf.get(key)!;
      r.citas++;
      if (a.status === "no_show") r.noShow++;
    }
    return professionals.map((p) => {
      const stat = apptsByProf.get(p.userId) || { citas: 0, noShow: 0 };
      return {
        userId: p.userId,
        name: p.name,
        color: p.color,
        citas: stat.citas,
        ingresos: 0, // no professional_id on payments → omit per-prof revenue
        noShowRate: stat.citas > 0 ? Math.round((stat.noShow / stat.citas) * 100) : 0,
      };
    });
  }, [professionals, apptsInPeriod]);

  // === Pacientes en riesgo: activos SIN próxima cita agendada ===
  // (los que hace más que no vienen, arriba — plata que se va por la puerta)
  const inactivePatients: InactivePatient[] = useMemo(() => {
    const now = Date.now();
    const lastByPatient = new Map<string, number>();
    const hasFuture = new Set<string>();
    for (const a of appointments) {
      if (!a.patient_id) continue;
      if (a.status === "cancelled" || a.status === "cancelled_by_patient") continue;
      const t = new Date(a.start_at).getTime();
      if (t > now) {
        hasFuture.add(a.patient_id);
      } else {
        const prev = lastByPatient.get(a.patient_id) ?? 0;
        if (t > prev) lastByPatient.set(a.patient_id, t);
      }
    }
    return allPatients
      .filter((p) => p.is_active && !hasFuture.has(p.id))
      .map((p) => {
        const last = lastByPatient.get(p.id) ?? null;
        return {
          id: p.id,
          full_name: p.full_name,
          email: p.email,
          lastAppointment: last ? new Date(last).toISOString() : null,
          daysSinceLast: last ? Math.floor((now - last) / 86400000) : 9999,
        };
      })
      .sort((a, b) => b.daysSinceLast - a.daysSinceLast);
  }, [allPatients, appointments]);

  const [inactivePage, setInactivePage] = useState(1);
  const { paginatedItems: pageInactive, totalPages: inactiveTotalPages } = usePagination(inactivePatients, inactivePage);

  const handleExport = () => {
    const headers = ["Sección", "Métrica", "Valor"];
    const rows: string[][] = [
      ["Resumen", "Período", PERIOD_LABELS[period]],
      ["Resumen", "Citas realizadas", String(kpis.totalCitas)],
      ["Resumen", "Cobrado (UYU)", String(kpis.cobrado)],
      ["Resumen", "Pendiente de cobro (UYU)", String(kpis.pendiente)],
      ["Resumen", "Tasa de ausencias (%)", String(kpis.noShowRate)],
      ["Resumen", "Ocupación de agenda (%)", String(kpis.occupancy)],
      ["Resumen", "Pacientes activos", String(kpis.activePatients)],
      ["Resumen", "Proyección del mes (UYU)", String(monthProjection.total)],
      ["Resumen", "Demora promedio de cobro (días)", collectionDelay === null ? "—" : String(collectionDelay)],
      ["Origen", "Panel", String(sourceData.panel)],
      ["Origen", "Web pública", String(sourceData.publica)],
      ["Origen", "Portal", String(sourceData.portal)],
      ["Riesgo", "Pacientes sin próxima cita", String(inactivePatients.length)],
      ...revenueData.flatMap((r) => [
        ["Ingresos", `${r.month} - cobrado`, String(r.cobrado)],
        ["Ingresos", `${r.month} - pendiente`, String(r.pendiente)],
      ]),
      ...noShowData.map((n) => ["Ausencias", `${n.month}`, `${n.rate}% (${n.noShow}/${n.total})`]),
      ...professionalRows.map((p) => ["Profesional", p.name, `${p.citas} citas, ${p.noShowRate}% ausencias`]),
    ];
    exportCSV(headers, rows, `estadisticas_${todayDateString()}.csv`);
  };

  const handleExportPDF = async () => {
    try {
      setExportingPDF(true);
      // El reporte se DIBUJA como documento (no es una captura de pantalla):
      // encabezado con el color de marca, cajas de KPIs, gráficos y tablas
      // nativas. Nunca sale cortado ni depende del tema de la app.
      await buildStatisticsPdf({
        clinicName: displayName || "Mi consultorio",
        periodLabel: PERIOD_LABELS[period],
        primaryColor,
        kpis,
        trends,
        monthProjection,
        collectionDelay,
        sourceData,
        weekdayData,
        revenueData,
        noShowData,
        professionalRows,
        inactivePatients,
        fileName: `estadisticas_${todayDateString()}.pdf`,
      });
      toast({ title: "PDF generado", description: "El reporte se descargó correctamente" });
    } catch (e) {
      console.error("PDF export error:", e);
      toast({
        title: "Error",
        description: "No se pudo generar el PDF",
        variant: "destructive",
      });
    } finally {
      setExportingPDF(false);
    }
  };

  if (bizLoading || loading) return <LoadingPage />;

  const GROTESK = { fontFamily: "'Space Grotesk', sans-serif" } as const;
  const CARD_BG = {
    background: "linear-gradient(180deg,var(--cd-card1),var(--cd-card2))",
    border: "1px solid hsl(var(--cd-tint-hsl)/0.1)",
  } as const;
  const PILL = {
    background: "hsl(var(--cd-tint-hsl)/0.05)",
    border: "1px solid hsl(var(--cd-tint-hsl)/0.12)",
    color: "var(--cd-text-soft)",
  } as const;

  return (
    <div
      className="dark min-h-screen"
      style={{ background: "var(--cd-bg)", fontFamily: "'Instrument Sans', 'Plus Jakarta Sans', sans-serif" }}
    >
      <div className="w-full px-4 sm:px-6 py-6 space-y-4">
        {/* Encabezado de página */}
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3.5 min-w-0">
            <span
              className="h-[46px] w-[46px] rounded-[14px] flex items-center justify-center shrink-0"
              style={{ background: "hsl(var(--cd-accent-hsl)/0.12)", border: "1px solid hsl(var(--cd-accent-hsl)/0.25)" }}
            >
              <BarChart3 className="h-5 w-5" style={{ color: "var(--cd-accent)" }} />
            </span>
            <div className="min-w-0">
              <h1 className="text-[22px] sm:text-[28px] font-bold tracking-tight inline-flex items-center gap-2" style={GROTESK}>
                Estadísticas
                <HelpTooltip id="statistics" />
              </h1>
              <p className="text-[13px] truncate" style={{ color: "var(--cd-muted)" }}>{PERIOD_LABELS[period]}</p>
            </div>
          </div>
          <div className="flex items-center gap-2.5 flex-wrap">
            <div
              className="flex gap-[3px] p-1 rounded-[13px]"
              style={{ background: "hsl(var(--cd-tint-hsl)/0.06)", border: "1px solid hsl(var(--cd-tint-hsl)/0.12)" }}
            >
              {([["30d", "30d"], ["90d", "90d"], ["year", "Año"], ["all", "Todo"]] as const).map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setPeriod(key)}
                  className="px-[15px] py-2 rounded-[10px] text-[12.5px] transition-colors"
                  style={
                    period === key
                      ? { background: "var(--cd-text)", color: "var(--cd-bg-deep)", fontWeight: 600 }
                      : { background: "transparent", color: "var(--cd-muted)", fontWeight: 500 }
                  }
                >
                  {label}
                </button>
              ))}
            </div>
            <Button variant="outline" size="sm" onClick={handleExport} className="gap-2 h-10 px-4 rounded-xl border-0 text-[13px] font-medium" style={PILL}>
              <Download className="h-[13px] w-[13px]" />
              <span className="hidden sm:inline">Exportar CSV</span>
              <span className="sm:hidden">CSV</span>
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleExportPDF}
              disabled={exportingPDF}
              className="gap-2 h-10 px-4 rounded-xl border-0 text-[13px] font-medium"
              style={PILL}
            >
              <FileDown className="h-[13px] w-[13px]" />
              <span className="hidden sm:inline">
                {exportingPDF ? "Generando..." : "Exportar PDF"}
              </span>
              <span className="sm:hidden">{exportingPDF ? "..." : "PDF"}</span>
            </Button>
          </div>
        </div>

        {/* Reportable content (captured for PDF) */}
        <div ref={reportRef} className="space-y-6 bg-background">

        <Tabs value={view} onValueChange={(v) => setView(v as typeof view)} className="space-y-4">
          <TabsList
            className="grid w-full grid-cols-3 sm:w-auto sm:inline-grid h-auto p-1 gap-1 rounded-[14px] bg-transparent"
            style={{ background: "hsl(var(--cd-tint-hsl)/0.05)", border: "1px solid hsl(var(--cd-tint-hsl)/0.1)" }}
          >
            <TabsTrigger
              value="finanzas"
              className="gap-1.5 sm:px-[18px] py-[9px] rounded-[11px] text-[13px] font-medium text-[color:var(--cd-muted)] data-[state=active]:bg-[color:var(--cd-text)] data-[state=active]:text-[color:var(--cd-bg-deep)] data-[state=active]:font-semibold data-[state=active]:shadow-none"
            >
              <DollarSign className="h-[13px] w-[13px]" /> Finanzas
            </TabsTrigger>
            <TabsTrigger
              value="actividad"
              className="gap-1.5 sm:px-[18px] py-[9px] rounded-[11px] text-[13px] font-medium text-[color:var(--cd-muted)] data-[state=active]:bg-[color:var(--cd-text)] data-[state=active]:text-[color:var(--cd-bg-deep)] data-[state=active]:font-semibold data-[state=active]:shadow-none"
            >
              <Activity className="h-[13px] w-[13px]" /> Actividad
            </TabsTrigger>
            <TabsTrigger
              value="pacientes"
              className="gap-1.5 sm:px-[18px] py-[9px] rounded-[11px] text-[13px] font-medium text-[color:var(--cd-muted)] data-[state=active]:bg-[color:var(--cd-text)] data-[state=active]:text-[color:var(--cd-bg-deep)] data-[state=active]:font-semibold data-[state=active]:shadow-none"
            >
              <Users className="h-[13px] w-[13px]" /> Pacientes
            </TabsTrigger>
          </TabsList>

        {/* ══════════ FINANZAS: la historia de tu plata ══════════ */}
        <TabsContent value="finanzas" className="space-y-6 mt-0">
        {/* Hero de cobros (mockup): tres celdas sobre gradiente con glow */}
        <div
          className="relative overflow-hidden rounded-[22px]"
          style={{
            border: "1px solid hsl(var(--cd-tint-hsl)/0.14)",
            background: "linear-gradient(160deg,var(--cd-hero1) 0%,var(--cd-hero2) 60%,var(--cd-hero3) 100%)",
          }}
        >
          <div
            className="absolute pointer-events-none"
            style={{
              top: -100, right: -50, width: 320, height: 320, borderRadius: "50%",
              background: "radial-gradient(circle,hsl(var(--cd-accent-hsl)/.15) 0%,hsl(var(--cd-accent-hsl)/0) 65%)",
              filter: "blur(10px)",
            }}
            aria-hidden
          />
          <div className="relative grid gap-0.5" style={{ gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))" }}>
            <div className="px-6 lg:px-7 py-6">
              <div
                className="flex items-center gap-2 uppercase mb-2.5 text-[11px] font-semibold"
                style={{ ...GROTESK, letterSpacing: "0.16em", color: "var(--cd-accent)" }}
              >
                <DollarSign className="h-[13px] w-[13px]" />
                Cobrado en el período
              </div>
              <div className="flex items-baseline gap-2.5 flex-wrap">
                <span
                  className="font-bold leading-none tracking-tight text-[28px] lg:text-[38px]"
                  style={{ ...GROTESK, color: "var(--cd-accent-soft)" }}
                >
                  {formatCurrency(kpis.cobrado)}
                </span>
                <TrendBadge value={trends?.cobrado ?? null} />
              </div>
              <div className="mt-2 text-xs" style={{ color: "var(--cd-dim)" }}>vs. período anterior</div>
            </div>
            <div className="px-6 lg:px-7 py-6 sm:border-l sm:border-l-[hsl(var(--cd-tint-hsl)/0.08)]">
              <div
                className="flex items-center gap-2 uppercase mb-2.5 text-[11px] font-semibold"
                style={{ ...GROTESK, letterSpacing: "0.16em", color: "#a08657" }}
              >
                <TrendingUp className="h-[13px] w-[13px]" />
                Pendiente de cobro
              </div>
              <div
                className="font-bold leading-none tracking-tight text-[28px] lg:text-[38px]"
                style={{ ...GROTESK, color: "#fcd34d" }}
              >
                {formatCurrency(kpis.pendiente)}
              </div>
              <div className="mt-2 text-xs" style={{ color: "var(--cd-dim)" }}>en pagos aún no realizados</div>
            </div>
            <div className="px-6 lg:px-7 py-6 sm:border-l sm:border-l-[hsl(var(--cd-tint-hsl)/0.08)]">
              <div
                className="flex items-center gap-2 uppercase mb-2.5 text-[11px] font-semibold"
                style={{ ...GROTESK, letterSpacing: "0.16em", color: "var(--cd-muted)" }}
              >
                <Percent className="h-[13px] w-[13px]" />
                Tasa de cobranza
              </div>
              {(() => {
                const total = kpis.cobrado + kpis.pendiente;
                const rate = total > 0 ? Math.round((kpis.cobrado / total) * 100) : 0;
                return (
                  <div className="flex items-center gap-4">
                    <div className="relative shrink-0" style={{ width: 76, height: 76 }}>
                      <svg width="76" height="76" viewBox="0 0 100 100">
                        <circle cx="50" cy="50" r="41" fill="none" stroke="hsl(var(--cd-tint-hsl)/.12)" strokeWidth="9" />
                        <circle
                          cx="50" cy="50" r="41" fill="none" stroke="url(#grTasaStats)" strokeWidth="9"
                          strokeLinecap="round" strokeDasharray="258"
                          strokeDashoffset={258 * (1 - rate / 100)}
                          transform="rotate(-90 50 50)"
                        />
                        <defs>
                          <linearGradient id="grTasaStats" x1="0" y1="0" x2="1" y2="1">
                            <stop offset="0%" style={{ stopColor: "var(--cd-accent)" }} />
                            <stop offset="100%" style={{ stopColor: "var(--cd-accent-deep)" }} />
                          </linearGradient>
                        </defs>
                      </svg>
                      <div className="absolute inset-0 flex items-center justify-center font-bold text-[19px]" style={{ ...GROTESK, color: "var(--cd-text)" }}>
                        {rate}%
                      </div>
                    </div>
                    <div>
                      <div className="text-xs leading-relaxed" style={{ color: "var(--cd-dim)" }}>
                        del total facturado<br />en el período
                      </div>
                      <div className="mt-1.5 text-[11.5px] font-semibold" style={{ color: "var(--cd-accent-soft)" }}>
                        {formatCurrency(kpis.cobrado)} cobrado
                      </div>
                    </div>
                  </div>
                );
              })()}
            </div>
          </div>
        </div>

        {/* Fila inteligente: proyección, demora de cobro y vencidos */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="rounded-[18px] p-5" style={CARD_BG}>
            <div
              className="flex items-center gap-2 uppercase mb-2 text-[10.5px] font-semibold"
              style={{ ...GROTESK, letterSpacing: "0.15em", color: "var(--cd-dim)" }}
            >
              <Target className="h-[13px] w-[13px]" style={{ color: "var(--cd-accent)" }} />
              Proyección de este mes
            </div>
            <p className="font-bold text-2xl" style={{ ...GROTESK, color: "var(--cd-text)" }}>{formatCurrency(monthProjection.total)}</p>
            <p className="text-xs mt-1" style={{ color: "var(--cd-muted)" }}>
              {formatCurrency(monthProjection.cobrado)} cobrado + {formatCurrency(monthProjection.porCobrar)} por cobrar
            </p>
          </div>
          <div className="rounded-[18px] p-5" style={CARD_BG}>
            <div
              className="flex items-center gap-2 uppercase mb-2 text-[10.5px] font-semibold"
              style={{ ...GROTESK, letterSpacing: "0.15em", color: "var(--cd-dim)" }}
            >
              <Timer className="h-[13px] w-[13px]" style={{ color: "#a9ccf5" }} />
              Demora promedio de cobro
            </div>
            <p className="font-bold text-2xl" style={{ ...GROTESK, color: "var(--cd-text)" }}>
              {collectionDelay === null ? "—" : collectionDelay === 0 ? "Al día" : `${collectionDelay} días`}
            </p>
            <p className="text-xs mt-1" style={{ color: "var(--cd-muted)" }}>
              entre el vencimiento y el pago efectivo
            </p>
          </div>
          <div
            className="rounded-[18px] p-5"
            style={{
              background: "linear-gradient(180deg,var(--cd-card1),var(--cd-card2))",
              border: overdueInfo.count === 0 ? "1px solid hsl(var(--cd-accent-hsl)/0.16)" : "1px solid rgba(251,113,133,0.22)",
            }}
          >
            <div
              className="flex items-center gap-2 uppercase mb-2 text-[10.5px] font-semibold"
              style={{ ...GROTESK, letterSpacing: "0.15em", color: "var(--cd-dim)" }}
            >
              {overdueInfo.count === 0 ? (
                <CalendarCheck className="h-[13px] w-[13px]" style={{ color: "var(--cd-accent)" }} />
              ) : (
                <AlertTriangle className="h-[13px] w-[13px]" style={{ color: "#fda4af" }} />
              )}
              Pagos vencidos
            </div>
            <p className="font-bold text-2xl" style={{ ...GROTESK, color: overdueInfo.count === 0 ? "var(--cd-accent-soft)" : "#fda4af" }}>
              {formatCurrency(overdueInfo.total)}
            </p>
            <div className="flex items-center justify-between gap-2 mt-1">
              <p className="text-xs" style={{ color: overdueInfo.count === 0 ? "var(--cd-muted)" : "#a06570" }}>
                {overdueInfo.count === 0
                  ? "nadie te debe, todo al día ✓"
                  : `${overdueInfo.count} pago${overdueInfo.count === 1 ? "" : "s"} sin cobrar`}
              </p>
              {overdueInfo.count > 0 && (
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 text-xs shrink-0 rounded-lg border-0"
                  style={{ background: "rgba(251,113,133,0.1)", border: "1px solid rgba(251,113,133,0.25)", color: "#fda4af" }}
                  onClick={() => navigate("/pagos?status=overdue")}
                >
                  Ver quién te debe
                </Button>
              )}
            </div>
          </div>
        </div>

        {/* Revenue */}
        <div className="rounded-[20px] p-5 sm:p-7" style={CARD_BG}>
          <div className="flex items-center gap-2.5 sm:gap-3 mb-5 flex-wrap">
            <span
              className="flex h-8 w-8 items-center justify-center rounded-[10px] shrink-0"
              style={{ background: "hsl(var(--cd-accent-hsl)/0.12)", color: "var(--cd-accent)" }}
            >
              <DollarSign className="h-[15px] w-[15px]" />
            </span>
            <span className="font-semibold text-base flex-1 inline-flex items-center gap-2" style={{ ...GROTESK, color: "var(--cd-text)" }}>
              Ingresos por mes
              <HelpTooltip id="statsRevenue" />
            </span>
            <div className="flex gap-3.5 text-xs font-medium" style={{ color: "var(--cd-muted)" }}>
              <span className="inline-flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-[3px]" style={{ background: "linear-gradient(135deg,var(--cd-accent),var(--cd-accent-deep))" }} />
                Cobrado
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-[3px]" style={{ background: "linear-gradient(135deg,#fcd34d,#f59e0b)" }} />
                Pendiente
              </span>
            </div>
          </div>
          {revenueData.length === 0 ? (
            <p className="text-sm py-8 text-center" style={{ color: "var(--cd-muted)" }}>No hay pagos en el período</p>
          ) : (
            <div className="h-72 lg:h-80">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={revenueData} margin={{ top: 20, right: 8, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="gradCobrado" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" style={{ stopColor: "var(--cd-accent)" }} />
                      <stop offset="100%" style={{ stopColor: "var(--cd-accent-deep)" }} />
                    </linearGradient>
                    <linearGradient id="gradPendiente" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#fcd34d" />
                      <stop offset="100%" stopColor="#f59e0b" />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke="hsl(var(--cd-tint-hsl)/0.08)" vertical={false} />
                  <XAxis
                    dataKey="month"
                    tick={{ fontSize: 11.5, fill: "var(--cd-muted)", fontFamily: "'Space Grotesk', sans-serif" }}
                    axisLine={{ stroke: "hsl(var(--cd-tint-hsl)/0.1)" }}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fontSize: 10.5, fill: "var(--cd-dim)", fontFamily: "'Space Grotesk', sans-serif" }}
                    tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`}
                    axisLine={{ stroke: "hsl(var(--cd-tint-hsl)/0.1)" }}
                    tickLine={false}
                  />
                  <Tooltip
                    formatter={(value: number) => formatCurrency(value)}
                    cursor={{ fill: "hsl(var(--cd-tint-hsl)/0.05)" }}
                    contentStyle={{
                      borderRadius: 12,
                      border: "1px solid hsl(var(--cd-tint-hsl)/0.2)",
                      background: "var(--cd-card1)",
                      color: "var(--cd-text)",
                    }}
                    labelStyle={{ color: "var(--cd-text)", fontWeight: 600 }}
                  />
                  <Bar dataKey="cobrado" name="Cobrado" fill="url(#gradCobrado)" radius={[8, 8, 3, 3]}>
                    <LabelList
                      dataKey="cobrado"
                      position="top"
                      formatter={(v: number) => (v > 0 ? `$${v >= 1000 ? `${Math.round(v / 100) / 10}k` : v}` : "")}
                      style={{ fill: "var(--cd-accent-soft)", fontSize: 10.5, fontWeight: 600, fontFamily: "'Space Grotesk', sans-serif" }}
                    />
                  </Bar>
                  <Bar dataKey="pendiente" name="Pendiente" fill="url(#gradPendiente)" radius={[8, 8, 3, 3]}>
                    <LabelList
                      dataKey="pendiente"
                      position="top"
                      formatter={(v: number) => (v > 0 ? `$${v >= 1000 ? `${Math.round(v / 100) / 10}k` : v}` : "")}
                      style={{ fill: "#fcd34d", fontSize: 10.5, fontWeight: 600, fontFamily: "'Space Grotesk', sans-serif" }}
                    />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
        </TabsContent>

        {/* ══════════ ACTIVIDAD: tu agenda en números ══════════ */}
        <TabsContent value="actividad" className="space-y-6 mt-0">

        {/* KPIs de actividad (con tendencia vs período anterior) */}
        <div className="grid grid-cols-3 gap-3">
          <KpiCard
            icon={CalendarCheck}
            label="Citas"
            value={String(kpis.totalCitas)}
            color="text-primary"
            trend={<TrendBadge value={trends?.citas ?? null} />}
          />
          <KpiCard icon={Activity} label="Ocupación" value={`${kpis.occupancy}%`} color="text-primary" />
          <KpiCard
            icon={TrendingDown}
            label="Ausencias"
            value={`${kpis.noShowRate}%`}
            color="text-destructive"
            trend={<TrendBadge value={trends?.ausencias ?? null} suffix=" pts" invert />}
          />
        </div>

        {/* Gráficos de actividad en dos columnas en desktop */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Occupancy */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Activity className="h-5 w-5 text-primary" />
              Ocupación semanal de agenda
              <HelpTooltip id="statsOccupancy" />
            </CardTitle>
          </CardHeader>
          <CardContent>
            {occupancyData.length === 0 ? (
              <p className="text-sm text-muted-foreground py-8 text-center">
                Se necesita una semana tipo configurada y al menos una cita en el período.
              </p>
            ) : (
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={occupancyData}>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                    <XAxis dataKey="week" tick={{ fontSize: 12 }} />
                    <YAxis unit="%" domain={[0, 100]} tick={{ fontSize: 12 }} />
                    <Tooltip
                      formatter={(v: number) => [`${v}%`, "Ocupación"]}
                      contentStyle={{ borderRadius: 8, border: "1px solid hsl(var(--border))", background: "hsl(var(--card))" }}
                    />
                    <Line type="monotone" dataKey="ocupacion" stroke="hsl(var(--primary))" strokeWidth={2} dot={{ r: 3 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Per-professional */}
        {professionalRows.length > 1 && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <Users className="h-5 w-5 text-primary" />
                Desempeño por profesional
                <HelpTooltip id="statsByProfessional" />
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {professionalRows.map((p) => (
                  <div key={p.userId} className="flex items-center justify-between gap-3 p-3 rounded-lg border">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-3 h-3 rounded-full shrink-0" style={{ background: p.color }} />
                      <p className="font-medium text-sm truncate">{p.name}</p>
                    </div>
                    <div className="flex items-center gap-4 text-sm shrink-0">
                      <div className="text-right">
                        <p className="font-semibold">{p.citas}</p>
                        <p className="text-xs text-muted-foreground">citas</p>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold text-destructive">{p.noShowRate}%</p>
                        <p className="text-xs text-muted-foreground">ausencias</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Días de la semana */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <CalendarDays className="h-5 w-5 text-primary" />
              Tu semana: días con más sesiones
            </CardTitle>
          </CardHeader>
          <CardContent>
            {weekdayData.every((d) => d.count === 0) ? (
              <p className="text-sm text-muted-foreground py-8 text-center">No hay datos de citas en el período</p>
            ) : (
              (() => {
                const maxDay = Math.max(...weekdayData.map((d) => d.count), 1);
                return (
                  <div className="space-y-2">
                    {weekdayData.map((d) => (
                      <div key={d.day} className="flex items-center gap-3">
                        <span className="text-xs w-8 shrink-0 text-muted-foreground font-medium">{d.day}</span>
                        <div className="flex-1 h-5 rounded-md bg-muted overflow-hidden">
                          <div
                            className={`h-full rounded-md ${d.count >= maxDay * 0.8 ? "bg-primary" : "bg-primary/40"}`}
                            style={{ width: `${(d.count / maxDay) * 100}%` }}
                          />
                        </div>
                        <span className="text-xs font-semibold w-8 text-right tabular-nums">{d.count}</span>
                      </div>
                    ))}
                  </div>
                );
              })()
            )}
          </CardContent>
        </Card>

        {/* Hours */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-primary" />
              Horas con mayor cantidad de citas
              <HelpTooltip id="statsHourDistribution" />
            </CardTitle>
          </CardHeader>
          <CardContent>
            {hourData.length === 0 ? (
              <p className="text-sm text-muted-foreground py-8 text-center">No hay datos de citas en el período</p>
            ) : (
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={hourData}>
                    <XAxis dataKey="hour" tick={{ fontSize: 12 }} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
                    <Tooltip
                      formatter={(value: number) => [`${value} citas`, "Cantidad"]}
                      contentStyle={{ borderRadius: 8, border: "1px solid hsl(var(--border))", background: "hsl(var(--card))" }}
                    />
                    <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                      {hourData.map((entry, i) => (
                        <Cell
                          key={i}
                          fill={entry.count >= maxHourCount * 0.8 ? "hsl(var(--primary))" : "hsl(var(--muted-foreground) / 0.3)"}
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>

        {/* No-show trend */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center justify-between gap-2">
              <span className="flex items-center gap-2">
                <TrendingDown className="h-5 w-5 text-destructive" />
                Tendencia de ausencias
                <HelpTooltip id="statsNoShow" />
              </span>
              {(() => {
                const { delta, curRate, prevRate } = noShowTrend;
                if (prevRate === 0 && curRate === 0) return null;
                const isUp = delta > 0;
                const isDown = delta < 0;
                const Icon = isUp ? ArrowUpRight : isDown ? ArrowDownRight : Minus;
                const colorClass = isUp ? "text-destructive" : isDown ? "text-[hsl(var(--success,142_70%_45%))]" : "text-muted-foreground";
                return (
                  <span className={`flex items-center gap-1 text-sm font-semibold ${colorClass}`}>
                    <Icon className="h-4 w-4" />
                    {delta > 0 ? "+" : ""}{delta}% vs mes anterior
                  </span>
                );
              })()}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {noShowData.length === 0 ? (
              <p className="text-sm text-muted-foreground py-8 text-center">No hay datos suficientes</p>
            ) : (
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={noShowData}>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                    <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                    <YAxis unit="%" allowDecimals={false} tick={{ fontSize: 12 }} domain={[0, 'auto']} />
                    <Tooltip
                      formatter={(value: number, name: string) => {
                        if (name === "rate") return [`${value}%`, "Tasa ausencia"];
                        return [value, name];
                      }}
                      contentStyle={{ borderRadius: 8, border: "1px solid hsl(var(--border))", background: "hsl(var(--card))" }}
                    />
                    <Line type="monotone" dataKey="rate" stroke="hsl(var(--destructive))" strokeWidth={2} dot={{ r: 4 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Origen de las reservas */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Globe className="h-5 w-5 text-primary" />
              Origen de las reservas
            </CardTitle>
          </CardHeader>
          <CardContent>
            {sourceData.total === 0 ? (
              <p className="text-sm text-muted-foreground py-8 text-center">Sin citas en el período</p>
            ) : (
              <div className="space-y-2.5">
                {([
                  ["Vos (panel)", sourceData.panel, "bg-muted-foreground/50"],
                  ["Web pública", sourceData.publica, "bg-primary"],
                  ["Portal", sourceData.portal, "bg-emerald-500"],
                ] as const).map(([label, count, color]) => {
                  const pctVal = Math.round((count / sourceData.total) * 100);
                  return (
                    <div key={label} className="flex items-center gap-2">
                      <span className="text-xs w-20 shrink-0 text-muted-foreground">{label}</span>
                      <div className="flex-1 h-2.5 rounded-full bg-muted overflow-hidden">
                        <div className={`h-full rounded-full ${color}`} style={{ width: `${pctVal}%` }} />
                      </div>
                      <span className="text-xs font-semibold w-10 text-right tabular-nums">{pctVal}%</span>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        </div>
        </TabsContent>

        {/* ══════════ PACIENTES: retención y riesgo ══════════ */}
        <TabsContent value="pacientes" className="space-y-6 mt-0">

        {/* KPIs de pacientes */}
        <div className="grid grid-cols-2 gap-3">
          <KpiCard icon={Users} label="Pacientes activos" value={String(kpis.activePatients)} color="text-primary" />
          <KpiCard icon={UserX} label="Sin próxima cita" value={String(inactivePatients.length)} color="text-[hsl(var(--warning))]" />
        </div>

        {/* New vs returning */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Users className="h-5 w-5 text-primary" />
              Pacientes nuevos vs recurrentes
              <HelpTooltip id="statsRetention" />
            </CardTitle>
          </CardHeader>
          <CardContent>
            {retentionData.length === 0 ? (
              <p className="text-sm text-muted-foreground py-8 text-center">Sin datos de pagos en el período</p>
            ) : (
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={retentionData}>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                    <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
                    <Tooltip
                      contentStyle={{ borderRadius: 8, border: "1px solid hsl(var(--border))", background: "hsl(var(--card))" }}
                    />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    <Bar dataKey="nuevos" name="Nuevos" stackId="a" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="recurrentes" name="Recurrentes" stackId="a" fill="hsl(var(--muted-foreground) / 0.5)" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Inactive patients */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2 flex-wrap">
              <UserX className="h-5 w-5 text-orange-500" />
              Pacientes en riesgo · sin próxima cita
              <HelpTooltip id="statsInactivePatients" />
              {inactivePatients.length > 0 && (
                <span className="text-sm font-normal text-muted-foreground">({inactivePatients.length})</span>
              )}
            </CardTitle>
            <p className="text-xs text-muted-foreground">
              Pacientes activos que no tienen ninguna cita agendada a futuro. Tocá para abrir su ficha, o escribiles directo.
            </p>
          </CardHeader>
          <CardContent>
            {inactivePatients.length === 0 ? (
              <p className="text-sm text-muted-foreground py-8 text-center">
                🎉 Todos tus pacientes activos tienen su próxima cita agendada
              </p>
            ) : (
              <div className="space-y-2">
                <div className="grid grid-cols-1 xl:grid-cols-2 gap-2">
                {pageInactive.map((p) => {
                  const phone = allPatients.find((x) => x.id === p.id)?.whatsapp_phone || null;
                  return (
                    <div
                      key={p.id}
                      className="flex items-center justify-between gap-3 p-3 rounded-lg border hover:bg-muted/50 transition-colors"
                    >
                      <div
                        className="min-w-0 flex-1 cursor-pointer"
                        onClick={() => navigate(`/patients/${p.id}`)}
                      >
                        <p className="font-medium text-sm truncate">{p.full_name}</p>
                        <p className="text-xs text-muted-foreground">{p.email || "Sin email"}</p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-sm font-semibold text-[hsl(var(--warning))]">
                          {p.daysSinceLast >= 9999 ? "Sin sesiones" : `hace ${p.daysSinceLast} días`}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {p.lastAppointment
                            ? `Última: ${new Date(p.lastAppointment).toLocaleDateString("es-UY", { day: "2-digit", month: "2-digit", year: "2-digit" })}`
                            : "Nunca tuvo cita"}
                        </p>
                      </div>
                      {phone ? (
                        <Button
                          size="sm"
                          variant="outline"
                          className="shrink-0 gap-1.5 h-8"
                          onClick={(e) => {
                            e.stopPropagation();
                            sendWhatsAppToInactive({ ...p, whatsapp_phone: phone });
                          }}
                        >
                          <MessageCircle className="h-3.5 w-3.5" />
                          <span className="hidden sm:inline">WhatsApp</span>
                        </Button>
                      ) : (
                        <span className="text-xs text-muted-foreground shrink-0 hidden sm:inline">Sin teléfono</span>
                      )}
                    </div>
                  );
                })}
                </div>
                <ListPagination
                  currentPage={inactivePage}
                  totalPages={inactiveTotalPages}
                  onPageChange={setInactivePage}
                  totalItems={inactivePatients.length}
                  pageSize={ITEMS_PER_PAGE}
                />
              </div>
            )}
          </CardContent>
        </Card>
        </TabsContent>

        </Tabs>
        </div>
      </div>
    </div>
  );
};

interface KpiCardProps {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  color?: string;
  trend?: React.ReactNode;
}
const KpiCard = ({ icon: Icon, label, value, color = "text-primary", trend }: KpiCardProps) => (
  <Card>
    <CardContent className="p-3 sm:p-4">
      <div className="flex items-center gap-2 mb-1">
        <Icon className={`h-4 w-4 ${color}`} />
        <p className="text-xs text-muted-foreground truncate">{label}</p>
      </div>
      <p className="text-lg sm:text-xl font-bold truncate">
        {value}
        {trend && <span className="ml-1.5 align-middle">{trend}</span>}
      </p>
    </CardContent>
  </Card>
);

// Flechita de tendencia vs el período anterior. `invert`: subir es malo
// (ej: ausencias). Sin datos del período anterior → no se muestra nada.
const TrendBadge = ({
  value,
  suffix = "%",
  invert = false,
  className = "",
}: {
  value: number | null;
  suffix?: string;
  invert?: boolean;
  className?: string;
}) => {
  if (value === null || value === 0) return null;
  const isUp = value > 0;
  const good = invert ? !isUp : isUp;
  const Icon = isUp ? ArrowUpRight : ArrowDownRight;
  return (
    <span
      className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold ${className}`}
      style={
        good
          ? { background: "hsl(var(--cd-accent-hsl)/0.1)", border: "1px solid hsl(var(--cd-accent-hsl)/0.25)", color: "var(--cd-accent-soft)" }
          : { background: "rgba(251,113,133,0.1)", border: "1px solid rgba(251,113,133,0.25)", color: "#fda4af" }
      }
    >
      <Icon className="h-3 w-3" />
      {isUp ? "+" : ""}
      {value}
      {suffix}
    </span>
  );
};

export default Statistics;
