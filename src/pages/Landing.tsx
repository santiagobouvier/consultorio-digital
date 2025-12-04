import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Users, Calendar, MessageCircle } from "lucide-react";

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
    description: "Enviá recordatorios automáticos a tus pacientes con un solo click.",
  },
];

const Landing = () => {
  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white">
      {/* Hero Section */}
      <section className="min-h-screen flex flex-col items-center justify-center px-6 py-16">
        <div className="max-w-2xl mx-auto text-center animate-fade-in">
          {/* Logo placeholder */}
          <div className="w-16 h-16 mx-auto mb-8 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
            <Calendar className="w-8 h-8 text-emerald-500" />
          </div>
          
          {/* Title */}
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight mb-6">
            Sistema de Gestión de Consultorio
          </h1>
          
          {/* Subtitle */}
          <p className="text-lg md:text-xl text-gray-400 mb-10 max-w-lg mx-auto leading-relaxed">
            Organizá pacientes, citas y recordatorios en un panel simple y profesional.
          </p>
          
          {/* CTA Button */}
          <Link to="/auth">
            <Button 
              size="lg" 
              className="h-14 px-10 text-base font-semibold bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl transition-all duration-200 shadow-lg shadow-emerald-500/20 hover:shadow-emerald-500/30"
            >
              Iniciar sesión
            </Button>
          </Link>
        </div>
      </section>

      {/* Features Section */}
      <section className="px-6 py-20 bg-[#0f0f0f]">
        <div className="max-w-5xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {features.map((feature, index) => (
              <div
                key={feature.title}
                className="p-6 md:p-8 rounded-2xl bg-[#161616] border border-white/5 shadow-xl shadow-black/20 animate-fade-in"
                style={{ animationDelay: `${(index + 1) * 100}ms`, animationFillMode: 'both' }}
              >
                {/* Icon */}
                <div className="w-12 h-12 rounded-xl bg-emerald-500/10 flex items-center justify-center mb-5">
                  <feature.icon className="w-6 h-6 text-emerald-500" />
                </div>
                
                {/* Title */}
                <h3 className="text-lg font-semibold text-white mb-3">
                  {feature.title}
                </h3>
                
                {/* Description */}
                <p className="text-gray-400 text-sm leading-relaxed">
                  {feature.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="px-6 py-8 bg-[#0a0a0a] border-t border-white/5">
        <p className="text-center text-gray-500 text-sm">
          © {new Date().getFullYear()} Sistema de Gestión de Consultorio
        </p>
      </footer>
    </div>
  );
};

export default Landing;
