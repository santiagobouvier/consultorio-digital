import { Link } from "react-router-dom";
import { useState, useCallback, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Users, MessageCircle, UserPlus, ClipboardList, CalendarCheck, Clock, Eye, Sparkles, Calendar, HelpCircle, ChevronLeft, ChevronRight, Check, CalendarDays, BarChart3, UserCheck } from "lucide-react";
import PricingCard from "@/components/PricingCard";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import useEmblaCarousel from "embla-carousel-react";
import dashboardMobile from "@/assets/screenshots/dashboard-mobile.png";
import appointmentsMobile from "@/assets/screenshots/appointments-mobile.png";
import agendaMobile from "@/assets/screenshots/agenda-mobile.png";
import patientsMobile from "@/assets/screenshots/patients-mobile.png";
import remindersMobile from "@/assets/screenshots/reminders-mobile.png";

const screenshotSlides = [
  {
    title: "Dashboard Principal",
    description: "Visualizá todas tus citas del día y estadísticas importantes de un vistazo. Accedé rápidamente a pacientes activos, citas pendientes y acciones frecuentes.",
    image: dashboardMobile
  },
  {
    title: "Agenda Inteligente",
    description: "Calendario visual para organizar tus citas por día, semana o mes. Filtrá por modalidad y estado para tener todo bajo control.",
    image: agendaMobile
  },
  {
    title: "Gestión de Pacientes",
    description: "Fichas completas con historial, notas privadas y datos de contacto. Todo organizado para que encuentres la información que necesitás.",
    image: patientsMobile
  },
  {
    title: "Recordatorios WhatsApp",
    description: "Enviá recordatorios con un solo click, sin salir del sistema. Mantené a tus pacientes informados de sus próximas citas.",
    image: remindersMobile
  },
  {
    title: "Portal de Reservas",
    description: "Tus pacientes pueden agendar citas desde tu página pública. Ahorrá tiempo y dejá que ellos elijan el horario que les convenga.",
    image: appointmentsMobile
  }
];

const faqItems = [
  {
    question: "¿Qué incluye cada plan?",
    answer: "Todos los planes incluyen las mismas funcionalidades: portal del paciente, agenda inteligente, recordatorios por WhatsApp, dashboard financiero y alertas de vencimiento. La diferencia está en la cantidad de profesionales y pacientes activos."
  },
  {
    question: "¿Cómo funciona el pago anual en cuotas?",
    answer: "Podés pagar el plan anual en hasta 12 cuotas sin interés con tarjeta de crédito. El acceso se activa inmediatamente después de confirmar el pago."
  },
  {
    question: "¿Puedo cambiar de plan en cualquier momento?",
    answer: "Sí, podés escalar tu plan cuando lo necesites. Si pasás a un plan superior, solo pagás la diferencia proporcional."
  },
  {
    question: "¿Qué pasa si supero el límite de pacientes?",
    answer: "Te avisaremos cuando estés cerca del límite. Para superarlo, debés solicitar un upgrade de plan manualmente, nunca se te cobrará nada sin tu autorización."
  },
  {
    question: "¿Los recordatorios por WhatsApp tienen costo adicional?",
    answer: "No, los recordatorios semi-automáticos están incluidos en todos los planes sin límite de envíos."
  },
];


const enterprisePlan = {
  id: "enterprise",
  name: "Plan Enterprise",
  description: "Para grandes organizaciones con necesidades específicas",
  professionals: "Profesionales ilimitados",
  patients: "Pacientes ilimitados",
  price: "Desde 12.000 UYU",
  priceNote: "/ mes",
  buttonText: "Hablar con ventas",
  buttonLink: "https://wa.me/59891093977?text=Hola,%20quiero%20hablar%20sobre%20el%20Plan%20Enterprise%20para%20mi%20organización.",
  isExternal: true,
  isHighlighted: false,
};

const features = [
  {
    icon: Users,
    title: "Gestión de Pacientes",
    description: "Administrá tu cartera de pacientes con fichas completas y notas privadas.",
  },
  {
    icon: Calendar,
    title: "Agenda Profesional",
    description: "Organizá tus citas con un calendario intuitivo y fácil de usar.",
  },
  {
    icon: MessageCircle,
    title: "Recordatorios por WhatsApp",
    description: "Enviá recordatorios semi-automáticos a tus pacientes con un solo click.",
  },
];

