import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { CalendarDays, LogIn, Clock, Stethoscope } from "lucide-react";
import LoadingPage from "@/components/LoadingPage";
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

const PublicClinic = () => {
  const { slug } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [business, setBusiness] = useState<any>(null);
  const [planAllowsPublicWeb, setPlanAllowsPublicWeb] = useState(true);
  const [settings, setSettings] = useState<any>(null);
  const [schedule, setSchedule] = useState<ScheduleRow[]>([]);

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
          "id, owner_user_id, name, specialty, public_slug, custom_subdomain, portal_logo_url, portal_primary_color, portal_dark_primary_color, portal_clinic_display_name, plan_code";

        // Buscar primero por public_slug (caso más común), luego fallback a custom_subdomain.
        let businessData: any = null;
        const bySlug = await supabase
          .from("businesses_public_branding")
          .select(columns)
          .eq("public_slug", slug)
          .maybeSingle();
        if (bySlug.error) throw bySlug.error;
        businessData = bySlug.data;

        if (!businessData) {
          const bySubdomain = await supabase
            .from("businesses_public_branding")
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

        const [{ data: settingsData }, { data: templateData }] = await Promise.all([
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
        ]);

        if (cancelled) return;
        setBusiness(businessData);
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

  return (
    <div className="min-h-screen bg-background text-foreground" style={brandStyle}>
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
        <div className="absolute inset-0 bg-gradient-to-b from-background/40 via-background/70 to-background" aria-hidden />

        <div className="relative container mx-auto max-w-5xl px-4 py-12 sm:py-16 md:py-20">
          <div className="flex flex-col items-center text-center gap-5 sm:gap-6">
            {logoUrl ? (
              <img
                src={logoUrl}
                alt={`Logo de ${clinicName}`}
                className="w-24 h-24 sm:w-28 sm:h-28 md:w-32 md:h-32 rounded-2xl object-cover shadow-xl ring-4 ring-background"
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

            <div className="space-y-2 sm:space-y-3">
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

            <p className="max-w-2xl text-sm sm:text-base md:text-lg text-muted-foreground whitespace-pre-wrap leading-relaxed">
              {description}
            </p>

            {/* CTAs */}
            <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto pt-2">
              <Button
                size="lg"
                className="w-full sm:w-auto gap-2 text-base font-semibold shadow-lg transition-transform hover:scale-[1.02]"
                style={{
                  background: `hsl(var(--brand))`,
                  color: "white",
                }}
                onClick={() => navigate(`/consultorio/${targetSlug}/reservar`)}
              >
                <CalendarDays className="h-5 w-5" />
                Reservar turno
              </Button>
              <Button
                size="lg"
                variant="outline"
                className="w-full sm:w-auto gap-2 text-base font-semibold border-2"
                style={{
                  borderColor: `hsl(var(--brand) / 0.5)`,
                  color: `hsl(var(--brand))`,
                }}
                onClick={() => navigate(`/portal/${targetSlug}`)}
              >
                <LogIn className="h-5 w-5" />
                Ya soy paciente
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Body */}
      <main className="container mx-auto max-w-5xl px-4 py-10 sm:py-14 space-y-8">
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
                  {schedule.map(({ day, ranges }) => (
                    <div
                      key={day}
                      className="flex flex-col gap-1 p-3 rounded-lg bg-muted/40 border border-border/50"
                    >
                      <span className="text-sm font-semibold text-foreground">
                        {DAY_LABELS[day]}
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
                  ))}
                </div>
              </CardContent>
            </Card>
          </section>
        )}

        {/* Footer note */}
        <p className="text-center text-xs sm:text-sm text-muted-foreground pt-4">
          ¿Tenés dudas? Comunicate directamente con el consultorio para coordinar tu consulta.
        </p>
      </main>
    </div>
  );
};

export default PublicClinic;