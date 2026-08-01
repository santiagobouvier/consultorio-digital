import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Building2,
  CheckCircle2,
  ArrowRight,
  Sparkles,
  Download,
  Calendar,
  CreditCard,
  ShieldCheck,
} from "lucide-react";
import { usePWAInstall } from "@/hooks/use-pwa-install";
import { ThemeToggle } from "@/components/ThemeToggle";
import { IOSInstallTutorial } from "@/components/pwa/IOSInstallTutorial";
import { DesktopSafariTutorial } from "@/components/pwa/DesktopSafariTutorial";
import { UnsupportedBrowserModal } from "@/components/pwa/UnsupportedBrowserModal";

// ============= Confetti Effect =============
const ConfettiCanvas = () => {
  useEffect(() => {
    const canvas = document.createElement("canvas");
    canvas.style.cssText =
      "position:fixed;top:0;left:0;width:100%;height:100%;pointer-events:none;z-index:9999";
    document.body.appendChild(canvas);
    const ctx = canvas.getContext("2d")!;
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    const colors = ["#00a5a0", "#FFD700", "#FF6B6B", "#4FC3F7", "#AB47BC", "#66BB6A"];
    const particles: {
      x: number; y: number; w: number; h: number;
      color: string; vx: number; vy: number; rotation: number; rv: number; alpha: number;
    }[] = [];

    for (let i = 0; i < 120; i++) {
      particles.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height * -1,
        w: Math.random() * 8 + 4,
        h: Math.random() * 4 + 2,
        color: colors[Math.floor(Math.random() * colors.length)],
        vx: (Math.random() - 0.5) * 4,
        vy: Math.random() * 4 + 2,
        rotation: Math.random() * 360,
        rv: (Math.random() - 0.5) * 10,
        alpha: 1,
      });
    }

    let frame: number;
    const start = Date.now();
    const animate = () => {
      const elapsed = Date.now() - start;
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      const fadeAfter = 1500;
      for (const p of particles) {
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.1;
        p.rotation += p.rv;
        if (elapsed > fadeAfter) p.alpha = Math.max(0, 1 - (elapsed - fadeAfter) / 500);

        ctx.save();
        ctx.globalAlpha = p.alpha;
        ctx.translate(p.x, p.y);
        ctx.rotate((p.rotation * Math.PI) / 180);
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
        ctx.restore();
      }

      if (elapsed < 2000) {
        frame = requestAnimationFrame(animate);
      } else {
        canvas.remove();
      }
    };
    frame = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(frame);
      canvas.remove();
    };
  }, []);

  return null;
};

interface PortalWelcomeInstallProps {
  branding: {
    displayName: string;
    specialty: string;
    logoUrl: string;
    slug: string;
  };
  themeStyle: Record<string, string>;
  onContinue: () => void;
}

/**
 * Pantalla de bienvenida + instalación de PWA para pacientes.
 * Se muestra antes del login del Portal del Paciente la primera vez
 * que el usuario abre /portal/:slug. Branding del consultorio + guía
 * de instalación contextual según iOS / Android / Desktop.
 */
