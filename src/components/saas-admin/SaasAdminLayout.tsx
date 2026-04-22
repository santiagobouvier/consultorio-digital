import { useNavigate } from "react-router-dom";
import { Building2, DollarSign, Users, Settings2, Server, ArrowLeft, Stethoscope, BarChart3, ChevronRight, type LucideIcon } from "lucide-react";
import digitalBuildersLogo from "@/assets/logo-digitalbuilders.webp";
import consultorioDigitalLogo from "@/assets/logo-consultorio-digital-white.png";

export type SaasSection = "home" | "consultorios" | "finanzas" | "usuarios" | "planes" | "sistema" | "estadisticas";

interface ModuleItem {
  id: SaasSection;
  label: string;
  description: string;
  icon: LucideIcon;
  accent: keyof typeof ACCENTS;
}

const MODULES: ModuleItem[] = [
  { id: "consultorios", label: "Consultorios", description: "Gestión de clínicas, profesionales y pacientes.", icon: Building2, accent: "teal" },
  { id: "finanzas",     label: "Finanzas",     description: "Ingresos, MRR y suscripciones activas.",         icon: DollarSign, accent: "emerald" },
  { id: "estadisticas", label: "Estadísticas", description: "Métricas, crecimiento y distribución de planes.", icon: BarChart3, accent: "blue" },
  { id: "usuarios",     label: "Usuarios",     description: "Cuentas, roles y permisos globales.",            icon: Users, accent: "blue" },
  { id: "planes",       label: "Planes",       description: "Configuración de planes y límites.",             icon: Settings2, accent: "violet" },
  { id: "sistema",      label: "Sistema",      description: "Salud técnica, logs y configuración global.",    icon: Server, accent: "cyan" },
];

const SECTION_LABELS: Record<Exclude<SaasSection, "home">, string> = {
  consultorios: "Consultorios",
  finanzas: "Finanzas",
  estadisticas: "Estadísticas",
  usuarios: "Usuarios",
  planes: "Planes",
  sistema: "Sistema",
};

interface SaasAdminLayoutProps {
  activeSection: SaasSection;
  onSectionChange: (s: SaasSection) => void;
  children: React.ReactNode;
}

export const SaasAdminLayout = ({ activeSection, onSectionChange, children }: SaasAdminLayoutProps) => {
  const navigate = useNavigate();
  const isHome = activeSection === "home";
  const currentModule = !isHome ? MODULES.find(m => m.id === activeSection) : undefined;

  return (
    <div className="dark min-h-screen flex flex-col bg-[#0e1417] text-slate-100">
      {/* ── Top header (always visible) ── */}
      <header className="sticky top-0 z-30 bg-[#0e1417]/90 backdrop-blur-md border-b border-slate-800/60">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
          {/* Brand — clickable home */}
          <button
            onClick={() => onSectionChange("home")}
            className="flex items-center gap-3 group rounded-lg -ml-1 px-1 py-1 hover:bg-slate-800/40 transition-colors"
            title="Ir al panel principal"
          >
            <img 
              src={consultorioDigitalLogo} 
              alt="Consultorio Digital" 
              className="h-12 w-12 object-contain"
            />
            <div className="text-left leading-tight">
              <p className="text-[10px] font-medium uppercase tracking-[0.18em] text-slate-500">Consultorio Digital</p>
              <p className="text-sm font-semibold text-slate-100 -mt-0.5">Panel de administración</p>
            </div>
          </button>

          {/* Breadcrumb + back */}
          <div className="flex items-center gap-2">
            {!isHome && currentModule && (
              <>
                <div className="hidden sm:flex items-center gap-1.5 text-xs text-slate-400 mr-2">
                  <button
                    onClick={() => onSectionChange("home")}
                    className="hover:text-slate-100 transition-colors"
                  >
                    Panel
                  </button>
                  <ChevronRight className="h-3.5 w-3.5 text-slate-600" />
                  <span className="text-slate-200 font-medium">{currentModule.label}</span>
                </div>
                <button
                  onClick={() => onSectionChange("home")}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium text-slate-300 bg-slate-800/60 hover:bg-slate-800 border border-slate-700/60 hover:text-white transition-colors"
                >
                  <ArrowLeft className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">Volver al panel</span>
                  <span className="sm:hidden">Volver</span>
                </button>
              </>
            )}
            {isHome && (
              <button
                onClick={() => navigate("/")}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium text-slate-400 hover:text-slate-100 hover:bg-slate-800/60 transition-colors"
                title="Salir del panel"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Salir</span>
              </button>
            )}
          </div>
        </div>
      </header>

      {/* ── Main area ── */}
      <main className="flex-1 w-full">
        {isHome ? (
          <HomeDashboard onSectionChange={onSectionChange} />
        ) : (
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 lg:py-8">
            {/* Module title */}
            {currentModule && (
              <div className="mb-6 flex items-center gap-3">
                <div className={`h-10 w-10 rounded-lg flex items-center justify-center bg-slate-900/60 border border-slate-800 ${ACCENTS[currentModule.accent].icon}`}>
                  <currentModule.icon className="h-5 w-5" />
                </div>
                <div>
                  <h1 className="text-xl font-semibold text-slate-100 leading-tight">{currentModule.label}</h1>
                  <p className="text-xs text-slate-500">{currentModule.description}</p>
                </div>
              </div>
            )}
            {children}
          </div>
        )}
      </main>

      {/* ── Footer minimalista ── */}
      <footer className="border-t border-slate-800/60 bg-[#0e1417]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-center gap-2.5">
          <span className="text-[10px] font-medium uppercase tracking-[0.22em] text-slate-600">
            Powered by
          </span>
          <a
            href="https://digitalbuilders.uy"
            target="_blank"
            rel="noopener noreferrer"
            className="opacity-70 hover:opacity-100 transition-opacity inline-flex items-center"
            title="Digital Builders"
          >
            <img
              src={digitalBuildersLogo}
              alt="Digital Builders"
              className="h-6 w-auto object-contain"
            />
          </a>
        </div>
      </footer>
    </div>
  );
};

