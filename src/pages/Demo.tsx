import { usePageMeta } from "@/hooks/use-page-meta";
// Demo hub: bloques para elegir qué probar. Pensado para el profesional que
// trabaja solo: primero el recorrido completo, después cada pieza del día a
// día. Estética clara "Luz editorial", como la landing.
import { useNavigate, Link } from "react-router-dom";
import { Globe, Smartphone, LayoutDashboard, FileText, ArrowLeft, ArrowRight, Lock, MessageCircle, Play } from "lucide-react";

const BRAND = "#1f938d";
const TEAL_DEEP = "#14655f";
const BG = "#fbfaf7";
const INK = "#16211c";
const MUTED = "#5b6a63";
const DIM = "#93a09a";
const CARD_BORDER = "1px solid rgba(22,33,28,.09)";
const GROTESK = { fontFamily: "'Space Grotesk', sans-serif" } as const;

interface DemoBlock {
  icon: typeof Globe;
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
      "Probá el sistema sin registrarte: agenda sincronizada, reserva online, WhatsApp automático, portal del paciente y expediente clínico.",
    canonicalPath: "/demo",
  });
  const navigate = useNavigate();

  const blocks: DemoBlock[] = [
    {
      icon: LayoutDashboard,
      title: "Tu agenda en el panel",
      subtitle: "Lo que ves vos, todos los días",
      description: "El panel donde manejás tu día: citas, cobros y pacientes, sincronizado con tu Google Calendar. Probalo con datos de ejemplo.",
      cta: "Ver mi agenda",
      enabled: true,
      onClick: () => navigate("/demo/agenda"),
    },
    {
      icon: Globe,
      title: "Tu web de reservas",
      subtitle: "Lo que ve un paciente nuevo",
      description: "Entra a tu página, ve tus horarios libres reales y reserva su turno solo, sin escribirte ni llamarte.",
      cta: "Reservar un turno",
      enabled: true,
      onClick: () => navigate("/demo/reservar"),
    },
    {
      icon: MessageCircle,
      title: "El WhatsApp automático",
      subtitle: "Lo que le llega al paciente (y a vos)",
      description: "Confirmaciones, recordatorios y avisos que salen solos, con tu nombre. Tal como aparecen en el celular.",
      cta: "Ver el WhatsApp",
      enabled: true,
      onClick: () => navigate("/demo/whatsapp"),
    },
    {
      icon: Smartphone,
      title: "El portal del paciente",
      subtitle: "Lo que ve tu paciente fiel",
      description: "Su espacio con tu marca: próximas sesiones, historial y pagos. Como tu propia app, sin que instale nada.",
      cta: "Entrar al portal",
      enabled: true,
      onClick: () => navigate("/portal-paciente/demo"),
    },
    {
      icon: FileText,
      title: "El expediente clínico",
      subtitle: "La historia de cada paciente",
      description: "La ficha por sesión: notas clínicas, documentos y estado de pago, todo ordenado. Lo que hace la diferencia en el día a día.",
      cta: "Ver el expediente",
      enabled: true,
      onClick: () => navigate("/demo/expediente"),
    },
  ];

  return (
    <div className="min-h-screen px-4 sm:px-6 py-10 sm:py-16" style={{ background: BG, color: INK, fontFamily: "'Instrument Sans', sans-serif" }}>
      {/* Top */}
      <div className="max-w-5xl mx-auto">
        <Link to="/" className="inline-flex items-center gap-2 text-sm font-medium transition-opacity hover:opacity-70 mb-10" style={{ color: MUTED }}>
          <ArrowLeft className="w-4 h-4" /> Volver al inicio
        </Link>

        <div className="text-center mb-10 sm:mb-14">
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight mb-3" style={{ ...GROTESK, letterSpacing: "-0.03em" }}>
            Probá la demo
          </h1>
          <p className="text-base sm:text-lg max-w-2xl mx-auto" style={{ color: MUTED }}>
            La misma plataforma que vas a usar todos los días, con datos de ejemplo.
            Elegí qué ver — nada se guarda y no hay que registrarse.
          </p>
        </div>

        {/* Recorrido guiado: la pieza protagonista — el viaje completo en 2 min */}
        <button
          onClick={() => navigate("/demo/recorrido")}
          className="group w-full mb-8 rounded-[20px] p-6 sm:p-7 flex flex-col sm:flex-row items-center gap-5 text-left transition-transform hover:scale-[1.01] bg-white"
          style={{ border: `1.5px solid ${BRAND}`, boxShadow: "0 24px 50px -30px rgba(31,147,141,0.5)" }}
        >
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center shrink-0" style={{ backgroundColor: BRAND }}>
            <Play className="w-7 h-7 text-white ml-0.5" />
          </div>
          <div className="flex-1 min-w-0 text-center sm:text-left">
            <p className="text-xs font-semibold mb-1" style={{ ...GROTESK, letterSpacing: "0.08em", color: TEAL_DEEP }}>EMPEZÁ POR ACÁ · 2 MINUTOS</p>
            <h2 className="text-xl sm:text-2xl font-bold mb-1" style={GROTESK}>El recorrido completo</h2>
            <p className="text-sm m-0" style={{ color: MUTED }}>
              El paciente reserva → le llega el WhatsApp → el recordatorio → tu agenda → tu Google Calendar. Vivilo en 5 pasos.
            </p>
          </div>
          <span className="inline-flex items-center gap-2 h-11 px-5 rounded-full text-sm font-semibold shrink-0 text-white" style={{ backgroundColor: BRAND }}>
            Empezar
            <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" />
          </span>
        </button>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {blocks.map((b) => (
            <div
              key={b.title}
              className="relative rounded-[18px] bg-white p-6 flex flex-col"
              style={{ border: CARD_BORDER }}
            >
              <div
                className="w-12 h-12 rounded-xl flex items-center justify-center mb-5"
                style={{ backgroundColor: "rgba(31,147,141,0.1)", color: BRAND }}
              >
                <b.icon className="w-6 h-6" />
              </div>

              <p className="text-xs font-semibold mb-1" style={{ color: TEAL_DEEP }}>{b.subtitle}</p>
              <h3 className="text-lg font-bold mb-2" style={GROTESK}>{b.title}</h3>
              <p className="text-sm leading-relaxed mb-6 flex-1" style={{ color: MUTED }}>{b.description}</p>

              {b.enabled ? (
                <button
                  onClick={b.onClick}
                  className="group inline-flex items-center justify-center gap-2 h-11 rounded-xl text-sm font-semibold transition-colors hover:bg-black/[0.03]"
                  style={{ border: "1px solid rgba(22,33,28,.16)", color: INK }}
                >
                  {b.cta}
                  <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" />
                </button>
              ) : (
                <div className="inline-flex items-center justify-center gap-2 h-11 rounded-xl text-sm font-medium" style={{ color: DIM, border: "1px solid rgba(22,33,28,.1)" }}>
                  <Lock className="w-4 h-4" /> Próximamente
                </div>
              )}
            </div>
          ))}

          {/* Cierre: de la demo a probarlo de verdad */}
          <div className="relative rounded-[18px] p-6 flex flex-col justify-center items-start" style={{ background: INK }}>
            <h3 className="text-lg font-bold mb-2" style={{ ...GROTESK, color: BG }}>¿Te imaginás tu día así?</h3>
            <p className="text-sm leading-relaxed mb-5" style={{ color: "rgba(251,250,247,0.6)" }}>
              Probalo con tus datos reales: 7 días gratis, sin tarjeta, y te lo dejamos configurado en una videollamada.
            </p>
            <a
              href="/auth"
              className="inline-flex items-center gap-2 h-11 px-5 rounded-full text-sm font-bold"
              style={{ background: "#2fb583", color: "#071009" }}
            >
              Probar gratis 7 días
              <ArrowRight className="w-4 h-4" />
            </a>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Demo;
