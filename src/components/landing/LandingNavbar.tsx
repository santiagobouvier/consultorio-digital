// Sticky landing navbar. Transparent over the hero, turns solid (blur + border)
// once scrolled. Desktop shows inline section links + CTAs; mobile collapses
// into a toggle menu with large tap targets. Section links smooth-scroll and
// close the menu.
import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Menu, X, ArrowRight } from "lucide-react";
import logoWhite from "@/assets/logo-consultorio-digital-white.png";

const BRAND = "#00a5a0";

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

  const go = (id: string) => {
    setOpen(false);
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <header
      className={`fixed top-0 inset-x-0 z-50 transition-all duration-300 ${scrolled ? "border-b border-white/10" : ""}`}
      style={{
        backgroundColor: scrolled || open ? "rgba(10,10,10,0.85)" : "transparent",
        backdropFilter: scrolled || open ? "blur(12px)" : "none",
        WebkitBackdropFilter: scrolled || open ? "blur(12px)" : "none",
      }}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
        {/* Logo → back to top */}
        <button
          onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
          className="flex items-center"
          aria-label="Inicio"
        >
          <img src={logoWhite} alt="Tu Consultorio Digital" className="h-8 sm:h-9 w-auto" />
        </button>

        {/* Desktop links */}
        <nav className="hidden md:flex items-center gap-1">
          {LINKS.map((l) => (
            <button
              key={l.id}
              onClick={() => go(l.id)}
              className="px-3 py-2 text-sm text-gray-300 hover:text-white transition-colors"
            >
              {l.label}
            </button>
          ))}
        </nav>

        {/* Desktop CTAs */}
        <div className="hidden md:flex items-center gap-2">
          <Link to="/acceso">
            <Button variant="ghost" className="text-sm text-white/70 hover:text-white hover:bg-white/5">
              Ingresar
            </Button>
          </Link>
          <Button
            onClick={() => go("pricing")}
            className="h-10 px-5 text-sm font-semibold rounded-xl text-white"
            style={{ backgroundColor: BRAND, boxShadow: `0 4px 20px rgba(0,165,160,0.3)` }}
          >
            Empezar gratis
            <ArrowRight className="w-4 h-4 ml-1.5" />
          </Button>
        </div>

        {/* Mobile toggle */}
        <button
          className="md:hidden p-2 text-white"
          onClick={() => setOpen((o) => !o)}
          aria-label={open ? "Cerrar menú" : "Abrir menú"}
        >
          {open ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
        </button>
      </div>

      {/* Mobile menu */}
      {open && (
        <div className="md:hidden border-t border-white/10">
          <div className="px-4 py-4 space-y-1">
            {LINKS.map((l) => (
              <button
                key={l.id}
                onClick={() => go(l.id)}
                className="block w-full text-left px-3 py-3 rounded-lg text-base text-gray-200 hover:bg-white/5 transition-colors"
              >
                {l.label}
              </button>
            ))}
            <div className="pt-3 space-y-2">
              <Link to="/acceso" onClick={() => setOpen(false)} className="block">
                <Button variant="outline" className="w-full h-12 text-base bg-transparent text-white border-white/20 hover:bg-white/5">
                  Ingresar
                </Button>
              </Link>
              <Button
                onClick={() => go("pricing")}
                className="w-full h-12 text-base font-semibold text-white"
                style={{ backgroundColor: BRAND, boxShadow: `0 4px 20px rgba(0,165,160,0.3)` }}
              >
                Empezar gratis
              </Button>
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
