import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  ArrowLeft,
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
} from "lucide-react";
import LoadingPage from "@/components/LoadingPage";
import { useBusinessId } from "@/hooks/use-business-id";
import { useProfessionals } from "@/hooks/use-professionals";
import { ListPagination, usePagination, ITEMS_PER_PAGE } from "@/components/ListPagination";
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
} from "recharts";
import { exportCSV, todayDateString } from "@/lib/csv-export";

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
  const [period, setPeriod] = useState<PeriodKey>("90d");
  const [loading, setLoading] = useState(true);
  const [exportingPDF, setExportingPDF] = useState(false);
  const reportRef = useRef<HTMLDivElement>(null);

  // Raw data
  const [appointments, setAppointments] = useState<Array<{ start_at: string; status: string; professional_id: string | null }>>([]);
  const [payments, setPayments] = useState<Array<{ amount: number; status: string; due_date: string; paid_at: string | null; patient_id: string }>>([]);
  const [slots, setSlots] = useState<Array<{ date: string; status: string }>>([]);
  const [allPatients, setAllPatients] = useState<Array<{ id: string; full_name: string; email: string | null; is_active: boolean; whatsapp_phone: string | null }>>([]);
  const [publicSlug, setPublicSlug] = useState<string | null>(null);

  useEffect(() => {
    if (businessId) loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [businessId]);

  const loadAll = async () => {
    setLoading(true);
    try {
      const [{ data: appts }, { data: pays }, { data: sl }, { data: pts }, { data: biz }] = await Promise.all([
        supabase
          .from("appointments")
          .select("start_at, status, professional_id")
          .eq("business_id", businessId!),
        supabase
          .from("payments")
          .select("amount, status, due_date, paid_at, patient_id")
          .eq("business_id", businessId!),
        supabase
          .from("availability_slots")
          .select("date, status")
          .eq("business_id", businessId!),
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
      setSlots(sl || []);
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
  const slotsInPeriod = useMemo(
    () =>
      slots.filter((s) => {
        const d = new Date(s.date);
        return d >= periodStart && d <= new Date();
      }),
    [slots, periodStart]
  );

  // === KPIs ===
  const kpis = useMemo(() => {
    const validAppts = apptsInPeriod.filter((a) => a.status !== "cancelled");
    const totalCitas = validAppts.length;
    const cobrado = paymentsInPeriod.filter((p) => p.status === "paid").reduce((s, p) => s + p.amount, 0);
    const pendiente = payments.filter((p) => p.status === "pending").reduce((s, p) => s + p.amount, 0);
    const noShow = validAppts.filter((a) => a.status === "no_show").length;
    const noShowRate = totalCitas > 0 ? Math.round((noShow / totalCitas) * 100) : 0;
    const activePatients = allPatients.filter((p) => p.is_active).length;
    const occupied = slotsInPeriod.filter((s) => s.status === "booked").length;
    const totalSlots = slotsInPeriod.length;
    const occupancy = totalSlots > 0 ? Math.round((occupied / totalSlots) * 100) : 0;
    return { totalCitas, cobrado, pendiente, noShowRate, activePatients, occupancy, totalSlots };
  }, [apptsInPeriod, paymentsInPeriod, payments, allPatients, slotsInPeriod]);

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
    return `${window.location.origin}/portal/${publicSlug}`;
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

  // === Occupancy by week (last weeks in period) ===
  const occupancyData = useMemo(() => {
    const map = new Map<string, { booked: number; total: number }>();
    for (const s of slotsInPeriod) {
      const d = new Date(s.date);
      // ISO week key
      const monday = new Date(d);
      const day = monday.getDay() || 7;
      monday.setDate(monday.getDate() - day + 1);
      const key = `${monday.getFullYear()}-${String(monday.getMonth() + 1).padStart(2, "0")}-${String(monday.getDate()).padStart(2, "0")}`;
      if (!map.has(key)) map.set(key, { booked: 0, total: 0 });
      const w = map.get(key)!;
      w.total++;
      if (s.status === "booked") w.booked++;
    }
    return Array.from(map.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-12)
      .map(([k, v]) => ({
        week: k.slice(5).replace("-", "/"),
        ocupacion: v.total > 0 ? Math.round((v.booked / v.total) * 100) : 0,
      }));
  }, [slotsInPeriod]);

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

  // === Inactive patients (90 days) — kept from previous version ===
  const inactivePatients: InactivePatient[] = useMemo(() => {
    const lastApptByPatient = new Map<string, Date>();
    // Need patient_id on appointments — we didn't request it. Re-derive from payments (paid+linked appts not available either).
    // Simpler: use payments due_date as a proxy of patient activity.
    for (const p of payments) {
      const ref = p.paid_at ? new Date(p.paid_at) : new Date(p.due_date);
      const prev = lastApptByPatient.get(p.patient_id);
      if (!prev || ref > prev) lastApptByPatient.set(p.patient_id, ref);
    }
    const now = Date.now();
    return allPatients
      .filter((p) => p.is_active)
      .map((p) => {
        const last = lastApptByPatient.get(p.id) || null;
        const daysSince = last ? Math.floor((now - last.getTime()) / 86400000) : 999;
        return {
          id: p.id,
          full_name: p.full_name,
          email: p.email,
          lastAppointment: last ? last.toISOString() : null,
          daysSinceLast: daysSince,
        };
      })
      .filter((p) => p.daysSinceLast >= 90)
      .sort((a, b) => b.daysSinceLast - a.daysSinceLast);
  }, [allPatients, payments]);

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
    if (!reportRef.current) return;
    try {
      setExportingPDF(true);
      // Dynamic import to keep initial bundle light
      const [{ default: jsPDF }, { default: html2canvas }] = await Promise.all([
        import("jspdf"),
        import("html2canvas"),
      ]);

      // Render at higher scale for sharper output
      const canvas = await html2canvas(reportRef.current, {
        scale: 2,
        backgroundColor: "#ffffff",
        useCORS: true,
        logging: false,
        windowWidth: reportRef.current.scrollWidth,
      });

      const imgData = canvas.toDataURL("image/png");
      const pdf = new jsPDF("p", "mm", "a4");
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const margin = 8;
      const usableWidth = pageWidth - margin * 2;
      const imgHeight = (canvas.height * usableWidth) / canvas.width;

      // Cover header
      pdf.setFontSize(16);
      pdf.text("Estadísticas", margin, 14);
      pdf.setFontSize(10);
      pdf.setTextColor(120);
      pdf.text(`Período: ${PERIOD_LABELS[period]}`, margin, 20);
      pdf.text(`Generado: ${new Date().toLocaleDateString("es-UY")}`, margin, 25);
      pdf.setTextColor(0);

      const topOffset = 30;
      let heightLeft = imgHeight;
      let position = topOffset;

      // First page
      pdf.addImage(imgData, "PNG", margin, position, usableWidth, imgHeight);
      heightLeft -= pageHeight - topOffset;

      // Additional pages
      while (heightLeft > 0) {
        pdf.addPage();
        position = margin - (imgHeight - heightLeft);
        pdf.addImage(imgData, "PNG", margin, position, usableWidth, imgHeight);
        heightLeft -= pageHeight - margin;
      }

      pdf.save(`estadisticas_${todayDateString()}.pdf`);
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

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-6xl mx-auto p-4 sm:p-6 lg:p-8 space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate("/dashboard")} className="shrink-0 h-10 w-10">
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold">Estadísticas</h1>
              <p className="text-sm text-muted-foreground">{PERIOD_LABELS[period]}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Tabs value={period} onValueChange={(v) => setPeriod(v as PeriodKey)}>
              <TabsList>
                <TabsTrigger value="30d">30d</TabsTrigger>
                <TabsTrigger value="90d">90d</TabsTrigger>
                <TabsTrigger value="year">Año</TabsTrigger>
                <TabsTrigger value="all">Todo</TabsTrigger>
              </TabsList>
            </Tabs>
            <Button variant="outline" size="sm" onClick={handleExport} className="gap-2">
              <Download className="h-4 w-4" />
              <span className="hidden sm:inline">Exportar CSV</span>
              <span className="sm:hidden">CSV</span>
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleExportPDF}
              disabled={exportingPDF}
              className="gap-2"
            >
              <FileDown className="h-4 w-4" />
              <span className="hidden sm:inline">
                {exportingPDF ? "Generando..." : "Exportar PDF"}
              </span>
              <span className="sm:hidden">{exportingPDF ? "..." : "PDF"}</span>
            </Button>
          </div>
        </div>

        {/* Reportable content (captured for PDF) */}
        <div ref={reportRef} className="space-y-6 bg-background">
        {/* Cobros destacado */}
        <Card className="border-2 border-primary/20">
          <CardContent className="p-4 sm:p-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <DollarSign className="h-4 w-4 text-primary" />
                  <p className="text-xs sm:text-sm text-muted-foreground">Cobrado en el período</p>
                </div>
                <p className="text-2xl sm:text-3xl font-bold text-primary">{formatCurrency(kpis.cobrado)}</p>
              </div>
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <TrendingUp className="h-4 w-4 text-[hsl(var(--warning))]" />
                  <p className="text-xs sm:text-sm text-muted-foreground">Pendiente de cobro</p>
                </div>
                <p className="text-2xl sm:text-3xl font-bold text-[hsl(var(--warning))]">{formatCurrency(kpis.pendiente)}</p>
              </div>
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <Percent className="h-4 w-4 text-primary" />
                  <p className="text-xs sm:text-sm text-muted-foreground">Tasa de cobranza</p>
                </div>
                {(() => {
                  const total = kpis.cobrado + kpis.pendiente;
                  const rate = total > 0 ? Math.round((kpis.cobrado / total) * 100) : 0;
                  return <p className="text-2xl sm:text-3xl font-bold">{rate}%</p>;
                })()}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* KPI row complementario */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <KpiCard icon={CalendarCheck} label="Citas" value={String(kpis.totalCitas)} color="text-primary" />
          <KpiCard icon={Users} label="Pacientes activos" value={String(kpis.activePatients)} color="text-primary" />
          <KpiCard icon={Activity} label="Ocupación" value={`${kpis.occupancy}%`} color="text-primary" />
          <KpiCard icon={TrendingDown} label="Ausencias" value={`${kpis.noShowRate}%`} color="text-destructive" />
        </div>

        {/* Revenue */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <DollarSign className="h-5 w-5 text-primary" />
              Ingresos por mes
            </CardTitle>
          </CardHeader>
          <CardContent>
            {revenueData.length === 0 ? (
              <p className="text-sm text-muted-foreground py-8 text-center">No hay pagos en el período</p>
            ) : (
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={revenueData}>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                    <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                    <YAxis tick={{ fontSize: 12 }} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
                    <Tooltip
                      formatter={(value: number) => formatCurrency(value)}
                      contentStyle={{ borderRadius: 8, border: "1px solid hsl(var(--border))", background: "hsl(var(--card))" }}
                    />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    <Bar dataKey="cobrado" name="Cobrado" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="pendiente" name="Pendiente" fill="hsl(var(--warning))" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Occupancy */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Activity className="h-5 w-5 text-primary" />
              Ocupación semanal de agenda
            </CardTitle>
          </CardHeader>
          <CardContent>
            {occupancyData.length === 0 ? (
              <p className="text-sm text-muted-foreground py-8 text-center">No hay slots generados en el período</p>
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

        {/* New vs returning */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Users className="h-5 w-5 text-primary" />
              Pacientes nuevos vs recurrentes
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

        {/* Per-professional */}
        {professionalRows.length > 1 && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <Users className="h-5 w-5 text-primary" />
                Desempeño por profesional
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

        {/* Hours */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-primary" />
              Horas con mayor cantidad de citas
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

        {/* Inactive patients */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <UserX className="h-5 w-5 text-orange-500" />
              Pacientes sin actividad en los últimos 90 días
              {inactivePatients.length > 0 && (
                <span className="text-sm font-normal text-muted-foreground">({inactivePatients.length})</span>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {inactivePatients.length === 0 ? (
              <p className="text-sm text-muted-foreground py-8 text-center">
                🎉 Todos tus pacientes activos tuvieron actividad reciente
              </p>
            ) : (
              <div className="space-y-2">
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
                        <p className="text-sm font-semibold text-[hsl(var(--warning))]">{p.daysSinceLast} días</p>
                        <p className="text-xs text-muted-foreground">
                          {p.lastAppointment
                            ? new Date(p.lastAppointment).toLocaleDateString("es-UY", { day: "2-digit", month: "2-digit", year: "2-digit" })
                            : "Sin actividad"}
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
      </div>
    </div>
  );
};

interface KpiCardProps {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  color?: string;
}
const KpiCard = ({ icon: Icon, label, value, color = "text-primary" }: KpiCardProps) => (
  <Card>
    <CardContent className="p-3 sm:p-4">
      <div className="flex items-center gap-2 mb-1">
        <Icon className={`h-4 w-4 ${color}`} />
        <p className="text-xs text-muted-foreground truncate">{label}</p>
      </div>
      <p className="text-lg sm:text-xl font-bold truncate">{value}</p>
    </CardContent>
  </Card>
);

export default Statistics;
