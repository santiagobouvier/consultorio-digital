// "Un día con Consultorio Digital": el scroll cuenta la jornada real de un
// profesional — recordatorio → sesión con ficha → cobro → reserva que entra
// sola → almuerzo sincronizado → cierre del día. Cada escena usa piezas de la
// interfaz real (bloques de agenda, fichas, estados de pago, notificaciones).
//
// Escritorio: escenario fijo (sticky) a la izquierda que se transforma
// mientras los pasos pasan a la derecha. Mobile/tablet: línea de tiempo
// vertical con las escenas entrando en profundidad — composición propia,
// no el escritorio apilado. Con prefers-reduced-motion todo se muestra
// sin animaciones.
import { useEffect, useMemo, useRef, useState } from "react";
import { Check } from "lucide-react";

// Paleta (la misma de la landing, verde refinado)
const GREEN = "#2fb583";
const BRAND = "#1f938d";
const GREEN_SOFT = "#7ce0b8";
const INK = "#04120c";
const MUTED = "#8fa39a";
const SOFT = "#c6d4cd";
const DIM = "#5c6f66";
const CARD = "linear-gradient(180deg,#0c1310,#080d0b)";
const GROTESK = { fontFamily: "'Space Grotesk', sans-serif" } as const;

const reducedMotion = () =>
  typeof window !== "undefined" &&
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/* ─────────────────────────── Escenas (UI real en miniatura) ─────────────────────────── */

const SceneShell = ({ children }: { children: React.ReactNode }) => (
  <div
    className="rounded-3xl p-5 sm:p-6 w-full"
    style={{ background: CARD, border: "1px solid rgba(47,181,131,.14)", boxShadow: "0 30px 80px -40px rgba(0,0,0,.8)" }}
  >
    {children}
  </div>
);

const Pill = ({ children, tone = "green" }: { children: React.ReactNode; tone?: "green" | "amber" | "dim" }) => (
  <span
    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10.5px] font-semibold whitespace-nowrap"
    style={
      tone === "green"
        ? { background: "rgba(47,181,131,.1)", border: "1px solid rgba(47,181,131,.3)", color: GREEN_SOFT }
        : tone === "amber"
          ? { background: "rgba(251,191,36,.1)", border: "1px solid rgba(251,191,36,.3)", color: "#fcd34d" }
          : { background: "rgba(255,255,255,.05)", border: "1px solid rgba(255,255,255,.1)", color: MUTED }
    }
  >
    {children}
  </span>
);

const SceneRecordatorio = () => (
  <SceneShell>
    <p className="m-0 text-xs font-semibold uppercase" style={{ ...GROTESK, letterSpacing: ".12em", color: DIM }}>WhatsApp · automático</p>
    <div className="mt-3 rounded-2xl rounded-tl-md p-4" style={{ background: "#0f1f18", border: "1px solid rgba(47,181,131,.18)" }}>
      <p className="m-0 text-[13px] leading-relaxed" style={{ color: SOFT }}>
        Hola Camila, te recordamos tu sesión de <b style={{ color: "#f2f7f4" }}>hoy 09:00</b> en Consultorio García.
        Si necesitás reprogramar, escribinos.
      </p>
    </div>
    <div className="mt-3 flex items-center gap-2 flex-wrap">
      <Pill>Enviado · sin mover un dedo</Pill>
      <Pill tone="dim">respaldo por email</Pill>
    </div>
  </SceneShell>
);

