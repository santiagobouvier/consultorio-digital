// Pantalla de carga global. La usan todas las páginas del panel, el portal y
// la web pública, así que respeta el modo claro/oscuro del usuario en vez de
// forzar un fondo oscuro. El logo va sobre un disco oscuro fijo (como ícono de
// app) porque el PNG está diseñado para fondo oscuro.
const LoadingPage = () => {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <style>{`
        @keyframes loadingFadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }

        @keyframes loadingBreathe {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.05); }
        }

        @keyframes loadingRing {
          0% { transform: scale(1); opacity: 0.45; }
          100% { transform: scale(1.9); opacity: 0; }
        }

        .loading-stage {
          animation: loadingFadeIn 0.5s ease-out both;
        }

        .loading-breathe {
          animation: loadingBreathe 2.8s ease-in-out infinite;
        }

        .loading-ring {
          position: absolute;
          inset: 0;
          border-radius: 9999px;
          border: 2px solid hsl(var(--primary) / 0.5);
          animation: loadingRing 2.4s ease-out infinite;
        }

        .loading-ring-late {
          animation-delay: 1.2s;
        }

        @media (prefers-reduced-motion: reduce) {
          .loading-breathe, .loading-ring { animation: none; }
          .loading-ring { display: none; }
        }
      `}</style>

      <div className="loading-stage relative flex items-center justify-center">
        <span className="loading-ring" aria-hidden="true" />
        <span className="loading-ring loading-ring-late" aria-hidden="true" />
        <div
          className="loading-breathe relative flex h-24 w-24 items-center justify-center overflow-hidden rounded-full shadow-lg"
          style={{ backgroundColor: "hsl(180 12% 10%)" }}
        >
          <img
            src="/logo-loading.png"
            alt="Cargando..."
            className="h-14 w-14 object-contain"
          />
        </div>
      </div>
    </div>
  );
};

export default LoadingPage;
