// Hub de Configuración: acá viven todos los módulos secundarios que antes
// llenaban el nav. El menú principal queda solo con lo del día a día; todo
// lo demás se encuentra en esta pantalla, ordenado y explicado.
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useBusinessId } from "@/hooks/use-business-id";
import { usePlanLimits } from "@/hooks/use-plan-limits";
import { HELP_CONTENT } from "@/data/help-content";
import { getSubdomainUrl } from "@/hooks/use-hostname-business";
import { buildShareUrl } from "@/config/app";
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
  key: string;
  title: string;
  description: string;
  url: string;
  icon: typeof Settings;
  /** Tinte HSL propio del módulo (mismos colores que el nav). */
  tint: string;
};

const TILES: ConfigTile[] = [
  {
    key: "horarios",
    title: "Horarios y sesiones",
    description: "Tus días y horas de atención, y los tipos de sesión que ofrecés.",
    url: "/horarios-disponibles",
    icon: AlarmClock,
    tint: "262 80% 66%",
  },
  {
    key: "recordatorios",
    title: "Recordatorios",
    description: "Los WhatsApp automáticos que van a salir, y su historial.",
    url: "/recordatorios-pendientes",
    icon: Clock,
    tint: "42 92% 56%",
  },
  {
    key: "consultorio",
    title: "Mi consultorio",
    description: "Datos del consultorio, equipo de profesionales y preferencias.",
    url: "/mi-consultorio",
    icon: Settings,
    tint: "168 70% 45%",
  },
  {
    key: "portal",
    title: "Portal y web pública",
    description: "Logo, colores y cómo te ven tus pacientes online.",
    url: "/personalizar-portal",
    icon: Palette,
    tint: "320 75% 62%",
  },
  {
    key: "plan",
    title: "Mi plan",
    description: "Tu suscripción, el estado de pago y la factura.",
    url: "/billing",
    icon: CreditCard,
    tint: "235 75% 66%",
  },
  {
    key: "ayuda",
    title: "Ayuda",
    description: "Guías cortas de cada módulo, al grano.",
    url: "/ayuda",
    icon: LifeBuoy,
    tint: "199 85% 55%",
  },
];

const DAY_LABELS: Array<{ col: string; short: string }> = [
  { col: "monday_enabled", short: "Lun" },
  { col: "tuesday_enabled", short: "Mar" },
  { col: "wednesday_enabled", short: "Mié" },
  { col: "thursday_enabled", short: "Jue" },
  { col: "friday_enabled", short: "Vie" },
  { col: "saturday_enabled", short: "Sáb" },
  { col: "sunday_enabled", short: "Dom" },
];

/** "Lun a Vie" cuando los días son consecutivos, si no "Lun, Mié, Vie". */
const formatDays = (days: string[]) => {
  if (days.length === 0) return null;
  if (days.length === 1) return days[0];
  const idx = days.map((d) => DAY_LABELS.findIndex((l) => l.short === d));
  const consecutive = idx.every((v, i) => i === 0 || v === idx[i - 1] + 1);
  return consecutive ? `${days[0]} a ${days[days.length - 1]}` : days.join(", ");
};

const DEFAULT_PORTAL_COLOR = "176 100% 32%";

