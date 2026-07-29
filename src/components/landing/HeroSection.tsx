// Landing hero. Intentionally different from the UI mock-up sections below:
// no window/card, no product screenshot — a bold, atmospheric, typography-led
// hero with an animated gradient headline and a dramatic central glow.
import type { MouseEvent } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowRight, Check, ChevronDown, FileText } from "lucide-react";
import ofertaValorPdf from "@/assets/oferta-valor-2026.pdf.asset.json";

const BRAND = "#00a5a0";
const GREEN = "#00c78a";

const TRUST = ["Sin tarjeta", "15 días gratis", "Cancelás cuando quieras"];

export function HeroSection() {
  const navigate = useNavigate();
  const go = (id: string) => document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
  const scrollNext = (e: MouseEvent<HTMLButtonElement>) =>
    e.currentTarget.closest("section")?.nextElementSibling?.scrollIntoView({ behavior: "smooth", block: "start" });

  return (
    <section className="relative min-h-screen flex items-center justify-center px-4 sm:px-6 overflow-hidden z-10">
      <style>{`
        @keyframes heroGlow { 0%, 100% { opacity: 0.5; transform: scale(1); } 50% { opacity: 0.85; transform: scale(1.08); } }
        @keyframes heroGrad { 0% { background-position: 0% 50%; } 100% { background-position: 200% 50%; } }
        @keyframes heroUp { from { opacity: 0; transform: translateY(22px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes heroArrow { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(7px); } }
        .hero-up { opacity: 0; animation: heroUp 0.8s cubic-bezier(0.16,1,0.3,1) forwards; }
        .hero-arrow { animation: heroArrow 2s ease-in-out infinite; }
      `}</style>

      {/* Dramatic central glow */}
      <div aria-hidden className="pointer-events-none absolute inset-0 flex items-center justify-center">
        <div
          style={{
            width: "min(900px, 120vw)",
            height: "min(900px, 120vw)",
            borderRadius: "50%",
            background: `radial-gradient(circle, ${BRAND}26, ${GREEN}12 40%, transparent 70%)`,
            filter: "blur(40px)",
            animation: "heroGlow 8s ease-in-out infinite",
          }}
        />
      </div>

      <div className="relative max-w-4xl mx-auto text-center py-28">
        {/* Eyebrow */}
        <div
          className="hero-up inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-white/10 text-xs sm:text-sm text-gray-300 mb-7"
          style={{ backgroundColor: "rgba(255,255,255,0.03)", animationDelay: "0s" }}
        >
          <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: GREEN }} />
          El consultorio digital del profesional de salud
        </div>

        {/* Headline */}
        <h1
          className="hero-up text-4xl sm:text-6xl md:text-7xl font-bold tracking-tight leading-[1.12] mb-6"
          style={{ animationDelay: "0.1s" }}
        >
          Todo tu consultorio,
          <span
            className="block bg-clip-text text-transparent pb-2"
            style={{
              backgroundImage: `linear-gradient(90deg, ${BRAND}, ${GREEN}, ${BRAND})`,
              backgroundSize: "200% auto",
              animation: "heroGrad 6s linear infinite",
            }}
          >
            en un solo lugar.
          </span>
        </h1>

        {/* Subtitle */}
        <p
          className="hero-up text-base sm:text-lg md:text-xl text-gray-400 max-w-2xl mx-auto mb-9 leading-relaxed font-light"
          style={{ animationDelay: "0.2s" }}
        >
          Agenda, pacientes, pagos y recordatorios automáticos. Sin planillas ni mensajes sueltos,
          con tu marca y listo para tus pacientes.
        </p>

        {/* CTAs */}
        <div
          className="hero-up flex flex-col sm:flex-row items-center justify-center gap-3 mb-8"
          style={{ animationDelay: "0.3s" }}
        >
          <Button
            onClick={() => go("pricing")}
            className="w-full sm:w-auto h-14 px-8 text-base font-semibold rounded-full text-white transition-transform hover:scale-[1.03]"
            style={{ background: `linear-gradient(135deg, ${BRAND}, ${GREEN})`, boxShadow: `0 8px 30px rgba(0,165,160,0.35)` }}
          >
            Empezar 15 días gratis
            <ArrowRight className="w-4 h-4 ml-2" />
          </Button>
          <Button
            onClick={() => navigate("/demo")}
            variant="outline"
            className="w-full sm:w-auto h-14 px-8 text-base font-semibold rounded-full bg-transparent text-white border-white/20 hover:bg-white/5"
          >
            Ver la demo
          </Button>
        </div>

        {/* Trust */}
        <div
          className="hero-up flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-xs sm:text-sm text-gray-500"
          style={{ animationDelay: "0.4s" }}
        >
          {TRUST.map((t) => (
            <span key={t} className="inline-flex items-center gap-1.5">
              <Check className="w-3.5 h-3.5" style={{ color: GREEN }} />
              {t}
            </span>
          ))}
        </div>
      </div>

      {/* Scroll-down arrow → next section */}
      <button
        onClick={scrollNext}
        aria-label="Ir a la siguiente sección"
        className="hero-arrow absolute bottom-8 left-1/2 -translate-x-1/2 text-white/40 hover:text-white/80 transition-colors"
      >
        <ChevronDown className="w-7 h-7" />
      </button>
    </section>
  );
}
