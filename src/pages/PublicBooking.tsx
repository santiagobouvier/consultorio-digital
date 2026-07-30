import { useEffect, useMemo, useState, useCallback, useRef } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { buildShareUrl } from "@/config/app";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ArrowLeft, CalendarDays, CheckCircle2, Clock, Loader2, Stethoscope, Video, MapPin } from "lucide-react";
import LoadingPage from "@/components/LoadingPage";
import { toast } from "sonner";
import NotFound from "./NotFound";
import { getPlanDefinition } from "@/lib/plan-definitions";
import { PublicThemeControl } from "@/components/public/PublicThemeControl";
import { cacheClinicBrand } from "@/lib/clinic-brand-cache";

// Horarios 2.0: la reserva es por TIPO DE SESIÓN (service). El visitante elige
// el tipo, el motor calcula los inicios que caben según su duración, completa
// sus datos y confirma. Ya no depende de casilleros precortados.

type Service = {
  id: string;
  name: string;
  duration_minutes: number;
  mode: string; // 'online' | 'presencial' | 'ambas'
  suggested_price: number | null;
};

type Start = {
  day: string;        // YYYY-MM-DD
  start_time: string; // HH:MM:SS
  end_time: string;   // HH:MM:SS
};

const formSchema = z.object({
  name: z.string().trim().min(2, "Ingresá tu nombre completo").max(100),
  email: z.string().trim().email("Email inválido").max(255),
  phone: z.string().trim().min(6, "Teléfono inválido").max(30),
  message: z.string().trim().max(500).optional(),
});

const DAY_NAMES = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];
const DAY_SHORT = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
const MONTH_NAMES = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];
const MONTH_SHORT = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

const parseDay = (dateStr: string) => {
  const [y, m, d] = dateStr.split("-").map(Number);
  return { date: new Date(y, m - 1, d), d, m };
};

const formatSlotDate = (dateStr: string) => {
  const [y, m, d] = dateStr.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  return `${DAY_NAMES[date.getDay()]} ${d} de ${MONTH_NAMES[m - 1]}`;
};

const formatTime = (t: string) => t.slice(0, 5);

const MODE_LABEL: Record<string, string> = {
  online: "Online",
  presencial: "Presencial",
  ambas: "Online o presencial",
};

// ── Datos de ejemplo para el modo demo (nada se guarda) ──
const DEMO_BUSINESS = {
  id: "demo",
  name: "Lic. Laura López",
  specialty: "Psicología clínica",
  public_slug: "demo",
  custom_subdomain: null,
  portal_logo_url: null,
  portal_primary_color: "176 100% 32%",
  portal_dark_primary_color: "176 85% 42%",
  portal_clinic_display_name: "Lic. Laura López",
  plan_code: "esencial",
};

const DEMO_SERVICES: Service[] = [
  { id: "demo-s1", name: "Sesión individual", duration_minutes: 50, mode: "ambas", suggested_price: 1500 },
  { id: "demo-s2", name: "Primera consulta", duration_minutes: 90, mode: "online", suggested_price: 2000 },
];

// Genera inicios demo desde ventanas 9-13 y 15-19 según la duración elegida.
const demoStarts = (durationMinutes: number): Start[] => {
  const out: Start[] = [];
  const pad = (n: number) => String(n).padStart(2, "0");
  for (let offset = 1; offset <= 4; offset++) {
    const d = new Date();
    d.setDate(d.getDate() + offset);
    if (d.getDay() === 0) continue; // domingo cerrado
    const day = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
    for (const [wStart, wEnd] of [[9 * 60, 13 * 60], [15 * 60, 19 * 60]]) {
      let t = wStart;
      while (t + durationMinutes <= wEnd) {
        out.push({
          day,
          start_time: `${pad(Math.floor(t / 60))}:${pad(t % 60)}:00`,
          end_time: `${pad(Math.floor((t + durationMinutes) / 60))}:${pad((t + durationMinutes) % 60)}:00`,
        });
        t += durationMinutes;
      }
    }
  }
  return out;
};

