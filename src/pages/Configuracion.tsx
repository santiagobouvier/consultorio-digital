// Hub de Configuración: acá viven todos los módulos secundarios que antes
// llenaban el nav. El menú principal queda solo con lo del día a día; todo
// lo demás se encuentra en esta pantalla, ordenado y explicado.
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useBusinessId } from "@/hooks/use-business-id";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  ArrowLeft,
  AlarmClock,
  Clock,
  Settings,
  Palette,
  CreditCard,
  LifeBuoy,
  ChevronRight,
  CalendarHeart,
  CalendarSearch,
  Copy,
  Check,
  RefreshCw,
  Loader2,
  Trash2,
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

/**
 * Tu agenda en el calendario del celular: genera un link privado de
 * suscripción iCal (Google Calendar / iPhone). El token es secreto y por
 * profesional; regenerarlo invalida el anterior.
 */
const CalendarFeedCard = () => {
  const { businessId } = useBusinessId(false);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!businessId) return;
    let cancelled = false;
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || cancelled) return;
      const { data } = await (supabase as any)
        .from("calendar_feed_tokens")
        .select("token")
        .eq("business_id", businessId)
        .eq("professional_user_id", user.id)
        .maybeSingle();
      if (cancelled) return;
      if (data?.token) {
        setToken(data.token);
        setLoading(false);
        return;
      }
      // Sin link todavía: se crea solo, así el botón está siempre pronto
      const { data: created } = await (supabase as any)
        .from("calendar_feed_tokens")
        .insert({ business_id: businessId, professional_user_id: user.id })
        .select("token")
        .single();
      if (!cancelled) {
        setToken(created?.token ?? null);
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [businessId]);

  const feedUrl = token
    ? `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/calendar-feed?token=${token}`
    : null;

  // Botones de un toque: Google abre su pantalla de "Añadir calendario" con
  // todo pronto; webcal:// abre el calendario nativo en iPhone/Mac.
  const webcalUrl = feedUrl ? feedUrl.replace(/^https:\/\//, "webcal://") : null;
  const googleAddUrl = webcalUrl
    ? `https://calendar.google.com/calendar/r?cid=${encodeURIComponent(webcalUrl)}`
    : null;

  const handleRegenerate = async () => {
    if (!businessId) return;
    setWorking(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Sesión no válida");
      const { data, error } = await (supabase as any)
        .from("calendar_feed_tokens")
        .update({ token: crypto.randomUUID() })
        .eq("business_id", businessId)
        .eq("professional_user_id", user.id)
        .select("token")
        .single();
      if (error) throw error;
      setToken(data.token);
      toast({
        title: "Link regenerado",
        description: "El link anterior dejó de funcionar. Volvé a agregarlo en tu calendario.",
      });
    } catch (e) {
      console.error(e);
      toast({ title: "Error", description: "No se pudo regenerar el link", variant: "destructive" });
    } finally {
      setWorking(false);
    }
  };

  const handleCopy = async () => {
    if (!feedUrl) return;
    try {
      await navigator.clipboard.writeText(feedUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast({ title: "No se pudo copiar", description: feedUrl });
    }
  };

  return (
    <div className="space-y-4">
      {loading || !feedUrl ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Preparando tu conexión...
        </div>
      ) : (
        <div className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <Button asChild className="h-12 rounded-xl text-[15px] font-semibold">
              <a href={googleAddUrl!} target="_blank" rel="noreferrer">
                Conectar Google Calendar
              </a>
            </Button>
            <Button asChild variant="secondary" className="h-12 rounded-xl text-[15px] font-semibold">
              <a href={webcalUrl!}>Conectar iPhone / Mac</a>
            </Button>
          </div>
          <p className="text-[12.5px] leading-snug text-muted-foreground">
            Un toque: se abre tu calendario con todo pronto, confirmás y listo — tus citas
            aparecen y se actualizan solas. Nada clínico viaja por acá: solo paciente, tipo de
            sesión y horario. (Google puede tardar unas horas en refrescar.)
          </p>
          <Button variant="ghost" size="sm" className="text-muted-foreground" onClick={handleCopy}>
            {copied ? <Check className="h-3.5 w-3.5 mr-2 text-emerald-500" /> : <Copy className="h-3.5 w-3.5 mr-2" />}
            Copiar link (para agregarlo a mano)
          </Button>
          <Button variant="ghost" size="sm" className="text-muted-foreground" onClick={handleRegenerate} disabled={working}>
            {working ? <Loader2 className="h-3.5 w-3.5 mr-2 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5 mr-2" />}
            Regenerar link (invalida el anterior)
          </Button>
        </div>
      )}
    </div>
  );
};

/**
 * El camino inverso: el sistema LEE el calendario personal del profesional
 * (Google / iCloud / Outlook) para avisar choques al agendar. Se conecta
 * pegando el link iCal privado una sola vez; el link nunca vuelve al
 * navegador (solo lo lee el servidor).
 */
type ExternalCal = { id: string; label: string; host: string };

