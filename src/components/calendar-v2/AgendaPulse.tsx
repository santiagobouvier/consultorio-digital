// El "pulso" del día: tres piezas vivas que hacen que la agenda se sienta
// un producto premium y no una planilla.
//  - AgendaHero: saludo con nombre + resumen de HOY con degradado de marca.
//  - InProgressCard: tarjeta flotante mientras hay una sesión en curso.
//  - DayCompleteCelebration: festejo de fin de día (una vez por día).
// Todas comparten la misma consulta liviana de las citas de hoy; la clave
// arranca con "appointments" para que la invalidación central la refresque.
import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { useDashboardBranding } from "@/contexts/DashboardBrandingContext";
import { cn } from "@/lib/utils";
import { PartyPopper, ChevronRight } from "lucide-react";

const CANCELLED = ["cancelled", "cancelled_by_patient"];

interface PulseAppointment {
  id: string;
  start_at: string;
  end_at: string;
  status: string;
  patients: { full_name: string } | null;
}

export const useTodayPulse = (businessId: string | null | undefined) => {
  const todayStr = format(new Date(), "yyyy-MM-dd");
  const { data: appointments = [] } = useQuery({
    queryKey: ["appointments", businessId, "today-pulse", todayStr],
    queryFn: async (): Promise<PulseAppointment[]> => {
      const { data, error } = await supabase
        .from("appointments")
        .select("id, start_at, end_at, status, patients(full_name)")
        .eq("business_id", businessId!)
        .gte("start_at", new Date(`${todayStr}T00:00:00`).toISOString())
        .lte("start_at", new Date(`${todayStr}T23:59:59`).toISOString())
        .order("start_at", { ascending: true });
      if (error) throw error;
      return (data as unknown as PulseAppointment[]) || [];
    },
    enabled: !!businessId,
    staleTime: 30_000,
    refetchInterval: 120_000,
  });
  return appointments;
};

/** Reloj compartido: un tick por minuto para "en curso" y progreso. */
const useMinuteTick = () => {
  const [tick, setTick] = useState(() => Date.now());
  useEffect(() => {
    const t = window.setInterval(() => setTick(Date.now()), 30_000);
    return () => window.clearInterval(t);
  }, []);
  return tick;
};

// ─────────────────────────────────────────────────────────────
// Hero: saludo + resumen del día
// ─────────────────────────────────────────────────────────────
export const AgendaHero = ({ appointments }: { appointments: PulseAppointment[] }) => {
  const { primaryColor } = useDashboardBranding();
  const tick = useMinuteTick();

  const { data: firstName = "" } = useQuery({
    queryKey: ["hero-profile-name"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return "";
      const { data } = await supabase
        .from("profiles")
        .select("name")
        .eq("id", user.id)
        .maybeSingle();
      return (data?.name ?? "").trim().split(/\s+/)[0] ?? "";
    },
    staleTime: 10 * 60_000,
  });

  const hour = new Date(tick).getHours();
  const greeting =
    hour < 12 ? "Buen día" : hour < 19 ? "Buenas tardes" : "Buenas noches";
  const emoji = hour < 12 ? "☀️" : hour < 19 ? "🌤️" : "🌙";

  const active = appointments.filter((a) => !CANCELLED.includes(a.status));
  const attended = active.filter((a) => a.status === "attended").length;
  const upcoming = active.filter((a) => new Date(a.start_at).getTime() > tick);
  const allDone = active.length > 0 && attended === active.length;

  let summary: string;
  if (active.length === 0) {
    summary = "Hoy no tenés pacientes — día libre 🙌";
  } else if (allDone) {
    summary = `Terminaste por hoy: ${attended} de ${active.length} atendidos ✨`;
  } else if (upcoming.length > 0) {
    const next = upcoming[0];
    const who = next.patients?.full_name?.split(/\s+/)[0];
    summary =
      `Hoy: ${active.length} paciente${active.length !== 1 ? "s" : ""}` +
      ` · ${upcoming.length === active.length ? "el primero" : "el próximo"}${who ? ` (${who})` : ""} a las ${format(new Date(next.start_at), "HH:mm")}`;
  } else {
    summary = `Hoy: ${active.length} paciente${active.length !== 1 ? "s" : ""}`;
  }

  const progress = active.length > 0 ? attended / active.length : 0;

  // Minimalista: una sola línea fina, sin caja. El dato respira, no grita.
  return (
    <div className="flex items-center gap-2.5 min-w-0">
      <span
        className="h-1.5 w-1.5 rounded-full shrink-0"
        style={{ background: `hsl(${primaryColor})` }}
        aria-hidden
      />
      <p className="text-[13px] text-muted-foreground truncate">
        <span className="font-semibold text-foreground">
          {greeting}
          {firstName ? `, ${firstName}` : ""} {emoji}
        </span>
        <span className="mx-1.5 opacity-50">·</span>
        {summary}
      </p>
      {active.length > 0 && attended > 0 && !allDone && (
        <span className="ml-auto shrink-0 flex items-center gap-1.5">
          <span className="h-1 w-12 rounded-full bg-foreground/10 overflow-hidden">
            <span
              className="block h-full rounded-full transition-all duration-700"
              style={{ width: `${progress * 100}%`, background: `hsl(${primaryColor})` }}
            />
          </span>
          <span className="text-[10px] font-semibold text-muted-foreground tabular-nums">
            {attended}/{active.length}
          </span>
        </span>
      )}
    </div>
  );
};

