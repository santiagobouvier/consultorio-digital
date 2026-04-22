import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, TrendingUp, Building2, UserCog, Users, DollarSign, Activity, Crown, Sparkles } from "lucide-react";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip,
  PieChart, Pie, Cell, LineChart, Line, CartesianGrid, Legend,
} from "recharts";
import { PLAN_DEFINITIONS, normalizePlanCode, getPlanPrice } from "@/lib/plan-definitions";

interface BusinessRow {
  id: string;
  name: string;
  plan_code: string;
  billing_period: string;
  is_demo: boolean;
  is_active: boolean;
  created_at: string;
}

interface SubscriptionRow {
  business_id: string;
  status: string;
  plan_code: string;
  trial_ends_at: string | null;
  cancelled_at: string | null;
}

interface TopRow {
  id: string;
  name: string;
  patients: number;
  professionals: number;
  plan: string;
}

const PLAN_COLORS: Record<string, string> = {
  emprendedor: "#14b8a6",
  esencial: "#06b6d4",
  profesional: "#8b5cf6",
  consultorio: "#f59e0b",
  clinica: "#ec4899",
  personalizado: "#64748b",
};

const STATUS_COLORS: Record<string, string> = {
  active: "#10b981",
  trial: "#f59e0b",
  cancelled: "#ef4444",
  expired: "#6b7280",
  paused: "#a855f7",
};

const STATUS_LABELS: Record<string, string> = {
  active: "Activas",
  trial: "En prueba",
  cancelled: "Canceladas",
  expired: "Expiradas",
  paused: "Pausadas",
};

const fmtMoney = (n: number) =>
  `$ ${n.toLocaleString("es-UY", { maximumFractionDigits: 0 })}`;

