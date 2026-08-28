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

  const GROTESK = { fontFamily: "'Space Grotesk', sans-serif" } as const;
  const CARD_BG = {
    background: "linear-gradient(180deg,var(--cd-card1),var(--cd-card2))",
    border: "1px solid hsl(var(--cd-tint-hsl)/0.1)",
  } as const;

  return (
    <div
      className="dark min-h-screen pb-16"
      style={{ "--primary": "var(--brand-primary, 176 85% 42%)", background: "var(--cd-bg)", fontFamily: "'Instrument Sans', 'Plus Jakarta Sans', sans-serif" } as React.CSSProperties}
    >
      <div className="w-full px-4 sm:px-6 py-6 space-y-4">
        {/* Encabezado de página */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate("/dashboard")}
            aria-label="Volver al inicio"
            className="flex h-[38px] w-[38px] items-center justify-center rounded-xl shrink-0 transition-opacity hover:opacity-80"
            style={{ background: "hsl(var(--cd-tint-hsl)/0.07)", border: "1px solid hsl(var(--cd-tint-hsl)/0.12)", color: "var(--cd-text-soft)" }}
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <span
            className="flex h-[42px] w-[42px] items-center justify-center rounded-[13px] shrink-0"
            style={{ background: "hsl(var(--cd-accent-hsl)/0.12)", border: "1px solid hsl(var(--cd-accent-hsl)/0.25)", color: "var(--cd-accent)" }}
          >
            <Settings className="h-[18px] w-[18px]" />
          </span>
          <div className="min-w-0">
            <h1 className="text-[22px] sm:text-[28px] font-bold tracking-tight leading-tight" style={{ ...GROTESK, color: "var(--cd-text)" }}>
              Configuración
            </h1>
            <p className="text-[12.5px] truncate" style={{ color: "var(--cd-muted)" }}>
              Todo lo que se ajusta una vez y trabaja solo.
            </p>
          </div>
        </div>

        {/* Tiles (mockup): tarjetas oscuras con estado real por módulo, todo
            con un ÚNICO color: el de la marca del portal. El ámbar queda solo
            para el globito de recordatorios pendientes (semántico). */}
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-2.5 sm:gap-3">
          {tiles.map((tile) => {
            const metaText = tile.key === "plan" ? (planName ? `Plan ${planName}` : null) : meta[tile.key];
            const badge = tile.key === "recordatorios" && remindersCount > 0 ? remindersCount : null;
            return (
              <button
                key={tile.url}
                onClick={() => navigate(tile.url)}
                className="group flex h-full items-start gap-3.5 rounded-[17px] p-4 text-left transition-all duration-200 hover:-translate-y-0.5 active:scale-[0.985]"
                style={CARD_BG}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLElement).style.border = "1px solid hsl(var(--cd-accent-hsl)/0.4)";
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLElement).style.border = CARD_BG.border as string;
                }}
              >
                <span
                  className="flex h-[42px] w-[42px] shrink-0 items-center justify-center rounded-[13px] transition-transform duration-300 ease-out group-hover:scale-110"
                  style={{ background: "hsl(var(--cd-accent-hsl)/0.12)", color: "var(--cd-accent)" }}
                >
                  <tile.icon className="h-[19px] w-[19px]" strokeWidth={2} />
                </span>
                <span className="min-w-0 flex-1 flex flex-col gap-[3px]">
                  <span className="flex items-center gap-2">
                    <span className="text-[15px] font-semibold leading-tight" style={{ ...GROTESK, color: "var(--cd-text)" }}>
                      {tile.title}
                    </span>
                    {badge !== null && (
                      <span
                        className="inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-[10px] font-semibold"
                        style={{ background: "rgba(251,191,36,0.12)", border: "1px solid rgba(251,191,36,0.3)", color: "#fcd34d" }}
                      >
                        {badge}
                      </span>
                    )}
                  </span>
                  <span className="text-xs leading-relaxed" style={{ color: "var(--cd-muted)" }}>
                    {tile.description}
                  </span>
                  {metaText && (
                    <span
                      className="mt-px block text-[11.5px] font-semibold leading-snug break-all"
                      style={{ color: tile.key === "recordatorios" && remindersCount > 0 ? "#fcd34d" : "var(--cd-accent-soft)" }}
                    >
                      {metaText}
                    </span>
                  )}
                </span>
                <ChevronRight
                  className="h-[15px] w-[15px] shrink-0 self-center transition-transform duration-200 group-hover:translate-x-0.5"
                  style={{ color: "var(--cd-dim)" }}
                />
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default Configuracion;