export const PortalWelcomeInstall = ({
  branding,
  themeStyle,
  onContinue,
}: PortalWelcomeInstallProps) => {
  const { isInstalled, triggerInstall } = usePWAInstall();
  const [showIOS, setShowIOS] = useState(false);
  const [showSafari, setShowSafari] = useState(false);
  const [showUnsupported, setShowUnsupported] = useState(false);
  const [installing, setInstalling] = useState(false);
  const [justInstalled, setJustInstalled] = useState(false);

  // Si ya está instalado al cargar (display-mode standalone), saltamos directo al login.
  // Si la instalación ocurre en vivo (evento appinstalled), mostramos celebración.
  useEffect(() => {
    if (isInstalled && !justInstalled) onContinue();
  }, [isInstalled, justInstalled, onContinue]);

  // Escuchar evento nativo `appinstalled` (Android/Chrome) para mostrar celebración.
  useEffect(() => {
    const handleAppInstalled = () => {
      setInstalling(false);
      setJustInstalled(true);
    };
    window.addEventListener("appinstalled", handleAppInstalled);
    return () => window.removeEventListener("appinstalled", handleAppInstalled);
  }, []);

  const handleOpenApp = () => {
    // Navegación full-page: si la PWA está instalada, el SO puede capturar
    // la URL del scope (/portal/:slug) y abrirla en modo standalone.
    window.location.href = `/portal/${branding.slug}`;
  };

  const handleInstallClick = async () => {
    setInstalling(true);
    try {
      const result = await triggerInstall();
      switch (result) {
        case "accepted":
          setJustInstalled(true);
          break;
        case "ios":
          setShowIOS(true);
          break;
        case "desktop-safari":
          setShowSafari(true);
          break;
        case "unsupported":
          setShowUnsupported(true);
          break;
        case "dismissed":
        default:
          break;
      }
    } finally {
      setInstalling(false);
    }
  };

  const initials = useMemo(
    () =>
      branding.displayName
        .split(" ")
        .map((w) => w[0])
        .join("")
        .substring(0, 2)
        .toUpperCase(),
    [branding.displayName],
  );

  return (
    <div className="min-h-screen" style={themeStyle as React.CSSProperties}>
      <div className="relative min-h-screen overflow-hidden bg-background text-foreground">
        {/* Sutil gradiente radial con color de marca */}
        <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
          <div
            className="absolute inset-0"
            style={{
              background:
                "radial-gradient(ellipse 80% 50% at 50% 0%, hsl(var(--primary) / 0.10), transparent 70%)",
            }}
          />
          <div
            className="absolute inset-0"
            style={{
              background:
                "radial-gradient(ellipse 60% 40% at 50% 100%, hsl(var(--primary) / 0.05), transparent 70%)",
            }}
          />
        </div>

        {/* Theme toggle arriba a la derecha */}
        <div className="absolute top-4 right-4 z-10">
          <ThemeToggle variant="ghost" />
        </div>

        <div className="mx-auto flex min-h-screen w-full max-w-md md:max-w-2xl flex-col items-center justify-center px-6 py-10 md:py-14">
          {justInstalled ? (
            <div className="w-full space-y-8 animate-in fade-in zoom-in-95 duration-500">
              <ConfettiCanvas />
              <div className="flex flex-col items-center text-center space-y-5">
                <div className="relative">
                  <div className="absolute inset-0 rounded-3xl bg-primary/40 blur-2xl animate-pulse" aria-hidden />
                  {branding.logoUrl ? (
                    <img
                      src={branding.logoUrl}
                      alt={branding.displayName}
                      className="relative h-28 w-28 rounded-3xl object-cover shadow-2xl ring-2 ring-primary/40"
                    />
                  ) : (
                    <div className="relative flex h-28 w-28 items-center justify-center rounded-3xl bg-primary text-primary-foreground shadow-2xl ring-2 ring-primary/40">
                      {initials ? (
                        <span className="text-3xl font-bold">{initials}</span>
                      ) : (
                        <Building2 className="h-12 w-12" />
                      )}
                    </div>
                  )}
                  <div className="absolute -bottom-2 -right-2 flex h-9 w-9 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg ring-2 ring-background">
                    <CheckCircle2 className="h-5 w-5" />
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
                    <Sparkles className="h-3 w-3" />
                    Instalación completa
                  </div>
                  <h1 className="text-3xl font-bold tracking-tight">
                    ¡App instalada!
                  </h1>
                  <p className="text-base text-muted-foreground leading-relaxed max-w-xs mx-auto">
                    Encontrás el ícono de{" "}
                    <span className="font-semibold text-foreground">{branding.displayName}</span>{" "}
                    en tu pantalla de inicio para acceder siempre de forma instantánea.
                  </p>
                </div>
              </div>

              <div className="space-y-3">
                <Button
                  onClick={handleOpenApp}
                  className="w-full h-12 text-sm font-semibold"
                  size="lg"
                >
                  Abrir app ahora
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
                <button
                  type="button"
                  onClick={onContinue}
                  className="w-full text-xs text-muted-foreground hover:text-foreground transition-colors py-2"
                >
                  Continuar en el navegador
                </button>
              </div>
            </div>
          ) : (
            <div className="w-full space-y-8 md:space-y-10">
              {/* Hero branding */}
              <div className="flex flex-col items-center text-center space-y-5 md:space-y-6">
                <div
                  className="relative animate-in fade-in zoom-in-95 duration-500"
                  style={{ animationDelay: "0ms", animationFillMode: "backwards" }}
                >
                  <div
                    className="absolute inset-0 rounded-3xl blur-2xl"
                    aria-hidden
                    style={{ background: "hsl(var(--primary) / 0.35)" }}
                  />
                  {branding.logoUrl ? (
                    <img
                      src={branding.logoUrl}
                      alt={branding.displayName}
                      className="relative h-20 w-20 md:h-28 md:w-28 rounded-3xl object-cover shadow-2xl ring-1 ring-border/40"
                    />
                  ) : (
                    <div className="relative flex h-20 w-20 md:h-28 md:w-28 items-center justify-center rounded-3xl bg-primary text-primary-foreground shadow-2xl ring-1 ring-border/40">
                      {initials ? (
                        <span className="text-2xl md:text-3xl font-bold">{initials}</span>
                      ) : (
                        <Building2 className="h-10 w-10 md:h-12 md:w-12" />
                      )}
                    </div>
                  )}
                </div>

                <div
                  className="space-y-1.5 animate-in fade-in slide-in-from-bottom-2 duration-500"
                  style={{ animationDelay: "50ms", animationFillMode: "backwards" }}
                >
                  <h1 className="text-3xl md:text-4xl font-bold tracking-tight leading-tight">
                    {branding.displayName}
                  </h1>
                  {branding.specialty && (
                    <p className="text-sm md:text-base text-muted-foreground">
                      {branding.specialty}
                    </p>
                  )}
                </div>

                <div
                  className="space-y-2 max-w-sm animate-in fade-in slide-in-from-bottom-2 duration-500"
                  style={{ animationDelay: "100ms", animationFillMode: "backwards" }}
                >
                  <p className="text-lg md:text-xl font-semibold text-foreground leading-snug">
                    Bienvenido/a a tu portal personal
                  </p>
                  <p className="text-sm md:text-base text-muted-foreground leading-relaxed">
                    Acá vas a encontrar tus próximas citas, pagos y todo lo que
                    necesites para acompañar tu proceso con{" "}
                    <span className="font-medium text-foreground">
                      {branding.displayName}
                    </span>
                    .
                  </p>
                </div>
              </div>

              {/* Features */}
              <div
                className="grid grid-cols-1 md:grid-cols-3 gap-3 md:gap-4 animate-in fade-in slide-in-from-bottom-2 duration-500"
                style={{ animationDelay: "150ms", animationFillMode: "backwards" }}
              >
                {[
                  { icon: Calendar, title: "Tus citas en un toque", desc: "Reservá y revisá tu agenda al instante." },
                  { icon: CreditCard, title: "Pagás cuando quieras", desc: "Online, en cualquier momento." },
                  { icon: ShieldCheck, title: "Privado y seguro", desc: "Solo el consultorio puede acceder." },
                ].map((f) => {
                  const Icon = f.icon;
                  return (
                    <div
                      key={f.title}
                      className="flex md:flex-col items-center md:items-center gap-3 md:gap-2 md:text-center rounded-2xl border border-border/50 bg-card/40 backdrop-blur px-4 py-3 md:py-4"
                    >
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                        <Icon className="h-5 w-5" />
                      </div>
                      <div className="flex-1 md:flex-none">
                        <p className="text-sm font-semibold leading-tight">{f.title}</p>
                        <p className="text-xs text-muted-foreground leading-snug mt-0.5">
                          {f.desc}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* CTAs — jerarquía: la gente llega desde la web del consultorio
                  queriendo ENTRAR. Ingresar es lo principal; instalar la app
                  es un plus opcional, discreto abajo. */}
              <div
                className="space-y-3 animate-in fade-in slide-in-from-bottom-2 duration-500"
                style={{ animationDelay: "200ms", animationFillMode: "backwards" }}
              >
                <Button
                  onClick={onContinue}
                  className="w-full h-12 text-base font-semibold"
                  size="lg"
                  style={{ backgroundColor: "hsl(var(--primary))" }}
                >
                  Ingresar a mi portal
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Button>

                <Button
                  variant="outline"
                  onClick={handleInstallClick}
                  disabled={installing}
                  className="w-full h-11 text-sm font-medium text-muted-foreground hover:text-foreground"
                  size="lg"
                >
                  <Download className="mr-2 h-4 w-4" />
                  {installing ? "Instalando..." : "Instalar la app gratis (opcional)"}
                </Button>

                <p className="text-xs text-muted-foreground/80 text-center leading-tight pt-1">
                  La app no pasa por la App Store y ocupa menos de 1MB — ideal para
                  entrar con un toque la próxima vez.
                </p>
              </div>

              <p className="text-center text-[11px] text-muted-foreground/60">
                Tu información está protegida y solo el consultorio puede acceder.
              </p>
            </div>
          )}
        </div>
      </div>
      <IOSInstallTutorial open={showIOS} onClose={() => setShowIOS(false)} clinicName={branding.displayName} />
      <DesktopSafariTutorial open={showSafari} onClose={() => setShowSafari(false)} clinicName={branding.displayName} />
      <UnsupportedBrowserModal open={showUnsupported} onClose={() => setShowUnsupported(false)} />
    </div>
  );
};

export default PortalWelcomeInstall;