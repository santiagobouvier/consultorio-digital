import { usePageMeta } from "@/hooks/use-page-meta";
import { useJsonLd } from "@/hooks/use-json-ld";
import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { 
  Users, 
  Calendar, 
  HelpCircle, 
  Check, 
  Shield, 
  CreditCard, 
  Bell, 
  UserCheck, 
  Lock, 
  Sparkles,
  AlertTriangle,
  ArrowRight,
  Clock,
  Eye,
  Palette,
  CalendarCheck,
  Download,
  BarChart3,
  Link2,
  Send,
  LayoutDashboard,
  MessageCircle,
  ExternalLink,
  ShieldCheck,
} from "lucide-react";
import PricingCard from "@/components/PricingCard";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { PLAN_DEFINITIONS, PUBLIC_PLAN_ORDER, formatPrice } from "@/lib/plan-definitions";
import { InstallAppButton } from "@/components/InstallAppButton";
import { ScrollReveal } from "@/components/landing/ScrollReveal";
import { AgendaPreview } from "@/components/landing/AgendaPreview";
import { LandingNavbar } from "@/components/landing/LandingNavbar";
import { HeroSection } from "@/components/landing/HeroSection";
import { ScrollToTop } from "@/components/landing/ScrollToTop";
import { PortalPreview, BookingPreview, PaymentsPreview, StatsPreview } from "@/components/landing/LandingPreviews";

// Brand colors
const BRAND = "#00a5a0";
const BRAND_GLOW = "rgba(0, 165, 160, 0.15)";
const BRAND_SHADOW = "rgba(0, 165, 160, 0.35)";
const GREEN = "#00c78a";
const GREEN_BG = "rgba(0, 199, 138, 0.1)";
const GREEN_GLOW = "rgba(0, 199, 138, 0.15)";

const faqItems = [
  {
    question: "¿Qué incluye cada plan?",
    answer: "Todos los planes incluyen el sistema completo: portal del paciente, agenda, cobro online con Mercado Pago, recordatorios automáticos por WhatsApp y email, expediente clínico, estadísticas, app instalable y marca blanca. La diferencia está en tres cosas: la cantidad de pacientes activos, la cantidad de WhatsApps automáticos por mes, y la web propia — incluida desde el plan Esencial."
  },
  {
    question: "¿Cómo es eso de la web propia incluida?",
    answer: "Desde el plan Esencial, el equipo te arma tu página web con tu logo, tu estilo y tu dominio propio (el dominio lo comprás vos, cuesta unos US$ 15 al año). En Esencial es una página completa con inicio, sobre vos, servicios, reservas y contacto. En Profesional el diseño es totalmente a medida. La reserva online queda integrada adentro: tus pacientes agendan sin salir de tu web."
  },
  {
    question: "¿Los recordatorios automáticos tienen costo extra?",
    answer: "No. Cada plan incluye una cantidad generosa de recordatorios de WhatsApp por mes (250 en Emprendedor, 700 en Esencial, 1.500 en Profesional) y los de email son ilimitados en todos los planes. Si llegás al límite de WhatsApps, tus pacientes siguen recibiendo el aviso por email igual."
  },
  {
    question: "¿De qué número le llega el WhatsApp a mis pacientes?",
    answer: "Desde el número oficial de Consultorio Digital, con un mensaje aprobado por WhatsApp que incluye el nombre de tu consultorio y TU número de contacto — si el paciente quiere reprogramar, te escribe directo a vos."
  },
  {
    question: "¿Puedo cambiar de plan en cualquier momento?",
    answer: "Sí, podés escalar tu plan cuando lo necesites. Si pasás a un plan superior, solo pagás la diferencia proporcional."
  },
  {
    question: "¿Qué pasa si supero el límite de pacientes?",
    answer: "Te avisaremos cuando estés cerca del límite. Para superarlo, debés solicitar un upgrade de plan manualmente."
  },
  {
    question: "¿Mis pacientes pueden ver información de otros pacientes?",
    answer: "No. Cada paciente accede solo a su propia información: sus citas, su historial y su estado de pagos. La privacidad está garantizada."
  },
];

const problems = [
  { icon: AlertTriangle, text: "Agenda desordenada entre cuadernos y apps" },
  { icon: AlertTriangle, text: "Pagos que se olvidan o no se registran" },
  { icon: AlertTriangle, text: "Pacientes que no recuerdan sus turnos" },
  { icon: AlertTriangle, text: "Información repartida en planillas y apps" },
  { icon: AlertTriangle, text: "Sin una web propia donde te encuentren y reserven" },
];

// Per-plan feature definitions. El item de recordatorios se personaliza por
// plan con su límite mensual de WhatsApps (getPricingPlans).
const REMINDERS_FEATURE = "Recordatorios automáticos por WhatsApp y email";
const CUSTOM_WEB_FEATURE = "Web propia con tu dominio — la armamos por vos";
// Texto de la web según el nivel del plan
const CUSTOM_WEB_TEXT: Record<string, string> = {
  template: "Web propia con tu dominio — 1 página con inicio, sobre vos, servicios, reservas y contacto",
  custom: "Web completamente personalizada con tu dominio — diseño a medida, la armamos por vos",
};
const allFeatures = [
  CUSTOM_WEB_FEATURE,
  "Portal del paciente",
  "Agenda privada",
  "Gestión de pagos y alertas",
  REMINDERS_FEATURE,
  "Dashboard financiero",
  "App instalable (PWA)",
  "Invitación de pacientes por link",
  "Exportación CSV",
  "Reserva online de turnos",
  "Estadísticas y métricas",
  "Marca blanca (logo y colores)",
  "Cobro online con Mercado Pago",
];

