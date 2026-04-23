import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Building2,
  Smartphone,
  Share,
  PlusSquare,
  CheckCircle2,
  ArrowRight,
  Sparkles,
  MoreVertical,
  Download,
  X,
} from "lucide-react";
import { usePWAInstall } from "@/hooks/use-pwa-install";

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

type Platform = "ios" | "android" | "desktop";

const detectPlatform = (): Platform => {
  if (typeof window === "undefined") return "desktop";
  const ua = window.navigator.userAgent;
  const iPadOS =
    ua.includes("Macintosh") && (window.navigator.maxTouchPoints || 0) > 1;
  if (/iPhone|iPad|iPod/.test(ua) || iPadOS) return "ios";
  if (/Android/.test(ua)) return "android";
  return "desktop";
};

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
  const { canInstall, install, isInstalled } = usePWAInstall();
  const [platform, setPlatform] = useState<Platform>("desktop");
  const [showInstructions, setShowInstructions] = useState(false);
  const [installing, setInstalling] = useState(false);
  const [justInstalled, setJustInstalled] = useState(false);

  useEffect(() => {
    setPlatform(detectPlatform());
  }, []);

  // Si ya está instalado al cargar (display-mode standalone), saltamos directo al login.
  // Si la instalación ocurre en vivo (evento appinstalled), mostramos celebración.
  useEffect(() => {
    if (isInstalled && !justInstalled) onContinue();
  }, [isInstalled, justInstalled, onContinue]);

  // Escuchar evento nativo `appinstalled` (Android/Chrome) para mostrar celebración.
  useEffect(() => {
    const handleAppInstalled = () => {
      setInstalling(false);
      setShowInstructions(false);
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
    if (canInstall) {
      setInstalling(true);
      try {
        await install();
      } finally {
        setInstalling(false);
      }
      return;
    }
    // iOS o Android sin prompt nativo → mostramos pasos manuales.
    setShowInstructions(true);
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

  const iosSteps = [
    {
      icon: Share,
      title: "Tocá el botón Compartir",
      description: "Está en la barra inferior de Safari (cuadrado con flecha hacia arriba).",
    },
    {
      icon: PlusSquare,
      title: "Elegí 'Agregar a inicio'",
      description: "Bajá en el menú hasta encontrar 'Agregar a pantalla de inicio'.",
    },
    {
      icon: CheckCircle2,
      title: "Confirmá y abrí la app",
      description: "Vas a verla como una app independiente en tu pantalla de inicio.",
    },
  ];

  const androidSteps = [
    {
      icon: MoreVertical,
      title: "Abrí el menú del navegador",
      description: "Tocá los tres puntos arriba a la derecha en Chrome.",
    },
    {
      icon: Download,
      title: "Elegí 'Instalar app' o 'Agregar a inicio'",
      description: "Según tu versión de Android puede aparecer con uno u otro nombre.",
    },
    {
      icon: CheckCircle2,
      title: "Confirmá y abrí la app",
      description: "Aparece como una app más en tu cajón de aplicaciones.",
    },
  ];

  const steps = platform === "ios" ? iosSteps : androidSteps;

  return (
    <div className="min-h-screen" style={themeStyle as React.CSSProperties}>
      <div className="relative min-h-screen overflow-hidden bg-background text-foreground">
        {/* Decorative gradient backdrop con color de marca */}
        <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
          <div className="absolute -top-32 -right-24 h-[28rem] w-[28rem] rounded-full bg-primary/25 blur-3xl" />
          <div className="absolute top-1/2 -left-32 h-[24rem] w-[24rem] rounded-full bg-primary/15 blur-3xl" />
          <div className="absolute inset-0 bg-gradient-to-b from-background/0 via-background/40 to-background" />
        </div>

        {/* Skip arriba a la derecha */}
        <div className="absolute top-4 right-4 z-10">
          <Button
            variant="ghost"
            size="sm"
            onClick={onContinue}
            className="text-muted-foreground hover:text-foreground"
          >
            Omitir <X className="ml-1 h-3.5 w-3.5" />
          </Button>
        </div>

        <div className="mx-auto flex min-h-screen w-full max-w-md flex-col items-center justify-center px-5 py-10">
          {justInstalled ? (
            <div className="w-full space-y-8 animate-in fade-in zoom-in-95 duration-500">
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
          ) : !showInstructions ? (
            <div className="w-full space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
              {/* Hero branding */}
              <div className="flex flex-col items-center text-center space-y-5">
                <div className="relative">
                  <div className="absolute inset-0 rounded-3xl bg-primary/30 blur-xl" aria-hidden />
                  {branding.logoUrl ? (
                    <img
                      src={branding.logoUrl}
                      alt={branding.displayName}
                      className="relative h-24 w-24 rounded-3xl object-cover shadow-2xl ring-1 ring-border/50"
                    />
                  ) : (
                    <div className="relative flex h-24 w-24 items-center justify-center rounded-3xl bg-primary text-primary-foreground shadow-2xl ring-1 ring-border/50">
                      {initials ? (
                        <span className="text-2xl font-bold">{initials}</span>
                      ) : (
                        <Building2 className="h-10 w-10" />
                      )}
                    </div>
                  )}
                </div>

                <div className="space-y-2">
                  <div className="inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
                    <Sparkles className="h-3 w-3" />
                    Tu portal personal
                  </div>
                  <h1 className="text-3xl font-bold tracking-tight">
                    Bienvenido/a a<br />
                    <span className="text-primary">{branding.displayName}</span>
                  </h1>
                  {branding.specialty && (
                    <p className="text-sm text-muted-foreground">{branding.specialty}</p>
                  )}
                </div>

                <p className="text-base text-muted-foreground leading-relaxed max-w-xs">
                  Gestioná tus turnos, pagos e información clínica desde un solo lugar.
                </p>
              </div>

              {/* Install CTA Card */}
              <Card className="border-primary/20 shadow-xl bg-card/80 backdrop-blur">
                <CardContent className="p-5 space-y-5">
                  {/* Benefit text */}
                  <p className="text-sm text-muted-foreground leading-relaxed text-center">
                    Accedé a tus turnos y pagos en un toque, sin abrir el navegador.
                  </p>

                  <Button
                    onClick={handleInstallClick}
                    disabled={installing}
                    className="w-full h-14 text-base font-semibold"
                    size="lg"
                    style={{ backgroundColor: 'hsl(var(--primary))' }}
                  >n                    <Download className="mr-2 h-5 w-5" />
                    {installing ? "Instalando..." : "Instalá la app"}
                  </Button>

                  {/* Skip link - small, grey, at bottom */}
                  <div className="pt-2 text-center">
                    <button
                      type="button"
                      onClick={onContinue}
                      className="text-xs text-muted-foreground/60 hover:text-muted-foreground transition-colors"
                    >
                      Hacerlo después
                    </button>
                  </div>
                </CardContent>
              </Card>

              <p className="text-center text-[11px] text-muted-foreground">
                Tu información está protegida y solo el consultorio puede acceder.
              </p>
            </div>
          ) : (
            <div className="w-full space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-300">
              <div className="text-center space-y-2">
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/15 text-primary">
                  <Smartphone className="h-7 w-7" />
                </div>
                <h2 className="text-xl font-bold">
                  {platform === "ios"
                    ? "Instalación en iPhone"
                    : platform === "android"
                      ? "Instalación en Android"
                      : "Instalación manual"}
                </h2>
                <p className="text-sm text-muted-foreground">
                  Seguí estos pasos para agregar la app a tu dispositivo.
                </p>
              </div>

              <Card className="border-border/60 bg-card/80 backdrop-blur">
                <CardContent className="p-5 space-y-4">
                  {steps.map((step, i) => {
                    const Icon = step.icon;
                    return (
                      <div key={i} className="flex items-start gap-4">
                        <div className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                          <Icon className="h-5 w-5" />
                          <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">
                            {i + 1}
                          </span>
                        </div>
                        <div className="flex-1 pt-0.5">
                          <p className="text-sm font-semibold leading-tight">{step.title}</p>
                          <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                            {step.description}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </CardContent>
              </Card>

              <div className="space-y-2">
                <Button onClick={onContinue} className="w-full h-11" size="lg">
                  Listo, continuar
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowInstructions(false)}
                  className="w-full text-xs text-muted-foreground"
                >
                  Volver
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default PortalWelcomeInstall;