const Configuracion = () => {
  const navigate = useNavigate();
  const { isSuperAdmin } = useAuth();
  const { businessId } = useBusinessId(false);
  const { planInfo } = usePlanLimits(businessId);
  const planName = planInfo.loading ? null : planInfo.planName;

  const [brandColor, setBrandColor] = useState(DEFAULT_PORTAL_COLOR);
  const [meta, setMeta] = useState<Record<string, string | null>>({});
  const [remindersCount, setRemindersCount] = useState(0);

  useEffect(() => {
    if (!businessId) return;
    let cancelled = false;

    const load = async () => {
      // Mañana, en hora local
      const start = new Date();
      start.setDate(start.getDate() + 1);
      start.setHours(0, 0, 0, 0);
      const end = new Date(start);
      end.setDate(end.getDate() + 1);

      const [tpl, svcs, reminders, pros, biz] = await Promise.all([
        supabase
          .from("availability_templates")
          .select(
            "monday_enabled, tuesday_enabled, wednesday_enabled, thursday_enabled, friday_enabled, saturday_enabled, sunday_enabled"
          )
          .eq("business_id", businessId)
          .eq("is_active", true),
        supabase
          .from("services")
          .select("id", { count: "exact", head: true })
          .eq("business_id", businessId)
          .eq("is_active", true),
        supabase
          .from("scheduled_reminders")
          .select("id", { count: "exact", head: true })
          .eq("business_id", businessId)
          .eq("status", "scheduled")
          .gte("scheduled_for", start.toISOString())
          .lt("scheduled_for", end.toISOString()),
        supabase
          .from("user_roles")
          .select("user_id", { count: "exact", head: true })
          .eq("business_id", businessId)
          .in("role", ["owner", "professional"]),
        supabase
          .from("businesses")
          .select("public_slug, custom_subdomain, custom_domain, portal_primary_color")
          .eq("id", businessId)
          .maybeSingle(),
      ]);

      if (cancelled) return;

      // Horarios: días activos + tipos de sesión
      const activeDays = DAY_LABELS.filter((d) =>
        (tpl.data ?? []).some((row: Record<string, unknown>) => row[d.col] === true)
      ).map((d) => d.short);
      const daysLabel = formatDays(activeDays);
      const svcCount = svcs.count ?? 0;
      const horariosParts = [
        daysLabel,
        svcCount > 0 ? `${svcCount} ${svcCount === 1 ? "tipo" : "tipos"} de sesión` : null,
      ].filter(Boolean);

      // Recordatorios de mañana
      const remCount = reminders.count ?? 0;
      setRemindersCount(remCount);

      // Profesionales activos
      const proCount = pros.count ?? 0;

      // URL pública del portal
      const business = biz.data as
        | {
            public_slug?: string | null;
            custom_subdomain?: string | null;
            custom_domain?: string | null;
            portal_primary_color?: string | null;
          }
        | null;
      let portalUrl: string | null = null;
      if (business?.custom_domain) portalUrl = business.custom_domain;
      else if (business?.custom_subdomain)
        portalUrl = getSubdomainUrl(business.custom_subdomain).replace(/^https?:\/\//, "");
      else if (business?.public_slug)
        portalUrl = buildShareUrl(`/portal/${business.public_slug}`).replace(/^https?:\/\//, "");

      if (business?.portal_primary_color) setBrandColor(business.portal_primary_color);

      setMeta({
        horarios: horariosParts.length ? horariosParts.join(" · ") : null,
        recordatorios: remCount > 0 ? `${remCount} programados para mañana` : "Sin envíos para mañana",
        consultorio: proCount > 0 ? `${proCount} ${proCount === 1 ? "profesional activo" : "profesionales activos"}` : null,
        portal: portalUrl,
        ayuda: `${Object.keys(HELP_CONTENT).length} guías disponibles`,
      });
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [businessId]);

  const tiles = isSuperAdmin ? TILES.filter((t) => t.url !== "/billing") : TILES;

  return (
    <div className="min-h-screen bg-background pb-16">
      <div className="mx-auto w-full max-w-[860px] px-4 sm:px-6 py-6 sm:py-8 space-y-6">
        {/* Encabezado de página */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate("/dashboard")}
            aria-label="Volver al inicio"
            className="h-11 w-11 shrink-0 rounded-2xl border border-border/70 bg-card flex items-center justify-center text-muted-foreground transition-colors hover:text-foreground hover:border-border"
          >
            <ArrowLeft className="h-[18px] w-[18px]" />
          </button>
          <span
            className="h-11 w-11 rounded-2xl flex items-center justify-center shrink-0"
            style={{
              background: `hsla(${brandColor}, 0.16)`,
              boxShadow: `inset 0 0 0 1px hsla(${brandColor}, 0.32)`,
            }}
          >
            <Settings className="h-5 w-5" style={{ color: `hsl(${brandColor})` }} />
          </span>
          <div className="min-w-0">
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight leading-none">Configuración</h1>
            <p className="text-sm text-muted-foreground mt-1.5 truncate">
              Todo lo que se ajusta una vez y trabaja solo.
            </p>
          </div>
        </div>

        {/* Tiles */}
        <div className="flex flex-col gap-3">
          {tiles.map((tile) => {
            const tintHsl = `hsl(${tile.tint})`;
            const tintHsla = (alpha: number) => `hsla(${tile.tint}, ${alpha})`;
            const metaText = tile.key === "plan" ? (planName ? `Plan ${planName}` : null) : meta[tile.key];
            const badge = tile.key === "recordatorios" && remindersCount > 0 ? remindersCount : null;
            return (
              <button
                key={tile.url}
                onClick={() => navigate(tile.url)}
                className="group flex items-start gap-4 rounded-2xl border border-border/70 bg-card p-4 sm:p-5 text-left transition-all duration-200 hover:border-border hover:shadow-md active:scale-[0.99]"
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
                  <span className="flex items-center gap-2">
                    <span className="text-[17px] font-bold text-foreground leading-tight">{tile.title}</span>
                    {badge !== null && (
                      <span
                        className="inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-[11px] font-bold"
                        style={{ background: tintHsla(0.18), color: tintHsl }}
                      >
                        {badge}
                      </span>
                    )}
                  </span>
                  <span className="mt-1 block text-[13.5px] leading-snug text-muted-foreground">
                    {tile.description}
                  </span>
                  {metaText && (
                    <span
                      className="mt-2 block text-[12.5px] font-semibold leading-snug break-all"
                      style={{ color: tintHsl }}
                    >
                      {metaText}
                    </span>
                  )}
                </span>
                <ChevronRight className="h-4 w-4 shrink-0 self-center text-muted-foreground/50 transition-transform duration-200 group-hover:translate-x-0.5" />
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default Configuracion;
