import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, BarChart3, TrendingDown, UserX } from "lucide-react";
import LoadingPage from "@/components/LoadingPage";
import { useBusinessId } from "@/hooks/use-business-id";
import { ListPagination, usePagination, ITEMS_PER_PAGE } from "@/components/ListPagination";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";

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

const Statistics = () => {
  const navigate = useNavigate();
  const { businessId, loading: bizLoading } = useBusinessId();
  const [loading, setLoading] = useState(true);
  const [hourData, setHourData] = useState<HourData[]>([]);
  const [noShowData, setNoShowData] = useState<NoShowMonth[]>([]);
  const [inactivePatients, setInactivePatients] = useState<InactivePatient[]>([]);
  const [inactivePage, setInactivePage] = useState(1);

  useEffect(() => {
    if (businessId) loadStats();
  }, [businessId]);

  const loadStats = async () => {
    try {
      // Fetch all appointments for this business
      const { data: appointments } = await supabase
        .from("appointments")
        .select("start_at, status")
        .eq("business_id", businessId!);

      if (appointments) {
        // 1. Peak hours
        const hourCounts: Record<number, number> = {};
        for (let h = 0; h < 24; h++) hourCounts[h] = 0;
        for (const a of appointments) {
          if (a.status === "cancelled") continue;
          const hour = new Date(a.start_at).getHours();
          hourCounts[hour]++;
        }
        const hours: HourData[] = Object.entries(hourCounts)
          .filter(([_, c]) => c > 0)
          .map(([h, c]) => ({ hour: `${h.padStart(2, "0")}:00`, count: c }))
          .sort((a, b) => a.hour.localeCompare(b.hour));
        setHourData(hours);

        // 2. No-show rate by month
        const monthMap = new Map<string, { total: number; noShow: number }>();
        for (const a of appointments) {
          if (a.status === "cancelled") continue;
          const d = new Date(a.start_at);
          const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
          if (!monthMap.has(key)) monthMap.set(key, { total: 0, noShow: 0 });
          const m = monthMap.get(key)!;
          m.total++;
          if (a.status === "no_show") m.noShow++;
        }
        const months: NoShowMonth[] = Array.from(monthMap.entries())
          .sort(([a], [b]) => a.localeCompare(b))
          .slice(-12)
          .map(([month, d]) => ({
            month: formatMonth(month),
            total: d.total,
            noShow: d.noShow,
            rate: d.total > 0 ? Math.round((d.noShow / d.total) * 100) : 0,
          }));
        setNoShowData(months);
      }

      // 3. Inactive patients (no appointment in last 90 days)
      const ninetyDaysAgo = new Date();
      ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

      const { data: patients } = await supabase
        .from("patients")
        .select("id, full_name, email")
        .eq("business_id", businessId!)
        .eq("is_active", true);

      if (patients && patients.length > 0) {
        const patientIds = patients.map(p => p.id);
        const { data: recentAppts } = await supabase
          .from("appointments")
          .select("patient_id, start_at")
          .in("patient_id", patientIds)
          .not("status", "in", '("cancelled")')
          .order("start_at", { ascending: false });

        const lastApptMap = new Map<string, string>();
        for (const a of recentAppts || []) {
          if (a.patient_id && !lastApptMap.has(a.patient_id)) {
            lastApptMap.set(a.patient_id, a.start_at);
          }
        }

        const now = Date.now();
        const inactive: InactivePatient[] = patients
          .map(p => {
            const last = lastApptMap.get(p.id);
            const lastDate = last ? new Date(last) : null;
            const daysSince = lastDate ? Math.floor((now - lastDate.getTime()) / (1000 * 60 * 60 * 24)) : 999;
            return {
              id: p.id,
              full_name: p.full_name,
              email: p.email,
              lastAppointment: last || null,
              daysSinceLast: daysSince,
            };
          })
          .filter(p => p.daysSinceLast >= 90)
          .sort((a, b) => b.daysSinceLast - a.daysSinceLast);

        setInactivePatients(inactive);
      }
    } catch (error) {
      console.error("Error loading stats:", error);
    } finally {
      setLoading(false);
    }
  };

  const formatMonth = (key: string) => {
    const [y, m] = key.split("-");
    const months = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
    return `${months[parseInt(m) - 1]} ${y.slice(2)}`;
  };

  const maxHourCount = Math.max(...hourData.map(h => h.count), 1);

  if (bizLoading || loading) return <LoadingPage />;

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-5xl mx-auto p-4 sm:p-6 lg:p-8 space-y-6">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate("/dashboard")} className="shrink-0 h-10 w-10">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold">Estadísticas</h1>
            <p className="text-sm text-muted-foreground">Métricas calculadas desde tus citas y pacientes</p>
          </div>
        </div>

        {/* Peak hours */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-primary" />
              Horas con mayor cantidad de citas
            </CardTitle>
          </CardHeader>
          <CardContent>
            {hourData.length === 0 ? (
              <p className="text-sm text-muted-foreground py-8 text-center">No hay datos de citas aún</p>
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

        {/* No-show rate */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <TrendingDown className="h-5 w-5 text-destructive" />
              Tasa de ausencias por mes
            </CardTitle>
          </CardHeader>
          <CardContent>
            {noShowData.length === 0 ? (
              <p className="text-sm text-muted-foreground py-8 text-center">No hay datos suficientes</p>
            ) : (
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={noShowData}>
                    <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                    <YAxis unit="%" allowDecimals={false} tick={{ fontSize: 12 }} />
                    <Tooltip
                      formatter={(value: number, name: string) => {
                        if (name === "rate") return [`${value}%`, "Tasa ausencia"];
                        return [value, name];
                      }}
                      contentStyle={{ borderRadius: 8, border: "1px solid hsl(var(--border))", background: "hsl(var(--card))" }}
                    />
                    <Bar dataKey="rate" fill="hsl(var(--destructive))" radius={[4, 4, 0, 0]} />
                  </BarChart>
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
              Pacientes sin cita en los últimos 90 días
              {inactivePatients.length > 0 && (
                <span className="text-sm font-normal text-muted-foreground">({inactivePatients.length})</span>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {inactivePatients.length === 0 ? (
              <p className="text-sm text-muted-foreground py-8 text-center">
                🎉 Todos tus pacientes activos tuvieron cita recientemente
              </p>
            ) : (
              <div className="space-y-2 max-h-[400px] overflow-y-auto">
                {inactivePatients.map(p => (
                  <div
                    key={p.id}
                    className="flex items-center justify-between gap-3 p-3 rounded-lg border hover:bg-muted/50 cursor-pointer transition-colors"
                    onClick={() => navigate(`/patients/${p.id}`)}
                  >
                    <div className="min-w-0">
                      <p className="font-medium text-sm truncate">{p.full_name}</p>
                      <p className="text-xs text-muted-foreground">{p.email || "Sin email"}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-sm font-semibold text-orange-500">{p.daysSinceLast} días</p>
                      <p className="text-xs text-muted-foreground">
                        {p.lastAppointment
                          ? new Date(p.lastAppointment).toLocaleDateString("es-UY", { day: "2-digit", month: "2-digit", year: "2-digit" })
                          : "Sin citas"}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Statistics;
