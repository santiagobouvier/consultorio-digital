import { useNavigate } from "react-router-dom";
import { Building2, DollarSign, Users, Settings2, Server, ArrowLeft, Activity, TrendingUp, UserCog, type LucideIcon } from "lucide-react";
import { useEffect, useState } from "react";

export type SaasSection = "consultorios" | "finanzas" | "usuarios" | "planes" | "sistema";

interface SaasMetrics {
  estimatedRevenue: number;
  totalBusinesses: number;
  totalProfessionals: number;
  totalPatients: number;
}

interface NavItem {
  id: SaasSection;
  label: string;
  icon: LucideIcon;
}

const NAV_ITEMS: NavItem[] = [
  { id: "consultorios", label: "Consultorios", icon: Building2 },
  { id: "finanzas", label: "Finanzas", icon: DollarSign },
  { id: "usuarios", label: "Usuarios", icon: Users },
  { id: "planes", label: "Planes", icon: Settings2 },
  { id: "sistema", label: "Sistema", icon: Server },
];

// Animated counter for metric values
const AnimatedNumber = ({ value }: { value: number }) => {
  const [display, setDisplay] = useState(0);
  useEffect(() => {
    const duration = 600;
    const start = performance.now();
    const from = display;
    const step = (now: number) => {
      const t = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - t, 3);
      setDisplay(Math.round(from + (value - from) * eased));
      if (t < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);
  return <>{display.toLocaleString("es-UY")}</>;
};

interface SaasAdminLayoutProps {
  activeSection: SaasSection;
  onSectionChange: (s: SaasSection) => void;
  metrics: SaasMetrics;
  children: React.ReactNode;
}

export const SaasAdminLayout = ({ activeSection, onSectionChange, metrics, children }: SaasAdminLayoutProps) => {
  const navigate = useNavigate();

  return (
    <div className="dark min-h-screen flex bg-[#0a0a0f] text-slate-100">
      {/* ── Sidebar ── */}
      <aside className="w-20 lg:w-60 shrink-0 bg-[#08080d] border-r border-slate-800/80 flex flex-col fixed h-screen z-40">
        {/* Logo / brand */}
        <div className="h-20 border-b border-slate-800/80 flex items-center justify-center lg:justify-start lg:px-5 gap-3">
          <div className="h-10 w-10 rounded-lg bg-teal-500/15 border border-teal-500/30 flex items-center justify-center shadow-[0_0_20px_-5px_rgba(0,165,160,0.5)]">
            <Activity className="h-5 w-5 text-teal-400" />
          </div>
          <div className="hidden lg:block">
            <p className="text-xs font-mono uppercase tracking-[0.2em] text-teal-400/80">SaaS</p>
            <p className="text-sm font-bold text-white -mt-0.5">Control</p>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 py-4 px-2 lg:px-3 space-y-1 overflow-y-auto">
          {NAV_ITEMS.map(item => {
            const Icon = item.icon;
            const active = activeSection === item.id;
            return (
              <button
                key={item.id}
                onClick={() => onSectionChange(item.id)}
                className={[
                  "w-full flex items-center gap-3 px-3 py-3 rounded-lg transition-all group relative",
                  active
                    ? "bg-teal-500/10 text-teal-300 shadow-[inset_0_0_0_1px_rgba(0,165,160,0.3)]"
                    : "text-slate-400 hover:text-slate-100 hover:bg-slate-800/50",
                ].join(" ")}
                title={item.label}
              >
                {active && (
                  <span className="absolute left-0 top-1/2 -translate-y-1/2 h-6 w-0.5 bg-teal-400 rounded-r-full shadow-[0_0_10px_rgba(0,165,160,0.8)]" />
                )}
                <Icon className={`h-5 w-5 shrink-0 ${active ? "text-teal-400" : ""}`} />
                <span className="hidden lg:inline text-sm font-medium">{item.label}</span>
              </button>
            );
          })}
        </nav>

        {/* Back to home */}
        <div className="p-2 lg:p-3 border-t border-slate-800/80">
          <button
            onClick={() => navigate("/")}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-slate-500 hover:text-slate-200 hover:bg-slate-800/50 transition-colors"
            title="Volver al inicio"
          >
            <ArrowLeft className="h-4 w-4 shrink-0" />
            <span className="hidden lg:inline text-xs font-medium">Volver al inicio</span>
          </button>
        </div>
      </aside>

      {/* ── Main area ── */}
      <div className="flex-1 ml-20 lg:ml-60 flex flex-col min-w-0">
        {/* Top metrics header — sticky */}
        <header className="sticky top-0 z-30 bg-[#0a0a0f]/95 backdrop-blur-md border-b border-slate-800/80">
          <div className="px-4 lg:px-8 py-4">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <MetricCard
                label="MRR Estimado"
                value={metrics.estimatedRevenue}
                prefix="$"
                icon={TrendingUp}
                accent="teal"
              />
              <MetricCard
                label="Consultorios"
                value={metrics.totalBusinesses}
                icon={Building2}
                accent="blue"
              />
              <MetricCard
                label="Profesionales"
                value={metrics.totalProfessionals}
                icon={UserCog}
                accent="violet"
              />
              <MetricCard
                label="Pacientes"
                value={metrics.totalPatients}
                icon={Users}
                accent="cyan"
              />
            </div>
          </div>
        </header>

        {/* Section content */}
        <main className="flex-1 px-4 lg:px-8 py-6">
          {children}
        </main>
      </div>
    </div>
  );
};

const ACCENTS: Record<string, { ring: string; icon: string; glow: string }> = {
  teal:    { ring: "ring-teal-500/20",    icon: "text-teal-400",    glow: "shadow-[0_0_20px_-10px_rgba(0,165,160,0.7)]" },
  blue:    { ring: "ring-blue-500/20",    icon: "text-blue-400",    glow: "shadow-[0_0_20px_-10px_rgba(59,130,246,0.6)]" },
  emerald: { ring: "ring-emerald-500/20", icon: "text-emerald-400", glow: "shadow-[0_0_20px_-10px_rgba(16,185,129,0.6)]" },
  violet:  { ring: "ring-violet-500/20",  icon: "text-violet-400",  glow: "shadow-[0_0_20px_-10px_rgba(139,92,246,0.6)]" },
  cyan:    { ring: "ring-cyan-500/20",    icon: "text-cyan-400",    glow: "shadow-[0_0_20px_-10px_rgba(6,182,212,0.6)]" },
};

const MetricCard = ({ label, value, icon: Icon, prefix, accent }: { label: string; value: number; icon: LucideIcon; prefix?: string; accent: keyof typeof ACCENTS }) => {
  const a = ACCENTS[accent];
  return (
    <div className={`relative rounded-xl bg-slate-900/40 ring-1 ${a.ring} ${a.glow} px-4 py-3 overflow-hidden`}>
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-[10px] font-mono uppercase tracking-[0.15em] text-slate-500">{label}</span>
        <Icon className={`h-3.5 w-3.5 ${a.icon}`} />
      </div>
      <p className="text-xl lg:text-2xl font-mono font-bold text-white tabular-nums">
        {prefix}<AnimatedNumber value={value} />
      </p>
    </div>
  );
};

export default SaasAdminLayout;
