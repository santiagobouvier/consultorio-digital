// Sticky landing navbar. Transparent over the hero, turns solid (blur + border)
// once scrolled. Desktop: refined inline links with animated underline + CTAs.
// Mobile: a full-screen overlay menu whose items animate in, staggered.
import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Menu, X, ArrowRight } from "lucide-react";
import logoWhite from "@/assets/logo-consultorio-digital-white.png";

const BRAND = "#00a5a0";
const GREEN = "#00c78a";

const LINKS = [
  { label: "Funciones", id: "funciones" },
  { label: "Precios", id: "pricing" },
  { label: "Preguntas", id: "preguntas" },
];

export function LandingNavbar() {
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Lock body scroll while the full-screen menu is open
  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  const go = (id: string) => {
    setOpen(false);
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
  };

  const solid = scrolled || open;

  return (
    <>
      <style>{`
        @keyframes navOverlayIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes navItemIn { from { opacity: 0; transform: translateY(16px); } to { opacity: 1; transform: translateY(0); } }
        .nav-link-underline { transition: width 0.3s cubic-bezier(0.16,1,0.3,1); }
        .nav-overlay { animation: navOverlayIn 0.3s ease-out; }
        .nav-item { opacity: 0; animation: navItemIn 0.5s cubic-bezier(0.16,1,0.3,1) forwards; }
      `}</style>

      <header
        className={`fixed top-0 inset-x-0 z-50 transition-all duration-300 ${scrolled ? "border-b border-white/10" : ""}`}
        style={{
          backgroundColor: solid && !open ? "rgba(10,10,10,0.72)" : "transparent",
          backdropFilter: solid && !open ? "blur(14px)" : "none",
          WebkitBackdropFilter: solid && !open ? "blur(14px)" : "none",
        }}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 md:h-20 flex items-center justify-between">
          {/* Logo → back to top */}
          <button
            onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
            className="flex items-center transition-opacity hover:opacity-80"
            aria-label="Inicio"
          >
            <img src={logoWhite} alt="Tu Consultorio Digital" className="h-9 md:h-12 w-auto" />
          </button>

          {/* Desktop links */}
          <nav className="hidden md:flex items-center gap-8 absolute left-1/2 -translate-x-1/2">
            {LINKS.map((l) => (
              <button
                key={l.id}
                onClick={() => go(l.id)}
                className="group relative py-1 text-sm font-medium tracking-wide text-white/70 hover:text-white transition-colors"
              >
                {l.label}
                <span
                  className="nav-link-underline absolute left-0 -bottom-0.5 h-px w-0 group-hover:w-full"
                  style={{ backgroundColor: GREEN }}
                />
              </button>
            ))}
          </nav>

          {/* Desktop CTAs */}
          <div className="hidden md:flex items-center gap-3">
            <Link to="/acceso">
              <Button variant="ghost" className="text-sm font-medium tracking-wide text-white/70 hover:text-white hover:bg-white/5">
                Ingresar
              </Button>
            </Link>
            <Button
              onClick={() => go("pricing")}
              className="h-10 px-5 text-sm font-semibold rounded-full text-white transition-transform hover:scale-[1.03]"
              style={{ background: `linear-gradient(135deg, ${BRAND}, ${GREEN})`, boxShadow: `0 4px 20px rgba(0,165,160,0.3)` }}
            >
              Empezar gratis
              <ArrowRight className="w-4 h-4 ml-1.5" />
            </Button>
          </div>

          {/* Mobile toggle */}
          <button
            className="md:hidden p-2 -mr-2 text-white relative z-[70]"
            onClick={() => setOpen((o) => !o)}
            aria-label={open ? "Cerrar menú" : "Abrir menú"}
          >
            {open ? <X className="w-7 h-7" /> : <Menu className="w-7 h-7" />}
          </button>
        </div>
      </header>

      {/* Mobile full-screen menu */}
      {open && (
        <div
          className="nav-overlay md:hidden fixed inset-0 z-[60] flex flex-col"
          style={{ background: "rgba(8,8,8,0.98)", backdropFilter: "blur(24px)", WebkitBackdropFilter: "blur(24px)" }}
        >
          {/* subtle top glow */}
          <div
            className="pointer-events-none absolute inset-x-0 top-0 h-1/2"
            style={{ background: `radial-gradient(ellipse 80% 50% at 50% 0%, ${BRAND}1f, transparent 70%)` }}
          />

          {/* top row (logo) */}
          <div className="h-16 px-4 flex items-center">
            <img src={logoWhite} alt="Tu Consultorio Digital" className="h-9 w-auto" />
          </div>

          {/* links */}
          <nav className="relative flex-1 flex flex-col justify-center px-6">
            {LINKS.map((l, i) => (
              <button
                key={l.id}
                onClick={() => go(l.id)}
                className="nav-item group flex items-center justify-between py-5 border-b border-white/10 text-left"
                style={{ animationDelay: `${0.07 * i + 0.05}s` }}
              >
                <span className="text-3xl font-semibold text-white tracking-tight">{l.label}</span>
                <ArrowRight className="w-6 h-6 text-white/25 transition-all group-hover:text-white group-hover:translate-x-1" />
              </button>
            ))}
          </nav>

          {/* CTAs */}
          <div
            className="nav-item relative px-6 pb-10 pt-4 space-y-3"
            style={{ animationDelay: `${0.07 * LINKS.length + 0.08}s` }}
          >
            <Button
              onClick={() => go("pricing")}
              className="w-full h-14 text-base font-semibold rounded-2xl text-white"
              style={{ background: `linear-gradient(135deg, ${BRAND}, ${GREEN})`, boxShadow: `0 8px 30px rgba(0,165,160,0.35)` }}
            >
              Empezar 15 días gratis
              <ArrowRight className="w-5 h-5 ml-2" />
            </Button>
            <Link to="/acceso" onClick={() => setOpen(false)} className="block">
              <Button variant="outline" className="w-full h-14 text-base bg-transparent text-white border-white/20 hover:bg-white/5 rounded-2xl">
                Ingresar
              </Button>
            </Link>
          </div>
        </div>
      )}
    </>
  );
}