// ─────────────────────────────────────────────────────────────
// Tarjeta flotante "En sesión"
// ─────────────────────────────────────────────────────────────
export const InProgressCard = ({
  appointments,
  onOpen,
}: {
  appointments: PulseAppointment[];
  onOpen: () => void;
}) => {
  const { primaryColor } = useDashboardBranding();
  const tick = useMinuteTick();

  const current = useMemo(
    () =>
      appointments.find(
        (a) =>
          !CANCELLED.includes(a.status) &&
          a.status !== "attended" &&
          new Date(a.start_at).getTime() <= tick &&
          tick < new Date(a.end_at).getTime()
      ) ?? null,
    [appointments, tick]
  );

  if (!current) return null;

  const start = new Date(current.start_at).getTime();
  const end = new Date(current.end_at).getTime();
  const progress = Math.min(Math.max((tick - start) / (end - start), 0), 1);
  const name = current.patients?.full_name?.split(/\s+/)[0] ?? "Paciente";

  return (
    <button
      onClick={onOpen}
      className={cn(
        "fixed z-40 flex items-center gap-2.5 rounded-full border border-border/60 bg-card/95 backdrop-blur-md",
        "pl-3 pr-2 py-2 shadow-xl transition-transform active:scale-[0.97]",
        "bottom-[calc(env(safe-area-inset-bottom,0px)+5.5rem)] left-1/2 -translate-x-1/2",
        "md:bottom-8 md:left-auto md:right-24 md:translate-x-0",
        "animate-in fade-in slide-in-from-bottom-3"
      )}
      style={{ boxShadow: `0 12px 32px -12px hsla(${primaryColor}, 0.55)` }}
    >
      <span className="relative flex h-2.5 w-2.5 shrink-0">
        <span
          className="absolute inline-flex h-full w-full animate-ping rounded-full opacity-60"
          style={{ background: `hsl(${primaryColor})` }}
        />
        <span
          className="relative inline-flex h-2.5 w-2.5 rounded-full"
          style={{ background: `hsl(${primaryColor})` }}
        />
      </span>
      <span className="text-left">
        <span className="block text-[12.5px] font-semibold leading-tight">
          En sesión: {name}
        </span>
        <span className="block text-[10.5px] text-muted-foreground leading-tight tabular-nums">
          termina {format(new Date(current.end_at), "HH:mm")}
        </span>
        <span className="mt-1 block h-[3px] w-full rounded-full bg-foreground/10 overflow-hidden">
          <span
            className="block h-full rounded-full transition-all duration-1000"
            style={{ width: `${progress * 100}%`, background: `hsl(${primaryColor})` }}
          />
        </span>
      </span>
      <ChevronRight className="h-4 w-4 text-muted-foreground/60 shrink-0" />
    </button>
  );
};

// ─────────────────────────────────────────────────────────────
// Festejo de día completo (una vez por día, por consultorio)
// ─────────────────────────────────────────────────────────────
export const DayCompleteCelebration = ({
  businessId,
  appointments,
}: {
  businessId: string | null | undefined;
  appointments: PulseAppointment[];
}) => {
  const [show, setShow] = useState(false);
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!businessId) return;
    const active = appointments.filter((a) => !CANCELLED.includes(a.status));
    const attended = active.filter((a) => a.status === "attended").length;
    if (active.length < 2 || attended !== active.length) return;

    const key = `day-complete-${businessId}-${format(new Date(), "yyyy-MM-dd")}`;
    try {
      if (localStorage.getItem(key)) return;
      localStorage.setItem(key, "1");
    } catch {
      return;
    }
    setCount(active.length);
    setShow(true);
    const t = window.setTimeout(() => setShow(false), 4500);
    return () => window.clearTimeout(t);
  }, [businessId, appointments]);

  if (!show) return null;

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center pointer-events-none">
      <style>{`
        @keyframes celebFloat {
          0%   { transform: translateY(0) rotate(0deg); opacity: 0; }
          15%  { opacity: 1; }
          100% { transform: translateY(-90px) rotate(24deg); opacity: 0; }
        }
      `}</style>
      <div className="relative rounded-3xl border bg-card px-8 py-6 text-center shadow-2xl animate-in zoom-in-90 fade-in duration-300">
        {["🎉", "✨", "🎊", "💚", "⭐"].map((e, i) => (
          <span
            key={i}
            className="absolute text-xl"
            style={{
              left: `${12 + i * 18}%`,
              top: "-8px",
              animation: `celebFloat 2.4s ease-out ${i * 0.25}s infinite`,
            }}
            aria-hidden
          >
            {e}
          </span>
        ))}
        <PartyPopper className="mx-auto h-9 w-9 text-primary" />
        <p className="mt-2 text-lg font-bold">¡Día completo!</p>
        <p className="text-sm text-muted-foreground">
          {count} de {count} pacientes atendidos. Enorme. 👏
        </p>
      </div>
    </div>
  );
};
