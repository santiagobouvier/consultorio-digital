// Demo hub: bloques para elegir qué probar. Muestra la misma experiencia desde
// distintas miradas (paciente nuevo en la web, paciente fiel en su portal, y el
// profesional en su panel).
import { useNavigate, Link } from "react-router-dom";
import { Globe, Smartphone, LayoutDashboard, ArrowLeft, ArrowRight, Lock } from "lucide-react";

const BRAND = "#00a5a0";

interface DemoBlock {
  icon: typeof Globe;
  accent: string;
  title: string;
  subtitle: string;
  description: string;
  cta: string;
  enabled: boolean;
  onClick?: () => void;
}

const Demo = () => {
  const navigate = useNavigate();

  const blocks: DemoBlock[] = [
    {
      icon: Globe,
      accent: "#00c78a",
      title: "Tu web pública",
      subtitle: "Lo que ve un paciente nuevo",
      description: "Entra a tu web, ve tus horarios disponibles y reserva su turno solo, sin que tengas que escribirle.",
      cta: "Reservar un turno",
      enabled: true,
      onClick: () => navigate("/demo/reservar"),
    },
    {
      icon: Smartphone,
      accent: "#a78bfa",
      title: "El portal del paciente",
      subtitle: "Lo que ve tu paciente fiel",
      description: "Su espacio con tu marca: próximas sesiones, historial y reservas. Como tu propia app.",
      cta: "Entrar al portal",
      enabled: true,
      onClick: () => navigate("/portal-paciente/demo"),
    },
    {
      icon: LayoutDashboard,
      accent: BRAND,
      title: "Tu agenda en el panel",
      subtitle: "Lo que ves vos",
      description: "El panel donde gestionás tu día: agenda, citas, pacientes y cobros. Probalo con datos de ejemplo.",
      cta: "Ver el panel",
      enabled: true,
      onClick: () => navigate("/demo/agenda"),
    },
  ];

  return (
    <div className="min-h-screen bg-black text-white px-4 sm:px-6 py-10 sm:py-16">
      {/* Top */}
      <div className="max-w-5xl mx-auto">
        <Link to="/" className="inline-flex items-center gap-2 text-sm text-white/50 hover:text-white transition-colors mb-10">
          <ArrowLeft className="w-4 h-4" /> Volver al inicio
        </Link>

        <div className="text-center mb-10 sm:mb-14">
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight mb-3">
            Probá la demo
          </h1>
          <p className="text-base sm:text-lg text-gray-400 max-w-2xl mx-auto font-light">
            Elegí qué querés ver. La misma plataforma, desde las tres miradas: tu paciente nuevo,
            tu paciente fiel y vos.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {blocks.map((b) => (
            <div
              key={b.title}
              className="relative rounded-2xl border border-white/10 p-6 flex flex-col"
              style={{ backgroundColor: "#111111" }}
            >
              <div
                className="w-12 h-12 rounded-xl flex items-center justify-center mb-5"
                style={{ backgroundColor: `${b.accent}1a`, color: b.accent }}
              >
                <b.icon className="w-6 h-6" />
              </div>

              <p className="text-xs font-medium mb-1" style={{ color: b.accent }}>{b.subtitle}</p>
              <h3 className="text-lg font-bold text-white mb-2">{b.title}</h3>
              <p className="text-sm text-white/50 leading-relaxed mb-6 flex-1">{b.description}</p>

              {b.enabled ? (
                <button
                  onClick={b.onClick}
                  className="group inline-flex items-center justify-center gap-2 h-11 rounded-xl text-sm font-semibold text-white transition-transform hover:scale-[1.02]"
                  style={{ backgroundColor: b.accent, boxShadow: `0 4px 20px ${b.accent}40` }}
                >
                  {b.cta}
                  <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" />
                </button>
              ) : (
                <div className="inline-flex items-center justify-center gap-2 h-11 rounded-xl text-sm font-medium text-white/40 border border-white/10">
                  <Lock className="w-4 h-4" /> Próximamente
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default Demo;
