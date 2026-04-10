import { useState, useCallback, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { 
  Users, 
  MessageCircle, 
  Calendar, 
  HelpCircle, 
  ChevronLeft, 
  ChevronRight, 
  Check, 
  Shield, 
  CreditCard, 
  Bell, 
  UserCheck, 
  Lock, 
  Globe,
  ClipboardList,
  Eye,
  Clock,
  Sparkles,
  AlertTriangle
} from "lucide-react";
import PricingCard from "@/components/PricingCard";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import useEmblaCarousel from "embla-carousel-react";
import dashboardMobile from "@/assets/screenshots/dashboard-mobile.png";
import appointmentsMobile from "@/assets/screenshots/appointments-mobile.png";
import agendaMobile from "@/assets/screenshots/agenda-mobile.png";
import patientsMobile from "@/assets/screenshots/patients-mobile.png";
import remindersMobile from "@/assets/screenshots/reminders-mobile.png";
import { PLAN_DEFINITIONS, PLAN_ORDER, formatPrice } from "@/lib/plan-definitions";
import logoWhite from "@/assets/logo-consultorio-digital-white.png";
import { InstallAppButton } from "@/components/InstallAppButton";

// Brand color for landing (matches logo teal)
const BRAND_COLOR = "#00a5a0";
const BRAND_COLOR_LIGHT = "rgba(0, 165, 160, 0.15)";
const BRAND_SHADOW = "rgba(0, 165, 160, 0.35)";

// Screenshot slides for carousel
const screenshotSlides = [
  {
    title: "Dashboard Principal",
    description: "Visualizá citas del día, pagos pendientes y acciones rápidas. Todo lo importante en un solo lugar.",
    image: dashboardMobile
  },
  {
    title: "Agenda Privada",
    description: "Calendario visual solo accesible para vos y tus pacientes. Control total de horarios y disponibilidad.",
    image: agendaMobile
  },
  {
    title: "Fichas de Pacientes",
    description: "Historial completo, notas privadas, estado de pagos y próximas citas de cada paciente.",
    image: patientsMobile
  },
  {
    title: "Recordatorios WhatsApp",
    description: "Enviá recordatorios de citas y pagos con un solo click. Menos ausencias, más control.",
    image: remindersMobile
  },
  {
    title: "Portal del Paciente",
    description: "Cada paciente accede con su usuario, ve sus citas y puede reservar turnos disponibles.",
    image: appointmentsMobile
  }
];

// FAQ items
const faqItems = [
  {
    question: "¿Qué incluye cada plan?",
    answer: "Todos los planes incluyen las mismas funcionalidades: gestión de pacientes, agenda privada, portal del paciente, recordatorios por WhatsApp, gestión de pagos y alertas. La diferencia está en la cantidad de profesionales y pacientes activos."
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
    question: "¿Los recordatorios por WhatsApp tienen costo adicional?",
    answer: "No, los recordatorios están incluidos en todos los planes sin límite de envíos."
  },
  {
    question: "¿Mis pacientes pueden ver información de otros pacientes?",
    answer: "No. Cada paciente accede solo a su propia información: sus citas, su historial y su estado de pagos. La privacidad está garantizada."
  },
];

// Current real features
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
    title: "Recordatorios",
    description: "Recordatorios de citas y pagos. Envío manual por WhatsApp desde el sistema.",
  },
  {
    icon: Shield,
    title: "Multi-profesional",
    description: "Agregá profesionales a tu consultorio. Cada uno con su acceso a la agenda compartida.",
  },
];

// Problems section
const problems = [
  { icon: AlertTriangle, text: "Agenda desordenada entre cuadernos y apps" },
  { icon: AlertTriangle, text: "Pagos que se olvidan o no se registran" },
  { icon: AlertTriangle, text: "Pacientes que no recuerdan sus turnos" },
  { icon: AlertTriangle, text: "Información repartida en WhatsApp y Excel" },
];

// Benefits section
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

