import { usePageMeta } from "@/hooks/use-page-meta";
// Demo hub: bloques para elegir qué probar. Muestra la misma experiencia desde
// distintas miradas (paciente nuevo en la web, paciente fiel en su portal, y el
// profesional en su panel).
import { useNavigate, Link } from "react-router-dom";
import { Globe, Smartphone, LayoutDashboard, FileText, ArrowLeft, ArrowRight, Lock, MessageCircle, Play } from "lucide-react";

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
  usePageMeta({
    title: "Demo interactiva | Consultorio Digital",
    description:
      "Probá el sistema sin registrarte: reserva online, portal del paciente, agenda del profesional y expediente clínico en una demo interactiva.",
    canonicalPath: "/demo",
  });
  const navigate = useNavigate();

  const blocks: DemoBlock[] = [
    {
      icon: Globe,
      accent: "#00c78a",
      title: "Tu web pública",
      subtitle: "Lo que ve un paciente nuevo",
      description: "Entra a tu web de Consultorio Digital, ve tus horarios disponibles y reserva su turno solo, sin que tengas que escribirle.",
      cta: "Reservar un turno",
      enabled: true,
      onClick: () => navigate("/demo/reservar"),
    },
    {
      icon: MessageCircle,
      accent: "#25d366",
      title: "El WhatsApp automático",
      subtitle: "Lo que le llega al paciente",
      description: "Confirmaciones y recordatorios que salen solos, con tu nombre. El aviso tal como aparece en el celular del paciente.",
      cta: "Ver el WhatsApp",
      enabled: true,
      onClick: () => navigate("/demo/whatsapp"),
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
      icon: FileText,
      accent: "#38bdf8",
      title: "El expediente clínico",
      subtitle: "La historia de cada paciente",
      description: "La ficha por sesión: notas clínicas, documentos y estado de pago, todo ordenado. Lo que hace la diferencia en el día a día.",
      cta: "Ver el expediente",
      enabled: true,
      onClick: () => navigate("/demo/expediente"),
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

        {/* Recorrido guiado: la pieza protagonista — el viaje completo en 2 min */}
        <button
          onClick={() => navigate("/demo/recorrido")}
          className="group w-full mb-8 rounded-2xl border p-6 sm:p-7 flex flex-col sm:flex-row items-center gap-5 text-left transition-transform hover:scale-[1.01]"
          style={{
            borderColor: "rgba(0,199,138,0.4)",
            background: "linear-gradient(135deg, rgba(0,199,138,0.12) 0%, rgba(0,165,160,0.05) 100%)",
            boxShadow: "0 8px 40px rgba(0,199,138,0.12)",
          }}
        >
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center shrink-0" style={{ backgroundColor: "#00c78a" }}>
            <Play className="w-7 h-7 text-black ml-0.5" />
          </div>
          <div className="flex-1 min-w-0 text-center sm:text-left">
            <p className="text-xs font-semibold mb-1" style={{ color: "#00c78a" }}>EMPEZÁ POR ACÁ · 2 MINUTOS</p>
            <h2 className="text-xl sm:text-2xl font-bold text-white mb-1">El recorrido completo</h2>
            <p className="text-sm text-white/60">
              El paciente reserva → le llega el WhatsApp → el recordatorio → tu agenda. Vivilo en 4 pasos.
            </p>
          </div>
          <span className="inline-flex items-center gap-2 h-11 px-5 rounded-xl text-sm font-semibold shrink-0" style={{ backgroundColor: "#00c78a", color: "#000" }}>
            Empezar
            <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" />
          </span>
        </button>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
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