const ExternalCalendarsCard = () => {
  const { businessId } = useBusinessId(false);
  const [cals, setCals] = useState<ExternalCal[]>([]);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [url, setUrl] = useState("");
  const [showHelp, setShowHelp] = useState(false);
  // Plegado por defecto: es lo opcional/avanzado. Con algo conectado, abierto.
  const [openSec, setOpenSec] = useState(false);

  const refresh = async () => {
    const { data, error } = await supabase.functions.invoke("external-calendar", {
      body: { action: "list" },
    });
    if (!error && Array.isArray(data?.calendars)) {
      setCals(data.calendars);
      if (data.calendars.length > 0) setOpenSec(true);
    }
    setLoading(false);
  };

  useEffect(() => {
    void refresh();
  }, []);

  const handleAdd = async () => {
    if (!url.trim()) return;
    setWorking(true);
    try {
      const { data, error } = await supabase.functions.invoke("external-calendar", {
        body: { action: "add", url: url.trim(), businessId },
      });
      const errMsg = (data as any)?.error || (error ? "No se pudo conectar el calendario" : null);
      if (errMsg) {
        toast({ title: "No se pudo conectar", description: errMsg, variant: "destructive" });
        return;
      }
      setUrl("");
      toast({
        title: "Calendario conectado 🎉",
        description: "Al agendar, el sistema te va a avisar si chocás con algo tuyo.",
      });
      await refresh();
    } finally {
      setWorking(false);
    }
  };

  const handleRemove = async (id: string) => {
    setWorking(true);
    try {
      await supabase.functions.invoke("external-calendar", { body: { action: "remove", id } });
      setCals((prev) => prev.filter((c) => c.id !== id));
    } finally {
      setWorking(false);
    }
  };

  return (
    <div className="space-y-3">
      <button
        type="button"
        onClick={() => setOpenSec((v) => !v)}
        className="w-full flex items-center justify-between gap-3 text-left min-h-[44px]"
      >
        <div className="min-w-0">
          <h3 className="text-sm font-semibold leading-tight">
            ¿Que también te avise si chocás con algo tuyo?
            <span className="ml-2 align-middle text-[10px] font-semibold uppercase tracking-wide text-muted-foreground bg-muted rounded-full px-2 py-0.5">
              Opcional
            </span>
          </h3>
          <p className="mt-1 text-[13px] leading-snug text-muted-foreground">
            Conectá tu calendario personal y, al agendar un paciente, te aviso si esa hora
            choca con algo tuyo ("Dentista 15:00").
          </p>
        </div>
        <ChevronRight
          className={
            "h-4 w-4 shrink-0 text-muted-foreground transition-transform " +
            (openSec ? "rotate-90" : "")
          }
        />
      </button>

      {!openSec ? null : loading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Cargando...
        </div>
      ) : (
        <div className="space-y-3">
          {cals.length > 0 && (
            <div className="space-y-2">
              {cals.map((c) => (
                <div
                  key={c.id}
                  className="flex items-center gap-3 rounded-xl border border-border/70 bg-muted/30 px-3 py-2.5"
                >
                  <Check className="h-4 w-4 text-emerald-500 shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate">{c.label}</p>
                    <p className="text-[11.5px] text-muted-foreground truncate">{c.host}</p>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-9 w-9 rounded-xl text-muted-foreground hover:text-destructive shrink-0"
                    onClick={() => handleRemove(c.id)}
                    disabled={working}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}

          {cals.length < 3 && (
            <div className="flex items-center gap-2">
              <Input
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="Pegá acá el link iCal de tu calendario"
                className="h-11 rounded-xl text-sm"
              />
              <Button
                onClick={handleAdd}
                disabled={working || !url.trim()}
                className="h-11 rounded-xl shrink-0"
              >
                {working ? <Loader2 className="h-4 w-4 animate-spin" /> : "Conectar"}
              </Button>
            </div>
          )}

          <button
            type="button"
            onClick={() => setShowHelp((v) => !v)}
            className="text-[12.5px] text-muted-foreground hover:text-foreground underline underline-offset-4"
          >
            ¿De dónde saco ese link?
          </button>
          {showHelp && (
            <div className="rounded-xl bg-muted/40 p-3 text-[12.5px] leading-relaxed text-muted-foreground space-y-1.5">
              <p>
                <span className="font-medium text-foreground">Google Calendar (compu):</span>{" "}
                Configuración → tu calendario → Integrar el calendario → copiá la
                "Dirección secreta en formato iCal".
              </p>
              <p>
                <span className="font-medium text-foreground">iPhone / iCloud:</span>{" "}
                app Calendario → Calendarios → (i) junto a tu calendario → activá
                "Calendario público" → Compartir enlace → copialo (empieza con webcal://).
              </p>
              <p className="text-[11.5px]">
                El link es de solo lectura y queda guardado en el servidor: nunca se muestra
                entero ni sale de ahí. Podés desconectarlo cuando quieras.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

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

        {/* Integración con Google Calendar / iPhone: UNA tarjeta, dos sentidos */}
        <div className="rounded-2xl border border-border/70 bg-card p-5 sm:p-6 space-y-5">
          <div className="flex items-start gap-4">
            <span
              className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl"
              style={{ background: "hsla(190, 85%, 50%, 0.14)", boxShadow: "inset 0 0 0 1px hsla(190, 85%, 50%, 0.25)" }}
            >
              <CalendarHeart className="h-[22px] w-[22px]" style={{ color: "hsl(190 85% 50%)" }} strokeWidth={2} />
            </span>
            <div className="min-w-0">
              <h2 className="text-[15px] font-semibold leading-tight">
                Google Calendar y iPhone
              </h2>
              <p className="mt-1 text-[13px] leading-snug text-muted-foreground">
                Un toque y tus citas del consultorio aparecen en tu calendario de siempre.
              </p>
            </div>
          </div>
          <div className="border-t border-border/60 pt-4">
            <CalendarFeedCard />
          </div>
          <div className="border-t border-border/60 pt-4">
            <ExternalCalendarsCard />
          </div>
        </div>
      </div>
    </div>
  );
};

export default Configuracion;
