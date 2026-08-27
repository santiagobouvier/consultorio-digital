import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useBusinessId } from "@/hooks/use-business-id";
import { toast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import {
  CalendarHeart,
  Check,
  ChevronRight,
  Copy,
  Loader2,
  Trash2,
} from "lucide-react";
import { cn } from "@/lib/utils";

// La perillita de la agenda: conectar Google Calendar / iPhone sin salir
// del módulo. Un puntito verde dice "conectado"; el pop-up explica qué hace
// y tiene los botones de un toque. Vive acá porque ES una función de la
// agenda, no un ajuste perdido en Configuración.

const LS_KEY = "calendar-sync-connected";

type ExternalCal = { id: string; label: string; host: string };

export const CalendarSyncButton = ({ mobile = false }: { mobile?: boolean }) => {
  const { businessId } = useBusinessId(false);
  const [open, setOpen] = useState(false);
  const [connected, setConnected] = useState<boolean>(() => {
    try {
      return localStorage.getItem(LS_KEY) === "1";
    } catch {
      return false;
    }
  });

  // Link privado del feed (se crea solo la primera vez que se abre el pop-up)
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  // Calendario personal conectado (aviso de choques) — sección opcional
  const [cals, setCals] = useState<ExternalCal[]>([]);
  const [extOpen, setExtOpen] = useState(false);
  const [extUrl, setExtUrl] = useState("");
  const [extWorking, setExtWorking] = useState(false);
  const [showHelp, setShowHelp] = useState(false);

  const markConnected = () => {
    try {
      localStorage.setItem(LS_KEY, "1");
    } catch {
      /* sin localStorage no pasa nada: el puntito queda gris */
    }
    setConnected(true);
  };

  // Al abrir el pop-up: buscar (o crear) el token del feed + calendarios
  useEffect(() => {
    if (!open || !businessId) return;
    let cancelled = false;
    setLoading(true);
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
      } else {
        const { data: created } = await (supabase as any)
          .from("calendar_feed_tokens")
          .insert({ business_id: businessId, professional_user_id: user.id })
          .select("token")
          .single();
        if (!cancelled) setToken(created?.token ?? null);
      }
      if (!cancelled) setLoading(false);
      // Calendarios personales, en paralelo silencioso
      const { data: res, error } = await supabase.functions.invoke("external-calendar", {
        body: { action: "list" },
      });
      if (!cancelled && !error && Array.isArray(res?.calendars)) {
        setCals(res.calendars);
        if (res.calendars.length > 0) {
          setExtOpen(true);
          markConnected();
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, businessId]);

  const feedUrl = token
    ? `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/calendar-feed?token=${token}`
    : null;
  const webcalUrl = feedUrl ? feedUrl.replace(/^https:\/\//, "webcal://") : null;
  const googleAddUrl = webcalUrl
    ? `https://calendar.google.com/calendar/r?cid=${encodeURIComponent(webcalUrl)}`
    : null;

  const handleCopy = async () => {
    if (!feedUrl) return;
    try {
      await navigator.clipboard.writeText(feedUrl);
      setCopied(true);
      markConnected();
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast({ title: "No se pudo copiar", description: feedUrl });
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
      markConnected();
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
          <div className="px-5 pt-5 pb-4 border-b border-border/60">
            <DialogTitle className="text-lg font-bold flex items-center gap-2">
              <CalendarHeart className="h-5 w-5 text-primary" />
              Tu calendario de siempre
            </DialogTitle>
            <p
              className={cn(
                "mt-1.5 inline-flex items-center gap-1.5 text-xs font-semibold rounded-full px-2.5 py-1",
                connected
                  ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                  : "bg-muted text-muted-foreground"
              )}
            >
              <span className={cn("w-1.5 h-1.5 rounded-full", connected ? "bg-emerald-500" : "bg-muted-foreground/50")} />
              {connected ? "Conectado" : "Sin conectar"}
            </p>
          </div>

          <div className="overflow-y-auto flex-1 px-5 py-4 space-y-4">
            {/* Qué hace, en fácil */}
            <div className="rounded-xl bg-muted/40 p-3.5 text-[13px] leading-relaxed space-y-1.5">
              <p>📲 <span className="font-medium">Tus citas aparecen solas</span> en tu Google Calendar o en el calendario del iPhone.</p>
              <p>🔄 Agendás o cambiás algo acá → allá se actualiza solo.</p>
              <p>🛒 Ejemplo: estás en el súper, abrís el calendario de tu celu como siempre… y ahí está: "Viernes 17:00 — Agustina".</p>
              <p>🔒 Nada clínico viaja: solo nombre, tipo de sesión y hora.</p>
            </div>

            {loading || !feedUrl ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> Preparando tu conexión...
              </div>
            ) : (
              <div className="space-y-2">
                <Button asChild className="w-full h-12 rounded-xl text-[15px] font-semibold" onClick={markConnected}>
                  <a href={googleAddUrl!} target="_blank" rel="noreferrer">
                    Conectar Google Calendar
                  </a>
                </Button>
                <Button asChild variant="secondary" className="w-full h-12 rounded-xl text-[15px] font-semibold" onClick={markConnected}>
                  <a href={webcalUrl!}>Conectar iPhone / Mac</a>
                </Button>
                <p className="text-[12px] leading-snug text-muted-foreground">
                  Un toque, confirmás en tu calendario y listo para siempre. (Google puede
                  tardar unas horas en refrescar.)
                </p>
                <Button variant="ghost" size="sm" className="text-muted-foreground -ml-2" onClick={handleCopy}>
                  {copied ? <Check className="h-3.5 w-3.5 mr-2 text-emerald-500" /> : <Copy className="h-3.5 w-3.5 mr-2" />}
                  Copiar link (para agregarlo a mano)
                </Button>
              </div>
            )}

            {/* Opcional: que la agenda LEA su calendario y avise choques */}
            <div className="border-t border-border/60 pt-3.5">
              <button
                type="button"
                onClick={() => setExtOpen((v) => !v)}
                className="w-full flex items-center justify-between gap-3 text-left min-h-[44px]"
              >
                <div className="min-w-0">
                  <p className="text-sm font-semibold leading-tight">
                    ¿Que también te avise si chocás con algo tuyo?
                    <span className="ml-2 align-middle text-[10px] font-semibold uppercase tracking-wide text-muted-foreground bg-muted rounded-full px-2 py-0.5">
                      Opcional
                    </span>
                  </p>
                  <p className="mt-0.5 text-[12.5px] leading-snug text-muted-foreground">
                    ⚠️ Al agendar un paciente, te aviso si esa hora choca con algo de tu
                    calendario ("Dentista 15:00").
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
                <div className="mt-2.5 space-y-2.5">
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
                    <div className="rounded-xl bg-muted/40 p-3 text-[12.5px] leading-relaxed text-muted-foreground space-y-1.5">
                      <p>
                        <span className="font-medium text-foreground">Google Calendar (compu):</span>{" "}
                        Configuración → tu calendario → Integrar el calendario → copiá la
                        "Dirección secreta en formato iCal".
                      </p>
                      <p>
                        <span className="font-medium text-foreground">iPhone / iCloud:</span>{" "}
                        app Calendario → Calendarios → (i) junto a tu calendario → activá
                        "Calendario público" → Compartir enlace → copialo.
                      </p>
                      <p className="text-[11.5px]">
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
    </>
  );
};
