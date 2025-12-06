import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Users, MessageCircle, UserPlus, ClipboardList, CalendarCheck, Clock, Eye, Sparkles, Calendar, Play, HelpCircle } from "lucide-react";
import PricingCard from "@/components/PricingCard";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";

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
  {
    question: "¿Ofrecen período de prueba?",
    answer: "Sí, podés probar el sistema durante 14 días gratis con todas las funcionalidades. No se requiere tarjeta de crédito."
  },
];

const pricingPlans = [
  {
    id: "individual",
    name: "Consultorio Individual",
    description: "Ideal para profesionales independientes",
    professionals: "1 profesional",
    patients: "Hasta 80 pacientes activos",
    price: "1.900 UYU",
    priceNote: "/ mes (pago anual)",
    buttonText: "Elegir este plan",
    buttonLink: "/pago-plan/individual",
    isHighlighted: false,
  },
  {
    id: "profesional",
    name: "Consultorio Profesional",
    description: "Para consultorios en crecimiento",
    professionals: "Hasta 3 profesionales",
    patients: "Hasta 300 pacientes activos",
    price: "3.900 UYU",
    priceNote: "/ mes (pago anual)",
    buttonText: "Elegir este plan",
    buttonLink: "/pago-plan/profesional",
    isHighlighted: true,
    highlightLabel: "Más elegido",
  },
  {
    id: "avanzada",
    name: "Clínica Avanzada",
    description: "Para clínicas medianas",
    professionals: "Hasta 7 profesionales",
    patients: "Hasta 800 pacientes activos",
    price: "6.900 UYU",
    priceNote: "/ mes (pago anual)",
    buttonText: "Elegir este plan",
    buttonLink: "/pago-plan/avanzada",
    isHighlighted: false,
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
  buttonLink: "https://api.whatsapp.com/send?phone=59891093977&text=Hola%2C+me+interesa+el+Plan+Enterprise+para+mi+organizaci%C3%B3n.",
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

const Landing = () => {
  const whatsappLink = "https://api.whatsapp.com/send?phone=59891093977&text=Hola%2C+vengo+de+su+sitio+web.+Soy+profesional+y+me+interesa+el+servicio+de+gesti%C3%B3n+para+mis+pacientes.";

  return (
    <div className="min-h-screen bg-black text-white">
      {/* Hero Section */}
      <section className="min-h-[85vh] sm:min-h-screen flex flex-col items-center justify-center px-4 sm:px-6 py-12 sm:py-24">
        <div className="w-full max-w-3xl mx-auto animate-fade-in">
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
            <h1 className="text-2xl sm:text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight text-center mb-4 sm:mb-6 leading-tight">
              Sistema de Gestión
              <span className="block" style={{ color: '#00c78a' }}>de Consultorio</span>
            </h1>
            
            {/* Subtitle */}
            <p className="text-sm sm:text-lg md:text-xl text-gray-400 text-center mb-6 sm:mb-10 max-w-xl mx-auto leading-relaxed font-light">
              Organizá pacientes, citas y recordatorios en un panel simple y profesional.
            </p>
            
            {/* CTA Button */}
            <div className="flex justify-center">
              <Link to="/auth">
                <Button 
                  size="lg" 
                  className="h-12 sm:h-14 px-8 sm:px-12 text-sm sm:text-base font-semibold rounded-xl transition-all duration-300"
                  style={{ 
                    backgroundColor: '#00c78a',
                    boxShadow: '0 4px 30px rgba(0, 199, 138, 0.35)'
                  }}
                >
                  Iniciar sesión
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Video Demo Section */}
      <section className="px-4 sm:px-6 py-14 sm:py-24" style={{ backgroundColor: '#080808' }}>
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-8 sm:mb-12">
            <h2 className="text-xl sm:text-3xl md:text-4xl font-bold mb-3 sm:mb-4 tracking-tight">
              Mirá el sistema en acción
            </h2>
            <p className="text-gray-500 text-sm sm:text-lg font-light">
              Una demo de 2 minutos que muestra todo lo que podés hacer.
            </p>
          </div>
          
          {/* Video Container */}
          <div 
            className="relative aspect-video rounded-xl sm:rounded-2xl overflow-hidden border border-white/10"
            style={{ 
              backgroundColor: '#111111',
              boxShadow: '0 8px 40px rgba(0, 199, 138, 0.1)'
            }}
          >
            {/* Placeholder - Reemplazar con video real */}
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <div 
                className="w-16 h-16 sm:w-20 sm:h-20 rounded-full flex items-center justify-center mb-4 cursor-pointer transition-all duration-300 hover:scale-110"
                style={{ 
                  backgroundColor: '#00c78a',
                  boxShadow: '0 4px 30px rgba(0, 199, 138, 0.4)'
                }}
              >
                <Play className="w-7 h-7 sm:w-8 sm:h-8 text-white ml-1" fill="white" />
              </div>
              <p className="text-gray-400 text-sm font-light">Video demo próximamente</p>
            </div>
            
            {/* Uncomment and add your video URL when ready */}
            {/* <iframe 
              src="https://www.youtube.com/embed/YOUR_VIDEO_ID"
              title="Demo del Sistema"
              className="absolute inset-0 w-full h-full"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            /> */}
          </div>
        </div>
      </section>

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

          {/* Pricing Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6 mb-4 sm:mb-8">
            {pricingPlans.map((plan, index) => (
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
      <section className="px-4 sm:px-6 py-16 sm:py-28" style={{ backgroundColor: '#080808' }}>
        <div className="max-w-2xl mx-auto text-center">
          <span className="text-4xl sm:text-6xl mb-6 block">🚀</span>
          <h2 className="text-xl sm:text-3xl md:text-4xl font-bold mb-4 sm:mb-6 tracking-tight">
            Empezá a organizar tu consultorio
            <span className="block" style={{ color: '#00c78a' }}>hoy mismo</span>
          </h2>
          <p className="text-gray-500 text-sm sm:text-lg mb-8 sm:mb-10 font-light max-w-lg mx-auto">
            Probá gratis durante 14 días. Sin tarjeta de crédito. Cancelá cuando quieras.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link to="/auth">
              <Button 
                size="lg" 
                className="w-full sm:w-auto h-12 sm:h-14 px-8 sm:px-12 text-sm sm:text-base font-semibold rounded-xl transition-all duration-300"
                style={{ 
                  backgroundColor: '#00c78a',
                  boxShadow: '0 4px 30px rgba(0, 199, 138, 0.35)'
                }}
              >
                Crear cuenta gratis
              </Button>
            </Link>
            <a href="#pricing">
              <Button 
                variant="outline"
                size="lg" 
                className="w-full sm:w-auto h-12 sm:h-14 px-8 sm:px-12 text-sm sm:text-base font-semibold rounded-xl transition-all duration-300"
                style={{ 
                  borderColor: 'rgba(255, 255, 255, 0.2)',
                  color: 'white',
                  backgroundColor: 'transparent'
                }}
              >
                Ver planes
              </Button>
            </a>
          </div>
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
