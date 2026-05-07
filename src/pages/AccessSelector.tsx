import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import logoWhite from "@/assets/logo-consultorio-digital-white.png";

const BRAND = "#00a5a0";
const BRAND_GLOW = "rgba(0, 165, 160, 0.15)";
const GREEN = "#00c78a";

const cards = [
  {
    emoji: "🩺",
    title: "Soy profesional",
    description: "Accedé al sistema de gestión de tu consultorio",
    to: "/auth",
    gradient: `linear-gradient(135deg, ${BRAND}, ${GREEN})`,
    glowColor: BRAND,
  },
  {
    emoji: "👤",
    title: "Soy paciente",
    description: "Ingresá a tu portal personal de turnos y pagos",
    to: "/acceso/paciente",
    gradient: `linear-gradient(135deg, ${GREEN}, ${BRAND})`,
    glowColor: GREEN,
  },
];

const AccessSelector = () => {
  return (
    <div className="min-h-screen bg-[#111111] text-white overflow-x-hidden flex flex-col items-center justify-center px-4 py-12 relative">
      {/* Animated background orbs */}
      <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
        <div
          style={{
            position: "absolute",
            top: "-20%",
            left: "50%",
            transform: "translateX(-50%)",
            width: "140%",
            height: "60%",
            background: `radial-gradient(ellipse 80% 50% at 50% 50%, ${BRAND_GLOW}, transparent)`,
          }}
        />
        <div
          style={{
            position: "absolute",
            top: "10%",
            left: "15%",
            width: "400px",
            height: "400px",
            borderRadius: "50%",
            background: "radial-gradient(circle, rgba(0, 165, 160, 0.06), transparent 70%)",
            animation: "orbFloat1 20s ease-in-out infinite",
            filter: "blur(40px)",
          }}
        />
        <div
          style={{
            position: "absolute",
            top: "40%",
            right: "10%",
            width: "350px",
            height: "350px",
            borderRadius: "50%",
            background: "radial-gradient(circle, rgba(0, 199, 138, 0.05), transparent 70%)",
            animation: "orbFloat2 25s ease-in-out infinite",
            filter: "blur(50px)",
          }}
        />
        <div
          style={{
            position: "absolute",
            top: "70%",
            left: "40%",
            width: "500px",
            height: "500px",
            borderRadius: "50%",
            background: "radial-gradient(circle, rgba(0, 165, 160, 0.04), transparent 70%)",
            animation: "orbFloat3 30s ease-in-out infinite",
            filter: "blur(60px)",
          }}
        />
        <div
          style={{
            position: "absolute",
            inset: 0,
            backgroundImage:
              "linear-gradient(rgba(0,165,160,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(0,165,160,0.03) 1px, transparent 1px)",
            backgroundSize: "60px 60px",
            maskImage:
              "linear-gradient(to bottom, transparent, rgba(0,0,0,0.5) 20%, rgba(0,0,0,0.5) 80%, transparent)",
            WebkitMaskImage:
              "linear-gradient(to bottom, transparent, rgba(0,0,0,0.5) 20%, rgba(0,0,0,0.5) 80%, transparent)",
          }}
        />
      </div>

      {/* Content */}
      <div className="relative z-10 flex flex-col items-center w-full max-w-2xl">
        {/* Logo */}
        <img
          src={logoWhite}
          alt="Tu Consultorio Digital"
          className="h-20 sm:h-24 w-auto mb-8"
          style={{ animation: "logoFloat 6s ease-in-out infinite" }}
        />

        {/* Title */}
        <h1
          className="text-3xl sm:text-4xl font-bold mb-2 text-center"
          style={{ animation: "fadeSlideUp 0.7s cubic-bezier(0.16,1,0.3,1) 0.1s both" }}
        >
          Bienvenido/a
        </h1>
        <p
          className="text-gray-400 text-base sm:text-lg mb-10 text-center"
          style={{ animation: "fadeSlideUp 0.7s cubic-bezier(0.16,1,0.3,1) 0.2s both" }}
        >
          ¿Cómo querés ingresar?
        </p>

        {/* Cards */}
        <div
          className="grid grid-cols-1 sm:grid-cols-2 gap-5 w-full mb-10"
          style={{ animation: "fadeSlideUp 0.7s cubic-bezier(0.16,1,0.3,1) 0.35s both" }}
        >
          {cards.map((card) => (
            <Link
              key={card.to}
              to={card.to}
              className="group relative rounded-2xl p-6 sm:p-8 flex flex-col items-center text-center transition-all duration-300 border border-white/10 backdrop-blur-md"
              style={{
                backgroundColor: "rgba(255,255,255,0.04)",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.boxShadow = `0 0 40px ${card.glowColor}30, 0 0 80px ${card.glowColor}15`;
                e.currentTarget.style.borderColor = `${card.glowColor}40`;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.boxShadow = "none";
                e.currentTarget.style.borderColor = "rgba(255,255,255,0.1)";
              }}
            >
              <span className="text-5xl sm:text-6xl mb-4">{card.emoji}</span>
              <h2 className="text-xl sm:text-2xl font-bold mb-2">{card.title}</h2>
              <p className="text-gray-400 text-sm mb-5 leading-relaxed">{card.description}</p>
              <Button
                className="w-full h-11 rounded-xl font-semibold text-sm text-white transition-all duration-300 hover:scale-[1.03]"
                style={{
                  background: card.gradient,
                  boxShadow: `0 4px 20px ${card.glowColor}35`,
                }}
              >
                Ingresar
              </Button>
            </Link>
          ))}
        </div>

      </div>


      {/* CSS Animations */}
      <style>{`
        @keyframes logoFloat {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-8px); }
        }
        @keyframes fadeSlideUp {
          from { opacity: 0; transform: translateY(16px); }
          to { opacity: 1; transform: translateY(0); }
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
    </div>
  );
};

export default AccessSelector;