const steps = [
  {
    icon: UserPlus,
    title: "Creá tu cuenta",
    description: "Configurá tu consultorio en minutos.",
  },
  {
    icon: ClipboardList,
    title: "Cargá pacientes y horarios",
    description: "Organizá todo desde un panel simple.",
  },
  {
    icon: CalendarCheck,
    title: "Gestioná tu agenda",
    description: "Enviá recordatorios y controlá tus citas.",
  },
];

const benefits = [
  {
    icon: Clock,
    title: "Ahorro de tiempo",
    description: "Evitá mensajes repetitivos.",
  },
  {
    icon: Eye,
    title: "Agenda clara",
    description: "Visualizá tus citas por día o semana.",
  },
  {
    icon: MessageCircle,
    title: "Recordatorios por WhatsApp",
    description: "Semi-automáticos y fáciles de usar.",
  },
  {
    icon: Sparkles,
    title: "Diseño profesional",
    description: "Interfaz moderna y clara.",
  },
];

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
            Conocé el sistema
          </h2>
          <p className="text-gray-500 text-sm sm:text-lg font-light">
            Todo lo que necesitás para gestionar tu consultorio.
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
  const whatsappLink = "https://api.whatsapp.com/send?phone=59891093977&text=Hola%2C+me+gustar%C3%ADa+coordinar+una+demo+del+sistema+de+gesti%C3%B3n+para+profesionales+de+salud+mental.";

  const getPricingPlans = () => {
    const savingsNote = isAnnual ? "Ahorrás más del 50% pagando anual." : undefined;
    const paymentType = isAnnual ? "pago anual" : "pago mensual";
    
    return [
      {
        id: "individual",
        name: "Consultorio Individual",
        description: "Ideal para profesionales independientes",
        professionals: "1 profesional",
        patients: "Hasta 80 pacientes activos",
        price: isAnnual ? "1.900 UYU" : "3.000 UYU",
        priceNote: isAnnual ? "/ mes (pago anual)" : "/ mes",
        savingsNote,
        buttonText: "Elegir este plan",
        buttonLink: `https://wa.me/59891093977?text=Hola,%20quiero%20contratar%20el%20Plan%20Consultorio%20Individual%20(${isAnnual ? "1.900" : "3.000"}%20UYU/mes%20-%20${encodeURIComponent(paymentType)}).`,
        isExternal: true,
        isHighlighted: false,
      },
      {
        id: "profesional",
        name: "Consultorio Profesional",
        description: "Para consultorios en crecimiento",
        professionals: "Hasta 3 profesionales",
        patients: "Hasta 300 pacientes activos",
        price: isAnnual ? "3.900 UYU" : "6.200 UYU",
        priceNote: isAnnual ? "/ mes (pago anual)" : "/ mes",
        savingsNote,
        buttonText: "Elegir este plan",
        buttonLink: `https://wa.me/59891093977?text=Hola,%20quiero%20contratar%20el%20Plan%20Consultorio%20Profesional%20(${isAnnual ? "3.900" : "6.200"}%20UYU/mes%20-%20${encodeURIComponent(paymentType)}).`,
        isExternal: true,
        isHighlighted: true,
        highlightLabel: "Más elegido",
      },
      {
        id: "avanzada",
        name: "Clínica Avanzada",
        description: "Para clínicas medianas",
        professionals: "Hasta 7 profesionales",
        patients: "Hasta 800 pacientes activos",
        price: isAnnual ? "6.900 UYU" : "9.500 UYU",
        priceNote: isAnnual ? "/ mes (pago anual)" : "/ mes",
        savingsNote,
        buttonText: "Elegir este plan",
        buttonLink: `https://wa.me/59891093977?text=Hola,%20quiero%20contratar%20el%20Plan%20Clínica%20Avanzada%20(${isAnnual ? "6.900" : "9.500"}%20UYU/mes%20-%20${encodeURIComponent(paymentType)}).`,
        isExternal: true,
        isHighlighted: false,
      },
    ];
  };

  return (
    <div className="min-h-screen bg-black text-white">
      {/* Hero Section */}
      <section className="min-h-[85vh] sm:min-h-screen flex flex-col items-center justify-center px-4 sm:px-6 py-12 sm:py-24">
        <div className="w-full max-w-5xl mx-auto animate-fade-in">
          <div className="grid lg:grid-cols-2 gap-10 lg:gap-16 items-center">
            {/* Left Column - Content */}
            <div className="order-2 lg:order-1">
              {/* Premium Hero Card */}
              <div 
                className="relative rounded-2xl sm:rounded-3xl p-5 sm:p-10 md:p-14"
                style={{ 
                  backgroundColor: '#111111',
                  boxShadow: '0 8px 60px rgba(0, 199, 138, 0.15), 0 0 80px rgba(0, 199, 138, 0.08)'
                }}
              >
                {/* Emoji */}
                <div className="flex justify-center mb-6 sm:mb-10">
                  <span className="text-6xl sm:text-8xl">🗓️</span>
                </div>
                
                {/* Title */}
                <h1 className="text-2xl sm:text-4xl md:text-5xl font-bold tracking-tight text-center mb-4 sm:mb-6 leading-tight">
                  Sistema de Gestión
                  <span className="block" style={{ color: '#00c78a' }}>de Consultorio</span>
                </h1>
                
                {/* Subtitle */}
                <p className="text-sm sm:text-lg md:text-xl text-gray-400 text-center mb-6 sm:mb-10 max-w-xl mx-auto leading-relaxed font-light">
                  Organizá pacientes, citas y recordatorios en un panel simple y profesional.
                </p>
                
                {/* CTA Buttons */}
                <div className="flex flex-col sm:flex-row justify-center gap-4">
                  <Link to="/auth">
                    <Button 
                      size="lg" 
                      className="w-full sm:w-auto h-12 sm:h-14 px-8 sm:px-12 text-sm sm:text-base font-semibold rounded-xl transition-all duration-300"
                      style={{ 
                        backgroundColor: '#00c78a',
                        boxShadow: '0 4px 30px rgba(0, 199, 138, 0.35)'
                      }}
                    >
                      Iniciar sesión
                    </Button>
                  </Link>
                  <a 
                    href="#conoce-el-sistema"
                    onClick={(e) => {
                      e.preventDefault();
                      document.getElementById('conoce-el-sistema')?.scrollIntoView({ behavior: 'smooth' });
                    }}
                  >
                    <Button 
                      variant="outline"
                      size="lg" 
                      className="w-full sm:w-auto h-12 sm:h-14 px-8 sm:px-12 text-sm sm:text-base font-semibold rounded-xl transition-all duration-300 bg-white text-black border-white hover:bg-gray-100"
                    >
                      Conoce el sistema
                    </Button>
                  </a>
                </div>
              </div>
            </div>

            {/* Right Column - Floating Mockup */}
            <div className="order-1 lg:order-2 hidden lg:block">
              <div 
                className="relative"
                style={{
                  animation: 'float 6s ease-in-out infinite'
                }}
              >
                {/* Browser Window Mockup */}
                <div 
                  className="rounded-2xl overflow-hidden border"
                  style={{ 
                    backgroundColor: '#1a1a1a',
                    borderColor: 'rgba(255, 255, 255, 0.1)',
                    boxShadow: '0 25px 80px -20px rgba(0, 0, 0, 0.5), 0 0 60px rgba(0, 199, 138, 0.1)'
                  }}
                >
                  {/* Browser bar */}
                  <div 
                    className="flex items-center gap-2 px-4 py-2.5 border-b"
                    style={{ borderColor: 'rgba(255, 255, 255, 0.1)' }}
                  >
                    <div className="flex gap-1.5">
                      <div className="w-2.5 h-2.5 rounded-full bg-red-500/80" />
                      <div className="w-2.5 h-2.5 rounded-full bg-yellow-500/80" />
                      <div className="w-2.5 h-2.5 rounded-full bg-green-500/80" />
                    </div>
                    <div 
                      className="flex-1 h-5 rounded-md ml-3"
                      style={{ backgroundColor: 'rgba(255, 255, 255, 0.05)' }}
                    />
                  </div>

                  {/* Dashboard Content */}
                  <div className="p-6 grid grid-cols-5 gap-4">
                    {/* Mini Calendar - Left side */}
                    <div 
                      className="col-span-3 rounded-xl p-4"
                      style={{ backgroundColor: 'rgba(255, 255, 255, 0.03)' }}
                    >
                      <div className="flex items-center justify-between mb-3">
                        <span className="text-xs font-medium text-gray-400">Diciembre 2025</span>
                        <Calendar className="w-4 h-4 text-gray-500" />
                      </div>
                      
                      {/* Week days header */}
                      <div className="grid grid-cols-7 gap-1 mb-2">
                        {['L', 'M', 'X', 'J', 'V', 'S', 'D'].map((d) => (
                          <div key={d} className="text-[10px] text-gray-500 text-center">{d}</div>
                        ))}
                      </div>
                      
                      {/* Calendar days */}
                      <div className="grid grid-cols-7 gap-1">
                        {[...Array(7)].map((_, i) => (
                          <div 
                            key={i}
                            className="aspect-square rounded-md flex items-center justify-center text-[11px]"
                            style={{ 
                              backgroundColor: [1, 3, 5].includes(i) ? 'rgba(0, 199, 138, 0.2)' : 'transparent',
                              color: [1, 3, 5].includes(i) ? '#00c78a' : '#888'
                            }}
                          >
                            {i + 8}
                          </div>
                        ))}
                      </div>
                      <div className="grid grid-cols-7 gap-1 mt-1">
                        {[...Array(7)].map((_, i) => (
                          <div 
                            key={i}
                            className="aspect-square rounded-md flex items-center justify-center text-[11px]"
                            style={{ 
                              backgroundColor: [0, 2, 4].includes(i) ? 'rgba(0, 199, 138, 0.2)' : 'transparent',
                              color: [0, 2, 4].includes(i) ? '#00c78a' : '#888'
                            }}
                          >
                            {i + 15}
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Metrics cards - Right side */}
                    <div className="col-span-2 flex flex-col gap-3">
                      <div 
                        className="rounded-xl p-4 flex-1"
                        style={{ backgroundColor: 'rgba(0, 199, 138, 0.1)' }}
                      >
                        <div className="text-xs text-gray-400 mb-1">Citas hoy</div>
                        <div className="text-2xl font-bold" style={{ color: '#00c78a' }}>5</div>
                      </div>
                      <div 
                        className="rounded-xl p-4 flex-1"
                        style={{ backgroundColor: 'rgba(255, 255, 255, 0.03)' }}
                      >
                        <div className="text-xs text-gray-400 mb-1">Pacientes activos</div>
                        <div className="text-2xl font-bold text-white">47</div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Float animation keyframes */}
        <style>{`
          @keyframes float {
            0%, 100% { transform: translateY(0px); }
            50% { transform: translateY(-10px); }
          }
        `}</style>
      </section>

      {/* Screenshots Carousel Section */}
      <ScreenshotsCarousel />

      {/* How it Works Section */}
      <section className="px-4 sm:px-6 py-14 sm:py-28 bg-black">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-xl sm:text-3xl md:text-4xl font-bold text-center mb-10 sm:mb-20 tracking-tight">
            Cómo funciona
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-8">
            {steps.map((step, index) => (
              <div
                key={step.title}
                className="text-center animate-fade-in"
                style={{ animationDelay: `${(index + 1) * 100}ms`, animationFillMode: 'both' }}
              >
                {/* Step icon with glow */}
                <div 
                  className="w-12 h-12 sm:w-16 sm:h-16 mx-auto mb-4 sm:mb-6 rounded-xl sm:rounded-2xl flex items-center justify-center"
                  style={{ 
                    backgroundColor: 'rgba(0, 199, 138, 0.1)',
                    boxShadow: '0 0 30px rgba(0, 199, 138, 0.2)'
                  }}
                >
                  <step.icon className="w-5 h-5 sm:w-7 sm:h-7" style={{ color: '#00c78a' }} />
                </div>
                
                {/* Title */}
                <h3 className="text-base sm:text-lg font-semibold text-white mb-2 sm:mb-3 tracking-tight">
                  {step.title}
                </h3>
                
                {/* Description */}
                <p className="text-gray-500 text-xs sm:text-sm leading-relaxed font-light">
                  {step.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Benefits Section */}
      <section className="px-4 sm:px-6 py-14 sm:py-28" style={{ backgroundColor: '#080808' }}>
        <div className="max-w-4xl mx-auto">
          <h2 className="text-xl sm:text-3xl md:text-4xl font-bold text-center mb-8 sm:mb-20 tracking-tight">
            Beneficios
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-5">
            {benefits.map((benefit, index) => (
              <div
                key={benefit.title}
                className="flex items-start gap-3 sm:gap-5 p-4 sm:p-6 rounded-xl sm:rounded-2xl border border-white/5 animate-fade-in transition-all duration-300 hover:border-white/10"
                style={{ 
                  backgroundColor: '#111111',
                  animationDelay: `${(index + 1) * 100}ms`, 
                  animationFillMode: 'both' 
                }}
              >
                <div 
                  className="w-9 h-9 sm:w-11 sm:h-11 rounded-lg sm:rounded-xl flex items-center justify-center flex-shrink-0"
                  style={{ backgroundColor: 'rgba(0, 199, 138, 0.1)' }}
                >
                  <benefit.icon className="w-4 h-4 sm:w-5 sm:h-5" style={{ color: '#00c78a' }} />
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

      {/* Features Section */}
      <section className="px-4 sm:px-6 py-14 sm:py-28 bg-black">
        <div className="max-w-5xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 sm:gap-5">
            {features.map((feature, index) => (
              <div
                key={feature.title}
                className="p-5 sm:p-7 md:p-8 rounded-xl sm:rounded-2xl border border-white/5 animate-fade-in transition-all duration-300 hover:border-white/10"
                style={{ 
                  backgroundColor: '#111111',
                  animationDelay: `${(index + 1) * 100}ms`, 
                  animationFillMode: 'both' 
                }}
              >
                {/* Icon */}
                <div 
                  className="w-10 h-10 sm:w-12 sm:h-12 rounded-lg sm:rounded-xl flex items-center justify-center mb-4 sm:mb-6"
                  style={{ backgroundColor: 'rgba(0, 199, 138, 0.1)' }}
                >
                  <feature.icon className="w-5 h-5 sm:w-6 sm:h-6" style={{ color: '#00c78a' }} />
                </div>
                
                {/* Title */}
                <h3 className="text-base sm:text-lg font-semibold text-white mb-2 sm:mb-3 tracking-tight">
                  {feature.title}
                </h3>
                
                {/* Description */}
                <p className="text-gray-500 text-xs sm:text-sm leading-relaxed font-light">
                  {feature.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section id="pricing" className="px-4 sm:px-6 py-14 sm:py-28" style={{ backgroundColor: '#080808' }}>
        <div className="max-w-6xl mx-auto">
          {/* Section Header */}
          <div className="text-center mb-8 sm:mb-16">
            <h2 className="text-xl sm:text-3xl md:text-4xl font-bold mb-3 sm:mb-4 tracking-tight">
              Planes y Precios
            </h2>
            <p className="text-gray-500 text-sm sm:text-lg max-w-2xl mx-auto font-light">
              Pagás según el tamaño de tu consultorio. Todas las funciones están incluidas en todos los planes.
            </p>
          </div>

          {/* Billing Toggle */}
          <div className="flex justify-center mb-8 sm:mb-12">
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
          </div>

          {/* Pricing Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6 mb-4 sm:mb-8">
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

          {/* Enterprise Card - Full Width */}
          <div className="animate-fade-in" style={{ animationDelay: '400ms', animationFillMode: 'both' }}>
            <PricingCard {...enterprisePlan} />
          </div>

          {/* Payment Note */}
          <p className="text-center text-gray-500 text-xs sm:text-sm mt-6 sm:mt-10 font-light">
            💳 Todos los planes anuales se pueden pagar en hasta 12 cuotas sin interés.
          </p>
        </div>
      </section>

      {/* FAQ Section */}
      <section className="px-4 sm:px-6 py-14 sm:py-28 bg-black">
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

      {/* Demo CTA Section */}
      <section className="px-4 sm:px-6 py-16 sm:py-24 bg-black">
        <div className="max-w-2xl mx-auto text-center">
          <h2 className="text-xl sm:text-3xl md:text-4xl font-bold mb-4 sm:mb-6 tracking-tight">
            ¿Querés ver cómo funciona por dentro?
          </h2>
          <p className="text-gray-500 text-sm sm:text-lg mb-8 sm:mb-10 font-light max-w-lg mx-auto">
            Te muestro la demo en vivo en menos de 15 minutos y vemos si se adapta a tu consultorio.
          </p>
          <a 
            href="https://wa.me/59891093977?text=Hola,%20quiero%20agendar%20una%20demo%20del%20sistema%20para%20consultorios."
            target="_blank"
            rel="noopener noreferrer"
          >
            <Button 
              size="lg" 
              className="h-12 sm:h-14 px-8 sm:px-12 text-sm sm:text-base font-semibold rounded-xl transition-all duration-300"
              style={{ 
                backgroundColor: '#00c78a',
                boxShadow: '0 4px 30px rgba(0, 199, 138, 0.35)'
              }}
            >
              Ver demo en vivo
            </Button>
          </a>
        </div>
      </section>

      {/* Footer */}
      <footer className="px-4 sm:px-6 py-8 sm:py-12 bg-black border-t border-white/5">
        <p className="text-center text-gray-600 text-xs sm:text-sm font-light">
          © {new Date().getFullYear()} Sistema de Gestión de Consultorio
        </p>
      </footer>

      {/* Floating WhatsApp Button */}
      <a
        href={whatsappLink}
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
