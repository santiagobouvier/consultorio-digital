import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { CalendarDays, LogIn, Clock, Stethoscope, Video, MapPin, MousePointerClick, CheckCircle2, Sparkles } from "lucide-react";
import LoadingPage from "@/components/LoadingPage";
import { cacheClinicBrand } from "@/lib/clinic-brand-cache";
import NotFound from "./NotFound";
import { getPlanDefinition } from "@/lib/plan-definitions";
import { PublicThemeControl } from "@/components/public/PublicThemeControl";

type DayKey = "monday" | "tuesday" | "wednesday" | "thursday" | "friday" | "saturday" | "sunday";

const DAY_LABELS: Record<DayKey, string> = {
  monday: "Lunes",
  tuesday: "Martes",
  wednesday: "Miércoles",
  thursday: "Jueves",
  friday: "Viernes",
  saturday: "Sábado",
  sunday: "Domingo",
};

const DAY_ORDER: DayKey[] = [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
];

const formatRange = (start?: string | null, end?: string | null) => {
  if (!start || !end) return null;
  return `${start.slice(0, 5)} – ${end.slice(0, 5)}`;
};

type ScheduleRow = { day: DayKey; ranges: string[] };

const buildSchedule = (template: any): ScheduleRow[] => {
  if (!template) return [];
  return DAY_ORDER.map((day) => {
    if (!template[`${day}_enabled`]) return { day, ranges: [] };
    const r1 = formatRange(template[`${day}_start_1`], template[`${day}_end_1`]);
    const r2 = formatRange(template[`${day}_start_2`], template[`${day}_end_2`]);
    return { day, ranges: [r1, r2].filter(Boolean) as string[] };
  }).filter((row) => row.ranges.length > 0);
};

type PublicService = {
  id: string;
  name: string;
  duration_minutes: number;
  mode: string; // 'online' | 'presencial' | 'ambas'
  suggested_price: number | null;
};

const MODE_LABEL: Record<string, string> = {
  online: "Online",
  presencial: "Presencial",
  ambas: "Online o presencial",
};