const SceneSesion = () => (
  <SceneShell>
    <div className="flex items-center gap-3 px-3.5 py-3 rounded-xl" style={{ background: "rgba(47,181,131,.09)", borderLeft: `3px solid ${GREEN}` }}>
      <span className="text-[13px] font-bold tabular-nums" style={{ ...GROTESK, color: GREEN_SOFT }}>09:00</span>
      <span className="text-[13.5px] font-semibold" style={{ color: "#f2f7f4" }}>Camila S. · Sesión individual</span>
      <span className="ml-auto"><Pill>EN CURSO</Pill></span>
    </div>
    <div className="mt-3 rounded-2xl p-4" style={{ background: "rgba(255,255,255,.03)", border: "1px solid rgba(255,255,255,.07)" }}>
      <p className="m-0 text-xs font-semibold uppercase" style={{ ...GROTESK, letterSpacing: ".12em", color: DIM }}>Ficha de Camila</p>
      <div className="mt-2 flex flex-col gap-1.5 text-[12.5px]" style={{ color: MUTED }}>
        <span>12 sesiones · al día con los pagos</span>
        <span>Última nota: <i style={{ color: SOFT }}>"Avance sostenido, retomar registro de sueño"</i></span>
        <span style={{ color: GREEN_SOFT }}>Nota de hoy: guardada en el expediente ✓</span>
      </div>
    </div>
  </SceneShell>
);

const SceneCobro = () => (
  <SceneShell>
    <p className="m-0 text-xs font-semibold uppercase" style={{ ...GROTESK, letterSpacing: ".12em", color: DIM }}>Pagos</p>
    <div className="mt-3 flex items-center gap-3 px-3.5 py-3 rounded-xl" style={{ background: "rgba(255,255,255,.03)", border: "1px solid rgba(255,255,255,.07)" }}>
      <span className="flex items-center justify-center w-9 h-9 rounded-full text-[12px] font-semibold shrink-0" style={{ ...GROTESK, background: "rgba(47,181,131,.12)", color: GREEN_SOFT }}>CS</span>
      <div className="min-w-0">
        <p className="m-0 text-[13.5px] font-semibold" style={{ color: "#f2f7f4" }}>Camila Suárez</p>
        <p className="m-0 text-[11.5px]" style={{ color: MUTED }}>Sesión de hoy · link de Mercado Pago</p>
      </div>
      <div className="ml-auto text-right">
        <p className="m-0 text-[15px] font-bold" style={{ ...GROTESK, color: "#f2f7f4" }}>$ 1.300</p>
        <Pill>Pagada</Pill>
      </div>
    </div>
    <div className="mt-3 flex items-center gap-2 px-3.5 py-2.5 rounded-xl" style={{ background: "rgba(47,181,131,.07)", border: "1px solid rgba(47,181,131,.2)" }}>
      <Check className="w-3.5 h-3.5 shrink-0" style={{ color: GREEN }} strokeWidth={2.6} />
      <span className="text-[12px]" style={{ color: SOFT }}>Pago acreditado — se marcó solo. Si vencía, el sistema lo reclamaba.</span>
    </div>
  </SceneShell>
);

const SceneReserva = () => (
  <SceneShell>
    <div className="flex items-start gap-3 rounded-2xl p-4" style={{ background: "rgba(47,181,131,.07)", border: "1px solid rgba(47,181,131,.22)" }}>
      <span className="flex items-center justify-center w-9 h-9 rounded-xl shrink-0" style={{ background: "rgba(47,181,131,.14)", color: GREEN }}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="3" y="4" width="18" height="18" rx="3" /><path d="M16 2v4M8 2v4M3 10h18" /></svg>
      </span>
      <div>
        <p className="m-0 text-[13px] font-semibold" style={{ color: "#f2f7f4" }}>Nueva reserva desde tu link</p>
        <p className="m-0 mt-0.5 text-[12px]" style={{ color: MUTED }}>Andrés S. eligió <b style={{ color: GREEN_SOFT }}>jueves 15:00</b> — un horario que de verdad tenías libre.</p>
      </div>
    </div>
    <div className="mt-3 flex items-center gap-3 px-3.5 py-3 rounded-xl" style={{ background: "rgba(255,255,255,.03)", borderLeft: `3px solid ${BRAND}` }}>
      <span className="text-[13px] font-bold tabular-nums" style={{ ...GROTESK, color: MUTED }}>15:00</span>
      <span className="text-[13.5px]" style={{ color: SOFT }}>Andrés S. · confirmada</span>
      <span className="ml-auto"><Pill tone="dim">→ ya está en tu Google Calendar</Pill></span>
    </div>
  </SceneShell>
);

