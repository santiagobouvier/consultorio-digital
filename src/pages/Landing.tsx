import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Users, MessageCircle, UserPlus, ClipboardList, CalendarCheck, Clock, Eye, Sparkles, Calendar } from "lucide-react";
import PricingCard from "@/components/PricingCard";

const pricingPlans = [
  {
    id: "individual",
    name: "Consultorio Individual",
    description: "Ideal para profesionales independientes",
    professionals: "1 profesional",
    patients: "Hasta 80 pacientes activos",
    price: "1.500 UYU",
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
    price: "3.000 UYU",
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
    price: "5.500 UYU",
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
  price: "Desde 9.000 UYU",
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
      <section className="min-h-screen flex flex-col items-center justify-center px-4 sm:px-6 py-20 sm:py-24">
        <div className="w-full max-w-3xl mx-auto animate-fade-in">
          {/* Premium Hero Card */}
          <div 
            className="relative rounded-3xl p-6 sm:p-10 md:p-14"
            style={{ 
              backgroundColor: '#111111',
              boxShadow: '0 8px 60px rgba(0, 199, 138, 0.15), 0 0 80px rgba(0, 199, 138, 0.08)'
            }}
          >
            {/* Emoji */}
            <div className="flex justify-center mb-10">
              <span className="text-7xl sm:text-8xl">🗓️</span>
            </div>
            
            {/* Title */}
            <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight text-center mb-6 leading-tight">
              Sistema de Gestión
              <span className="block" style={{ color: '#00c78a' }}>de Consultorio</span>
            </h1>
            
            {/* Subtitle */}
            <p className="text-base sm:text-lg md:text-xl text-gray-400 text-center mb-10 max-w-xl mx-auto leading-relaxed font-light">
              Organizá pacientes, citas y recordatorios en un panel simple y profesional.
            </p>
            
            {/* CTA Button */}
            <div className="flex justify-center">
              <Link to="/auth">
                <Button 
                  size="lg" 
                  className="h-14 px-12 text-base font-semibold rounded-xl transition-all duration-300"
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

      {/* How it Works Section */}
      <section className="px-4 sm:px-6 py-28 bg-black">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold text-center mb-20 tracking-tight">
            Cómo funciona
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-10 md:gap-8">
            {steps.map((step, index) => (
              <div
                key={step.title}
                className="text-center animate-fade-in"
                style={{ animationDelay: `${(index + 1) * 100}ms`, animationFillMode: 'both' }}
              >
                {/* Step icon with glow */}
                <div 
                  className="w-16 h-16 mx-auto mb-6 rounded-2xl flex items-center justify-center"
                  style={{ 
                    backgroundColor: 'rgba(0, 199, 138, 0.1)',
                    boxShadow: '0 0 30px rgba(0, 199, 138, 0.2)'
                  }}
                >
                  <step.icon className="w-7 h-7" style={{ color: '#00c78a' }} />
                </div>
                
                {/* Title */}
                <h3 className="text-lg font-semibold text-white mb-3 tracking-tight">
                  {step.title}
                </h3>
                
                {/* Description */}
                <p className="text-gray-500 text-sm leading-relaxed font-light">
                  {step.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Benefits Section */}
      <section className="px-4 sm:px-6 py-28" style={{ backgroundColor: '#080808' }}>
        <div className="max-w-4xl mx-auto">
          <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold text-center mb-20 tracking-tight">
            Beneficios
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            {benefits.map((benefit, index) => (
              <div
                key={benefit.title}
                className="flex items-start gap-5 p-6 rounded-2xl border border-white/5 animate-fade-in transition-all duration-300 hover:border-white/10"
                style={{ 
                  backgroundColor: '#111111',
                  animationDelay: `${(index + 1) * 100}ms`, 
                  animationFillMode: 'both' 
                }}
              >
                <div 
                  className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0"
                  style={{ backgroundColor: 'rgba(0, 199, 138, 0.1)' }}
                >
                  <benefit.icon className="w-5 h-5" style={{ color: '#00c78a' }} />
                </div>
                <div>
                  <h3 className="text-white font-semibold mb-1.5 tracking-tight">
                    {benefit.title}
                  </h3>
                  <p className="text-gray-500 text-sm font-light">
                    {benefit.description}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="px-4 sm:px-6 py-28 bg-black">
        <div className="max-w-5xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {features.map((feature, index) => (
              <div
                key={feature.title}
                className="p-7 md:p-8 rounded-2xl border border-white/5 animate-fade-in transition-all duration-300 hover:border-white/10"
                style={{ 
                  backgroundColor: '#111111',
                  animationDelay: `${(index + 1) * 100}ms`, 
                  animationFillMode: 'both' 
                }}
              >
                {/* Icon */}
                <div 
                  className="w-12 h-12 rounded-xl flex items-center justify-center mb-6"
                  style={{ backgroundColor: 'rgba(0, 199, 138, 0.1)' }}
                >
                  <feature.icon className="w-6 h-6" style={{ color: '#00c78a' }} />
                </div>
                
                {/* Title */}
                <h3 className="text-lg font-semibold text-white mb-3 tracking-tight">
                  {feature.title}
                </h3>
                
                {/* Description */}
                <p className="text-gray-500 text-sm leading-relaxed font-light">
                  {feature.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section id="pricing" className="px-4 sm:px-6 py-28" style={{ backgroundColor: '#080808' }}>
        <div className="max-w-6xl mx-auto">
          {/* Section Header */}
          <div className="text-center mb-16">
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold mb-4 tracking-tight">
              Planes y Precios
            </h2>
            <p className="text-gray-500 text-base sm:text-lg max-w-2xl mx-auto font-light">
              Pagás según el tamaño de tu consultorio. Todas las funciones están incluidas en todos los planes.
            </p>
          </div>

          {/* Pricing Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
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
        </div>
      </section>

      {/* Footer */}
      <footer className="px-4 sm:px-6 py-12 bg-black border-t border-white/5">
        <p className="text-center text-gray-600 text-sm font-light">
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