// Screenshots Carousel Component
const ScreenshotsCarousel = () => {
  const [emblaRef, emblaApi] = useEmblaCarousel({ loop: true, align: "center" });
  const [selectedIndex, setSelectedIndex] = useState(0);

  const scrollPrev = useCallback(() => emblaApi && emblaApi.scrollPrev(), [emblaApi]);
  const scrollNext = useCallback(() => emblaApi && emblaApi.scrollNext(), [emblaApi]);

  const onSelect = useCallback(() => {
    if (!emblaApi) return;
    setSelectedIndex(emblaApi.selectedScrollSnap());
  }, [emblaApi]);

  useEffect(() => {
    if (!emblaApi) return;
    onSelect();
    emblaApi.on("select", onSelect);
    return () => { emblaApi.off("select", onSelect); };
  }, [emblaApi, onSelect]);

  return (
    <section id="conoce-el-sistema" className="px-4 sm:px-6 py-14 sm:py-24" style={{ backgroundColor: '#080808' }}>
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-10 sm:mb-16">
          <h2 className="text-xl sm:text-3xl md:text-4xl font-bold mb-3 sm:mb-4 tracking-tight">
            Conocé el sistema por dentro
          </h2>
          <p className="text-gray-500 text-sm sm:text-lg font-light">
            Así se ve tu consultorio organizado.
          </p>
        </div>

        {/* Carousel */}
        <div className="relative">
          <div className="overflow-hidden rounded-xl md:rounded-2xl" ref={emblaRef}>
            <div className="flex">
              {screenshotSlides.map((slide, index) => (
                <div 
                  key={index} 
                  className="flex-[0_0_100%] min-w-0 px-2 md:px-4"
                >
                  {/* Mobile Layout */}
                  <div 
                    className="md:hidden rounded-xl border border-white/10 p-5 flex flex-col"
                    style={{ 
                      backgroundColor: '#111111',
                      boxShadow: selectedIndex === index ? '0 8px 40px rgba(0, 199, 138, 0.15)' : 'none'
                    }}
                  >
                    <div className="mb-5">
                      <span 
                        className="text-[10px] font-semibold tracking-widest uppercase mb-2 block"
                        style={{ color: '#00c78a' }}
                      >
                        {index + 1}/{screenshotSlides.length}
                      </span>
                      <h3 className="text-lg font-bold text-white mb-2">
                        {slide.title}
                      </h3>
                      <p className="text-gray-400 text-sm leading-relaxed font-light">
                        {slide.description}
                      </p>
                    </div>
                    
                    <div className="flex justify-center">
                      {slide.image ? (
                        <img 
                          src={slide.image} 
                          alt={slide.title}
                          className="h-[320px] w-auto object-contain rounded-lg"
                        />
                      ) : (
                        <div 
                          className="h-[320px] w-[180px] rounded-lg flex items-center justify-center border border-white/10"
                          style={{ backgroundColor: '#1a1a1a' }}
                        >
                          <p className="text-gray-500 text-xs font-light">Próximamente</p>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Desktop Layout */}
                  <div 
                    className={`hidden md:flex items-center gap-12 lg:gap-20 rounded-2xl p-8 lg:p-12 border border-white/10 ${
                      index % 2 === 0 ? 'flex-row' : 'flex-row-reverse'
                    }`}
                    style={{ 
                      backgroundColor: '#111111',
                      boxShadow: selectedIndex === index ? '0 8px 40px rgba(0, 199, 138, 0.15)' : 'none'
                    }}
                  >
                    <div className="flex-1 flex justify-center">
                      {slide.image ? (
                        <img 
                          src={slide.image} 
                          alt={slide.title}
                          className="h-[400px] lg:h-[480px] w-auto object-contain rounded-xl shadow-2xl"
                        />
                      ) : (
                        <div 
                          className="h-[400px] lg:h-[480px] w-[220px] lg:w-[260px] rounded-xl flex items-center justify-center border border-white/10"
                          style={{ backgroundColor: '#1a1a1a' }}
                        >
                          <p className="text-gray-500 text-sm font-light">Próximamente</p>
                        </div>
                      )}
                    </div>
                    
                    <div className="flex-1 flex flex-col justify-center">
                      <span 
                        className="text-xs font-semibold tracking-widest uppercase mb-4"
                        style={{ color: '#00c78a' }}
                      >
                        Funcionalidad {index + 1}/{screenshotSlides.length}
                      </span>
                      <h3 className="text-2xl lg:text-3xl font-bold text-white mb-4">
                        {slide.title}
                      </h3>
                      <p className="text-gray-400 text-base lg:text-lg leading-relaxed font-light">
                        {slide.description}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Navigation Arrows */}
          <button
            onClick={scrollPrev}
            className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-2 md:-translate-x-6 w-10 h-10 md:w-12 md:h-12 rounded-full flex items-center justify-center transition-all duration-300 hover:scale-110 z-10"
            style={{ 
              backgroundColor: '#00c78a',
              boxShadow: '0 4px 20px rgba(0, 199, 138, 0.3)'
            }}
          >
            <ChevronLeft className="w-5 h-5 md:w-6 md:h-6 text-white" />
          </button>
          <button
            onClick={scrollNext}
            className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-2 md:translate-x-6 w-10 h-10 md:w-12 md:h-12 rounded-full flex items-center justify-center transition-all duration-300 hover:scale-110 z-10"
            style={{ 
              backgroundColor: '#00c78a',
              boxShadow: '0 4px 20px rgba(0, 199, 138, 0.3)'
            }}
          >
            <ChevronRight className="w-5 h-5 md:w-6 md:h-6 text-white" />
          </button>
        </div>

        {/* Dots Indicator */}
        <div className="flex justify-center gap-2 mt-6">
          {screenshotSlides.map((_, index) => (
            <button
              key={index}
              onClick={() => emblaApi?.scrollTo(index)}
              className="w-2 h-2 rounded-full transition-all duration-300"
              style={{ 
                backgroundColor: selectedIndex === index ? '#00c78a' : 'rgba(255, 255, 255, 0.2)',
                transform: selectedIndex === index ? 'scale(1.3)' : 'scale(1)'
              }}
            />
          ))}
        </div>
      </div>
    </section>
  );
};

const Landing = () => {
  const [isAnnual, setIsAnnual] = useState(true);
  const whatsappDemo = "https://wa.me/59891093977?text=Hola,%20quiero%20ver%20una%20demo%20del%20sistema%20para%20consultorios.";
  const whatsappContact = "https://wa.me/59891093977?text=Hola,%20tengo%20una%20consulta%20sobre%20el%20sistema.";
  const whatsappPersonalizado = "https://wa.me/59891093977?text=Hola,%20quiero%20un%20plan%20personalizado%20para%20mi%20consultorio.";

  const getPricingPlans = () => {
    const paymentType = isAnnual ? "pago anual" : "pago mensual";
    
    // Get visible plans (exclude personalizado for cards, show separately)
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
        price: `${formatPrice(price)} USD`,
        priceNote: isAnnual ? "/ mes (pago anual)" : "/ mes",
        savingsNote: isAnnual ? "Recomendado: ahorrás pagando anual" : undefined,
        buttonText: "Quiero este plan",
        buttonLink: `https://wa.me/59891093977?text=Hola,%20quiero%20contratar%20el%20${encodeURIComponent(plan.name)}%20(${formatPrice(price)}%20USD/mes%20-%20${encodeURIComponent(paymentType)}).`,
        isExternal: true,
        isHighlighted: plan.isHighlighted || false,
        highlightLabel: plan.highlightLabel,
      };
    });
  };

  const personalizadoPlan = {
    id: "personalizado",
    name: "Plan Personalizado",
    description: "A medida para tus necesidades específicas",
    professionals: "Profesionales a medida",
    patients: "Pacientes a medida",
    price: "Hablemos",
    priceNote: "",
    buttonText: "Hablemos",
    buttonLink: whatsappPersonalizado,
    isExternal: true,
    isHighlighted: false,
  };

  return (
    <div className="min-h-screen bg-black text-white">
      {/* Hero Section */}
      <section className="min-h-[85vh] sm:min-h-screen flex flex-col items-center justify-center px-4 sm:px-6 py-12 sm:py-24">
        <div className="w-full max-w-3xl mx-auto animate-fade-in">
          <div 
            className="relative rounded-2xl sm:rounded-3xl p-6 sm:p-10 md:p-14"
            style={{ 
              backgroundColor: '#111111',
              boxShadow: `0 8px 60px ${BRAND_COLOR_LIGHT}, 0 0 80px rgba(0, 165, 160, 0.08)`
            }}
          >
            {/* Logo */}
            <div className="flex justify-center mb-0">
              <img 
                src={logoWhite} 
                alt="Tu Consultorio Digital" 
                className="h-40 sm:h-56 w-auto"
              />
            </div>
            
            {/* Title */}
            <h1 className="text-2xl sm:text-4xl md:text-5xl font-bold tracking-tight text-center mb-4 sm:mb-6 leading-tight -mt-6 sm:-mt-10">
              Tu consultorio ordenado:
              <span className="block" style={{ color: BRAND_COLOR }}>pacientes, agenda y pagos</span>
              <span className="block">en un solo lugar</span>
            </h1>
            
            {/* Subtitle */}
            <p className="text-sm sm:text-lg md:text-xl text-gray-400 text-center mb-8 sm:mb-10 max-w-xl mx-auto leading-relaxed font-light">
              Gestioná pacientes, agenda privada, pagos y recordatorios sin planillas ni mensajes sueltos.
            </p>
            
            {/* CTA Buttons */}
            <div className="flex flex-col sm:flex-row justify-center gap-4">
              <a 
                href={whatsappDemo}
                target="_blank"
                rel="noopener noreferrer"
              >
                <Button 
                  size="lg" 
                  className="w-full sm:w-auto h-12 sm:h-14 px-8 sm:px-12 text-sm sm:text-base font-semibold rounded-xl transition-all duration-300"
                  style={{ 
                    backgroundColor: BRAND_COLOR,
                    boxShadow: `0 4px 30px ${BRAND_SHADOW}`
                  }}
                >
                  Ver demo
                </Button>
              </a>
              <a 
                href={whatsappContact}
                target="_blank"
                rel="noopener noreferrer"
              >
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

            {/* Install App & Login Buttons */}
            <div className="flex flex-col sm:flex-row justify-center gap-3 mt-6 pt-6 border-t border-white/10">
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
      </section>

      {/* Problem → Solution Section */}
      <section className="px-4 sm:px-6 py-14 sm:py-24 bg-black">
        <div className="max-w-5xl mx-auto">
          <div className="grid md:grid-cols-2 gap-8 md:gap-16">
            {/* Problems */}
            <div>
              <h2 className="text-xl sm:text-2xl font-bold mb-6 text-gray-300">
                ¿Te suena familiar?
              </h2>
              <div className="space-y-4">
                {problems.map((problem, index) => (
                  <div 
                    key={index}
                    className="flex items-center gap-3 p-4 rounded-xl border border-red-500/20"
                    style={{ backgroundColor: 'rgba(239, 68, 68, 0.05)' }}
                  >
                    <problem.icon className="w-5 h-5 text-red-400 flex-shrink-0" />
                    <span className="text-gray-300 text-sm sm:text-base">{problem.text}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Solution */}
            <div>
              <h2 className="text-xl sm:text-2xl font-bold mb-6" style={{ color: '#00c78a' }}>
                La solución
              </h2>
              <div 
                className="p-6 rounded-xl border"
                style={{ 
                  backgroundColor: 'rgba(0, 199, 138, 0.05)',
                  borderColor: 'rgba(0, 199, 138, 0.2)'
                }}
              >
                <ul className="space-y-4">
                  <li className="flex items-start gap-3">
                    <Check className="w-5 h-5 mt-0.5 flex-shrink-0" style={{ color: '#00c78a' }} />
                    <span className="text-gray-300">Un sistema privado para tu consultorio</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <Check className="w-5 h-5 mt-0.5 flex-shrink-0" style={{ color: '#00c78a' }} />
                    <span className="text-gray-300">Todo centralizado y claro</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <Check className="w-5 h-5 mt-0.5 flex-shrink-0" style={{ color: '#00c78a' }} />
                    <span className="text-gray-300">Acceso para vos, tu equipo y tus pacientes</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <Check className="w-5 h-5 mt-0.5 flex-shrink-0" style={{ color: '#00c78a' }} />
                    <span className="text-gray-300">Alertas automáticas de pagos y citas</span>
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Screenshots Carousel Section */}
      <ScreenshotsCarousel />

      {/* Features Section - Current Real Features */}
      <section className="px-4 sm:px-6 py-14 sm:py-28 bg-black">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-10 sm:mb-16">
            <h2 className="text-xl sm:text-3xl md:text-4xl font-bold mb-3 sm:mb-4 tracking-tight">
              Todo lo que necesitás
            </h2>
            <p className="text-gray-500 text-sm sm:text-lg font-light max-w-2xl mx-auto">
              Funcionalidades diseñadas para el día a día de tu consultorio.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
            {currentFeatures.map((feature, index) => (
              <div
                key={feature.title}
                className="p-5 sm:p-7 rounded-xl sm:rounded-2xl border border-white/5 animate-fade-in transition-all duration-300 hover:border-white/10"
                style={{ 
                  backgroundColor: '#111111',
                  animationDelay: `${(index + 1) * 100}ms`, 
                  animationFillMode: 'both' 
                }}
              >
                <div 
                  className="w-10 h-10 sm:w-12 sm:h-12 rounded-lg sm:rounded-xl flex items-center justify-center mb-4 sm:mb-5"
                  style={{ backgroundColor: 'rgba(0, 199, 138, 0.1)' }}
                >
                  <feature.icon className="w-5 h-5 sm:w-6 sm:h-6" style={{ color: '#00c78a' }} />
                </div>
                <h3 className="text-base sm:text-lg font-semibold text-white mb-2 tracking-tight">
                  {feature.title}
                </h3>
                <p className="text-gray-500 text-xs sm:text-sm leading-relaxed font-light">
                  {feature.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Key Differentiator Section */}
      <section className="px-4 sm:px-6 py-14 sm:py-24" style={{ backgroundColor: '#080808' }}>
        <div className="max-w-4xl mx-auto">
          <div 
            className="rounded-2xl sm:rounded-3xl p-8 sm:p-12 text-center border"
            style={{ 
              backgroundColor: '#111111',
              borderColor: 'rgba(0, 199, 138, 0.2)',
              boxShadow: '0 0 60px rgba(0, 199, 138, 0.1)'
            }}
          >
            <div 
              className="w-14 h-14 sm:w-16 sm:h-16 mx-auto mb-6 rounded-2xl flex items-center justify-center"
              style={{ backgroundColor: 'rgba(0, 199, 138, 0.1)' }}
            >
              <Lock className="w-7 h-7 sm:w-8 sm:h-8" style={{ color: '#00c78a' }} />
            </div>
            
            <h2 className="text-xl sm:text-3xl md:text-4xl font-bold mb-4 tracking-tight">
              Tu consultorio, tu sistema
            </h2>
            <p className="text-lg sm:text-xl mb-6" style={{ color: '#00c78a' }}>
              Un sistema privado, no una agenda pública
            </p>
            <p className="text-gray-400 text-sm sm:text-base max-w-2xl mx-auto leading-relaxed font-light">
              A diferencia de plataformas públicas donde cualquiera puede agendar, acá solo tus pacientes acceden a tu agenda. 
              Más control, menos cancelaciones, imagen más profesional.
            </p>
          </div>
        </div>
      </section>

      {/* Benefits Section */}
      <section className="px-4 sm:px-6 py-14 sm:py-28 bg-black">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-xl sm:text-3xl md:text-4xl font-bold text-center mb-8 sm:mb-16 tracking-tight">
            Por qué elegir este sistema
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
            {benefits.map((benefit, index) => (
              <div
                key={benefit.title}
                className="flex items-start gap-4 sm:gap-5 p-5 sm:p-6 rounded-xl sm:rounded-2xl border border-white/5 animate-fade-in transition-all duration-300 hover:border-white/10"
                style={{ 
                  backgroundColor: '#111111',
                  animationDelay: `${(index + 1) * 100}ms`, 
                  animationFillMode: 'both' 
                }}
              >
                <div 
                  className="w-10 h-10 sm:w-12 sm:h-12 rounded-lg sm:rounded-xl flex items-center justify-center flex-shrink-0"
                  style={{ backgroundColor: 'rgba(0, 199, 138, 0.1)' }}
                >
                  <benefit.icon className="w-5 h-5 sm:w-6 sm:h-6" style={{ color: '#00c78a' }} />
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
            ))}
          </div>
        </div>
      </section>

      {/* Private Clinic Premium Feature */}
      <section className="px-4 sm:px-6 py-14 sm:py-24" style={{ backgroundColor: '#080808' }}>
        <div className="max-w-4xl mx-auto">
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
              <li className="flex items-center gap-3 text-gray-300 text-sm sm:text-base">
                <Check className="w-4 h-4 flex-shrink-0" style={{ color: '#a78bfa' }} />
                Portal exclusivo para tus pacientes
              </li>
              <li className="flex items-center gap-3 text-gray-300 text-sm sm:text-base">
                <Check className="w-4 h-4 flex-shrink-0" style={{ color: '#a78bfa' }} />
                Acceso privado y seguro
              </li>
              <li className="flex items-center gap-3 text-gray-300 text-sm sm:text-base">
                <Check className="w-4 h-4 flex-shrink-0" style={{ color: '#a78bfa' }} />
                Preparado para dominio o subdominio propio
              </li>
              <li className="flex items-center gap-3 text-gray-300 text-sm sm:text-base">
                <Check className="w-4 h-4 flex-shrink-0" style={{ color: '#a78bfa' }} />
                Imagen profesional frente a tus pacientes
              </li>
            </ul>

            <p className="text-gray-500 text-xs sm:text-sm font-light">
              Próximamente disponible como add-on para todos los planes.
            </p>
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section id="pricing" className="px-4 sm:px-6 py-14 sm:py-28 bg-black">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-8 sm:mb-12">
            <h2 className="text-xl sm:text-3xl md:text-4xl font-bold mb-3 sm:mb-4 tracking-tight">
              Planes según tu consultorio
            </h2>
            <p className="text-gray-500 text-sm sm:text-lg max-w-2xl mx-auto font-light">
              Elegí el plan según la cantidad de pacientes que manejás hoy. Podés cambiarlo cuando quieras.
            </p>
          </div>

          {/* Billing Toggle */}
          <div className="flex flex-col items-center gap-3 mb-8 sm:mb-12">
            <div className="inline-flex items-center gap-4 px-4">
              <span className={`text-sm font-medium transition-colors ${!isAnnual ? 'text-white' : 'text-gray-500'}`}>
                Pago mensual
              </span>
              <button
                onClick={() => setIsAnnual(!isAnnual)}
                className="relative w-14 h-7 rounded-full transition-colors duration-300"
                style={{ backgroundColor: isAnnual ? '#00c78a' : 'rgba(255, 255, 255, 0.2)' }}
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
                className="text-xs sm:text-sm font-medium px-4 py-1.5 rounded-full animate-fade-in"
                style={{ 
                  backgroundColor: 'rgba(0, 199, 138, 0.1)',
                  color: '#00c78a'
                }}
              >
                💳 Hasta 12 cuotas sin interés
              </p>
            )}
          </div>

          {/* Pricing Cards Grid - 4 plans */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 mb-8 sm:mb-12">
            {getPricingPlans().map((plan, index) => (
              <div
                key={plan.id}
                className="animate-fade-in"
                style={{ animationDelay: `${(index + 1) * 100}ms`, animationFillMode: 'both' }}
              >
                <PricingCard {...plan} />
              </div>
            ))}
          </div>

          {/* Personalizado - Bloque aparte, destacado */}
          <div className="max-w-3xl mx-auto animate-fade-in" style={{ animationDelay: '600ms', animationFillMode: 'both' }}>
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
                <div className="flex items-center gap-2">
                  <Check className="w-5 h-5 flex-shrink-0" style={{ color: '#00c78a' }} />
                  <span>Más profesionales</span>
                </div>
                <div className="flex items-center gap-2">
                  <Check className="w-5 h-5 flex-shrink-0" style={{ color: '#00c78a' }} />
                  <span>Más pacientes</span>
                </div>
                <div className="flex items-center gap-2">
                  <Check className="w-5 h-5 flex-shrink-0" style={{ color: '#00c78a' }} />
                  <span>Configuraciones a medida</span>
                </div>
              </div>
              <a href={whatsappPersonalizado} target="_blank" rel="noopener noreferrer">
                <Button
                  className="h-12 sm:h-14 px-10 sm:px-12 text-sm sm:text-base font-semibold rounded-xl transition-all duration-300"
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
        </div>
      </section>

      {/* FAQ Section */}
      <section className="px-4 sm:px-6 py-14 sm:py-28" style={{ backgroundColor: '#080808' }}>
        <div className="max-w-3xl mx-auto">
          <div className="text-center mb-10 sm:mb-16">
            <div className="flex justify-center mb-4">
              <div 
                className="w-12 h-12 sm:w-14 sm:h-14 rounded-xl sm:rounded-2xl flex items-center justify-center"
                style={{ 
                  backgroundColor: 'rgba(0, 199, 138, 0.1)',
                  boxShadow: '0 0 30px rgba(0, 199, 138, 0.15)'
                }}
              >
                <HelpCircle className="w-6 h-6 sm:w-7 sm:h-7" style={{ color: '#00c78a' }} />
              </div>
            </div>
            <h2 className="text-xl sm:text-3xl md:text-4xl font-bold mb-3 sm:mb-4 tracking-tight">
              Preguntas Frecuentes
            </h2>
            <p className="text-gray-500 text-sm sm:text-lg font-light">
              Todo lo que necesitás saber antes de empezar.
            </p>
          </div>

          <Accordion type="single" collapsible className="space-y-3">
            {faqItems.map((item, index) => (
              <AccordionItem 
                key={index} 
                value={`item-${index}`}
                className="border border-white/5 rounded-xl sm:rounded-2xl px-5 sm:px-6 overflow-hidden"
                style={{ backgroundColor: '#111111' }}
              >
                <AccordionTrigger className="text-left text-sm sm:text-base font-medium text-white hover:no-underline py-4 sm:py-5">
                  {item.question}
                </AccordionTrigger>
                <AccordionContent className="text-gray-400 text-sm pb-4 sm:pb-5 font-light leading-relaxed">
                  {item.answer}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      </section>

      {/* Final CTA Section */}
      <section className="px-4 sm:px-6 py-16 sm:py-24 bg-black">
        <div className="max-w-2xl mx-auto text-center">
          <h2 className="text-xl sm:text-3xl md:text-4xl font-bold mb-4 sm:mb-6 tracking-tight">
            ¿Querés ver cómo funciona?
          </h2>
          <p className="text-gray-500 text-sm sm:text-lg mb-8 sm:mb-10 font-light max-w-lg mx-auto">
            Te muestro el sistema funcionando con un consultorio real en pocos minutos.
          </p>
          <div className="flex flex-col sm:flex-row justify-center gap-4">
            <a 
              href={whatsappDemo}
              target="_blank"
              rel="noopener noreferrer"
            >
              <Button 
                size="lg" 
                className="w-full sm:w-auto h-12 sm:h-14 px-8 sm:px-12 text-sm sm:text-base font-semibold rounded-xl transition-all duration-300"
                style={{ 
                  backgroundColor: '#00c78a',
                  boxShadow: '0 4px 30px rgba(0, 199, 138, 0.35)'
                }}
              >
                Ver demo
              </Button>
            </a>
            <a 
              href={whatsappContact}
              target="_blank"
              rel="noopener noreferrer"
            >
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
          
          {/* Install App & Login Buttons */}
          <div className="flex flex-col sm:flex-row justify-center gap-3 mt-6">
            <InstallAppButton />
            <a href="/auth">
              <Button variant="outline" className="gap-2 bg-transparent text-white border-white/20 hover:bg-white/5">
                Iniciar sesión
              </Button>
            </a>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="px-4 sm:px-6 py-8 sm:py-12 bg-black border-t border-white/5">
        <div className="max-w-7xl mx-auto flex flex-col items-center gap-4">
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
          backgroundColor: '#00c78a',
          boxShadow: '0 4px 30px rgba(0, 199, 138, 0.4)'
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
    </div>
  );
};

export default Landing;