const SceneAlmuerzo = () => (
  <SceneShell>
    <p className="m-0 text-xs font-semibold uppercase" style={{ ...GROTESK, letterSpacing: ".12em", color: DIM }}>Tu calendario personal</p>
    <div className="mt-3 flex items-center gap-3 px-3.5 py-3 rounded-xl" style={{ background: "rgba(255,255,255,.03)", borderLeft: "3px solid #4285F4" }}>
      <span className="flex items-center justify-center w-6 h-6 rounded-full bg-white shrink-0">
        <svg width="12" height="12" viewBox="0 0 48 48"><path fill="#EA4335" d="M24 9.5c3.5 0 6.7 1.2 9.2 3.6l6.9-6.9C35.9 2.4 30.5 0 24 0 14.6 0 6.5 5.4 2.6 13.2l8 6.2C12.4 13.7 17.7 9.5 24 9.5z" /><path fill="#4285F4" d="M47 24.6c0-1.6-.2-3.1-.4-4.6H24v9h12.9c-.6 3-2.3 5.5-4.8 7.2l7.7 6c4.5-4.2 7.2-10.3 7.2-17.6z" /><path fill="#FBBC05" d="M10.5 28.6a14.5 14.5 0 0 1 0-9.2l-8-6.2a24 24 0 0 0 0 21.6l8-6.2z" /><path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.7-6c-2.1 1.5-4.9 2.3-8.2 2.3-6.3 0-11.6-4.2-13.5-9.9l-8 6.2C6.5 42.6 14.6 48 24 48z" /></svg>
      </span>
      <span className="text-[13.5px]" style={{ color: SOFT }}>Almuerzo · 13:00 – 14:00</span>
      <span className="ml-auto"><Pill tone="dim">desde tu Google Calendar</Pill></span>
    </div>
    <div className="mt-3 flex items-center gap-2 px-3.5 py-2.5 rounded-xl" style={{ background: "rgba(255,255,255,.03)", border: "1px dashed rgba(255,255,255,.12)" }}>
      <span className="text-[12px]" style={{ color: MUTED }}>Esa hora quedó bloqueada: nadie puede reservarte encima de lo tuyo.</span>
    </div>
  </SceneShell>
);

const SceneCierre = () => (
  <SceneShell>
    <p className="m-0 text-xs font-semibold uppercase" style={{ ...GROTESK, letterSpacing: ".12em", color: DIM }}>Estadísticas · hoy</p>
    <div className="mt-3 grid grid-cols-3 gap-2">
      {[
        ["$ 4.600", "cobrado", GREEN_SOFT],
        ["5", "sesiones", "#f2f7f4"],
        ["0", "ausencias", "#f2f7f4"],
      ].map(([v, l, c]) => (
        <div key={l as string} className="rounded-xl px-3 py-3 text-center" style={{ background: "rgba(255,255,255,.03)", border: "1px solid rgba(255,255,255,.07)" }}>
          <p className="m-0 text-[17px] font-bold" style={{ ...GROTESK, color: c as string }}>{v}</p>
          <p className="m-0 text-[10px] uppercase" style={{ ...GROTESK, letterSpacing: ".1em", color: DIM }}>{l}</p>
        </div>
      ))}
    </div>
    <div className="mt-3 h-1.5 rounded-full overflow-hidden" style={{ background: "rgba(47,181,131,.1)" }}>
      <div className="h-full rounded-full" style={{ width: "88%", background: `linear-gradient(90deg, ${GREEN}, ${BRAND})` }} />
    </div>
    <p className="m-0 mt-2 text-[11.5px]" style={{ color: DIM }}>Tasa de cobranza del día — sin planillas, sin cuentas a mano.</p>
  </SceneShell>
);

/* ─────────────────────────── Pasos de la jornada ─────────────────────────── */