const planFeatures: Record<string, string[]> = {
  // Emprendedor no incluye la web personalizada (la razón para subir de plan)
  emprendedor: allFeatures.filter((f) => f !== CUSTOM_WEB_FEATURE),
  esencial: allFeatures,
  profesional: allFeatures,
  consultorio: allFeatures,
};
const Landing = () => {
  usePageMeta({
    title: "Consultorio Digital | Agenda online para profesionales",
    description:
      "Tu link público de reservas y tu panel privado en un solo lugar: agenda, recordatorios, pacientes y cobros para profesionales de la salud en Uruguay.",
    canonicalPath: "/",
  });

  useJsonLd(
    "landing-faq",
    useMemo(
      () => ({
        "@context": "https://schema.org",
        "@type": "FAQPage",
        mainEntity: faqItems.map((item) => ({
          "@type": "Question",
          name: item.question,
          acceptedAnswer: { "@type": "Answer", text: item.answer },
        })),
      }),
      []
    )
  );

  const [isAnnual, setIsAnnual] = useState(true);
  const whatsappPersonalizado = "https://wa.me/59898543623?text=Hola,%20quiero%20un%20plan%20personalizado%20para%20mi%20consultorio.";

  const getPricingPlans = () => {
    const visiblePlans = PUBLIC_PLAN_ORDER.filter(code => code !== "personalizado");
    
    return visiblePlans.map(planCode => {
      const plan = PLAN_DEFINITIONS[planCode];
      const price = isAnnual ? plan.priceAnnual : plan.priceMonthly;
      const profText = plan.maxProfessionals === 1
        ? "1 profesional"
        : `Hasta ${plan.maxProfessionals} profesionales`;
      const patText = plan.maxPatients === null
        ? "Pacientes activos sin límite"
        : `Hasta ${plan.maxPatients} pacientes activos`;

      const waLimit = plan.whatsappMonthly;

      // Los 3 diferenciales del plan, en grande: pacientes, WhatsApp y web
      const keyFeatures = [
        {
          text: plan.maxPatients === null
            ? "Pacientes ilimitados"
            : `Hasta ${plan.maxPatients} pacientes activos`,
          included: true,
        },
        {
          text: waLimit
            ? `${waLimit.toLocaleString("es-UY")} WhatsApps automáticos por mes`
            : "WhatsApps automáticos sin límite",
          included: true,
        },
        {
          text: CUSTOM_WEB_TEXT[plan.customWebsite] || "Web propia con tu dominio",
          included: plan.customWebsite !== "none",
        },
      ];

      // La base común (sin los diferenciales, que ya van arriba)
      const features = allFeatures
        .filter((f) => f !== REMINDERS_FEATURE && f !== CUSTOM_WEB_FEATURE)
        .map((f) => ({ text: f, included: true }));

      return {
        id: planCode,
        name: plan.name,
        description: plan.description,
        professionals: profText,
        patients: patText,
        price: `${formatPrice(price)}`,
        priceNote: isAnnual ? "UYU / mes (pago anual)" : "UYU / mes",
        annualSavings: isAnnual ? (plan.priceMonthly - plan.priceAnnual) * 12 : 0,
        buttonText: "Empezar 7 días gratis",
        buttonLink: `/auth?plan=${planCode}&billing=${isAnnual ? 'annual' : 'monthly'}`,
        buyText: "Comprar ahora sin prueba",
        buyLink: `/auth?plan=${planCode}&billing=${isAnnual ? 'annual' : 'monthly'}&skip_trial=true`,
        isExternal: false,
        isHighlighted: plan.isHighlighted || false,
        highlightLabel: plan.highlightLabel,
        premium: planCode === "profesional",
        keyFeatures,
        features,
      };
    });
  };

  return (
    <div className="min-h-screen bg-black text-white overflow-x-hidden">
      <LandingNavbar />
      <ScrollToTop />
      {/* Animated parallax background */}
      <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
        <div 
          style={{
            position: 'absolute',
            top: '-20%',
            left: '50%',
            transform: 'translateX(-50%)',
            width: '140%',
            height: '60%',
            background: `radial-gradient(ellipse 80% 50% at 50% 50%, ${BRAND_GLOW}, transparent)`,
          }}
        />
        <div 
          style={{
            position: 'absolute',
            top: '10%',
            left: '15%',
            width: '400px',
            height: '400px',
            borderRadius: '50%',
            background: `radial-gradient(circle, rgba(0, 165, 160, 0.06), transparent 70%)`,
            animation: 'orbFloat1 20s ease-in-out infinite',
            filter: 'blur(40px)',
          }}
        />
        <div 
          style={{
            position: 'absolute',
            top: '40%',
            right: '10%',
            width: '350px',
            height: '350px',
            borderRadius: '50%',
            background: `radial-gradient(circle, rgba(0, 199, 138, 0.05), transparent 70%)`,
            animation: 'orbFloat2 25s ease-in-out infinite',
            filter: 'blur(50px)',
          }}
        />
        <div 
          style={{
            position: 'absolute',
            top: '70%',
            left: '40%',
            width: '500px',
            height: '500px',
            borderRadius: '50%',
            background: `radial-gradient(circle, rgba(0, 165, 160, 0.04), transparent 70%)`,
            animation: 'orbFloat3 30s ease-in-out infinite',
            filter: 'blur(60px)',
          }}
        />
        <div 
          style={{
            position: 'absolute',
            inset: 0,
            backgroundImage: `linear-gradient(rgba(0,165,160,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(0,165,160,0.03) 1px, transparent 1px)`,
            backgroundSize: '60px 60px',
            maskImage: 'linear-gradient(to bottom, transparent, rgba(0,0,0,0.5) 20%, rgba(0,0,0,0.5) 80%, transparent)',
            WebkitMaskImage: 'linear-gradient(to bottom, transparent, rgba(0,0,0,0.5) 20%, rgba(0,0,0,0.5) 80%, transparent)',
          }}
        />
      </div>

      {/* Hero */}
      <HeroSection />

      {/* Problem → Solution Section */}
      <section className="relative px-4 sm:px-6 py-14 sm:py-24 bg-black z-10">
        <div className="max-w-5xl mx-auto">
          <div className="grid md:grid-cols-2 gap-8 md:gap-16">
            <ScrollReveal direction="left">
              <h2 className="text-xl sm:text-2xl font-bold mb-6 text-gray-300">
                ¿Te suena familiar?
              </h2>
              <div className="space-y-4">
                {problems.map((problem, index) => (
                  <ScrollReveal key={index} delay={index * 100}>
                    <div 
                      className="flex items-center gap-3 p-4 rounded-xl border border-red-500/20 transition-all duration-300 hover:border-red-500/30 hover:translate-x-1"
                      style={{ backgroundColor: 'rgba(239, 68, 68, 0.05)' }}
                    >
                      <problem.icon className="w-5 h-5 text-red-400 flex-shrink-0" />
                      <span className="text-gray-300 text-sm sm:text-base">{problem.text}</span>
                    </div>
                  </ScrollReveal>
                ))}
              </div>
            </ScrollReveal>

            <ScrollReveal direction="right" delay={200}>
              <h2 className="text-xl sm:text-2xl font-bold mb-6" style={{ color: GREEN }}>
                La solución
              </h2>
              <div 
                className="p-6 rounded-xl border transition-all duration-500 hover:shadow-lg"
                style={{ backgroundColor: 'rgba(0, 199, 138, 0.05)', borderColor: 'rgba(0, 199, 138, 0.2)' }}
              >
                <ul className="space-y-4">
                  {[
                    "Un sistema privado para tu consultorio",
                    "Todo centralizado y claro",
                    "Acceso para vos y tus pacientes",
                    "Recordatorios automáticos por WhatsApp y email — salen solos",
                    "Tu propia página web con tu dominio — la armamos por vos",
                  ].map((text, i) => (
                    <li key={i} className="flex items-start gap-3">
                      <Check className="w-5 h-5 mt-0.5 flex-shrink-0" style={{ color: GREEN }} />
                      <span className="text-gray-300">{text}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </ScrollReveal>
          </div>
        </div>
      </section>

      {/* "Cómo funciona" Section */}
      <section className="relative px-4 sm:px-6 py-14 sm:py-24 z-10" style={{ backgroundColor: '#080808' }}>
        <div className="max-w-4xl mx-auto">
          <ScrollReveal>
            <h2 className="text-xl sm:text-3xl md:text-4xl font-bold text-center mb-10 sm:mb-16 tracking-tight">
              Empezar es muy fácil
            </h2>
          </ScrollReveal>

          <div className="relative grid grid-cols-1 md:grid-cols-3 gap-8 md:gap-6">
            <div 
              className="hidden md:block absolute top-12 left-[20%] right-[20%] h-px"
              style={{ backgroundColor: 'rgba(0, 199, 138, 0.2)' }}
            />

            {[
              { step: "1", title: "Creá tu cuenta gratis", description: "Registrate en menos de 2 minutos. Sin tarjeta." },
              { step: "2", title: "Configurá tu consultorio", description: "Cargá tus pacientes, servicios y horarios disponibles." },
              { step: "3", title: "Invitá a tus pacientes", description: "Cada paciente accede a su portal propio con tu marca." },
            ].map((item, index) => (
              <ScrollReveal key={item.step} delay={index * 150}>
                <div className="relative text-center">
                  <div 
                    className="w-14 h-14 sm:w-16 sm:h-16 rounded-full flex items-center justify-center mx-auto mb-5 text-2xl sm:text-3xl font-bold relative z-10"
                    style={{ 
                      backgroundColor: '#111111',
                      border: `2px solid ${GREEN}`,
                      color: GREEN,
                      boxShadow: `0 0 30px ${GREEN_GLOW}`,
                    }}
                  >
                    {item.step}
                  </div>
                  <h3 className="text-base sm:text-lg font-semibold text-white mb-2">{item.title}</h3>
                  <p className="text-gray-500 text-sm font-light max-w-xs mx-auto">{item.description}</p>
                </div>
              </ScrollReveal>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════ */}
      {/* FEATURE SHOWCASES                                         */}
      {/* ═══════════════════════════════════════════════════════════ */}

      {/* ── Portal del Paciente con Marca Blanca ── */}
      <section id="funciones" className="relative px-4 sm:px-6 py-14 sm:py-24 z-10 bg-black scroll-mt-20">
        <div className="max-w-7xl mx-auto">
          <div className="grid md:grid-cols-2 gap-8 md:gap-14 items-center">
            <ScrollReveal direction="left">
              <div>
                <div 
                  className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium mb-6"
                  style={{ backgroundColor: 'rgba(147, 51, 234, 0.15)', color: '#a78bfa' }}
                >
                  <Palette className="w-3.5 h-3.5" />
                  Marca blanca
                </div>
                <h2 className="text-xl sm:text-3xl md:text-4xl font-bold mb-4 tracking-tight">
                  Tu portal, tu marca
                </h2>
                <p className="text-gray-400 text-sm sm:text-base leading-relaxed font-light mb-6">
                  Cada paciente accede a un portal exclusivo con <strong className="text-white">tu logo, tus colores y tu nombre</strong>. 
                  Parece tu propia aplicación — porque lo es.
                </p>
                <ul className="space-y-3">
                  {[
                    "Logo y nombre personalizados",
                    "Colores para modo claro y oscuro",
                    "URL propia con tu marca",
                    "Experiencia profesional para tus pacientes",
                  ].map((text, i) => (
                    <li key={i} className="flex items-center gap-3 text-gray-300 text-sm">
                      <Check className="w-4 h-4 flex-shrink-0" style={{ color: GREEN }} />
                      {text}
                    </li>
                  ))}
                </ul>
              </div>
            </ScrollReveal>

            <ScrollReveal direction="right" delay={200}>
              <PortalPreview />
            </ScrollReveal>
          </div>
        </div>
      </section>

      {/* ── Reserva Online de Turnos ── */}
      <section className="relative px-4 sm:px-6 py-14 sm:py-24 z-10" style={{ backgroundColor: '#080808' }}>
        <div className="max-w-7xl mx-auto">
          <div className="grid md:grid-cols-2 gap-8 md:gap-14 items-center">
            <ScrollReveal direction="left">
              <BookingPreview />
            </ScrollReveal>

            <ScrollReveal direction="right" delay={200}>
              <div>
                <div 
                  className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium mb-6"
                  style={{ backgroundColor: GREEN_BG, color: GREEN }}
                >
                  <CalendarCheck className="w-3.5 h-3.5" />
                  Autogestión
                </div>
                <h2 className="text-xl sm:text-3xl md:text-4xl font-bold mb-4 tracking-tight">
                  Tus pacientes reservan solos
                </h2>
                <p className="text-gray-400 text-sm sm:text-base leading-relaxed font-light mb-6">
                  El paciente entra al portal, ve tus <strong className="text-white">horarios disponibles en tiempo real</strong>, 
                  elige fecha y hora, y listo. Sin mensajes de ida y vuelta.
                </p>
                <ul className="space-y-3">
                  {[
                    "Calendario con disponibilidad real",
                    "Selección de modalidad (presencial / online)",
                    "Confirmación instantánea",
                    "El turno aparece directo en tu agenda",
                  ].map((text, i) => (
                    <li key={i} className="flex items-center gap-3 text-gray-300 text-sm">
                      <Check className="w-4 h-4 flex-shrink-0" style={{ color: GREEN }} />
                      {text}
                    </li>
                  ))}
                </ul>
              </div>
            </ScrollReveal>
          </div>
        </div>
      </section>

      {/* ── PWA Instalable con Branding ── */}
      <section className="relative px-4 sm:px-6 py-14 sm:py-24 z-10 bg-black">
        <div className="max-w-4xl mx-auto">
          <ScrollReveal>
            <div className="text-center mb-10 sm:mb-14">
              <div 
                className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium mb-6"
                style={{ backgroundColor: 'rgba(59, 130, 246, 0.15)', color: '#60a5fa' }}
              >
                <Download className="w-3.5 h-3.5" />
                App instalable
              </div>
              <h2 className="text-xl sm:text-3xl md:text-4xl font-bold mb-4 tracking-tight">
                Tu app en el celular de cada paciente
              </h2>
              <p className="text-gray-400 text-sm sm:text-base font-light max-w-2xl mx-auto">
                Tus pacientes instalan el portal como una app en su celular. 
                Aparece con <strong className="text-white">tu nombre y tu logo</strong> en la pantalla de inicio.
              </p>
            </div>
          </ScrollReveal>

          <ScrollReveal delay={200}>
            <div className="flex justify-center items-end gap-6 sm:gap-10">
              {[
                { emoji: "🩺", name: "Mi Psicólogo", label: "Consultorio A", color: '#a78bfa' },
                { emoji: "💆", name: "Centro Bienestar", label: "Consultorio B", color: GREEN },
                { emoji: "🏥", name: "Clínica Salud", label: "Consultorio C", color: BRAND },
              ].map((phone) => (
                <div key={phone.label} className="text-center">
                  <div 
                    className="w-20 sm:w-28 rounded-2xl border p-2 mb-3"
                    style={{ borderColor: 'rgba(59, 130, 246, 0.2)', backgroundColor: '#0a0a0a' }}
                  >
                    <div className="rounded-xl p-3 flex flex-col items-center" style={{ backgroundColor: '#111' }}>
                      <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl mb-1.5 flex items-center justify-center text-lg" style={{ backgroundColor: phone.color }}>
                        {phone.emoji}
                      </div>
                      <p className="text-[7px] sm:text-[8px] text-gray-400 truncate w-full text-center">{phone.name}</p>
                    </div>
                  </div>
                  <p className="text-[10px] sm:text-xs text-gray-500">{phone.label}</p>
                </div>
              ))}
            </div>
          </ScrollReveal>
        </div>
      </section>

      {/* ── Agenda inteligente ── */}
      <section className="relative px-4 sm:px-6 py-14 sm:py-24 z-10" style={{ backgroundColor: '#080808' }}>
        <div className="max-w-7xl mx-auto">
          <div className="grid md:grid-cols-2 gap-8 md:gap-14 items-center">
            <ScrollReveal direction="left">
              <div>
                <div 
                  className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium mb-6"
                  style={{ backgroundColor: GREEN_BG, color: GREEN }}
                >
                  <Calendar className="w-3.5 h-3.5" />
                  Agenda inteligente
                </div>
                <h2 className="text-xl sm:text-3xl md:text-4xl font-bold mb-4 tracking-tight">
                  Agenda inteligente,{" "}
                  <span style={{ color: GREEN }}>visión clara</span>
                </h2>
                <p className="text-gray-400 text-sm sm:text-base leading-relaxed font-light mb-6">
                  Vista diaria, semanal y mensual de tu consultorio.
                  Creá citas en segundos, marcá tu disponibilidad y tené todo bajo control.
                </p>
                <ul className="space-y-3">
                  {[
                    "Citas únicas o semanales en un par de toques",
                    "Filtros rápidos por estado y paciente",
                    "Vistas: día, semana, mes",
                    "Pagos pendientes del día en la agenda",
                  ].map((text, i) => (
                    <li key={i} className="flex items-center gap-3 text-gray-300 text-sm">
                      <Check className="w-4 h-4 flex-shrink-0" style={{ color: GREEN }} />
                      {text}
                    </li>
                  ))}
                </ul>
              </div>
            </ScrollReveal>

            <ScrollReveal direction="right" delay={200}>
              <AgendaPreview />
            </ScrollReveal>
          </div>
        </div>
      </section>

      {/* ── Avisos Automáticos (WhatsApp + Email) ── */}
      <section className="relative px-4 sm:px-6 py-14 sm:py-24 z-10 bg-black">
        <div className="max-w-7xl mx-auto">
          <div className="grid md:grid-cols-2 gap-8 md:gap-14 items-center">
            <ScrollReveal direction="left">
              <div>
                <div
                  className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium mb-6"
                  style={{ backgroundColor: 'rgba(37, 211, 102, 0.15)', color: '#25d366' }}
                >
                  <Bell className="w-3.5 h-3.5" />
                  Piloto automático
                </div>
                <h2 className="text-xl sm:text-3xl md:text-4xl font-bold mb-4 tracking-tight">
                  Recordatorios que salen{" "}
                  <span style={{ color: '#25d366' }}>solos</span>
                </h2>
                <p className="text-gray-400 text-sm sm:text-base leading-relaxed font-light mb-6">
                  Agendás la cita y listo: el sistema le manda al paciente el recordatorio
                  por <strong className="text-white">WhatsApp y email, sin que toques nada</strong>.
                  Como tener una secretaria que nunca se olvida.
                </p>
                <ul className="space-y-3">
                  {[
                    "WhatsApp automático desde un número oficial verificado",
                    "Email automático incluido, sin límite",
                    "Si la cita se cancela o se mueve, el aviso se ajusta solo",
                    "El paciente te responde directo a TU WhatsApp",
                  ].map((text, i) => (
                    <li key={i} className="flex items-center gap-3 text-gray-300 text-sm">
                      <Check className="w-4 h-4 flex-shrink-0" style={{ color: '#25d366' }} />
                      {text}
                    </li>
                  ))}
                </ul>
              </div>
            </ScrollReveal>

            <ScrollReveal direction="right" delay={200}>
              {/* Mock de chat de WhatsApp: el recordatorio como lo ve el paciente */}
              <div
                className="rounded-xl sm:rounded-2xl border border-white/10 overflow-hidden max-w-md mx-auto w-full"
                style={{ backgroundColor: '#0b141a' }}
              >
                <div className="flex items-center gap-3 px-4 py-3" style={{ backgroundColor: '#202c33' }}>
                  <div
                    className="w-9 h-9 rounded-full flex items-center justify-center text-base shrink-0"
                    style={{ backgroundColor: 'rgba(37, 211, 102, 0.2)' }}
                  >
                    💆
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-white truncate">Centro Bienestar</p>
                    <p className="text-[10px]" style={{ color: '#25d366' }}>✓ Cuenta de empresa</p>
                  </div>
                </div>
                <div className="p-4 sm:p-5">
                  <div
                    className="rounded-lg rounded-tl-none px-3.5 py-2.5 text-[13px] leading-relaxed"
                    style={{ backgroundColor: '#202c33', color: 'rgba(255,255,255,0.95)' }}
                  >
                    Hola María 👋 Te recordamos tu próxima sesión con Centro Bienestar:
                    <br />📅 lunes 3 de agosto
                    <br />🕐 15:00 hs
                    <br /><br />
                    Si necesitás reprogramar o cancelar, escribile a tu profesional:{" "}
                    <span style={{ color: '#53bdeb' }}>+598 98 123 456</span> ¡Te esperamos!
                    <span className="block text-right text-[10px] mt-1.5" style={{ color: 'rgba(255,255,255,0.4)' }}>
                      10:00 ✓✓
                    </span>
                  </div>
                  <p className="text-center text-[10px] text-gray-500 mt-4">
                    Enviado automáticamente 24 hs antes de la sesión — configurable
                  </p>
                </div>
              </div>
            </ScrollReveal>
          </div>
        </div>
      </section>

      {/* ── Gestión de Pagos ── */}
      <section className="relative px-4 sm:px-6 py-14 sm:py-24 z-10" style={{ backgroundColor: '#080808' }}>
        <div className="max-w-7xl mx-auto">
          <div className="grid md:grid-cols-2 gap-8 md:gap-14 items-center">
            <ScrollReveal direction="left">
              <PaymentsPreview />
            </ScrollReveal>

            <ScrollReveal direction="right" delay={200}>
              <div>
                <div 
                  className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium mb-6"
                  style={{ backgroundColor: 'rgba(245, 158, 11, 0.15)', color: '#f59e0b' }}
                >
                  <CreditCard className="w-3.5 h-3.5" />
                  Flujo de caja
                </div>
                <h2 className="text-xl sm:text-3xl md:text-4xl font-bold mb-4 tracking-tight">
                  Control total de tus cobros
                </h2>
                <p className="text-gray-400 text-sm sm:text-base leading-relaxed font-light mb-6">
                  Registrá pagos por cita o mensuales, controlá deudas pendientes y 
                  <strong className="text-white"> enviá recordatorios de cobro por WhatsApp</strong> con un clic.
                </p>
                <ul className="space-y-3">
                  {[
                    "Pagos por cita o suscripción mensual",
                    "Alertas de vencidos y por vencer",
                    "Recordatorios de cobro por WhatsApp",
                    "Exportación a CSV para tu contador",
                    "Historial completo por paciente",
                  ].map((text, i) => (
                    <li key={i} className="flex items-center gap-3 text-gray-300 text-sm">
                      <Check className="w-4 h-4 flex-shrink-0" style={{ color: '#f59e0b' }} />
                      {text}
                    </li>
                  ))}
                </ul>
              </div>
            </ScrollReveal>
          </div>
        </div>
      </section>

      {/* ── Invitaciones — Pacientes ── */}
      <section className="relative px-4 sm:px-6 py-14 sm:py-24 z-10 bg-black">
        <div className="max-w-5xl mx-auto">
          <ScrollReveal>
            <div className="text-center mb-10 sm:mb-14">
              <h2 className="text-xl sm:text-3xl md:text-4xl font-bold mb-4 tracking-tight">
                Sumá pacientes en segundos
              </h2>
              <p className="text-gray-400 text-sm sm:text-base font-light max-w-2xl mx-auto">
                Generás un link, lo mandás por WhatsApp y listo. Sin formularios complicados.
              </p>
            </div>
          </ScrollReveal>

          <div className="grid gap-6 max-w-xl mx-auto">
            <ScrollReveal delay={100}>
              <div
                className="p-6 sm:p-8 rounded-xl sm:rounded-2xl border border-white/5 transition-all duration-500 hover:border-white/15"
                style={{ backgroundColor: '#111111' }}
              >
                <div
                  className="w-12 h-12 rounded-xl flex items-center justify-center mb-5"
                  style={{ backgroundColor: GREEN_BG }}
                >
                  <Send className="w-6 h-6" style={{ color: GREEN }} />
                </div>
                <h3 className="text-lg font-bold text-white mb-2">Invitar pacientes</h3>
                <p className="text-gray-500 text-sm leading-relaxed font-light mb-4">
                  Generá un link de invitación único para cada paciente. Lo mandás por WhatsApp y el paciente se activa solo en tu portal.
                </p>
                <div className="flex items-center gap-2 text-[10px]">
                  <span className="px-2 py-1 rounded-md text-gray-400" style={{ backgroundColor: '#1a1a1a' }}>Generar link</span>
                  <ArrowRight className="w-3 h-3 text-gray-600" />
                  <span className="px-2 py-1 rounded-md text-gray-400" style={{ backgroundColor: '#1a1a1a' }}>
                    <MessageCircle className="w-3 h-3 inline mr-1" style={{ color: '#25d366' }} />
                    WhatsApp
                  </span>
                  <ArrowRight className="w-3 h-3 text-gray-600" />
                  <span className="px-2 py-1 rounded-md font-medium" style={{ backgroundColor: GREEN_BG, color: GREEN }}>✓ Activo</span>
                </div>
              </div>
            </ScrollReveal>
          </div>
        </div>
      </section>

      {/* ── Estadísticas y Centro de Control ── */}
      <section className="relative px-4 sm:px-6 py-14 sm:py-24 z-10" style={{ backgroundColor: '#080808' }}>
        <div className="max-w-7xl mx-auto">
          <div className="grid md:grid-cols-2 gap-8 md:gap-14 items-center">
            <ScrollReveal direction="left">
              <div>
                <div 
                  className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium mb-6"
                  style={{ backgroundColor: 'rgba(59, 130, 246, 0.15)', color: '#60a5fa' }}
                >
                  <BarChart3 className="w-3.5 h-3.5" />
                  Visibilidad
                </div>
                <h2 className="text-xl sm:text-3xl md:text-4xl font-bold mb-4 tracking-tight">
                  Entendé tu consultorio con datos
                </h2>
                <p className="text-gray-400 text-sm sm:text-base leading-relaxed font-light mb-6">
                  Dashboard con métricas en tiempo real. <strong className="text-white">Centro de control</strong> con el resumen del día y acciones rápidas.
                </p>
                <ul className="space-y-3">
                  {[
                    "Pacientes activos y tendencias",
                    "Citas por período",
                    "Ingresos y cobros pendientes",
                    "Resumen diario con acciones rápidas",
                  ].map((text, i) => (
                    <li key={i} className="flex items-center gap-3 text-gray-300 text-sm">
                      <Check className="w-4 h-4 flex-shrink-0" style={{ color: '#60a5fa' }} />
                      {text}
                    </li>
                  ))}
                </ul>
              </div>
            </ScrollReveal>

            <ScrollReveal direction="right" delay={200}>
              <StatsPreview />
            </ScrollReveal>
          </div>
        </div>
      </section>

      {/* ── Cobro Online con Mercado Pago ── */}
      <section className="relative px-4 sm:px-6 py-14 sm:py-24 z-10 bg-black">
        <div className="max-w-5xl mx-auto">
          <div className="grid md:grid-cols-2 gap-8 md:gap-14 items-center">
            <ScrollReveal direction="left">
              <div 
                className="rounded-xl sm:rounded-2xl border border-white/10 overflow-hidden"
                style={{ backgroundColor: '#0a0a0a' }}
              >
                <div className="flex items-center gap-2 px-3 py-2 border-b border-white/5" style={{ backgroundColor: '#0f0f0f' }}>
                  <div className="flex gap-1">
                    <div className="w-2 h-2 rounded-full bg-red-500/60" />
                    <div className="w-2 h-2 rounded-full bg-yellow-500/60" />
                    <div className="w-2 h-2 rounded-full bg-green-500/60" />
                  </div>
                  <div className="flex-1 mx-4">
                    <div className="h-4 rounded bg-white/5 max-w-[180px] mx-auto flex items-center justify-center">
                      <span className="text-[8px] text-gray-600">tuconsultorio.digital/pagos</span>
                    </div>
                  </div>
                </div>
                <div className="p-4">
                  <div className="text-center mb-3">
                    <div className="w-12 h-12 rounded-full mx-auto mb-2 flex items-center justify-center text-xl" style={{ backgroundColor: 'rgba(0, 165, 160, 0.15)' }}>
                      💳
                    </div>
                    <p className="text-sm font-bold text-white">Centro Bienestar</p>
                    <p className="text-[9px] text-gray-500">Pago de sesión — Martes 15</p>
                  </div>
                  <div className="rounded-lg p-3 mb-2" style={{ backgroundColor: '#111' }}>
                    <p className="text-[9px] text-gray-500 mb-1">Detalle del pago</p>
                    <div className="flex items-center justify-between py-1">
                      <span className="text-[10px] text-gray-300">Consulta individual</span>
                      <span className="text-[10px] text-white font-bold">$2.500</span>
                    </div>
                    <div className="flex items-center justify-between py-1">
                      <span className="text-[10px] text-gray-300">Comisión MP</span>
                      <span className="text-[10px] text-gray-400">-$175</span>
                    </div>
                    <div className="border-t border-white/5 mt-1 pt-1 flex items-center justify-between">
                      <span className="text-[10px] text-gray-300 font-medium">Total a recibir</span>
                      <span className="text-[10px] text-white font-bold">$2.325</span>
                    </div>
                  </div>
                  <div 
                    className="rounded-lg p-2.5 text-center text-[10px] font-medium flex items-center justify-center gap-1.5"
                    style={{ backgroundColor: '#00a5a0', color: 'white' }}
                  >
                    <CreditCard className="w-3 h-3" />
                    Pagar con Mercado Pago →
                  </div>
                </div>
              </div>
            </ScrollReveal>

            <ScrollReveal direction="right" delay={200}>
              <div>
                <div 
                  className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium mb-6"
                  style={{ backgroundColor: 'rgba(0, 165, 160, 0.15)', color: '#00a5a0' }}
                >
                  <CreditCard className="w-3.5 h-3.5" />
                  Cobro integrado
                </div>
                <h2 className="text-xl sm:text-3xl md:text-4xl font-bold mb-4 tracking-tight">
                  Cobro online con Mercado Pago
                </h2>
                <p className="text-gray-400 text-sm sm:text-base leading-relaxed font-light mb-6">
                  Tus pacientes pueden <strong className="text-white">pagar las sesiones directamente desde su portal</strong>, 
                  con el botón de Mercado Pago integrado. Vos recibís el dinero en tu cuenta sin complicaciones.
                </p>
                <ul className="space-y-3">
                  {[
                    "Link de pago por cada sesión automáticamente",
                    "El paciente paga con tarjeta, débito o efectivo",
                    "El dinero va directo a tu cuenta de Mercado Pago",
                    "Registro automático del pago en el sistema",
                    "Sin setup complejo: se activa en un clic",
                  ].map((text, i) => (
                    <li key={i} className="flex items-center gap-3 text-gray-300 text-sm">
                      <Check className="w-4 h-4 flex-shrink-0" style={{ color: '#00a5a0' }} />
                      {text}
                    </li>
                  ))}
                </ul>
              </div>
            </ScrollReveal>
          </div>
        </div>
      </section>

      {/* Social Proof Section */}
      <section className="relative px-4 sm:px-6 py-14 sm:py-24 z-10" style={{ backgroundColor: '#080808' }}>
        <div className="max-w-4xl mx-auto">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6">
            {[
              { title: "7 días gratis", subtitle: "Sin tarjeta de crédito requerida", emoji: "🎁" },
              { title: "100% privado", subtitle: "Tus datos y los de tus pacientes, solo tuyos", emoji: "🔒" },
              { title: "Hecho en Uruguay", subtitle: "Para el mercado local, en pesos uruguayos", emoji: "🇺🇾" },
            ].map((stat, index) => (
              <ScrollReveal key={stat.title} delay={index * 120}>
                <div
                  className="text-center p-6 sm:p-8 rounded-xl sm:rounded-2xl border border-white/5 transition-all duration-500 hover:border-white/15"
                  style={{ backgroundColor: '#111111' }}
                >
                  <div className="text-3xl sm:text-4xl mb-3">{stat.emoji}</div>
                  <h3 className="text-base sm:text-lg font-bold text-white mb-1.5">{stat.title}</h3>
                  <p className="text-gray-500 text-xs sm:text-sm font-light">{stat.subtitle}</p>
                </div>
              </ScrollReveal>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section id="pricing" className="relative px-4 sm:px-6 py-14 sm:py-28 bg-black z-10 scroll-mt-20">
        <div className="max-w-6xl mx-auto">
          <ScrollReveal>
            <div className="text-center mb-8 sm:mb-12">
              <h2 className="text-xl sm:text-3xl md:text-4xl font-bold mb-3 sm:mb-4 tracking-tight">
                Planes según tu consultorio
              </h2>
              <p className="text-gray-500 text-sm sm:text-lg max-w-2xl mx-auto font-light">
                Elegí el plan según la cantidad de pacientes que manejás hoy. Podés cambiarlo cuando quieras.
              </p>
            </div>
          </ScrollReveal>

          {/* No-card trust banner */}
          <ScrollReveal delay={50}>
            <div className="max-w-3xl mx-auto mb-8 sm:mb-10">
              <div
                className="relative rounded-2xl border p-5 sm:p-6 flex items-start sm:items-center gap-4 overflow-hidden"
                style={{
                  backgroundColor: "rgba(0, 165, 160, 0.08)",
                  borderColor: "rgba(0, 165, 160, 0.35)",
                  boxShadow: "0 8px 32px rgba(0, 165, 160, 0.12)",
                }}
              >
                <div
                  className="shrink-0 w-12 h-12 sm:w-14 sm:h-14 rounded-xl flex items-center justify-center border"
                  style={{
                    backgroundColor: "rgba(0, 165, 160, 0.15)",
                    borderColor: "rgba(0, 165, 160, 0.4)",
                  }}
                >
                  <ShieldCheck
                    className="w-6 h-6 sm:w-7 sm:h-7"
                    style={{ color: "#5ee7e2" }}
                    strokeWidth={2}
                  />
                </div>
                <div className="flex-1 min-w-0 text-left">
                  <div
                    className="text-base sm:text-lg font-bold mb-1"
                    style={{ color: "#5ee7e2" }}
                  >
                    Importante: no pedimos tarjeta para los 7 días gratis
                  </div>
                  <p className="text-sm text-white/70 leading-snug">
                    Probá todo el sistema sin riesgo. No vas a ingresar ningún dato de pago hasta que decidas continuar. Dale sin miedo.
                  </p>
                </div>
              </div>
            </div>
          </ScrollReveal>

          {/* Billing Toggle */}
          <ScrollReveal delay={100}>
            <div className="flex flex-col items-center gap-3 mb-8 sm:mb-12">
              <div className="inline-flex items-center gap-4 px-4">
                <span className={`text-sm font-medium transition-colors ${!isAnnual ? 'text-white' : 'text-gray-500'}`}>
                  Pago mensual
                </span>
                <button
                  onClick={() => setIsAnnual(!isAnnual)}
                  className="relative w-14 h-7 rounded-full transition-colors duration-300"
                  style={{ backgroundColor: isAnnual ? GREEN : 'rgba(255, 255, 255, 0.2)' }}
                >
                  <span
                    className="absolute top-1 left-1 w-5 h-5 bg-white rounded-full transition-transform duration-300"
                    style={{ transform: isAnnual ? 'translateX(28px)' : 'translateX(0)' }}
                  />
                </button>
                <span className={`text-sm font-medium transition-colors ${isAnnual ? 'text-white' : 'text-gray-500'}`}>
                  Pago anual
                </span>
              </div>
              
              {isAnnual && (
                <div 
                  className="flex items-center gap-2 text-xs sm:text-sm font-medium px-4 py-1.5 rounded-full"
                  style={{ 
                    backgroundColor: GREEN_BG,
                    color: GREEN,
                    animation: 'fadeSlideUp 0.4s ease-out both',
                  }}
                >
                  <img 
                    src="https://www.mercadopago.com/org-img/MP3/home/logomp3.gif" 
                    alt="Mercado Pago" 
                    className="h-4 sm:h-5 w-auto"
                    loading="lazy"
                  />
                  <span>Hasta 12 cuotas sin interés con Mercado Pago</span>
                </div>
              )}
            </div>
          </ScrollReveal>

          {/* Pricing Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6 mb-8 sm:mb-12 max-w-5xl mx-auto">
            {getPricingPlans().map((plan, index) => (
              <ScrollReveal key={plan.id} delay={index * 100}>
                <PricingCard {...plan} />
              </ScrollReveal>
            ))}
          </div>

          {/* Personalizado */}
          <ScrollReveal delay={200}>
            <div className="max-w-3xl mx-auto">
              <div
                className="relative p-8 sm:p-10 md:p-12 rounded-2xl border border-white/15 text-center"
                style={{
                  background: 'linear-gradient(135deg, #111111 0%, #1a1a2e 50%, #111111 100%)',
                  boxShadow: '0 8px 40px rgba(0, 0, 0, 0.4), 0 0 60px rgba(0, 199, 138, 0.05)',
                }}
              >
                <div className="text-4xl sm:text-5xl mb-4">🚀</div>
                <h3 className="text-xl sm:text-2xl md:text-3xl font-bold text-white mb-3 tracking-tight">
                  ¿Necesitás algo a medida?
                </h3>
                <p className="text-gray-400 text-sm sm:text-base mb-6 sm:mb-8 max-w-lg mx-auto leading-relaxed">
                  ¿Son varios profesionales en un mismo consultorio, o necesitás más capacidad
                  o una configuración especial?
                  <br />
                  Te armamos un plan a tu medida.
                </p>
                <div className="flex flex-wrap items-center justify-center gap-4 sm:gap-6 mb-8 text-sm sm:text-base text-gray-300">
                  {["Equipos de varios profesionales", "Más pacientes", "Configuraciones a medida"].map((text, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <Check className="w-5 h-5 flex-shrink-0" style={{ color: GREEN }} />
                      <span>{text}</span>
                    </div>
                  ))}
                </div>
                <a href={whatsappPersonalizado} target="_blank" rel="noopener noreferrer">
                  <Button
                    className="h-12 sm:h-14 px-10 sm:px-12 text-sm sm:text-base font-semibold rounded-xl transition-all duration-300 hover:scale-[1.03]"
                    variant="outline"
                    style={{
                      borderColor: 'rgba(0, 199, 138, 0.4)',
                      color: 'white',
                      backgroundColor: 'rgba(0, 199, 138, 0.08)',
                    }}
                  >
                    Contactanos por WhatsApp
                  </Button>
                </a>
              </div>
            </div>
          </ScrollReveal>
        </div>
      </section>

      {/* FAQ Section */}
      <section id="preguntas" className="relative px-4 sm:px-6 py-14 sm:py-28 z-10 scroll-mt-20" style={{ backgroundColor: '#080808' }}>
        <div className="max-w-3xl mx-auto">
          <ScrollReveal>
            <div className="text-center mb-10 sm:mb-16">
              <div className="flex justify-center mb-4">
                <div 
                  className="w-12 h-12 sm:w-14 sm:h-14 rounded-xl sm:rounded-2xl flex items-center justify-center"
                  style={{ backgroundColor: GREEN_BG, boxShadow: `0 0 30px ${GREEN_GLOW}` }}
                >
                  <HelpCircle className="w-6 h-6 sm:w-7 sm:h-7" style={{ color: GREEN }} />
                </div>
              </div>
              <h2 className="text-xl sm:text-3xl md:text-4xl font-bold mb-3 sm:mb-4 tracking-tight">
                Preguntas Frecuentes
              </h2>
              <p className="text-gray-500 text-sm sm:text-lg font-light">
                Todo lo que necesitás saber antes de empezar.
              </p>
            </div>
          </ScrollReveal>

          <Accordion type="single" collapsible className="space-y-3">
            {faqItems.map((item, index) => (
              <ScrollReveal key={index} delay={index * 80}>
                <AccordionItem 
                  value={`item-${index}`}
                  className="border border-white/5 rounded-xl sm:rounded-2xl px-5 sm:px-6 overflow-hidden transition-all duration-300 hover:border-white/10"
                  style={{ backgroundColor: '#111111' }}
                >
                  <AccordionTrigger className="text-left text-sm sm:text-base font-medium text-white hover:no-underline py-4 sm:py-5">
                    {item.question}
                  </AccordionTrigger>
                  <AccordionContent className="text-gray-400 text-sm pb-4 sm:pb-5 font-light leading-relaxed">
                    {item.answer}
                  </AccordionContent>
                </AccordionItem>
              </ScrollReveal>
            ))}
          </Accordion>
        </div>
      </section>

      {/* Final CTA Section */}
      <section className="relative px-4 sm:px-6 py-16 sm:py-24 bg-black z-10">
        <div className="max-w-2xl mx-auto text-center">
          <ScrollReveal>
            <h2 className="text-xl sm:text-3xl md:text-4xl font-bold mb-4 sm:mb-6 tracking-tight">
              Probalo gratis durante 7 días
            </h2>
            <p className="text-gray-500 text-sm sm:text-lg mb-8 sm:mb-10 font-light max-w-lg mx-auto">
              Sin compromiso. Elegí tu plan, registrate y empezá a usar tu consultorio digital hoy.
            </p>
            <div className="flex flex-col sm:flex-row justify-center gap-4">
              <a href="#pricing">
                <Button 
                  size="lg" 
                  className="w-full sm:w-auto h-12 sm:h-14 px-8 sm:px-12 text-sm sm:text-base font-semibold rounded-xl transition-all duration-300 hover:scale-[1.03] group"
                  style={{ backgroundColor: GREEN, boxShadow: `0 4px 30px rgba(0, 199, 138, 0.35)` }}
                >
                  Elegir mi plan
                  <ArrowRight className="w-4 h-4 ml-2 transition-transform group-hover:translate-x-1" />
                </Button>
              </a>
              <a href="/acceso">
                <Button 
                  variant="outline"
                  size="lg" 
                  className="w-full sm:w-auto h-12 sm:h-14 px-8 sm:px-12 text-sm sm:text-base font-semibold rounded-xl transition-all duration-300 bg-transparent text-white border-white/20 hover:bg-white/5"
                >
                  Ingresar
                </Button>
              </a>
            </div>
            <div className="flex flex-col sm:flex-row justify-center gap-3 mt-6">
              <InstallAppButton />
            </div>
          </ScrollReveal>
        </div>
      </section>

      {/* Footer */}
      <footer className="relative px-4 sm:px-6 py-8 sm:py-12 bg-black border-t border-white/5 z-10">
        <div className="max-w-7xl mx-auto flex flex-col items-center gap-4">
          <div className="flex items-center gap-2 text-gray-500 text-xs">
            <span className="text-lg">🇺🇾</span>
            <span>Disponible únicamente en Uruguay</span>
          </div>
          <p className="text-center text-gray-600 text-xs sm:text-sm font-light">
            © {new Date().getFullYear()} Consultorio Digital
          </p>
          <div className="flex items-center gap-4 text-xs text-gray-500">
            <a href="/terminos" className="hover:text-gray-300 transition-colors">
              Términos y Condiciones
            </a>
            <span className="text-gray-700">·</span>
            <a href="/privacidad" className="hover:text-gray-300 transition-colors">
              Política de Privacidad
            </a>
            <span className="text-gray-700">·</span>
            <a href="/seguridad" className="hover:text-gray-300 transition-colors">
              Seguridad
            </a>
          </div>
          <div className="flex items-center gap-2 text-gray-500 text-xs">
            <span>Sistema desarrollado por</span>
            <a 
              href="https://www.digitalbuilders.net" 
              target="_blank" 
              rel="noopener noreferrer"
              className="hover:opacity-80 transition-opacity"
            >
              <img 
                src="/assets/logo-digitalbuilders.webp" 
                alt="Digital Builders" 
                className="h-10 sm:h-12"
              />
            </a>
          </div>
        </div>
      </footer>

      {/* CSS Animations */}
      <style>{`
        @keyframes heroFadeIn {
          from { opacity: 0; transform: translateY(30px) scale(0.97); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes logoFloat {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-8px); }
        }
        @keyframes badgePop {
          from { opacity: 0; transform: scale(0.8) translateY(10px); }
          to { opacity: 1; transform: scale(1) translateY(0); }
        }
        @keyframes fadeSlideUp {
          from { opacity: 0; transform: translateY(16px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes scrollBounce {
          0%, 100% { transform: translateX(-50%) translateY(0); opacity: 0.5; }
          50% { transform: translateX(-50%) translateY(8px); opacity: 1; }
        }
        @keyframes scrollDot {
          0%, 100% { transform: translateY(0); opacity: 0.4; }
          50% { transform: translateY(6px); opacity: 1; }
        }
        @keyframes orbPulse {
          0%, 100% { transform: translate(-50%, -50%) scale(1); opacity: 0.5; }
          50% { transform: translate(-50%, -50%) scale(1.2); opacity: 1; }
        }
        @keyframes orbFloat1 {
          0%, 100% { transform: translate(0, 0); }
          25% { transform: translate(60px, 40px); }
          50% { transform: translate(-30px, 80px); }
          75% { transform: translate(-60px, 20px); }
        }
        @keyframes orbFloat2 {
          0%, 100% { transform: translate(0, 0); }
          25% { transform: translate(-50px, 60px); }
          50% { transform: translate(40px, -30px); }
          75% { transform: translate(70px, 40px); }
        }
        @keyframes orbFloat3 {
          0%, 100% { transform: translate(0, 0); }
          33% { transform: translate(80px, -50px); }
          66% { transform: translate(-60px, -30px); }
        }
      `}</style>

      {/* Floating WhatsApp Button */}
      <a
        href="https://wa.me/59898543623?text=Hola%2C%20vine%20desde%20la%20web%20de%20Consultorio%20Digital%20y%20tengo%20una%20consulta"
        target="_blank"
        rel="noopener noreferrer"
        className="fixed bottom-6 right-6 z-50 group flex items-center gap-2"
        aria-label="Contactar por WhatsApp"
      >
        <span
          className="text-sm font-medium px-3 py-1.5 rounded-full opacity-0 -translate-x-2 transition-all duration-300 group-hover:opacity-100 group-hover:translate-x-0"
          style={{
            backgroundColor: '#128C7E',
            color: 'white',
          }}
        >
          ¿Consultas?
        </span>
        <div
          className="w-14 h-14 rounded-full flex items-center justify-center shadow-lg transition-transform duration-300 hover:scale-110"
          style={{
            backgroundColor: '#25d366',
            boxShadow: '0 4px 20px rgba(37, 211, 102, 0.4)',
            animation: 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
          }}
        >
          <MessageCircle className="w-7 h-7 text-white" strokeWidth={2.2} />
        </div>
      </a>
    </div>
  );
};

export default Landing;
