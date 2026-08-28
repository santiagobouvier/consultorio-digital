import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useBusinessId } from "@/hooks/use-business-id";
import { requestGoogleSync } from "@/lib/data-sync";
import { toast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { useDashboardBranding } from "@/contexts/DashboardBrandingContext";
import {
  CalendarHeart,
  Check,
  ChevronRight,
  Copy,
  Loader2,
  Trash2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { GoogleLinkTutorial } from "./GoogleLinkTutorial";

// La perillita de la agenda: conectar Google Calendar / iPhone sin salir
// del módulo. Un puntito verde dice "conectado"; el pop-up explica qué hace
// y tiene los botones de un toque. Vive acá porque ES una función de la
// agenda, no un ajuste perdido en Configuración.

// Se marca cada destino cuando el profesional toca su botón de conectar.
// Desconectar es REAL: se borra el token y el link deja de servir citas
// (para los dos destinos a la vez: es el mismo link).
const LS_G = "calendar-sync-google";
const LS_A = "calendar-sync-apple";

type ExternalCal = { id: string; label: string; host: string };

export const CalendarSyncButton = ({ mobile = false }: { mobile?: boolean }) => {
  const { businessId } = useBusinessId(false);
  const { primaryColor } = useDashboardBranding();
  const [open, setOpen] = useState(false);
  const [dest, setDest] = useState<{ google: boolean; apple: boolean }>(() => {
    try {
      return {
        google: localStorage.getItem(LS_G) === "1",
        apple: localStorage.getItem(LS_A) === "1",
      };
    } catch {
      return { google: false, apple: false };
    }
  });
  // Cuenta de Google conectada por OAuth (sincronización instantánea)
  const [gAcct, setGAcct] = useState<{ connected: boolean; email: string | null } | null>(null);
  const [gLoading, setGLoading] = useState(false);

  const refreshGoogleStatus = async () => {
    const { data, error } = await supabase.functions.invoke("google-calendar-sync", {
      body: { action: "status" },
    });
    if (!error && typeof data?.connected === "boolean") {
      setGAcct({ connected: data.connected, email: data.email ?? null });
    }
  };

  // El puntito del header necesita saber el estado sin abrir el pop-up
  useEffect(() => {
    void refreshGoogleStatus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // La ventanita de Google avisa cuando terminó (postMessage desde el callback)
  useEffect(() => {
    const onMsg = (e: MessageEvent) => {
      if (e.data === "google-calendar-connected") {
        void refreshGoogleStatus();
        requestGoogleSync();
        toast({
          title: "¡Google conectado! ⚡",
          description:
            "Tus citas se están sincronizando ahora mismo. Si antes lo tenías conectado por link, borrá ese calendario en Google para no ver doble.",
        });
      }
    };
    window.addEventListener("message", onMsg);
    return () => window.removeEventListener("message", onMsg);
  }, []);

  const handleGoogleOAuthDisconnect = async () => {
    setDisconnecting("google");
    try {
      await supabase.functions.invoke("google-calendar-sync", { body: { action: "disconnect" } });
      setGAcct({ connected: false, email: null });
      toast({
        title: "Google desconectado",
        description:
          "Las citas ya creadas quedan en tu calendario de Google; borralas allá si querés limpiarlas.",
      });
    } finally {
      setDisconnecting(null);
    }
  };

  const handleGoogleOAuth = async () => {
    setGLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("google-oauth-start", {
        body: { businessId },
      });
      if (error || !data?.url) {
        toast({
          title: "Todavía no está lista",
          description: "La conexión con Google no está desplegada aún. Probá en un rato.",
          variant: "destructive",
        });
        return;
      }
      window.open(data.url, "_blank", "width=520,height=680");
    } finally {
      setGLoading(false);
    }
  };

  const connected = !!gAcct?.connected || dest.google || dest.apple;

  // Un link privado POR DESTINO (Google / Apple): así se puede desconectar
  // uno sin tocar el otro. Si la columna destination todavía no existe en la
  // base, se cae al modo de link único compartido (singleMode).
  const [tokens, setTokens] = useState<{ google?: string; apple?: string }>({});
  const [singleMode, setSingleMode] = useState(false);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  // Calendario personal conectado (aviso de choques) — sección opcional
  const [cals, setCals] = useState<ExternalCal[]>([]);
  const [extOpen, setExtOpen] = useState(false);
  const [extUrl, setExtUrl] = useState("");
  const [extWorking, setExtWorking] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [tutorialOpen, setTutorialOpen] = useState(false);

  const markConnected = (which: "google" | "apple" = "google") => {
    try {
      localStorage.setItem(which === "google" ? LS_G : LS_A, "1");
    } catch {
      /* sin localStorage no pasa nada: el puntito queda gris */
    }
    setDest((d) => ({ ...d, [which]: true }));
  };

  // Carga (o crea) los links. Con la columna destination: un link por
  // destino. Sin ella (SQL viejo): un único link compartido para los dos.
  const loadTokens = async (): Promise<void> => {
    if (!businessId) return;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const table = () => (supabase as any).from("calendar_feed_tokens");

    const loadSingle = async () => {
      const { data: row } = await table()
        .select("token")
        .eq("business_id", businessId)
        .eq("professional_user_id", user.id)
        .limit(1)
        .maybeSingle();
      let t: string | null = row?.token ?? null;
      if (!t) {
        const { data: created } = await table()
          .insert({ business_id: businessId, professional_user_id: user.id })
          .select("token")
          .single();
        t = created?.token ?? null;
      }
      setSingleMode(true);
      setTokens({ google: t ?? undefined, apple: t ?? undefined });
    };

    const { data: rows, error } = await table()
      .select("token, destination")
      .eq("business_id", businessId)
      .eq("professional_user_id", user.id);
    if (error) {
      await loadSingle();
      return;
    }
    const map: Record<string, string> = {};
    for (const r of rows ?? []) map[r.destination ?? "any"] = r.token;
    try {
      for (const d of ["google", "apple"] as const) {
        if (map[d]) continue;
        const { data: created, error: e2 } = await table()
          .insert({ business_id: businessId, professional_user_id: user.id, destination: d })
          .select("token")
          .single();
        if (e2) throw e2;
        map[d] = created?.token;
      }
      setSingleMode(false);
      setTokens({ google: map.google, apple: map.apple });
    } catch {
      // Constraint o columna viejos: modo link único con lo que haya
      await loadSingle();
    }
  };

  // Desconectar DE VERDAD: borra ese token → ese link muere y ese calendario
  // deja de recibir citas. Después se genera uno nuevo limpio para reconectar.
  const [disconnecting, setDisconnecting] = useState<"google" | "apple" | null>(null);
  const handleDisconnect = async (which: "google" | "apple") => {
    if (!businessId) return;
    setDisconnecting(which);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const del = (supabase as any)
        .from("calendar_feed_tokens")
        .delete()
        .eq("business_id", businessId)
        .eq("professional_user_id", user.id);
      if (singleMode) {
        await del;
        try {
          localStorage.removeItem(LS_G);
          localStorage.removeItem(LS_A);
        } catch { /* nada */ }
        setDest({ google: false, apple: false });
      } else {
        await del.eq("destination", which);
        try {
          localStorage.removeItem(which === "google" ? LS_G : LS_A);
        } catch { /* nada */ }
        setDest((d) => ({ ...d, [which]: false }));
      }
      await loadTokens();
      toast({
        title: "Desconectado",
        description: singleMode
          ? "El link compartido dejó de funcionar (Google y iPhone). Para limpiar del todo, borrá el calendario suscrito en la app."
          : `Ese link dejó de funcionar: ${which === "google" ? "Google Calendar" : "el iPhone/Mac"} ya no recibe citas. Para limpiar del todo, borrá el calendario suscrito en la app.`,
      });
    } finally {
      setDisconnecting(null);
    }
  };

  // Al abrir el pop-up: preparar links + calendarios personales
  useEffect(() => {
    if (!open || !businessId) return;
    let cancelled = false;
    setLoading(true);
    (async () => {
      await loadTokens();
      if (!cancelled) setLoading(false);
      // Calendarios personales, en paralelo silencioso
      const { data: res, error } = await supabase.functions.invoke("external-calendar", {
        body: { action: "list" },
      });
      if (!cancelled && !error && Array.isArray(res?.calendars)) {
        setCals(res.calendars);
        if (res.calendars.length > 0) setExtOpen(true);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, businessId]);

  const mkUrl = (t?: string) =>
    t ? `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/calendar-feed?token=${t}` : null;
  const googleHttps = mkUrl(tokens.google);
  const googleWebcal = googleHttps ? googleHttps.replace(/^https:\/\//, "webcal://") : null;
  const googleAddUrl = googleWebcal
    ? `https://calendar.google.com/calendar/r?cid=${encodeURIComponent(googleWebcal)}`
    : null;
  const appleWebcal = mkUrl(tokens.apple)?.replace(/^https:\/\//, "webcal://") ?? null;
  const copyUrl = googleHttps ?? mkUrl(tokens.apple);

  const handleCopy = async () => {
    if (!copyUrl) return;
    try {
      await navigator.clipboard.writeText(copyUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast({ title: "No se pudo copiar", description: copyUrl });
    }
  };

  const handleAddExternal = async () => {
    if (!extUrl.trim()) return;
    setExtWorking(true);
    try {
      const { data, error } = await supabase.functions.invoke("external-calendar", {
        body: { action: "add", url: extUrl.trim(), businessId },
      });
      const errMsg = (data as any)?.error || (error ? "No se pudo conectar el calendario" : null);
      if (errMsg) {
        toast({ title: "No se pudo conectar", description: errMsg, variant: "destructive" });
        return;
      }
      setExtUrl("");
      toast({
        title: "Calendario conectado 🎉",
        description: "Al agendar, te aviso si chocás con algo tuyo.",
      });
      const { data: res } = await supabase.functions.invoke("external-calendar", {
        body: { action: "list" },
      });
      if (Array.isArray(res?.calendars)) setCals(res.calendars);
    } finally {
      setExtWorking(false);
    }
  };

  const handleRemoveExternal = async (id: string) => {
    setExtWorking(true);
    try {
      await supabase.functions.invoke("external-calendar", { body: { action: "remove", id } });
      setCals((prev) => prev.filter((c) => c.id !== id));
    } finally {
      setExtWorking(false);
    }
  };

  const dot = (
    <span
      className={cn(
        "rounded-full shrink-0",
        mobile ? "absolute top-1 right-1 w-2.5 h-2.5 ring-2 ring-background" : "w-2 h-2",
        connected ? "bg-emerald-500" : "bg-muted-foreground/40"
      )}
    />
  );

  return (
    <>
      {mobile ? (
        <button
          onClick={() => setOpen(true)}
          className="relative h-9 w-9 rounded-full flex items-center justify-center text-muted-foreground/70 transition-colors active:bg-muted hover:text-foreground"
          aria-label="Conectar mi calendario"
        >
          <CalendarHeart className="h-[17px] w-[17px]" strokeWidth={1.8} />
          {dot}
        </button>
      ) : (
        <Button variant="outline" size="sm" onClick={() => setOpen(true)} className="rounded-xl gap-2">
          {dot}
          Mi calendario
        </Button>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md p-0 gap-0 overflow-hidden max-h-[88dvh] flex flex-col">
          {/* Encabezado con el gradiente de marca, como toda la agenda */}
          <div
            className="px-5 pt-5 pb-4 border-b border-border/60"
            style={{
              background: `linear-gradient(135deg, hsla(${primaryColor}, 0.16) 0%, hsla(${primaryColor}, 0.05) 55%, transparent 90%)`,
            }}
          >
            <div className="flex items-center gap-3">
              <span
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl"
                style={{
                  background: `hsla(${primaryColor}, 0.15)`,
                  boxShadow: `inset 0 0 0 1px hsla(${primaryColor}, 0.3)`,
                }}
              >
                <CalendarHeart className="h-5 w-5 text-primary" strokeWidth={2} />
              </span>
              <div className="min-w-0">
                <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-primary">
                  Integración
                </p>
                <DialogTitle className="text-lg font-bold leading-tight">
                  Tu calendario de siempre
                </DialogTitle>
              </div>
            </div>

            {/* Estado actual, clarito */}
            <p
              className={cn(
                "mt-3 inline-flex items-center gap-1.5 text-xs font-semibold rounded-full px-2.5 py-1",
                connected
                  ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                  : "bg-muted text-muted-foreground"
              )}
            >
              <span
                className={cn(
                  "w-1.5 h-1.5 rounded-full",
                  connected ? "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.8)]" : "bg-muted-foreground/50"
                )}
              />
              {connected ? "Conectado" : "Sin conectar"}
            </p>
          </div>

          <div className="overflow-y-auto flex-1 px-4 py-4 space-y-4">
            {/* Qué hace, en fácil: filas con su emoji en chip */}
            <div className="rounded-2xl border border-border/60 bg-card divide-y divide-border/50 overflow-hidden">
              {[
                { e: "📲", t: <><span className="font-semibold">Tus citas aparecen solas</span> en tu Google Calendar o en el calendario del iPhone.</> },
                { e: "🔄", t: <>Agendás o cambiás algo acá → <span className="font-semibold">allá se actualiza solo</span>.</> },
                { e: "🛒", t: <>Estás en el súper, abrís el calendario del celu como siempre… y ahí está: <span className="font-semibold">"Viernes 17:00 — Agustina"</span>.</> },
                { e: "🔒", t: <>Nada clínico viaja: <span className="font-semibold">solo nombre, tipo de sesión y hora</span>.</> },
              ].map((row, i) => (
                <div key={i} className="flex items-center gap-3 px-3.5 py-2.5">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-[17px]">
                    {row.e}
                  </span>
                  <p className="text-[13px] leading-snug text-foreground/90">{row.t}</p>
                </div>
              ))}
            </div>

            {loading || !googleAddUrl || !appleWebcal ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
                <Loader2 className="h-4 w-4 animate-spin" /> Preparando tu conexión...
              </div>
            ) : (
              <div className="space-y-2">
                {/* Google por OAuth: un permiso y sincronización AL INSTANTE.
                    Fila verde con su Desconectar cuando ya está. */}
                {gAcct?.connected ? (
                  <div className="flex items-center justify-between gap-2 min-h-[48px] rounded-xl border border-emerald-500/30 bg-emerald-500/10 pl-3.5 pr-1.5 py-1">
                    <span className="flex flex-col min-w-0">
                      <span className="flex items-center gap-2 text-sm font-semibold text-emerald-600 dark:text-emerald-400">
                        <Check className="h-4 w-4 shrink-0" />
                        Google Calendar conectado ⚡ al instante
                      </span>
                      {gAcct.email && (
                        <span className="text-[11px] text-muted-foreground truncate pl-6">
                          {gAcct.email}
                        </span>
                      )}
                    </span>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-9 rounded-lg text-muted-foreground hover:text-destructive shrink-0"
                      onClick={handleGoogleOAuthDisconnect}
                      disabled={disconnecting !== null}
                    >
                      {disconnecting === "google" ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        "Desconectar"
                      )}
                    </Button>
                  </div>
                ) : (
                  <Button
                    className="w-full h-12 rounded-xl text-[15px] font-semibold"
                    style={{ boxShadow: `0 10px 24px -10px hsla(${primaryColor}, 0.65)` }}
                    onClick={handleGoogleOAuth}
                    disabled={gLoading}
                  >
                    {gLoading ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : null}
                    Conectar Google Calendar ⚡ al instante
                  </Button>
                )}

                {/* iPhone / Mac: ídem */}
                {dest.apple ? (
                  <div className="flex items-center justify-between gap-2 h-12 rounded-xl border border-emerald-500/30 bg-emerald-500/10 pl-3.5 pr-1.5">
                    <span className="flex items-center gap-2 text-sm font-semibold text-emerald-600 dark:text-emerald-400 min-w-0 truncate">
                      <Check className="h-4 w-4 shrink-0" />
                      iPhone / Mac conectado
                    </span>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-9 rounded-lg text-muted-foreground hover:text-destructive shrink-0"
                      onClick={() => handleDisconnect("apple")}
                      disabled={disconnecting !== null}
                    >
                      {disconnecting === "apple" ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        "Desconectar"
                      )}
                    </Button>
                  </div>
                ) : (
                  <Button
                    asChild
                    variant="outline"
                    className="w-full h-12 rounded-xl text-[15px] font-semibold border-2"
                    onClick={() => markConnected("apple")}
                  >
                    <a href={appleWebcal}>Conectar iPhone / Mac</a>
                  </Button>
                )}

                <p className="text-[12px] leading-snug text-muted-foreground text-center">
                  Un toque, confirmás en tu calendario y listo para siempre.
                  <br />
                  (Google puede tardar unas horas en refrescar.)
                </p>
                <div className="flex justify-center">
                  <Button variant="ghost" size="sm" className="text-muted-foreground" onClick={handleCopy}>
                    {copied ? <Check className="h-3.5 w-3.5 mr-2 text-emerald-500" /> : <Copy className="h-3.5 w-3.5 mr-2" />}
                    Copiar link
                  </Button>
                </div>
              </div>
            )}

            {/* Opcional: que la agenda LEA su calendario y avise choques */}
            <div className="rounded-2xl border border-border/60 bg-card px-3.5 py-1.5">
              <button
                type="button"
                onClick={() => setExtOpen((v) => !v)}
                className="w-full flex items-center justify-between gap-3 text-left min-h-[48px] py-1.5"
              >
                <div className="min-w-0">
                  <p className="text-sm font-semibold leading-tight">
                    ¿Que también te avise si chocás con algo tuyo?
                    <span className="ml-2 align-middle text-[10px] font-semibold uppercase tracking-wide text-muted-foreground bg-muted rounded-full px-2 py-0.5">
                      Opcional
                    </span>
                  </p>
                  <p className="mt-0.5 text-[12.5px] leading-snug text-muted-foreground">
                    Ejemplo: tenés "Dentista 15:00" en tu Google → acá esa hora se ve gris 📅
                    y, si vas a poner un paciente ahí, te aviso antes. Nada más: no crea
                    citas ni toca tu Google — solo lee.
                  </p>
                </div>
                <ChevronRight
                  className={cn(
                    "h-4 w-4 shrink-0 text-muted-foreground transition-transform",
                    extOpen && "rotate-90"
                  )}
                />
              </button>

              {extOpen && (
                <div className="pt-1 pb-2.5 space-y-2.5">
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
                        onClick={() => handleRemoveExternal(c.id)}
                        disabled={extWorking}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}

                  {cals.length < 3 && (
                    <div className="flex items-center gap-2">
                      <Input
                        value={extUrl}
                        onChange={(e) => setExtUrl(e.target.value)}
                        placeholder="Pegá el link iCal de tu calendario"
                        className="h-11 rounded-xl text-sm"
                      />
                      <Button
                        onClick={handleAddExternal}
                        disabled={extWorking || !extUrl.trim()}
                        className="h-11 rounded-xl shrink-0"
                      >
                        {extWorking ? <Loader2 className="h-4 w-4 animate-spin" /> : "Conectar"}
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
                    <div className="rounded-xl bg-muted/40 p-3 text-[12.5px] leading-relaxed text-muted-foreground space-y-2.5">
                      <div className="space-y-1.5">
                        <p className="font-medium text-foreground">Google Calendar (desde la compu):</p>
                        <Button
                          size="sm"
                          className="rounded-xl h-10 w-full font-semibold"
                          onClick={() => setTutorialOpen(true)}
                        >
                          📷 Ver el paso a paso con capturas
                        </Button>
                      </div>
                      <div className="space-y-1 border-t border-border/50 pt-2.5">
                        <p className="font-medium text-foreground">iPhone / iCloud:</p>
                        <p>1. Abrí la app Calendario → "Calendarios" (abajo al medio).</p>
                        <p>2. Tocá la (i) al lado de tu calendario.</p>
                        <p>3. Activá "Calendario público" → "Compartir enlace" → Copiar.</p>
                        <p>4. Pegalo acá arriba.</p>
                      </div>
                      <p className="text-[11.5px] border-t border-border/50 pt-2.5">
                        Solo lectura, y el link queda guardado en el servidor: nunca se muestra
                        entero. Lo desconectás cuando quieras.
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Tutorial con "capturas" paso a paso, encima del pop-up */}
      <GoogleLinkTutorial open={tutorialOpen} onClose={() => setTutorialOpen(false)} />
    </>
  );
};
