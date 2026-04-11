import { useState } from "react";
import { Button } from "@/components/ui/button";
import { 
  Users, 
  MessageCircle, 
  Calendar, 
  HelpCircle, 
  Check, 
  Shield, 
  CreditCard, 
  Bell, 
  UserCheck, 
  Lock, 
  Globe,
  Sparkles,
  AlertTriangle,
  Monitor,
  Tablet,
  Smartphone,
  ArrowRight,
  Clock,
  Eye,
} from "lucide-react";
import PricingCard from "@/components/PricingCard";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { PLAN_DEFINITIONS, PLAN_ORDER, formatPrice } from "@/lib/plan-definitions";
import logoWhite from "@/assets/logo-consultorio-digital-white.png";
import { InstallAppButton } from "@/components/InstallAppButton";
import { ScrollReveal } from "@/components/landing/ScrollReveal";

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
    answer: "Todos los planes incluyen las mismas funcionalidades: gestión de pacientes, agenda privada, portal del paciente, recordatorios automáticos por email, gestión de pagos y alertas. La diferencia está en la cantidad de profesionales y pacientes activos."
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
    question: "¿Los recordatorios por email tienen costo adicional?",
    answer: "No, los recordatorios automáticos están incluidos en todos los planes sin límite de envíos."
  },
  {
    question: "¿Mis pacientes pueden ver información de otros pacientes?",
    answer: "No. Cada paciente accede solo a su propia información: sus citas, su historial y su estado de pagos. La privacidad está garantizada."
  },
];

const currentFeatures = [
  {
    icon: Users,
    title: "Gestión de Pacientes",
    description: "Ficha completa por paciente con historial de citas, notas privadas y estado de pagos.",
  },
  {
    icon: Calendar,
    title: "Agenda Privada",
    description: "Solo accesible para vos y tus pacientes. Control total de horarios y disponibilidad.",
  },
  {
    icon: UserCheck,
    title: "Portal del Paciente",
    description: "Cada paciente accede con su usuario, ve sus citas, historial y puede reservar turnos.",
  },
  {
    icon: CreditCard,
    title: "Gestión de Pagos",
    description: "Registro de pagos mensuales o por cita. Alertas de vencidos y por vencer.",
  },
  {
    icon: Bell,
    title: "Recordatorios automáticos",
    description: "Recordatorios de citas y pagos enviados automáticamente por email a tus pacientes.",
  },
  {
    icon: Shield,
    title: "Multi-profesional",
    description: "Agregá profesionales a tu consultorio. Cada uno con su acceso a la agenda compartida.",
  },
];

const problems = [
  { icon: AlertTriangle, text: "Agenda desordenada entre cuadernos y apps" },
  { icon: AlertTriangle, text: "Pagos que se olvidan o no se registran" },
  { icon: AlertTriangle, text: "Pacientes que no recuerdan sus turnos" },
  { icon: AlertTriangle, text: "Información repartida en planillas y apps" },
];

const benefits = [
  {
    icon: Lock,
    title: "Privacidad total",
    description: "Tu agenda no es pública. Solo tus pacientes acceden.",
  },
  {
    icon: Eye,
    title: "Todo centralizado",
    description: "Pacientes, citas, pagos y recordatorios en un solo lugar.",
  },
  {
    icon: Clock,
    title: "Ahorro de tiempo",
    description: "Menos mensajes sueltos, menos olvidos, menos errores.",
  },
  {
    icon: Sparkles,
    title: "Imagen profesional",
    description: "Un sistema propio que transmite orden y seriedad.",
  },
];

