import { useEffect, useState } from "react";
import logoLoading from "@/assets/logo-loading.png";

// Si el LoadingPage llega a montarse, lo dejamos visible al menos este tiempo
// para que no "parpadee" cuando el contenido carga inmediatamente después.
const MIN_VISIBLE_MS = 1000;

const LoadingPage = () => {
  const [holdDone, setHoldDone] = useState(false);

  useEffect(() => {
    const t = window.setTimeout(() => setHoldDone(true), MIN_VISIBLE_MS);
    return () => window.clearTimeout(t);
  }, []);

  // El componente padre desmonta este loader cuando termina de cargar.
  // Si el padre intenta desmontarlo antes del MIN_VISIBLE_MS, igual lo
  // habrá visto el usuario porque ya está pintado en pantalla — el hold
  // sólo asegura que la animación de entrada (0.6s) alcance a ejecutarse.
  void holdDone;

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0a0a0f]">
      <style>{`
        @keyframes logoEntrance {
          from { 
            opacity: 0; 
            transform: translateY(20px); 
          }
          to { 
            opacity: 1; 
            transform: translateY(0); 
          }
        }

        @keyframes glowPulse {
          0%, 100% { 
            box-shadow: 0 0 20px rgba(0, 165, 160, 0.2); 
          }
          50% { 
            box-shadow: 0 0 40px rgba(0, 165, 160, 0.5); 
          }
        }

        @keyframes dotBounce {
          0%, 80%, 100% { 
            opacity: 0.3; 
            transform: scale(0.8); 
          }
          40% { 
            opacity: 1; 
            transform: scale(1.2); 
          }
        }

        @keyframes fadeOut {
          from { opacity: 1; }
          to { opacity: 0; }
        }

        .logo-entrance {
          animation: logoEntrance 0.6s ease-out forwards;
        }

        .glow-pulse {
          animation: glowPulse 2s ease-in-out infinite;
        }

        .dot-bounce {
          animation: dotBounce 1.4s ease-in-out infinite;
        }

        .dot-delay-1 {
          animation-delay: 0ms;
        }

        .dot-delay-2 {
          animation-delay: 150ms;
        }

        .dot-delay-3 {
          animation-delay: 300ms;
        }
      `}</style>
      
      <div className="flex flex-col items-center gap-8">
        {/* Logo con glow pulsante */}
        <div className="logo-entrance glow-pulse rounded-full p-4">
          <img 
            src={logoLoading} 
            alt="Cargando..." 
            className="w-20 h-20 object-contain"
          />
        </div>
        
        {/* Dots de carga */}
        <div className="flex items-center gap-2">
          <div className="dot-bounce dot-delay-1 w-2 h-2 rounded-full bg-[#00a5a0]"></div>
          <div className="dot-bounce dot-delay-2 w-2 h-2 rounded-full bg-[#00a5a0]"></div>
          <div className="dot-bounce dot-delay-3 w-2 h-2 rounded-full bg-[#00a5a0]"></div>
        </div>
      </div>
    </div>
  );
};

export default LoadingPage;