const STEPS = [
  {
    time: "08:55",
    title: "El recordatorio ya salió",
    text: "Todavía no llegaste al consultorio y tus pacientes de hoy ya recibieron el recordatorio por WhatsApp. Nadie se olvida de su sesión — y vos no mandaste ni un mensaje.",
    Scene: SceneRecordatorio,
  },
  {
    time: "09:00",
    title: "La sesión, con la ficha al lado",
    text: "Tocás la cita y aparece todo lo de Camila: cuántas sesiones lleva, qué anotaste la vez pasada y cómo viene con los pagos. Terminás, escribís la nota, y queda guardada.",
    Scene: SceneSesion,
  },
  {
    time: "10:30",
    title: "El cobro se acredita solo",
    text: "Camila pagó desde el link que le mandó el sistema, y el pago se marcó solo. Y si alguien se atrasa, no lo perseguís vos: lo reclama el sistema.",
    Scene: SceneCobro,
  },
  {
    time: "12:40",
    title: "Una reserva entra sola",
    text: "Mientras vos atendías, un paciente entró a tu link, vio tus horarios libres de verdad y eligió uno. La cita ya está en tu agenda y en tu Google Calendar.",
    Scene: SceneReserva,
  },
  {
    time: "13:00",
    title: "Lo tuyo también cuenta",
    text: "Anotaste el almuerzo en tu iPhone y acá apareció al instante. Esa hora queda protegida: nadie puede reservarte encima de tu vida.",
    Scene: SceneAlmuerzo,
  },
  {
    time: "20:00",
    title: "El día, cerrado",
    text: "Cuánto cobraste, cuántas sesiones diste, quién te quedó debiendo. El día se rinde solo — sin planillas, sin cuentas a mano. Y mañana arranca igual.",
    Scene: SceneCierre,
  },
];

/* ─────────────────────────── Componente ─────────────────────────── */