// ── Home dashboard with floating module blocks ──
const HomeDashboard = ({ onSectionChange }: { onSectionChange: (s: SaasSection) => void }) => {
  return (
    <div className="relative max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10 lg:py-16">
      {/* Subtle ambient glow */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 h-72 w-[42rem] bg-teal-500/5 blur-3xl rounded-full" />
      </div>

      <div className="relative">
        {/* Hero */}
        <div className="text-center max-w-2xl mx-auto mb-10 lg:mb-14">
          <p className="text-[11px] font-medium uppercase tracking-[0.22em] text-teal-400/80 mb-3">Panel principal</p>
          <h1 className="text-2xl sm:text-3xl lg:text-4xl font-semibold text-slate-100 tracking-tight">
            Bienvenido al centro de control
          </h1>
          <p className="mt-3 text-sm text-slate-400">
            Elegí un módulo para gestionar la plataforma de consultorios.
          </p>
        </div>

        {/* Module blocks */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 lg:gap-5">
          {MODULES.map((mod, i) => {
            const Icon = mod.icon;
            const a = ACCENTS[mod.accent];
            return (
              <button
                key={mod.id}
                onClick={() => onSectionChange(mod.id)}
                style={{ animationDelay: `${i * 60}ms` }}
                className="group relative text-left rounded-2xl bg-slate-900/40 border border-slate-800/80 hover:border-slate-700 hover:bg-slate-900/70 transition-all duration-300 p-5 lg:p-6 overflow-hidden animate-fade-in hover:-translate-y-0.5"
              >
                {/* Accent corner glow */}
                <div className={`absolute -top-12 -right-12 h-32 w-32 rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-500 blur-2xl ${a.glowBg}`} />

                <div className="relative flex items-start justify-between mb-5">
                  <div className={`h-12 w-12 rounded-xl flex items-center justify-center bg-slate-950/60 border border-slate-800 group-hover:border-slate-700 transition-colors`}>
                    <Icon className={`h-6 w-6 ${a.icon}`} />
                  </div>
                  <ChevronRight className="h-4 w-4 text-slate-600 group-hover:text-slate-300 group-hover:translate-x-0.5 transition-all" />
                </div>

                <div className="relative">
                  <h3 className="text-base font-semibold text-slate-100 mb-1">{mod.label}</h3>
                  <p className="text-xs text-slate-400 leading-relaxed">{mod.description}</p>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};

const ACCENTS: Record<string, { ring: string; icon: string; glow: string; glowBg: string }> = {
  teal:    { ring: "ring-teal-500/20",    icon: "text-teal-400",    glow: "shadow-[0_0_20px_-10px_rgba(0,165,160,0.7)]",  glowBg: "bg-teal-500/15" },
  blue:    { ring: "ring-blue-500/20",    icon: "text-blue-400",    glow: "shadow-[0_0_20px_-10px_rgba(59,130,246,0.6)]", glowBg: "bg-blue-500/15" },
  emerald: { ring: "ring-emerald-500/20", icon: "text-emerald-400", glow: "shadow-[0_0_20px_-10px_rgba(16,185,129,0.6)]", glowBg: "bg-emerald-500/15" },
  violet:  { ring: "ring-violet-500/20",  icon: "text-violet-400",  glow: "shadow-[0_0_20px_-10px_rgba(139,92,246,0.6)]", glowBg: "bg-violet-500/15" },
  cyan:    { ring: "ring-cyan-500/20",    icon: "text-cyan-400",    glow: "shadow-[0_0_20px_-10px_rgba(6,182,212,0.6)]",  glowBg: "bg-cyan-500/15" },
};

export default SaasAdminLayout;