const PublicClinic = () => {
  const { slug } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [business, setBusiness] = useState<any>(null);
  const [planAllowsPublicWeb, setPlanAllowsPublicWeb] = useState(true);
  const [settings, setSettings] = useState<any>(null);
  const [schedule, setSchedule] = useState<ScheduleRow[]>([]);
  const [services, setServices] = useState<PublicService[]>([]);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        setLoading(true);
        if (!slug) {
          if (!cancelled) setLoading(false);
          return;
        }

        const columns =
          "id, owner_user_id, name, specialty, public_slug, custom_subdomain, portal_logo_url, portal_primary_color, portal_dark_primary_color, portal_clinic_display_name, plan_code, is_private_clinic";

        // Buscar primero por public_slug (caso más común), luego fallback a custom_subdomain.
        let businessData: any = null;
        const bySlug = await supabase
          .from("businesses")
          .select(columns)
          .eq("public_slug", slug)
          .maybeSingle();
        if (bySlug.error) throw bySlug.error;
        businessData = bySlug.data;

        if (!businessData) {
          const bySubdomain = await supabase
            .from("businesses")
            .select(columns)
            .eq("custom_subdomain", slug)
            .maybeSingle();
          if (bySubdomain.error) throw bySubdomain.error;
          businessData = bySubdomain.data;
        }

        if (!businessData) {
          if (!cancelled) setLoading(false);
          return;
        }

        // Restricción por plan: solo planes con `hasPublicWeb` exponen la web pública.
        const planDef = getPlanDefinition(businessData.plan_code);
        if (!planDef.hasPublicWeb) {
          if (!cancelled) {
            setPlanAllowsPublicWeb(false);
            setLoading(false);
          }
          return;
        }

        const [{ data: settingsData }, { data: templateData }, svcResp] = await Promise.all([
          supabase
            .from("clinic_settings")
            .select("*")
            .eq("user_id", businessData.owner_user_id)
            .maybeSingle(),
          supabase
            .from("availability_templates")
            .select("*")
            .eq("business_id", businessData.id)
            .eq("is_active", true)
            .order("created_at", { ascending: true })
            .limit(1)
            .maybeSingle(),
          // Tipos de sesión (vía edge function: anon no lee services)
          supabase.functions
            .invoke("public-get-available-starts", { body: { slug } })
            .catch(() => ({ data: null })),
        ]);

        if (cancelled) return;
        setBusiness(businessData);
        setServices(((svcResp as any)?.data?.services ?? []) as PublicService[]);
        // La pantalla de carga usa esta marca en las próximas visitas
        cacheClinicBrand(slug, {
          logoUrl: businessData.portal_logo_url || null,
          color: businessData.portal_primary_color || null,
        });
        setSettings(settingsData);
        setSchedule(buildSchedule(templateData));
      } catch (error) {
        console.error("[PublicClinic] Error cargando consultorio:", error);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [slug]);

  const accent = useMemo(() => {
    const light = business?.portal_primary_color || "176 100% 32%";
    const dark = business?.portal_dark_primary_color || "176 85% 42%";
    return { light, dark };
  }, [business]);

  // Inject brand color overrides scoped to this page via CSS variables
  const brandStyle = useMemo(
    () =>
      ({
        ["--brand" as any]: accent.light,
        ["--brand-dark" as any]: accent.dark,
      }) as React.CSSProperties,
    [accent]
  );

  if (loading) return <LoadingPage />;

  // El plan del consultorio no incluye web pública: respondemos como 404 genérico
  // para no revelar la existencia del negocio.
  if (!planAllowsPublicWeb) {
    return <NotFound />;
  }

  if (!business) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="w-full max-w-2xl">
          <CardContent className="pt-6 text-center space-y-2">
            <p className="font-semibold text-foreground">Este portal no está disponible</p>
            <p className="text-sm text-muted-foreground">
              Verificá el link que te envió tu profesional. Si el problema persiste, contactá
              directamente al consultorio.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const clinicName =
    settings?.clinic_name ||
    business.portal_clinic_display_name ||
    business.name ||
    "Consultorio";
  const specialty = settings?.specialty || business.specialty;
  const description =
    settings?.welcome_message?.trim() ||
    "Gracias por visitarnos. Reservá tu turno online o accedé a tu portal si ya sos paciente.";
  const logoUrl = business.portal_logo_url || settings?.logo_url;
  const coverUrl = settings?.cover_image_url;
  const targetSlug = business.public_slug || slug;
  const isPrivate = !!business.is_private_clinic;
  const todayKey = DAY_ORDER[(new Date().getDay() + 6) % 7];
  const goReservar = () => navigate(`/consultorio/${targetSlug}/reservar`);

  return (
    <div className="min-h-screen bg-background text-foreground" style={brandStyle}>
      <style>{`
        @keyframes clinicFadeUp {
          from { opacity: 0; transform: translateY(18px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes clinicOrb1 {
          0%, 100% { transform: translate(0, 0); }
          50% { transform: translate(40px, 30px); }
        }
        @keyframes clinicOrb2 {
          0%, 100% { transform: translate(0, 0); }
          50% { transform: translate(-35px, -25px); }
        }
        .clinic-fade { animation: clinicFadeUp 0.7s cubic-bezier(0.16,1,0.3,1) both; }
        @media (prefers-reduced-motion: reduce) {
          .clinic-fade { animation: none; }
          .clinic-orb { animation: none !important; }
        }
      `}</style>
      <PublicThemeControl />

      {/* Hero */}
      <header className="relative overflow-hidden border-b border-border">
        {coverUrl ? (
          <div
            className="absolute inset-0 bg-cover bg-center"
            style={{ backgroundImage: `url(${coverUrl})` }}
            aria-hidden
          />
        ) : (
          <div
            className="absolute inset-0"
            style={{
              background: `linear-gradient(135deg, hsl(var(--brand) / 0.18), hsl(var(--brand) / 0.04) 60%, transparent)`,
            }}
            aria-hidden
          />
        )}
        {/* Orbes flotantes con el color del consultorio */}
        <div
          className="clinic-orb absolute -top-16 -left-16 w-80 h-80 rounded-full pointer-events-none"
          style={{
            background: "radial-gradient(circle, hsl(var(--brand) / 0.14), transparent 70%)",
            filter: "blur(30px)",
            animation: "clinicOrb1 18s ease-in-out infinite",
          }}
          aria-hidden
        />
        <div
          className="clinic-orb absolute top-24 -right-20 w-96 h-96 rounded-full pointer-events-none"
          style={{
            background: "radial-gradient(circle, hsl(var(--brand) / 0.1), transparent 70%)",
            filter: "blur(40px)",
            animation: "clinicOrb2 22s ease-in-out infinite",
          }}
          aria-hidden
        />
        <div className="absolute inset-0 bg-gradient-to-b from-background/40 via-background/70 to-background" aria-hidden />

        <div className="relative container mx-auto max-w-5xl px-4 py-12 sm:py-16 md:py-20">
          <div className="flex flex-col items-center text-center gap-5 sm:gap-6">
            <div className="clinic-fade" style={{ animationDelay: "0ms" }}>
              {logoUrl ? (
                <img
                  src={logoUrl}
                  alt={`Logo de ${clinicName}`}
                  className="w-24 h-24 sm:w-28 sm:h-28 md:w-32 md:h-32 rounded-2xl object-cover shadow-xl ring-4 ring-background"
                  style={{ boxShadow: "0 18px 50px -12px hsl(var(--brand) / 0.45)" }}
                />
              ) : (
                <div
                  className="w-24 h-24 sm:w-28 sm:h-28 md:w-32 md:h-32 rounded-2xl flex items-center justify-center shadow-xl ring-4 ring-background"
                  style={{ background: `hsl(var(--brand) / 0.15)` }}
                >
                  <Stethoscope
                    className="w-10 h-10 sm:w-12 sm:h-12"
                    style={{ color: `hsl(var(--brand))` }}
                  />
                </div>
              )}
            </div>

            <div className="space-y-2 sm:space-y-3 clinic-fade" style={{ animationDelay: "90ms" }}>
              <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight text-foreground">
                {clinicName}
              </h1>
              {specialty && (
                <p
                  className="inline-block text-sm sm:text-base font-medium px-3 py-1 rounded-full"
                  style={{
                    background: `hsl(var(--brand) / 0.12)`,
                    color: `hsl(var(--brand))`,
                  }}
                >
                  {specialty}
                </p>
              )}
            </div>

            <p
              className="max-w-2xl text-sm sm:text-base md:text-lg text-muted-foreground whitespace-pre-wrap leading-relaxed clinic-fade"
              style={{ animationDelay: "170ms" }}
            >
              {description}
            </p>

            {/* CTAs */}
            <div
              className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto pt-2 clinic-fade"
              style={{ animationDelay: "250ms" }}
            >
              {!isPrivate && (
                <Button
                  size="lg"
                  className="w-full sm:w-auto gap-2 text-base font-semibold shadow-lg transition-transform hover:scale-[1.02] h-14 px-8"
                  style={{
                    background: `hsl(var(--brand))`,
                    color: "white",
                    boxShadow: "0 10px 30px -8px hsl(var(--brand) / 0.55)",
                  }}
                  onClick={goReservar}
                >
                  <CalendarDays className="h-5 w-5" />
                  Reservar turno
                </Button>
              )}
              <Button
                size="lg"
                variant={isPrivate ? "default" : "ghost"}
                className="w-full sm:w-auto gap-2 text-base font-semibold"
                style={
                  isPrivate
                    ? { background: `hsl(var(--brand))`, color: "white" }
                    : { color: `hsl(var(--brand))` }
                }
                onClick={() => navigate(`/portal/${targetSlug}`)}
              >
                <LogIn className="h-5 w-5" />
                Ya soy paciente
              </Button>
            </div>
            {isPrivate && (
              <p className="text-xs text-muted-foreground clinic-fade" style={{ animationDelay: "320ms" }}>
                Este consultorio atiende con agenda privada: los turnos se coordinan directamente con el profesional.
              </p>
            )}
          </div>
        </div>
      </header>

      {/* Body */}
      <main className="container mx-auto max-w-5xl px-4 py-10 sm:py-14 space-y-10 sm:space-y-14">
        {/* Tipos de sesión */}
        {!isPrivate && services.length > 0 && (
          <section>
            <div className="flex items-center gap-2 mb-4">
              <div className="p-2 rounded-lg" style={{ background: `hsl(var(--brand) / 0.12)` }}>
                <Sparkles className="h-5 w-5" style={{ color: `hsl(var(--brand))` }} />
              </div>
              <h2 className="text-xl sm:text-2xl font-semibold">Tipos de sesión</h2>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {services.map((svc) => (
                <Card
                  key={svc.id}
                  className="group relative overflow-hidden transition-all hover:shadow-lg hover:-translate-y-0.5 cursor-pointer"
                  onClick={goReservar}
                >
                  <div
                    className="absolute inset-x-0 top-0 h-1"
                    style={{ background: `hsl(var(--brand) / 0.6)` }}
                  />
                  <CardContent className="p-5 space-y-3">
                    <div className="space-y-1">
                      <h3 className="font-semibold text-base text-foreground">{svc.name}</h3>
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                        <span className="inline-flex items-center gap-1">
                          <Clock className="h-3.5 w-3.5" /> {svc.duration_minutes} min
                        </span>
                        <span className="inline-flex items-center gap-1">
                          {svc.mode === "presencial" ? (
                            <MapPin className="h-3.5 w-3.5" />
                          ) : (
                            <Video className="h-3.5 w-3.5" />
                          )}
                          {MODE_LABEL[svc.mode] || svc.mode}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center justify-between gap-3 pt-1">
                      {svc.suggested_price && svc.suggested_price > 0 ? (
                        <p className="text-lg font-bold" style={{ color: `hsl(var(--brand))` }}>
                          $ {Math.round(svc.suggested_price).toLocaleString("es-UY")}
                        </p>
                      ) : (
                        <span />
                      )}
                      <Button
                        size="sm"
                        variant="outline"
                        className="gap-1.5 group-hover:text-white transition-colors"
                        style={{ borderColor: `hsl(var(--brand) / 0.4)`, color: `hsl(var(--brand))` }}
                        onClick={(e) => {
                          e.stopPropagation();
                          goReservar();
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.background = "hsl(var(--brand))";
                          e.currentTarget.style.color = "white";
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.background = "transparent";
                          e.currentTarget.style.color = "hsl(var(--brand))";
                        }}
                      >
                        Reservar
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </section>
        )}

        {/* Cómo funciona */}
        {!isPrivate && (
          <section>
            <h2 className="text-xl sm:text-2xl font-semibold text-center mb-6">
              Reservar es así de simple
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {[
                {
                  icon: MousePointerClick,
                  title: "1 · Elegí tu sesión",
                  desc: "Seleccioná el tipo de consulta que necesitás.",
                },
                {
                  icon: CalendarDays,
                  title: "2 · Elegí día y hora",
                  desc: "Vas a ver solo los horarios realmente disponibles.",
                },
                {
                  icon: CheckCircle2,
                  title: "3 · Listo",
                  desc: "Te llega la confirmación por email al instante.",
                },
              ].map((step) => (
                <div
                  key={step.title}
                  className="rounded-2xl border border-border/60 bg-card p-5 text-center space-y-2"
                >
                  <div
                    className="w-11 h-11 mx-auto rounded-xl flex items-center justify-center"
                    style={{ background: `hsl(var(--brand) / 0.12)` }}
                  >
                    <step.icon className="h-5 w-5" style={{ color: `hsl(var(--brand))` }} />
                  </div>
                  <p className="font-semibold text-sm">{step.title}</p>
                  <p className="text-xs text-muted-foreground leading-relaxed">{step.desc}</p>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Horarios de atención */}
        {schedule.length > 0 && (
          <section>
            <div className="flex items-center gap-2 mb-4">
              <div
                className="p-2 rounded-lg"
                style={{ background: `hsl(var(--brand) / 0.12)` }}
              >
                <Clock className="h-5 w-5" style={{ color: `hsl(var(--brand))` }} />
              </div>
              <h2 className="text-xl sm:text-2xl font-semibold">Horarios de atención</h2>
            </div>
            <Card>
              <CardContent className="p-4 sm:p-6">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {schedule.map(({ day, ranges }) => {
                    const isToday = day === todayKey;
                    return (
                      <div
                        key={day}
                        className={`flex flex-col gap-1 p-3 rounded-lg border ${
                          isToday ? "" : "bg-muted/40 border-border/50"
                        }`}
                        style={
                          isToday
                            ? {
                                background: "hsl(var(--brand) / 0.08)",
                                borderColor: "hsl(var(--brand) / 0.35)",
                              }
                            : undefined
                        }
                      >
                        <span className="text-sm font-semibold text-foreground inline-flex items-center gap-2">
                          {DAY_LABELS[day]}
                          {isToday && (
                            <span
                              className="text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded-full"
                              style={{ background: `hsl(var(--brand) / 0.15)`, color: `hsl(var(--brand))` }}
                            >
                              Hoy
                            </span>
                          )}
                        </span>
                        <div className="flex flex-wrap gap-2">
                          {ranges.map((range) => (
                            <span
                              key={range}
                              className="text-xs sm:text-sm px-2 py-0.5 rounded-md font-mono"
                              style={{
                                background: `hsl(var(--brand) / 0.1)`,
                                color: `hsl(var(--brand))`,
                              }}
                            >
                              {range}
                            </span>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </section>
        )}

        {/* Cierre con CTA */}
        {!isPrivate && (
          <section className="text-center space-y-3 pt-2">
            <p className="text-sm text-muted-foreground">
              ¿Tenés dudas? Comunicate directamente con el consultorio para coordinar tu consulta.
            </p>
            <Button
              size="lg"
              className="gap-2 text-base font-semibold"
              style={{ background: `hsl(var(--brand))`, color: "white" }}
              onClick={goReservar}
            >
              <CalendarDays className="h-5 w-5" />
              Reservar mi turno
            </Button>
          </section>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-border/60 mt-6">
        <div className="container mx-auto max-w-5xl px-4 py-6 flex flex-col sm:flex-row items-center justify-between gap-3">
          <p className="text-sm font-medium text-foreground">{clinicName}</p>
          <button
            onClick={() => navigate(`/portal/${targetSlug}`)}
            className="text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            Portal del paciente
          </button>
          <a
            href="https://consultoriodigital.app"
            target="_blank"
            rel="noopener noreferrer"
            className="text-[11px] text-muted-foreground/70 hover:text-muted-foreground transition-colors"
          >
            Hecho con ♥ en Consultorio Digital
          </a>
        </div>
      </footer>
    </div>
  );
};

export default PublicClinic;