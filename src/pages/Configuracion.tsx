// Hub de Configuración: acá viven todos los módulos secundarios que antes
// llenaban el nav. El menú principal queda solo con lo del día a día; todo
// lo demás se encuentra en esta pantalla, ordenado y explicado.
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import {
  ArrowLeft,
  AlarmClock,
  Clock,
  Settings,
  Palette,
  CreditCard,
  LifeBuoy,
  ChevronRight,
} from "lucide-react";

type ConfigTile = {
  title: string;
  description: string;
  url: string;
  icon: typeof Settings;
  /** Tinte HSL propio del módulo (mismos colores que el nav). */
  tint: string;
};

const TILES: ConfigTile[] = [
  {
    title: "Horarios y sesiones",
    description: "Tus días y horas de atención, y los tipos de sesión que ofrecés.",
    url: "/horarios-disponibles",
    icon: AlarmClock,
    tint: "262 80% 66%",
  },
  {
    title: "Recordatorios",
    description: "Los WhatsApp automáticos que van a salir, y su historial.",
    url: "/recordatorios-pendientes",
    icon: Clock,
    tint: "22 90% 58%",
  },
  {
    title: "Mi consultorio",
    description: "Datos del consultorio, equipo de profesionales y preferencias.",
    url: "/mi-consultorio",
    icon: Settings,
    tint: "215 15% 65%",
  },
  {
    title: "Portal y web pública",
    description: "Logo, colores y cómo te ven tus pacientes online.",
    url: "/personalizar-portal",
    icon: Palette,
    tint: "320 75% 62%",
  },
  {
    title: "Mi plan",
    description: "Tu suscripción, el estado de pago y la factura.",
    url: "/billing",
    icon: CreditCard,
    tint: "235 75% 66%",
  },
  {
    title: "Ayuda",
    description: "Guías cortas de cada módulo, al grano.",
    url: "/ayuda",
    icon: LifeBuoy,
    tint: "150 65% 45%",
  },
];

const Configuracion = () => {
  const navigate = useNavigate();
  const { isSuperAdmin } = useAuth();

  const tiles = isSuperAdmin ? TILES.filter((t) => t.url !== "/billing") : TILES;

  return (
    <div className="min-h-screen bg-background pb-16">
      <div className="mx-auto w-full max-w-[1500px] px-4 sm:px-6 lg:px-8 py-6 sm:py-8 space-y-6">
        {/* Encabezado de página */}
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3 min-w-0">
            <span
              className="h-11 w-11 rounded-2xl flex items-center justify-center shrink-0"
              style={{ background: "hsla(215, 15%, 65%, 0.16)" }}
            >
              <Settings className="h-5 w-5" style={{ color: "hsl(215 15% 65%)" }} />
            </span>
            <div className="min-w-0">
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Configuración</h1>
              <p className="text-sm text-muted-foreground truncate">
                Todo lo que se ajusta una vez y trabaja solo.
              </p>
            </div>
          </div>
          <button
            onClick={() => navigate("/dashboard")}
            className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Volver al inicio
          </button>
        </div>

        {/* Tiles */}
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3 sm:gap-4">
          {tiles.map((tile) => {
            const tintHsl = `hsl(${tile.tint})`;
            const tintHsla = (alpha: number) => `hsla(${tile.tint}, ${alpha})`;
            return (
              <button
                key={tile.url}
                onClick={() => navigate(tile.url)}
                className="group flex items-center gap-4 rounded-2xl border border-border/70 bg-card p-4 sm:p-5 text-left transition-all duration-200 hover:border-border hover:shadow-md active:scale-[0.985]"
              >
                <span
                  className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl transition-transform duration-200 group-hover:scale-[1.06]"
                  style={{
                    background: tintHsla(0.14),
                    boxShadow: `inset 0 0 0 1px ${tintHsla(0.25)}`,
                  }}
                >
                  <tile.icon className="h-[22px] w-[22px]" style={{ color: tintHsl }} strokeWidth={2} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[15px] font-semibold text-foreground leading-tight">
                    {tile.title}
                  </span>
                  <span className="mt-1 block text-[13px] leading-snug text-muted-foreground">
                    {tile.description}
                  </span>
                </span>
                <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground/50 transition-transform duration-200 group-hover:translate-x-0.5" />
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default Configuracion;