const Landing = () => {
  const [isAnnual, setIsAnnual] = useState(true);
  const whatsappDemo = "https://wa.me/59891093977?text=Hola,%20quiero%20ver%20una%20demo%20del%20sistema%20para%20consultorios.";
  const whatsappContact = "https://wa.me/59891093977?text=Hola,%20tengo%20una%20consulta%20sobre%20el%20sistema.";
  const whatsappPersonalizado = "https://wa.me/59891093977?text=Hola,%20quiero%20un%20plan%20personalizado%20para%20mi%20consultorio.";

  const getPricingPlans = () => {
    const paymentType = isAnnual ? "pago anual" : "pago mensual";
    const visiblePlans = PLAN_ORDER.filter(code => code !== "personalizado");
    
    return visiblePlans.map(planCode => {
      const plan = PLAN_DEFINITIONS[planCode];
      const price = isAnnual ? plan.priceAnnual : plan.priceMonthly;
      const profText = plan.maxProfessionals === 1 
        ? "1 profesional" 
        : `Hasta ${plan.maxProfessionals} profesionales`;
      const patText = `Hasta ${plan.maxPatients} pacientes activos`;
      
      return {
        id: planCode,
        name: plan.name,
        description: plan.description,
        professionals: profText,
        patients: patText,
        price: `${formatPrice(price)}`,
        priceNote: isAnnual ? "/ mes (pago anual)" : "/ mes",
        savingsNote: isAnnual ? "Recomendado: ahorrás pagando anual" : undefined,
        buttonText: "Quiero este plan",
        buttonLink: `https://wa.me/59891093977?text=Hola,%20quiero%20contratar%20el%20${encodeURIComponent(plan.name)}%20(${formatPrice(price)}/mes%20-%20${encodeURIComponent(paymentType)}).`,
        isExternal: true,
        isHighlighted: plan.isHighlighted || false,
        highlightLabel: plan.highlightLabel,
      };
    });
  };

  return (
    <div className="min-h-screen bg-black text-white overflow-x-hidden">
      {/* Animated background gradient */}
      <div 
        className="fixed inset-0 pointer-events-none z-0"
        style={{
          background: `radial-gradient(ellipse 80% 50% at 50% -20%, ${BRAND_GLOW}, transparent)`,
        }}
      />

      {/* Hero Section */}
      <section className="relative min-h-[85vh] sm:min-h-screen flex flex-col items-center justify-center px-4 sm:px-6 py-12 sm:py-24 z-10">
        <div className="w-full max-w-3xl mx-auto">
          <div 
            className="relative rounded-2xl sm:rounded-3xl p-6 sm:p-10 md:p-14"
            style={{ 
              backgroundColor: '#111111',
              boxShadow: `0 8px 60px ${BRAND_GLOW}, 0 0 120px rgba(0, 165, 160, 0.06)`,
              animation: 'heroFadeIn 1s cubic-bezier(0.16,1,0.3,1) forwards',
            }}
          >
            {/* Glow ring */}
            <div 
              className="absolute -inset-px rounded-2xl sm:rounded-3xl pointer-events-none"
              style={{
                background: `linear-gradient(135deg, rgba(0,165,160,0.25), transparent 40%, transparent 60%, rgba(0,199,138,0.15))`,
                borderRadius: 'inherit',
              }}
            />

            {/* Logo */}
            <div className="relative flex justify-center mb-0">
              <img 
                src={logoWhite} 
                alt="Tu Consultorio Digital" 
                className="h-40 sm:h-56 w-auto"
                style={{ animation: 'logoFloat 6s ease-in-out infinite' }}
              />
            </div>
            
            {/* Title */}
            <h1 className="relative text-2xl sm:text-4xl md:text-5xl font-bold tracking-tight text-center mb-4 sm:mb-6 leading-tight -mt-6 sm:-mt-10">
              Tu consultorio ordenado:
              <span 
                className="block bg-clip-text text-transparent"
                style={{ 
                  backgroundImage: `linear-gradient(135deg, ${BRAND}, ${GREEN})`,
                }}
              >
                pacientes, agenda y pagos
              </span>
              <span className="block">en un solo lugar</span>
            </h1>
            
            {/* Subtitle */}
            <p className="relative text-sm sm:text-lg md:text-xl text-gray-400 text-center mb-6 sm:mb-8 max-w-xl mx-auto leading-relaxed font-light">
              Gestioná pacientes, agenda privada, pagos y recordatorios sin planillas ni mensajes sueltos.
            </p>

            {/* Multi-device badges */}
            <div className="relative flex justify-center gap-3 sm:gap-4 mb-8 sm:mb-10">
              {[
                { icon: Monitor, label: "Computadora" },
                { icon: Tablet, label: "Tablet" },
                { icon: Smartphone, label: "Celular" },
              ].map((device, i) => (
                <div 
                  key={device.label}
                  className="flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-1.5 sm:py-2 rounded-full border border-white/10 text-gray-400 text-xs sm:text-sm"
                  style={{
                    backgroundColor: 'rgba(255,255,255,0.03)',
                    animation: `badgePop 0.5s cubic-bezier(0.16,1,0.3,1) ${600 + i * 120}ms both`,
                  }}
                >
                  <device.icon className="w-3.5 h-3.5 sm:w-4 sm:h-4" style={{ color: GREEN }} />
                  {device.label}
                </div>
              ))}
            </div>
            
            {/* CTA Buttons */}
            <div 
              className="relative flex flex-col sm:flex-row justify-center gap-4"
              style={{ animation: 'fadeSlideUp 0.7s cubic-bezier(0.16,1,0.3,1) 0.4s both' }}
            >
              <a href={whatsappDemo} target="_blank" rel="noopener noreferrer">
                <Button 
                  size="lg" 
                  className="w-full sm:w-auto h-12 sm:h-14 px-8 sm:px-12 text-sm sm:text-base font-semibold rounded-xl transition-all duration-300 hover:scale-[1.03] group"
                  style={{ 
                    backgroundColor: BRAND,
                    boxShadow: `0 4px 30px ${BRAND_SHADOW}`
                  }}
                >
                  Ver demo
                  <ArrowRight className="w-4 h-4 ml-2 transition-transform group-hover:translate-x-1" />
                </Button>
              </a>
              <a href={whatsappContact} target="_blank" rel="noopener noreferrer">
                <Button 
                  variant="outline"
                  size="lg" 
                  className="w-full sm:w-auto h-12 sm:h-14 px-8 sm:px-12 text-sm sm:text-base font-semibold rounded-xl transition-all duration-300 bg-transparent text-white border-white/20 hover:bg-white/5 hover:border-white/30"
                >
                  <MessageCircle className="w-4 h-4 mr-2" />
                  Hablar por WhatsApp
                </Button>
              </a>
            </div>

            {/* Install & Login */}
            <div 
              className="relative flex flex-col sm:flex-row justify-center gap-3 mt-6 pt-6 border-t border-white/10"
              style={{ animation: 'fadeSlideUp 0.7s cubic-bezier(0.16,1,0.3,1) 0.6s both' }}
            >
              <InstallAppButton />
              <a href="/auth" className="w-full sm:w-auto">
                <Button 
                  variant="outline" 
                  size="lg"
                  className="w-full sm:w-auto h-12 sm:h-14 px-8 sm:px-12 text-sm sm:text-base font-semibold rounded-xl gap-2 bg-transparent text-white border-white/20 hover:bg-white/5"
                >
                  Iniciar sesión
                </Button>
              </a>
            </div>
          </div>
        </div>

        {/* Scroll indicator */}
        <div 
          className="absolute bottom-8 left-1/2 -translate-x-1/2"
          style={{ animation: 'scrollBounce 2s ease-in-out infinite' }}
        >
          <div className="w-6 h-10 rounded-full border-2 border-white/20 flex items-start justify-center p-1.5">
            <div className="w-1.5 h-2.5 rounded-full bg-white/40" style={{ animation: 'scrollDot 2s ease-in-out infinite' }} />
          </div>
        </div>
      </section>

      {/* Multi-device Section */}
      <section className="relative px-4 sm:px-6 py-14 sm:py-24 z-10" style={{ backgroundColor: '#050505' }}>
        <div className="max-w-4xl mx-auto text-center">
          <ScrollReveal>
            <h2 className="text-xl sm:text-3xl md:text-4xl font-bold mb-4 tracking-tight">
              Usalo desde cualquier dispositivo
            </h2>
            <p className="text-gray-500 text-sm sm:text-lg font-light max-w-2xl mx-auto mb-10 sm:mb-14">
              Accedé a tu consultorio desde la computadora, la tablet o el celular. Sin instalar nada — funciona directo desde el navegador.
            </p>
          </ScrollReveal>

          <div className="flex justify-center items-end gap-4 sm:gap-8">
            {/* Desktop */}
            <ScrollReveal delay={100} direction="left">
              <div 
                className="rounded-xl sm:rounded-2xl border border-white/10 p-4 sm:p-6 w-36 sm:w-52 transition-all duration-500 hover:border-white/20"
                style={{ 
                  backgroundColor: '#111111',
                  boxShadow: `0 0 40px ${GREEN_GLOW}`,
                }}
              >
                <Monitor className="w-10 h-10 sm:w-14 sm:h-14 mx-auto mb-3" style={{ color: GREEN }} />
                <p className="text-xs sm:text-sm font-medium text-gray-300">Computadora</p>
                <p className="text-[10px] sm:text-xs text-gray-600 mt-1">Pantalla completa</p>
              </div>
            </ScrollReveal>

            {/* Tablet */}
            <ScrollReveal delay={250} direction="up">
              <div 
                className="rounded-xl sm:rounded-2xl border border-white/10 p-4 sm:p-6 w-28 sm:w-40 transition-all duration-500 hover:border-white/20"
                style={{ 
                  backgroundColor: '#111111',
                  boxShadow: `0 0 30px ${GREEN_GLOW}`,
                }}
              >
                <Tablet className="w-8 h-8 sm:w-12 sm:h-12 mx-auto mb-3" style={{ color: GREEN }} />
                <p className="text-xs sm:text-sm font-medium text-gray-300">Tablet</p>
                <p className="text-[10px] sm:text-xs text-gray-600 mt-1">Consultorio móvil</p>
              </div>
            </ScrollReveal>

            {/* Phone */}
            <ScrollReveal delay={400} direction="right">
              <div 
                className="rounded-xl sm:rounded-2xl border border-white/10 p-4 sm:p-6 w-24 sm:w-32 transition-all duration-500 hover:border-white/20"
                style={{ 
                  backgroundColor: '#111111',
                  boxShadow: `0 0 20px ${GREEN_GLOW}`,
                }}
              >
                <Smartphone className="w-7 h-7 sm:w-10 sm:h-10 mx-auto mb-3" style={{ color: GREEN }} />
                <p className="text-xs sm:text-sm font-medium text-gray-300">Celular</p>
                <p className="text-[10px] sm:text-xs text-gray-600 mt-1">En tu bolsillo</p>
              </div>
            </ScrollReveal>
          </div>
        </div>
      </section>

      {/* Problem → Solution Section */}
      <section className="relative px-4 sm:px-6 py-14 sm:py-24 bg-black z-10">
        <div className="max-w-5xl mx-auto">
          <div className="grid md:grid-cols-2 gap-8 md:gap-16">
            {/* Problems */}
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

            {/* Solution */}
            <ScrollReveal direction="right" delay={200}>
              <h2 className="text-xl sm:text-2xl font-bold mb-6" style={{ color: GREEN }}>
                La solución
              </h2>
              <div 
                className="p-6 rounded-xl border transition-all duration-500 hover:shadow-lg"
                style={{ 
                  backgroundColor: 'rgba(0, 199, 138, 0.05)',
                  borderColor: 'rgba(0, 199, 138, 0.2)',
                }}
              >
                <ul className="space-y-4">
                  {[
                    "Un sistema privado para tu consultorio",
                    "Todo centralizado y claro",
                    "Acceso para vos, tu equipo y tus pacientes",
                    "Alertas automáticas de pagos y citas",
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

      {/* Features Section */}
      <section className="relative px-4 sm:px-6 py-14 sm:py-28 bg-black z-10">
        <div className="max-w-5xl mx-auto">
          <ScrollReveal>
            <div className="text-center mb-10 sm:mb-16">
              <h2 className="text-xl sm:text-3xl md:text-4xl font-bold mb-3 sm:mb-4 tracking-tight">
                Todo lo que necesitás
              </h2>
              <p className="text-gray-500 text-sm sm:text-lg font-light max-w-2xl mx-auto">
                Funcionalidades diseñadas para el día a día de tu consultorio.
              </p>
            </div>
          </ScrollReveal>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
            {currentFeatures.map((feature, index) => (
              <ScrollReveal key={feature.title} delay={index * 80}>
                <div
                  className="group p-5 sm:p-7 rounded-xl sm:rounded-2xl border border-white/5 transition-all duration-500 hover:border-white/15 hover:-translate-y-1"
                  style={{ 
                    backgroundColor: '#111111',
                  }}
                >
                  <div 
                    className="w-10 h-10 sm:w-12 sm:h-12 rounded-lg sm:rounded-xl flex items-center justify-center mb-4 sm:mb-5 transition-transform duration-500 group-hover:scale-110"
                    style={{ backgroundColor: GREEN_BG }}
                  >
                    <feature.icon className="w-5 h-5 sm:w-6 sm:h-6" style={{ color: GREEN }} />
                  </div>
                  <h3 className="text-base sm:text-lg font-semibold text-white mb-2 tracking-tight">
                    {feature.title}
                  </h3>
                  <p className="text-gray-500 text-xs sm:text-sm leading-relaxed font-light">
                    {feature.description}
                  </p>
                </div>
              </ScrollReveal>
            ))}
          </div>
        </div>
      </section>

      {/* Key Differentiator Section */}
      <section className="relative px-4 sm:px-6 py-14 sm:py-24 z-10" style={{ backgroundColor: '#080808' }}>
        <div className="max-w-4xl mx-auto">
          <ScrollReveal direction="scale">
            <div 
              className="rounded-2xl sm:rounded-3xl p-8 sm:p-12 text-center border relative overflow-hidden"
              style={{ 
                backgroundColor: '#111111',
                borderColor: 'rgba(0, 199, 138, 0.2)',
                boxShadow: '0 0 80px rgba(0, 199, 138, 0.08)',
              }}
            >
              {/* Animated gradient orb */}
              <div 
                className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 rounded-full blur-3xl pointer-events-none"
                style={{ 
                  background: `radial-gradient(circle, rgba(0,199,138,0.12), transparent 70%)`,
                  animation: 'orbPulse 4s ease-in-out infinite',
                }}
              />

              <div 
                className="relative w-14 h-14 sm:w-16 sm:h-16 mx-auto mb-6 rounded-2xl flex items-center justify-center"
                style={{ backgroundColor: GREEN_BG }}
              >
                <Lock className="w-7 h-7 sm:w-8 sm:h-8" style={{ color: GREEN }} />
              </div>
              
              <h2 className="relative text-xl sm:text-3xl md:text-4xl font-bold mb-4 tracking-tight">
                Tu consultorio, tu sistema
              </h2>
              <p className="relative text-lg sm:text-xl mb-6" style={{ color: GREEN }}>
                Un sistema privado, no una agenda pública
              </p>
              <p className="relative text-gray-400 text-sm sm:text-base max-w-2xl mx-auto leading-relaxed font-light">
                A diferencia de plataformas públicas donde cualquiera puede agendar, acá solo tus pacientes acceden a tu agenda. 
                Más control, menos cancelaciones, imagen más profesional.
              </p>
            </div>
          </ScrollReveal>
        </div>
      </section>

      {/* Benefits Section */}
      <section className="relative px-4 sm:px-6 py-14 sm:py-28 bg-black z-10">
        <div className="max-w-4xl mx-auto">
          <ScrollReveal>
            <h2 className="text-xl sm:text-3xl md:text-4xl font-bold text-center mb-8 sm:mb-16 tracking-tight">
              Por qué elegir este sistema
            </h2>
          </ScrollReveal>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
            {benefits.map((benefit, index) => (
              <ScrollReveal key={benefit.title} delay={index * 100}>
                <div
                  className="group flex items-start gap-4 sm:gap-5 p-5 sm:p-6 rounded-xl sm:rounded-2xl border border-white/5 transition-all duration-500 hover:border-white/15 hover:-translate-y-1"
                  style={{ backgroundColor: '#111111' }}
                >
                  <div 
                    className="w-10 h-10 sm:w-12 sm:h-12 rounded-lg sm:rounded-xl flex items-center justify-center flex-shrink-0 transition-transform duration-500 group-hover:scale-110"
                    style={{ backgroundColor: GREEN_BG }}
                  >
                    <benefit.icon className="w-5 h-5 sm:w-6 sm:h-6" style={{ color: GREEN }} />
                  </div>
                  <div>
                    <h3 className="text-sm sm:text-base text-white font-semibold mb-1 tracking-tight">
                      {benefit.title}
                    </h3>
                    <p className="text-gray-500 text-xs sm:text-sm font-light">
                      {benefit.description}
                    </p>
                  </div>
                </div>
              </ScrollReveal>
            ))}
          </div>
        </div>
      </section>

      {/* Private Clinic Premium Feature */}
      <section className="relative px-4 sm:px-6 py-14 sm:py-24 z-10" style={{ backgroundColor: '#080808' }}>
        <div className="max-w-4xl mx-auto">
          <ScrollReveal direction="scale">
            <div 
              className="rounded-2xl sm:rounded-3xl p-8 sm:p-12 border relative overflow-hidden"
              style={{ 
                backgroundColor: '#111111',
                borderColor: 'rgba(255, 255, 255, 0.1)'
              }}
            >
              {/* Premium badge */}
              <div className="absolute top-4 right-4">
                <span 
                  className="px-3 py-1 rounded-full text-xs font-medium"
                  style={{ 
                    backgroundColor: 'rgba(147, 51, 234, 0.2)',
                    color: '#a78bfa'
                  }}
                >
                  Opcional
                </span>
              </div>

              <div className="flex items-center gap-4 mb-6">
                <div 
                  className="w-12 h-12 sm:w-14 sm:h-14 rounded-xl flex items-center justify-center"
                  style={{ backgroundColor: 'rgba(147, 51, 234, 0.1)' }}
                >
                  <Globe className="w-6 h-6 sm:w-7 sm:h-7" style={{ color: '#a78bfa' }} />
                </div>
                <div>
                  <h3 className="text-lg sm:text-xl font-bold text-white">
                    Consultorio Privado
                  </h3>
                  <p className="text-gray-500 text-sm">
                    Portal personalizado para tus pacientes
                  </p>
                </div>
              </div>

              <ul className="space-y-3 mb-6">
                {[
                  "Portal exclusivo para tus pacientes",
                  "Acceso privado y seguro",
                  "Preparado para dominio o subdominio propio",
                  "Imagen profesional frente a tus pacientes",
                ].map((text, i) => (
                  <li key={i} className="flex items-center gap-3 text-gray-300 text-sm sm:text-base">
                    <Check className="w-4 h-4 flex-shrink-0" style={{ color: '#a78bfa' }} />
                    {text}
                  </li>
                ))}
              </ul>

              <p className="text-gray-500 text-xs sm:text-sm font-light">
                Próximamente disponible como add-on para todos los planes.
              </p>
            </div>
          </ScrollReveal>
        </div>
      </section>

      {/* Pricing Section */}
      <section id="pricing" className="relative px-4 sm:px-6 py-14 sm:py-28 bg-black z-10">
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
                <p 
                  className="text-xs sm:text-sm font-medium px-4 py-1.5 rounded-full"
                  style={{ 
                    backgroundColor: GREEN_BG,
                    color: GREEN,
                    animation: 'fadeSlideUp 0.4s ease-out both',
                  }}
                >
                  💳 Hasta 12 cuotas sin interés
                </p>
              )}
            </div>
          </ScrollReveal>

          {/* Pricing Cards Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 mb-8 sm:mb-12">
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
                <div className="text-4xl sm:text-5xl mb-4">🏢</div>
                <h3 className="text-xl sm:text-2xl md:text-3xl font-bold text-white mb-3 tracking-tight">
                  Solución para consultorios grandes
                </h3>
                <p className="text-gray-400 text-sm sm:text-base mb-6 sm:mb-8 max-w-lg mx-auto leading-relaxed">
                  ¿Tenés un equipo más grande o necesitás más capacidad?
                  <br />
                  Te armamos un plan a tu medida.
                </p>
                <div className="flex flex-wrap items-center justify-center gap-4 sm:gap-6 mb-8 text-sm sm:text-base text-gray-300">
                  {["Más profesionales", "Más pacientes", "Configuraciones a medida"].map((text, i) => (
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
      <section className="relative px-4 sm:px-6 py-14 sm:py-28 z-10" style={{ backgroundColor: '#080808' }}>
        <div className="max-w-3xl mx-auto">
          <ScrollReveal>
            <div className="text-center mb-10 sm:mb-16">
              <div className="flex justify-center mb-4">
                <div 
                  className="w-12 h-12 sm:w-14 sm:h-14 rounded-xl sm:rounded-2xl flex items-center justify-center"
                  style={{ 
                    backgroundColor: GREEN_BG,
                    boxShadow: `0 0 30px ${GREEN_GLOW}`
                  }}
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
              ¿Querés ver cómo funciona?
            </h2>
            <p className="text-gray-500 text-sm sm:text-lg mb-8 sm:mb-10 font-light max-w-lg mx-auto">
              Te muestro el sistema funcionando con un consultorio real en pocos minutos.
            </p>
            <div className="flex flex-col sm:flex-row justify-center gap-4">
              <a href={whatsappDemo} target="_blank" rel="noopener noreferrer">
                <Button 
                  size="lg" 
                  className="w-full sm:w-auto h-12 sm:h-14 px-8 sm:px-12 text-sm sm:text-base font-semibold rounded-xl transition-all duration-300 hover:scale-[1.03] group"
                  style={{ 
                    backgroundColor: GREEN,
                    boxShadow: `0 4px 30px rgba(0, 199, 138, 0.35)`
                  }}
                >
                  Ver demo
                  <ArrowRight className="w-4 h-4 ml-2 transition-transform group-hover:translate-x-1" />
                </Button>
              </a>
              <a href={whatsappContact} target="_blank" rel="noopener noreferrer">
                <Button 
                  variant="outline"
                  size="lg" 
                  className="w-full sm:w-auto h-12 sm:h-14 px-8 sm:px-12 text-sm sm:text-base font-semibold rounded-xl transition-all duration-300 bg-transparent text-white border-white/20 hover:bg-white/5"
                >
                  <MessageCircle className="w-4 h-4 mr-2" />
                  Hablar por WhatsApp
                </Button>
              </a>
            </div>
            
            {/* Install & Login */}
            <div className="flex flex-col sm:flex-row justify-center gap-3 mt-6">
              <InstallAppButton />
              <a href="/auth">
                <Button variant="outline" className="gap-2 bg-transparent text-white border-white/20 hover:bg-white/5">
                  Iniciar sesión
                </Button>
              </a>
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
            © {new Date().getFullYear()} Sistema de Gestión de Consultorio
          </p>
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

      {/* Floating WhatsApp Button */}
      <a
        href={whatsappDemo}
        target="_blank"
        rel="noopener noreferrer"
        className="fixed bottom-6 right-6 z-50 w-14 h-14 rounded-full flex items-center justify-center transition-all duration-300 hover:scale-110"
        style={{ 
          backgroundColor: GREEN,
          boxShadow: '0 4px 30px rgba(0, 199, 138, 0.4)',
          animation: 'whatsappPulse 3s ease-in-out infinite',
        }}
        aria-label="Contactar por WhatsApp"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="currentColor"
          className="w-7 h-7 text-white"
        >
          <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
        </svg>
      </a>

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
        @keyframes whatsappPulse {
          0%, 100% { box-shadow: 0 4px 30px rgba(0, 199, 138, 0.4); }
          50% { box-shadow: 0 4px 40px rgba(0, 199, 138, 0.6), 0 0 20px rgba(0, 199, 138, 0.3); }
        }
      `}</style>
    </div>
  );
};

export default Landing;