export function DayJourney() {
  const [active, setActive] = useState(0);
  const stepRefs = useRef<Array<HTMLDivElement | null>>([]);
  const reduce = useMemo(() => reducedMotion(), []);

  // El paso activo es el que cruza el centro de la pantalla (solo escritorio).
  useEffect(() => {
    if (reduce) return;
    const obs = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            const idx = Number((e.target as HTMLElement).dataset.step);
            if (!Number.isNaN(idx)) setActive(idx);
          }
        }
      },
      { rootMargin: "-45% 0px -45% 0px" }
    );
    stepRefs.current.forEach((el) => el && obs.observe(el));
    return () => obs.disconnect();
  }, [reduce]);

  return (
    <section
      className="relative px-5 sm:px-8 py-16 lg:py-24 z-10"
      style={{ background: "#070b09", borderTop: "1px solid rgba(255,255,255,.05)" }}
    >
      <div className="max-w-6xl mx-auto">
        <div className="max-w-2xl">
          <span className="text-[11px] sm:text-xs font-semibold uppercase" style={{ ...GROTESK, letterSpacing: "0.16em", color: GREEN }}>
            Un día con Consultorio Digital
          </span>
          <h2 className="mt-3 text-[30px] leading-[1.1] sm:text-5xl font-bold tracking-tight text-white" style={{ ...GROTESK, letterSpacing: "-0.025em" }}>
            Un día entero, trabajando solo.
          </h2>
          <p className="mt-4 text-[14.5px] sm:text-base leading-relaxed" style={{ color: MUTED }}>
            Seguí el reloj: esto es lo que hace el sistema por vos en una jornada normal, mientras vos solo atendés.
          </p>
        </div>

        {/* ── Escritorio: escenario sticky + pasos que avanzan ── */}
        <div className="hidden lg:flex mt-14 gap-16 items-start">
          <div className="w-[46%] sticky top-28 self-start">
            <div className="relative" style={{ minHeight: 340 }}>
              {STEPS.map(({ Scene }, i) => {
                const isOn = i === active;
                const passed = i < active;
                return (
                  <div
                    key={i}
                    className="absolute inset-x-0 top-0"
                    aria-hidden={!isOn}
                    style={{
                      opacity: isOn ? 1 : 0,
                      transform: reduce
                        ? "none"
                        : isOn
                          ? "translateY(0) scale(1)"
                          : passed
                            ? "translateY(-26px) scale(.96)"
                            : "translateY(26px) scale(.96)",
                      transition: reduce ? "none" : "opacity .55s cubic-bezier(.16,1,.3,1), transform .55s cubic-bezier(.16,1,.3,1)",
                      pointerEvents: isOn ? "auto" : "none",
                    }}
                  >
                    <Scene />
                  </div>
                );
              })}
            </div>
            {/* Reloj de la jornada */}
            <div className="mt-6 flex items-center gap-3">
              <span className="text-[26px] font-bold tabular-nums" style={{ ...GROTESK, color: GREEN_SOFT }}>{STEPS[active].time}</span>
              <div className="flex-1 h-1 rounded-full overflow-hidden" style={{ background: "rgba(47,181,131,.12)" }}>
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${((active + 1) / STEPS.length) * 100}%`,
                    background: `linear-gradient(90deg, ${GREEN}, ${BRAND})`,
                    transition: reduce ? "none" : "width .5s cubic-bezier(.16,1,.3,1)",
                  }}
                />
              </div>
            </div>
          </div>
          <div className="flex-1">
            {STEPS.map((s, i) => (
              <div
                key={i}
                ref={(el) => (stepRefs.current[i] = el)}
                data-step={i}
                className="flex items-center"
                style={{ minHeight: "62vh" }}
              >
                <div
                  style={{
                    opacity: reduce || i === active ? 1 : 0.35,
                    transition: reduce ? "none" : "opacity .4s ease",
                  }}
                >
                  <span
                    className="inline-flex px-3 py-1 rounded-full text-xs font-bold tabular-nums"
                    style={{ ...GROTESK, background: "rgba(47,181,131,.1)", border: "1px solid rgba(47,181,131,.28)", color: GREEN_SOFT }}
                  >
                    {s.time}
                  </span>
                  <h3 className="mt-3 mb-0 text-[26px] font-bold tracking-tight text-white" style={{ ...GROTESK, letterSpacing: "-0.02em" }}>
                    {s.title}
                  </h3>
                  <p className="mt-3 mb-0 text-[15px] leading-relaxed max-w-md" style={{ color: MUTED }}>{s.text}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ── Mobile / tablet: línea de tiempo vertical propia ── */}
        <div className="lg:hidden mt-10 relative">
          <div className="absolute left-[17px] top-2 bottom-2 w-px" style={{ background: "rgba(47,181,131,.18)" }} aria-hidden />
          <div className="flex flex-col gap-9">
            {STEPS.map((s, i) => (
              <div key={i} className="relative pl-12">
                <span
                  className="absolute left-0 top-0 flex items-center justify-center w-9 h-9 rounded-full text-[10px] font-bold tabular-nums"
                  style={{ ...GROTESK, background: "#0c1310", border: "1px solid rgba(47,181,131,.3)", color: GREEN_SOFT }}
                >
                  {s.time}
                </span>
                <MobileStep index={i}>
                  <h3 className="m-0 text-[19px] font-bold tracking-tight text-white" style={{ ...GROTESK, letterSpacing: "-0.02em" }}>{s.title}</h3>
                  <p className="mt-2 mb-4 text-[13.5px] leading-relaxed" style={{ color: MUTED }}>{s.text}</p>
                  <s.Scene />
                </MobileStep>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

// Entrada con profundidad para cada paso en mobile (IntersectionObserver,
// una sola vez; sin animación si el sistema pide menos movimiento).
function MobileStep({ index, children }: { index: number; children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const [seen, setSeen] = useState(() => reducedMotion());

  useEffect(() => {
    if (seen || !ref.current) return;
    const obs = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) {
          setSeen(true);
          obs.disconnect();
        }
      },
      { rootMargin: "0px 0px -12% 0px" }
    );
    obs.observe(ref.current);
    return () => obs.disconnect();
  }, [seen]);

  return (
    <div
      ref={ref}
      style={{
        opacity: seen ? 1 : 0,
        transform: seen ? "none" : "translateY(26px) scale(.98)",
        transition: `opacity .7s cubic-bezier(.16,1,.3,1) ${Math.min(index * 40, 120)}ms, transform .7s cubic-bezier(.16,1,.3,1) ${Math.min(index * 40, 120)}ms`,
      }}
    >
      {children}
    </div>
  );
}