const PublicBooking = ({ demo = false, embed = false }: { demo?: boolean; embed?: boolean }) => {
  const { slug } = useParams();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const [loading, setLoading] = useState(true);
  const [business, setBusiness] = useState<any>(null);
  const [planAllowsPublicWeb, setPlanAllowsPublicWeb] = useState(true);
  // Vuelta del checkout de Mercado Pago (política "pago requerido")
  const [paidReturn, setPaidReturn] = useState(false);

  const [services, setServices] = useState<Service[]>([]);
  const [selectedService, setSelectedService] = useState<Service | null>(null);
  const [starts, setStarts] = useState<Start[]>([]);
  const [startsLoading, setStartsLoading] = useState(false);
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [selectedStart, setSelectedStart] = useState<Start | null>(null);
  const [modalityChoice, setModalityChoice] = useState<"online" | "presencial">("online");

  // Para el scroll automático entre pasos
  const scheduleRef = useRef<HTMLElement | null>(null);
  const formRef = useRef<HTMLElement | null>(null);

  const scrollTo = (ref: React.MutableRefObject<HTMLElement | null>) => {
    // Pequeña espera para que la sección ya esté renderizada
    window.setTimeout(() => {
      ref.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 80);
  };

  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  const [form, setForm] = useState({ name: "", email: "", phone: "", message: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Vuelta de Mercado Pago: ?payment=success|failure|pending
  useEffect(() => {
    const payment = searchParams.get("payment");
    if (!payment) return;
    if (payment === "success") {
      setPaidReturn(true);
      setSuccess(true);
    } else if (payment === "pending") {
      toast.info("Tu pago está en proceso. Cuando se acredite, te llega la confirmación por email.");
    } else {
      toast.error("El pago no se completó. Si no se paga, la reserva se libera a los 45 minutos.");
    }
    searchParams.delete("payment");
    setSearchParams(searchParams, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadStarts = useCallback(async (service: Service) => {
    setStartsLoading(true);
    setSelectedStart(null);
    setSelectedDay(null);
    try {
      if (demo) {
        setStarts(demoStarts(service.duration_minutes));
        return;
      }
      const { data, error } = await supabase.functions.invoke("public-get-available-starts", {
        body: { slug, serviceId: service.id, days: 30 },
      });
      if (error) throw error;
      setStarts((data?.starts ?? []) as Start[]);
    } catch (e) {
      console.error("[PublicBooking] Error cargando horarios:", e);
      toast.error("No pudimos cargar los horarios. Recargá la página.");
      setStarts([]);
    } finally {
      setStartsLoading(false);
    }
  }, [demo, slug]);

  const selectService = useCallback((service: Service, scroll = true) => {
    setSelectedService(service);
    if (service.mode === "online") setModalityChoice("online");
    if (service.mode === "presencial") setModalityChoice("presencial");
    void loadStarts(service);
    if (scroll) scrollTo(scheduleRef);
  }, [loadStarts]);

  const selectStart = (s: Start) => {
    setSelectedStart(s);
    scrollTo(formRef);
  };

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        setLoading(true);
        if (demo) {
          setBusiness(DEMO_BUSINESS);
          setServices(DEMO_SERVICES);
          if (!cancelled) setLoading(false);
          return;
        }
        if (!slug) {
          if (!cancelled) setLoading(false);
          return;
        }

        const columns =
          "id, name, specialty, public_slug, custom_subdomain, portal_logo_url, portal_primary_color, portal_dark_primary_color, portal_clinic_display_name, plan_code, is_private_clinic";

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

        // Restricción por plan: la reserva pública solo está disponible
        // en planes con `hasPublicWeb`.
        const planDef = getPlanDefinition(businessData.plan_code);
        if (!planDef.hasPublicWeb) {
          if (!cancelled) {
            setPlanAllowsPublicWeb(false);
            setLoading(false);
          }
          return;
        }

        // Menú de tipos de sesión (vía edge function: anon no lee services)
        const { data: svcResp, error: svcError } = await supabase.functions.invoke(
          "public-get-available-starts",
          { body: { slug } }
        );
        if (svcError) throw svcError;

        if (cancelled) return;
        setBusiness(businessData);
        // La pantalla de carga usa esta marca en las próximas visitas
        cacheClinicBrand(slug, {
          logoUrl: businessData.portal_logo_url || null,
          color: businessData.portal_primary_color || null,
        });
        setServices((svcResp?.services ?? []) as Service[]);
      } catch (error) {
        console.error("[PublicBooking] Error cargando reserva:", error);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [slug, demo]);

  // Un solo tipo de sesión → se elige solo (sin scroll: es la carga inicial)
  useEffect(() => {
    if (!loading && services.length === 1 && !selectedService) {
      selectService(services[0], false);
    }
  }, [loading, services, selectedService, selectService]);

  const accent = useMemo(() => {
    const light = business?.portal_primary_color || "176 100% 32%";
    const dark = business?.portal_dark_primary_color || "176 85% 42%";
    return { light, dark };
  }, [business]);

  const brandStyle = useMemo(
    () =>
      ({
        ["--brand" as any]: accent.light,
        ["--brand-dark" as any]: accent.dark,
      }) as React.CSSProperties,
    [accent]
  );

  // Días con disponibilidad, SIEMPRE en orden cronológico y con los horarios
  // de cada día ordenados (no dependemos del orden en que lleguen los datos).
  const startsByDate = useMemo(() => {
    const map = new Map<string, Start[]>();
    for (const s of starts) {
      const list = map.get(s.day) ?? [];
      list.push(s);
      map.set(s.day, list);
    }
    return Array.from(map.entries())
      .map(([date, items]) => ({
        date,
        items: [...items].sort((a, b) => a.start_time.localeCompare(b.start_time)),
      }))
      .sort((a, b) => a.date.localeCompare(b.date));
  }, [starts]);

  // Día seleccionado: por defecto el primero con lugar; si desaparece
  // (ej: se recargaron los horarios), volvemos al primero.
  useEffect(() => {
    if (startsByDate.length === 0) {
      setSelectedDay(null);
      return;
    }
    if (!selectedDay || !startsByDate.some((d) => d.date === selectedDay)) {
      setSelectedDay(startsByDate[0].date);
    }
  }, [startsByDate, selectedDay]);

  const timesForSelectedDay = useMemo(
    () => startsByDate.find((d) => d.date === selectedDay)?.items ?? [],
    [startsByDate, selectedDay]
  );

  // Modo embed: tema pedido por la web madre (?theme=dark|light)
  const embedTheme = embed && searchParams.get("theme") === "dark" ? "dark" : "light";

  // Modo embed: reportar el alto del contenido a la web que nos incrusta
  // y dejar el fondo transparente para fundirse con la página madre.
  useEffect(() => {
    if (!embed) return;
    document.documentElement.style.background = "transparent";
    document.body.style.background = "transparent";
    const report = () => {
      const height = document.documentElement.scrollHeight;
      window.parent?.postMessage({ type: "cd-embed-height", slug, height }, "*");
    };
    report();
    const ro = new ResizeObserver(report);
    ro.observe(document.body);
    return () => ro.disconnect();
  }, [embed, slug]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedService || !selectedStart || (!slug && !demo)) return;

    const parsed = formSchema.safeParse(form);
    if (!parsed.success) {
      const fieldErrors: Record<string, string> = {};
      for (const issue of parsed.error.issues) {
        const key = issue.path[0]?.toString();
        if (key && !fieldErrors[key]) fieldErrors[key] = issue.message;
      }
      setErrors(fieldErrors);
      return;
    }
    setErrors({});

    // Modo demo: no se envía nada, solo mostramos el éxito.
    if (demo) {
      setSuccess(true);
      return;
    }

    try {
      setSubmitting(true);
      const { data, error } = await supabase.functions.invoke("public-book-appointment", {
        body: {
          slug,
          serviceId: selectedService.id,
          date: selectedStart.day,
          startTime: formatTime(selectedStart.start_time),
          modality: selectedService.mode === "ambas" ? modalityChoice : selectedService.mode,
          name: parsed.data.name,
          email: parsed.data.email,
          phone: parsed.data.phone,
          message: parsed.data.message ?? "",
        },
      });

      if (error || (data && (data as any).error)) {
        const errCode = (data as any)?.error || error?.message;
        if (errCode === "start_not_available") {
          toast.error("Ese horario se acaba de ocupar. Elegí otro.");
          await loadStarts(selectedService);
        } else {
          toast.error("No pudimos confirmar tu reserva. Intentá de nuevo.");
        }
        return;
      }

      // Política "pago requerido": el checkout de Mercado Pago confirma la reserva
      if ((data as any)?.payment_required && (data as any)?.init_point) {
        toast.info("Te llevamos a Mercado Pago para confirmar tu reserva...");
        const initPoint = (data as any).init_point as string;
        if (embed) {
          // Dentro de un iframe el checkout de MP no puede cargar: navegamos
          // la ventana principal (o abrimos pestaña si el navegador lo corta).
          try {
            window.top!.location.href = initPoint;
          } catch {
            window.open(initPoint, "_blank", "noopener");
          }
        } else {
          window.location.href = initPoint;
        }
        return;
      }

      setSuccess(true);
    } catch (err) {
      console.error("[PublicBooking] submit error", err);
      toast.error("No pudimos confirmar tu reserva. Intentá de nuevo.");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <LoadingPage />;

  // Plan sin web pública: 404 genérico para no exponer el negocio.
  if (!planAllowsPublicWeb) {
    return <NotFound />;
  }

  if (!business) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6 text-center space-y-3">
            <p className="font-semibold text-foreground">Este consultorio no está disponible</p>
            <p className="text-sm text-muted-foreground">
              Verificá el link que te compartieron.
            </p>
            <Button variant="outline" onClick={() => navigate("/")} className="gap-2 mt-4">
              <ArrowLeft className="h-4 w-4" />
              Volver al inicio
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const clinicName =
    business.portal_clinic_display_name || business.name || "Consultorio";
  const targetSlug = business.public_slug || slug;

  // Agenda privada: sin reserva pública, solo pacientes con acceso al portal
  if (business.is_private_clinic && !demo && !success) {
    return (
      <div
        className="min-h-screen flex items-center justify-center bg-background p-4"
        style={brandStyle}
      >
        <Card className="w-full max-w-md">
          <CardContent className="pt-8 pb-6 text-center space-y-4">
            <div
              className="w-16 h-16 mx-auto rounded-full flex items-center justify-center"
              style={{ background: `hsl(var(--brand) / 0.15)` }}
            >
              <Stethoscope className="h-8 w-8" style={{ color: `hsl(var(--brand))` }} />
            </div>
            <div className="space-y-2">
              <h1 className="text-2xl font-bold text-foreground">{clinicName}</h1>
              <p className="text-sm text-muted-foreground">
                Este consultorio atiende con agenda privada: los turnos se coordinan
                directamente con el profesional y no se pueden reservar desde esta página.
              </p>
            </div>
            <div className="pt-2 space-y-2">
              <p className="text-xs text-muted-foreground px-2">
                ¿Ya sos paciente? Ingresá a tu portal para ver y gestionar tus citas.
              </p>
              <Button
                className="w-full"
                style={{ background: `hsl(var(--brand))`, color: "white" }}
                onClick={() => navigate(`/portal/${targetSlug}`)}
              >
                Ir a mi portal
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (success) {
    return (
      <div
        className={`${embed ? `${embedTheme === "dark" ? "dark " : ""}bg-transparent py-6` : "min-h-screen bg-background"} flex items-center justify-center p-4`}
        style={brandStyle}
      >
        <Card className="w-full max-w-md">
          <CardContent className="pt-8 pb-6 text-center space-y-4">
            <div
              className="w-16 h-16 mx-auto rounded-full flex items-center justify-center"
              style={{ background: `hsl(var(--brand) / 0.15)` }}
            >
              <CheckCircle2 className="h-8 w-8" style={{ color: `hsl(var(--brand))` }} />
            </div>
            <div className="space-y-2">
              <h1 className="text-2xl font-bold text-foreground">
                {paidReturn ? "¡Pago recibido y reserva confirmada!" : "¡Reserva confirmada!"}
              </h1>
              <p className="text-sm text-muted-foreground">
                {paidReturn
                  ? "Recibimos tu pago y tu cita quedó confirmada. Te enviamos los detalles a tu email."
                  : "Te enviamos los detalles a tu email. El consultorio se pondrá en contacto si necesita algo más."}
              </p>
            </div>
            {selectedStart && (
              <div className="bg-muted/40 border border-border rounded-lg p-3 text-sm">
                {selectedService && (
                  <p className="font-semibold text-foreground">{selectedService.name}</p>
                )}
                <p className="font-medium text-foreground">
                  {formatSlotDate(selectedStart.day)}
                </p>
                <p className="text-muted-foreground">
                  {formatTime(selectedStart.start_time)} – {formatTime(selectedStart.end_time)}
                </p>
              </div>
            )}
            {!embed && (
              <Button
                className="w-full gap-2"
                style={{ background: `hsl(var(--brand))`, color: "white" }}
                onClick={() => navigate(demo ? "/demo" : `/consultorio/${targetSlug}`)}
              >
                <ArrowLeft className="h-4 w-4" />
                {demo ? "Volver a la demo" : "Volver al consultorio"}
              </Button>
            )}
            <div className="pt-4 border-t border-border space-y-2">
              <p className="text-xs text-muted-foreground px-2">
                Tu profesional te enviará acceso a tu portal personal donde podrás ver tus citas y más.
              </p>
              <Button
                variant="outline"
                className="w-full"
                onClick={() => {
                  if (embed) {
                    window.open(buildShareUrl(`/portal/${targetSlug}`), "_blank", "noopener");
                  } else {
                    navigate(demo ? "/portal-paciente/demo" : `/portal/${targetSlug}`);
                  }
                }}
              >
                Conocé tu portal
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const stepDone = (n: number) =>
    (n === 1 && !!selectedService) || (n === 2 && !!selectedStart);

  const stepBadgeStyle = (active: boolean) =>
    active
      ? { background: `hsl(var(--brand))`, color: "white" }
      : { background: "hsl(var(--muted))", color: "hsl(var(--muted-foreground))" };

  return (
    <div
      className={`${embed ? `${embedTheme === "dark" ? "dark " : ""}bg-transparent` : "min-h-screen bg-background"} text-foreground`}
      style={brandStyle}
    >
      {/* Header: el botón de tema vive acá adentro (no flota) para que en
          mobile nunca se encime con el nombre del consultorio.
          En embed no se muestra: la web del cliente ya tiene su marca. */}
      {!embed && (
      <header className="border-b border-border bg-card/40">
        <div className="container mx-auto max-w-4xl px-4 py-4 flex items-center justify-between gap-3">
          {/* En demo no hay consultorio real adonde volver: alcanza con el
              "Volver a la demo" del banner de arriba. */}
          {demo ? (
            <span className="w-4 shrink-0" aria-hidden />
          ) : (
            <button
              onClick={() => navigate(`/consultorio/${targetSlug}`)}
              className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors shrink-0"
            >
              <ArrowLeft className="h-4 w-4" />
              <span className="hidden sm:inline">Volver</span>
            </button>
          )}
          <div className="flex items-center gap-2 min-w-0">
            {business.portal_logo_url ? (
              <img
                src={business.portal_logo_url}
                alt={clinicName}
                className="w-8 h-8 rounded-lg object-cover"
              />
            ) : (
              <div
                className="w-8 h-8 rounded-lg flex items-center justify-center"
                style={{ background: `hsl(var(--brand) / 0.15)` }}
              >
                <Stethoscope className="h-4 w-4" style={{ color: `hsl(var(--brand))` }} />
              </div>
            )}
            <span className="font-semibold text-sm sm:text-base truncate">{clinicName}</span>
          </div>
          <div className="shrink-0">{!demo && <PublicThemeControl inline />}</div>
        </div>
      </header>
      )}

      <main className={`container mx-auto max-w-4xl px-4 space-y-6 sm:space-y-8 ${embed ? "py-4 pb-10" : "py-6 sm:py-10 pb-28 sm:pb-10"}`}>
        <div className={`text-center space-y-2 ${embed ? "hidden" : ""}`}>
          <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold tracking-tight">
            Reservá tu turno
          </h1>
          <p className="text-sm sm:text-base text-muted-foreground">
            Elegí tu tipo de sesión y un horario. No necesitás crear una cuenta.
          </p>
        </div>

        {/* Paso 1: tipo de sesión */}
        <section className="space-y-3">
          <div className="flex items-center gap-2">
            <div
              className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold"
              style={stepBadgeStyle(true)}
            >
              1
            </div>
            <h2 className="text-lg sm:text-xl font-semibold">Elegí tu tipo de sesión</h2>
          </div>

          {services.length === 0 ? (
            <Card>
              <CardContent className="pt-6 pb-6 text-center space-y-2">
                <Clock className="h-8 w-8 mx-auto text-muted-foreground" />
                <p className="font-medium text-foreground">Este consultorio todavía no habilitó reservas online</p>
                <p className="text-sm text-muted-foreground">
                  Contactalo directamente para coordinar tu sesión.
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {services.map((s) => {
                const isSelected = selectedService?.id === s.id;
                return (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => selectService(s)}
                    className="text-left rounded-xl border-2 p-4 transition-all"
                    style={
                      isSelected
                        ? { borderColor: `hsl(var(--brand))`, background: `hsl(var(--brand) / 0.08)` }
                        : { borderColor: "hsl(var(--border))", background: "hsl(var(--card))" }
                    }
                  >
                    <p className="font-semibold text-foreground">{s.name}</p>
                    <p className="text-sm text-muted-foreground mt-0.5 flex items-center gap-2 flex-wrap">
                      <span className="inline-flex items-center gap-1">
                        <Clock className="h-3.5 w-3.5" /> {s.duration_minutes} min
                      </span>
                      <span className="inline-flex items-center gap-1">
                        {s.mode === "online" ? <Video className="h-3.5 w-3.5" /> : s.mode === "presencial" ? <MapPin className="h-3.5 w-3.5" /> : null}
                        {MODE_LABEL[s.mode] ?? s.mode}
                      </span>
                    </p>
                    {s.suggested_price != null && (
                      <p className="text-sm font-semibold mt-1" style={{ color: `hsl(var(--brand))` }}>
                        ${s.suggested_price.toLocaleString("es-UY")}
                      </p>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </section>

        {/* Paso 2: día (tira horizontal) + horarios del día elegido */}
        {selectedService && (
          <section ref={scheduleRef} className="space-y-3 scroll-mt-4">
            <div className="flex items-center gap-2">
              <div
                className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold"
                style={stepBadgeStyle(stepDone(1))}
              >
                2
              </div>
              <h2 className="text-lg sm:text-xl font-semibold">Elegí día y horario</h2>
            </div>

            {startsLoading ? (
              <Card>
                <CardContent className="py-10 flex items-center justify-center text-muted-foreground">
                  <Loader2 className="h-5 w-5 animate-spin mr-2" /> Buscando horarios...
                </CardContent>
              </Card>
            ) : starts.length === 0 ? (
              <Card>
                <CardContent className="pt-6 pb-6 text-center space-y-2">
                  <Clock className="h-8 w-8 mx-auto text-muted-foreground" />
                  <p className="font-medium text-foreground">No hay horarios disponibles por ahora</p>
                  <p className="text-sm text-muted-foreground">
                    Te recomendamos volver más tarde o contactar directamente al consultorio.
                  </p>
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardContent className="p-4 sm:p-5 space-y-4">
                  {/* Tira de días con lugar (scroll horizontal) */}
                  <div
                    className="flex gap-2 overflow-x-auto pb-2 -mx-1 px-1 snap-x"
                    role="tablist"
                    aria-label="Días disponibles"
                  >
                    {startsByDate.map(({ date }) => {
                      const { date: d, d: dayNum, m } = parseDay(date);
                      const isSelected = selectedDay === date;
                      return (
                        <button
                          key={date}
                          type="button"
                          role="tab"
                          aria-selected={isSelected}
                          onClick={() => {
                            setSelectedDay(date);
                            setSelectedStart(null);
                          }}
                          className="flex flex-col items-center justify-center rounded-xl border-2 px-3 py-2 min-w-[64px] snap-start transition-all"
                          style={
                            isSelected
                              ? {
                                  background: `hsl(var(--brand))`,
                                  borderColor: `hsl(var(--brand))`,
                                  color: "white",
                                }
                              : {
                                  borderColor: "hsl(var(--border))",
                                  background: "hsl(var(--card))",
                                  color: "hsl(var(--foreground))",
                                }
                          }
                        >
                          <span className={`text-[11px] uppercase tracking-wide ${isSelected ? "" : "text-muted-foreground"}`}>
                            {DAY_SHORT[d.getDay()]}
                          </span>
                          <span className="text-lg font-bold leading-tight">{dayNum}</span>
                          <span className={`text-[11px] ${isSelected ? "" : "text-muted-foreground"}`}>
                            {MONTH_SHORT[m - 1]}
                          </span>
                        </button>
                      );
                    })}
                  </div>

                  {/* Horarios del día elegido */}
                  {selectedDay && (
                    <div className="space-y-3">
                      <div className="flex items-center gap-2">
                        <CalendarDays className="h-4 w-4" style={{ color: `hsl(var(--brand))` }} />
                        <h3 className="text-sm sm:text-base font-semibold">
                          {formatSlotDate(selectedDay)}
                        </h3>
                      </div>
                      <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2">
                        {timesForSelectedDay.map((s) => {
                          const key = `${s.day}-${s.start_time}`;
                          const isSelected =
                            selectedStart?.day === s.day && selectedStart?.start_time === s.start_time;
                          return (
                            <button
                              key={key}
                              type="button"
                              onClick={() => selectStart(s)}
                              className="px-2 py-2.5 rounded-md border-2 text-sm font-medium transition-all"
                              style={
                                isSelected
                                  ? {
                                      background: `hsl(var(--brand))`,
                                      borderColor: `hsl(var(--brand))`,
                                      color: "white",
                                    }
                                  : {
                                      borderColor: `hsl(var(--brand) / 0.3)`,
                                      color: `hsl(var(--brand))`,
                                      background: `hsl(var(--brand) / 0.06)`,
                                    }
                              }
                            >
                              {formatTime(s.start_time)}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </section>
        )}

        {/* Paso 3: datos de contacto */}
        {selectedService && starts.length > 0 && (
          <section ref={formRef} className="space-y-3 scroll-mt-4">
            <div className="flex items-center gap-2">
              <div
                className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold"
                style={stepBadgeStyle(stepDone(2))}
              >
                3
              </div>
              <h2 className="text-lg sm:text-xl font-semibold">Tus datos</h2>
            </div>

            <Card>
              <CardContent className="p-4 sm:p-6">
                <form onSubmit={handleSubmit} className="space-y-4">
                  {selectedService.mode === "ambas" && (
                    <div className="space-y-1.5">
                      <Label>Modalidad</Label>
                      <div className="flex gap-2">
                        {(["online", "presencial"] as const).map((m) => (
                          <button
                            key={m}
                            type="button"
                            onClick={() => setModalityChoice(m)}
                            disabled={!selectedStart || submitting}
                            className="flex-1 inline-flex items-center justify-center gap-2 rounded-md border-2 py-2 text-sm font-medium transition-all"
                            style={
                              modalityChoice === m
                                ? { borderColor: `hsl(var(--brand))`, color: `hsl(var(--brand))`, background: `hsl(var(--brand) / 0.08)` }
                                : { borderColor: "hsl(var(--border))", color: "hsl(var(--muted-foreground))" }
                            }
                          >
                            {m === "online" ? <Video className="h-4 w-4" /> : <MapPin className="h-4 w-4" />}
                            {m === "online" ? "Online" : "Presencial"}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <Label htmlFor="name">Nombre completo *</Label>
                      <Input
                        id="name"
                        value={form.name}
                        onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                        placeholder="Ej: María González"
                        disabled={!selectedStart || submitting}
                        maxLength={100}
                      />
                      {errors.name && (
                        <p className="text-xs text-destructive">{errors.name}</p>
                      )}
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="phone">Teléfono *</Label>
                      <Input
                        id="phone"
                        type="tel"
                        value={form.phone}
                        onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                        placeholder="099 123 456"
                        disabled={!selectedStart || submitting}
                        maxLength={30}
                      />
                      {errors.phone && (
                        <p className="text-xs text-destructive">{errors.phone}</p>
                      )}
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="email">Email *</Label>
                    <Input
                      id="email"
                      type="email"
                      value={form.email}
                      onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                      placeholder="tu@email.com"
                      disabled={!selectedStart || submitting}
                      maxLength={255}
                    />
                    {errors.email && (
                      <p className="text-xs text-destructive">{errors.email}</p>
                    )}
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="message">Motivo de la consulta (opcional)</Label>
                    <Textarea
                      id="message"
                      value={form.message}
                      onChange={(e) => setForm((f) => ({ ...f, message: e.target.value }))}
                      placeholder="Contanos brevemente qué te gustaría tratar."
                      rows={3}
                      disabled={!selectedStart || submitting}
                      maxLength={500}
                    />
                  </div>

                  {selectedStart && (
                    <div
                      className="rounded-lg p-3 text-sm flex items-center gap-2"
                      style={{
                        background: `hsl(var(--brand) / 0.08)`,
                        color: `hsl(var(--brand))`,
                      }}
                    >
                      <CalendarDays className="h-4 w-4 flex-shrink-0" />
                      <span className="font-medium">
                        {selectedService.name} · {formatSlotDate(selectedStart.day)} · {formatTime(selectedStart.start_time)}
                      </span>
                    </div>
                  )}

                  <Button
                    type="submit"
                    size="lg"
                    disabled={!selectedStart || submitting}
                    className="w-full gap-2 font-semibold"
                    style={{
                      background: selectedStart ? `hsl(var(--brand))` : undefined,
                      color: selectedStart ? "white" : undefined,
                    }}
                  >
                    {submitting ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Confirmando...
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="h-4 w-4" />
                        {selectedStart ? "Confirmar reserva" : "Elegí un horario primero"}
                      </>
                    )}
                  </Button>
                </form>
              </CardContent>
            </Card>
          </section>
        )}
      </main>

      {/* Barra fija (solo mobile): resumen de la selección siempre a la vista */}
      {selectedStart && selectedService && (
        <div className="fixed bottom-0 inset-x-0 z-40 sm:hidden border-t border-border bg-card/95 backdrop-blur px-4 py-3">
          <button
            type="button"
            onClick={() => scrollTo(formRef)}
            className="w-full flex items-center justify-between gap-3 text-left"
          >
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground truncate">{selectedService.name}</p>
              <p className="text-sm font-semibold truncate">
                {formatSlotDate(selectedStart.day)} · {formatTime(selectedStart.start_time)}
              </p>
            </div>
            <span
              className="shrink-0 text-xs font-semibold px-3 py-2 rounded-md"
              style={{ background: `hsl(var(--brand))`, color: "white" }}
            >
              Completar datos
            </span>
          </button>
        </div>
      )}
    </div>
  );
};

export default PublicBooking;