export const EstadisticasSection = () => {
  const [loading, setLoading] = useState(true);
  const [includeDemos, setIncludeDemos] = useState(false);
  const [businesses, setBusinesses] = useState<BusinessRow[]>([]);
  const [subscriptions, setSubscriptions] = useState<SubscriptionRow[]>([]);
  const [profCount, setProfCount] = useState<Map<string, number>>(new Map());
  const [patientCount, setPatientCount] = useState<Map<string, number>>(new Map());

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        const [bizRes, subsRes, rolesRes, patRes] = await Promise.all([
          supabase.from("businesses").select("id, name, plan_code, billing_period, is_demo, is_active, created_at"),
          supabase.from("subscriptions").select("business_id, status, plan_code, trial_ends_at, cancelled_at"),
          supabase.from("user_roles").select("business_id, role").in("role", ["owner", "professional"]),
          supabase.from("patients").select("business_id").eq("is_active", true),
        ]);
        setBusinesses(bizRes.data || []);
        setSubscriptions(subsRes.data || []);
        const pc = new Map<string, number>();
        rolesRes.data?.forEach((r: any) => {
          if (r.business_id) pc.set(r.business_id, (pc.get(r.business_id) || 0) + 1);
        });
        setProfCount(pc);
        const ptc = new Map<string, number>();
        patRes.data?.forEach((p: any) => {
          if (p.business_id) ptc.set(p.business_id, (ptc.get(p.business_id) || 0) + 1);
        });
        setPatientCount(ptc);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const filteredBiz = useMemo(
    () => businesses.filter((b) => includeDemos || !b.is_demo),
    [businesses, includeDemos]
  );

  // ── 1) MRR + totales globales
  const totals = useMemo(() => {
    const totalBiz = filteredBiz.length;
    const totalProf = Array.from(profCount.entries())
      .filter(([id]) => filteredBiz.some((b) => b.id === id))
      .reduce((s, [, n]) => s + n, 0);
    const totalPat = Array.from(patientCount.entries())
      .filter(([id]) => filteredBiz.some((b) => b.id === id))
      .reduce((s, [, n]) => s + n, 0);
    const mrr = filteredBiz.reduce((sum, b) => {
      const code = normalizePlanCode(b.plan_code);
      const price = getPlanPrice(code, b.billing_period === "monthly" ? "monthly" : "annual");
      return sum + price;
    }, 0);
    const arpu = totalBiz > 0 ? mrr / totalBiz : 0;
    return { totalBiz, totalProf, totalPat, mrr, arpu };
  }, [filteredBiz, profCount, patientCount]);

  // ── 2) Distribución por plan
  const planDistribution = useMemo(() => {
    const map = new Map<string, number>();
    filteredBiz.forEach((b) => {
      const code = normalizePlanCode(b.plan_code);
      map.set(code, (map.get(code) || 0) + 1);
    });
    return Array.from(map.entries()).map(([code, count]) => ({
      plan: PLAN_DEFINITIONS[code]?.name || code,
      code,
      count,
      color: PLAN_COLORS[code] || "#64748b",
    }));
  }, [filteredBiz]);

  // ── 3) Estado de suscripciones
  const statusDistribution = useMemo(() => {
    const map = new Map<string, number>();
    const filteredIds = new Set(filteredBiz.map((b) => b.id));
    subscriptions
      .filter((s) => filteredIds.has(s.business_id))
      .forEach((s) => {
        let st = s.status || "unknown";
        if (st === "trial" && s.trial_ends_at && new Date(s.trial_ends_at) < new Date()) {
          st = "expired";
        }
        map.set(st, (map.get(st) || 0) + 1);
      });
    return Array.from(map.entries()).map(([status, count]) => ({
      status,
      label: STATUS_LABELS[status] || status,
      count,
      color: STATUS_COLORS[status] || "#64748b",
    }));
  }, [subscriptions, filteredBiz]);

  // ── 4) Crecimiento mensual (últimos 12 meses)
  const monthlyGrowth = useMemo(() => {
    const months: { key: string; label: string; date: Date }[] = [];
    const now = new Date();
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      months.push({
        key,
        label: d.toLocaleDateString("es-UY", { month: "short" }),
        date: d,
      });
    }
    return months.map((m) => {
      const count = filteredBiz.filter((b) => {
        const bd = new Date(b.created_at);
        return (
          bd.getFullYear() === m.date.getFullYear() &&
          bd.getMonth() === m.date.getMonth()
        );
      }).length;
      return { mes: m.label, nuevos: count };
    });
  }, [filteredBiz]);

  // ── 5) Top 5 consultorios (por pacientes)
  const topBusinesses: TopRow[] = useMemo(() => {
    return filteredBiz
      .map((b) => ({
        id: b.id,
        name: b.name,
        patients: patientCount.get(b.id) || 0,
        professionals: profCount.get(b.id) || 0,
        plan: PLAN_DEFINITIONS[normalizePlanCode(b.plan_code)]?.name || b.plan_code,
      }))
      .sort((a, b) => b.patients - a.patients)
      .slice(0, 5);
  }, [filteredBiz, patientCount, profCount]);

  // ── 6) Demo vs Reales
  const demoVsReal = useMemo(() => {
    const real = businesses.filter((b) => !b.is_demo).length;
    const demo = businesses.filter((b) => b.is_demo).length;
    return [
      { tipo: "Reales", count: real, color: "#14b8a6" },
      { tipo: "Demo", count: demo, color: "#f59e0b" },
    ];
  }, [businesses]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-32">
        <Loader2 className="h-8 w-8 animate-spin text-teal-400" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Filter */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-400">
          Métricas calculadas en tiempo real con datos de la plataforma.
        </p>
        <button
          onClick={() => setIncludeDemos((v) => !v)}
          className={`px-3 py-1.5 rounded-md text-xs font-medium border transition-colors ${
            includeDemos
              ? "bg-amber-500/10 border-amber-500/40 text-amber-300"
              : "bg-slate-900/60 border-slate-700 text-slate-400 hover:text-slate-200"
          }`}
        >
          {includeDemos ? "Incluyendo demos" : "Solo consultorios reales"}
        </button>
      </div>

      {/* KPIs principales */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <Kpi label="MRR estimado" value={fmtMoney(totals.mrr)} icon={TrendingUp} accent="teal" />
        <Kpi label="Consultorios" value={totals.totalBiz.toString()} icon={Building2} accent="blue" />
        <Kpi label="Profesionales" value={totals.totalProf.toString()} icon={UserCog} accent="violet" />
        <Kpi label="Pacientes" value={totals.totalPat.toString()} icon={Users} accent="cyan" />
        <Kpi label="ARPU" value={fmtMoney(totals.arpu)} icon={DollarSign} accent="emerald" />
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <ChartCard title="Distribución por plan" subtitle="Consultorios en cada nivel">
          {planDistribution.length === 0 ? (
            <Empty />
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={planDistribution}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                <XAxis dataKey="plan" stroke="#64748b" fontSize={11} />
                <YAxis stroke="#64748b" fontSize={11} allowDecimals={false} />
                <Tooltip
                  contentStyle={{ background: "#0f172a", border: "1px solid #334155", borderRadius: 8, fontSize: 12 }}
                  cursor={{ fill: "rgba(20,184,166,0.05)" }}
                />
                <Bar dataKey="count" radius={[6, 6, 0, 0]}>
                  {planDistribution.map((entry, i) => (
                    <Cell key={i} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

        <ChartCard title="Estado de suscripciones" subtitle="Distribución actual">
          {statusDistribution.length === 0 ? (
            <Empty />
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Pie
                  data={statusDistribution}
                  dataKey="count"
                  nameKey="label"
                  cx="50%"
                  cy="50%"
                  outerRadius={90}
                  innerRadius={50}
                  paddingAngle={2}
                >
                  {statusDistribution.map((entry, i) => (
                    <Cell key={i} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{ background: "#0f172a", border: "1px solid #334155", borderRadius: 8, fontSize: 12 }}
                />
                <Legend
                  iconType="circle"
                  wrapperStyle={{ fontSize: 12, color: "#cbd5e1" }}
                />
              </PieChart>
            </ResponsiveContainer>
          )}
        </ChartCard>
      </div>

      {/* Crecimiento + Demo vs Real */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2">
          <ChartCard title="Crecimiento mensual" subtitle="Nuevos consultorios — últimos 12 meses">
            <ResponsiveContainer width="100%" height={240}>
              <LineChart data={monthlyGrowth}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                <XAxis dataKey="mes" stroke="#64748b" fontSize={11} />
                <YAxis stroke="#64748b" fontSize={11} allowDecimals={false} />
                <Tooltip
                  contentStyle={{ background: "#0f172a", border: "1px solid #334155", borderRadius: 8, fontSize: 12 }}
                />
                <Line
                  type="monotone"
                  dataKey="nuevos"
                  stroke="#14b8a6"
                  strokeWidth={2.5}
                  dot={{ fill: "#14b8a6", r: 4 }}
                  activeDot={{ r: 6 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </ChartCard>
        </div>

        <ChartCard title="Demo vs Reales" subtitle="Composición total">
          <ResponsiveContainer width="100%" height={240}>
            <PieChart>
              <Pie
                data={demoVsReal}
                dataKey="count"
                nameKey="tipo"
                cx="50%"
                cy="50%"
                outerRadius={80}
                label={(e) => `${e.tipo}: ${e.count}`}
                labelLine={false}
                fontSize={11}
              >
                {demoVsReal.map((entry, i) => (
                  <Cell key={i} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{ background: "#0f172a", border: "1px solid #334155", borderRadius: 8, fontSize: 12 }}
              />
            </PieChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      {/* Top 5 consultorios */}
      <ChartCard
        title="Top 5 consultorios"
        subtitle="Por cantidad de pacientes activos"
        icon={<Crown className="h-4 w-4 text-amber-400" />}
      >
        {topBusinesses.length === 0 ? (
          <Empty />
        ) : (
          <div className="divide-y divide-slate-800/60">
            {topBusinesses.map((b, i) => (
              <div key={b.id} className="flex items-center gap-4 py-3 first:pt-1 last:pb-1">
                <div className="h-8 w-8 rounded-lg bg-slate-800/60 border border-slate-700 flex items-center justify-center text-sm font-semibold text-slate-300">
                  {i + 1}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-slate-100 truncate">{b.name}</p>
                  <p className="text-xs text-slate-500">{b.plan}</p>
                </div>
                <div className="flex items-center gap-5 text-xs">
                  <div className="text-right">
                    <p className="text-slate-500">Profs</p>
                    <p className="font-semibold text-slate-200 tabular-nums">{b.professionals}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-slate-500">Pacientes</p>
                    <p className="font-semibold text-teal-400 tabular-nums">{b.patients}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </ChartCard>
    </div>
  );
};

// ── Helpers
const Kpi = ({
  label, value, icon: Icon, accent,
}: { label: string; value: string; icon: any; accent: string }) => {
  const colors: Record<string, string> = {
    teal: "text-teal-400",
    blue: "text-blue-400",
    violet: "text-violet-400",
    cyan: "text-cyan-400",
    emerald: "text-emerald-400",
  };
  return (
    <div className="rounded-xl bg-slate-900/40 border border-slate-800/80 px-4 py-3">
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-[10px] font-medium uppercase tracking-[0.15em] text-slate-500">{label}</span>
        <Icon className={`h-3.5 w-3.5 ${colors[accent]} opacity-80`} />
      </div>
      <p className="text-xl lg:text-2xl font-semibold text-slate-100 tabular-nums">{value}</p>
    </div>
  );
};

const ChartCard = ({
  title, subtitle, children, icon,
}: { title: string; subtitle?: string; children: React.ReactNode; icon?: React.ReactNode }) => (
  <div className="rounded-2xl bg-slate-900/40 border border-slate-800/80 p-5">
    <div className="mb-4 flex items-center gap-2">
      {icon}
      <div>
        <h3 className="text-sm font-semibold text-slate-100">{title}</h3>
        {subtitle && <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p>}
      </div>
    </div>
    {children}
  </div>
);

const Empty = () => (
  <div className="flex flex-col items-center justify-center py-12 text-slate-500">
    <Activity className="h-8 w-8 mb-2 opacity-40" />
    <p className="text-xs">Sin datos para mostrar</p>
  </div>
);

export default EstadisticasSection;
