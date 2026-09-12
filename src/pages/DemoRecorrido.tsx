// El recorrido completo en 5 pasos, pensado para que se entienda SOLO:
// reserva → confirmación por WhatsApp → recordatorio automático → la agenda
// del profesional → la cita sincronizada en su Google Calendar. Todo ficticio,
// nada se guarda. Estética clara "Luz editorial", como la landing.
//
// Diseño: UNA sola pantalla, sin scroll — el stepper arriba, el contenido
// cambia en el mismo lugar (texto a la izquierda, visual a la derecha en
// escritorio; compacto en mobile). Se puede volver atrás con el botón Atrás
// o tocando un paso ya recorrido.
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft, ArrowRight, ArrowDown, Check, CalendarDays, MessageCircle, BellRing, LayoutDashboard, Video, Sparkles, RefreshCw } from "lucide-react";
import { WhatsAppPhone, buildDemoWaConfirmation, buildDemoWaReminder } from "@/components/demo/WhatsAppPhone";

const BRAND = "#1f938d";
const TEAL_DEEP = "#14655f";
const BG = "#fbfaf7";
const INK = "#16211c";
const MUTED = "#5b6a63";
const DIM = "#93a09a";

const tomorrow = new Date();
tomorrow.setDate(tomorrow.getDate() + 1);
const tomorrowEs = tomorrow.toLocaleDateString("es-UY", { weekday: "long", day: "numeric", month: "long" });

const SLOTS = ["10:00", "11:30", "14:00", "16:00", "17:30"];

const STEPS = [
  { icon: CalendarDays, label: "El paciente reserva" },
  { icon: MessageCircle, label: "Le llega la confirmación" },
  { icon: BellRing, label: "El recordatorio automático" },
  { icon: LayoutDashboard, label: "Vos lo ves en tu agenda" },
  { icon: RefreshCw, label: "Y en tu Google Calendar" },
];

const COPY: { title: string; body: string }[] = [
  {
    title: "Sofía encontró tu web y reserva sola",
    body: "Sin llamadas ni idas y vueltas por WhatsApp: elige un horario libre y confirma. Probalo vos:",
  },
  {
    title: "La confirmación le llega sola, al instante",
    body: "Apenas confirma la reserva, Sofía recibe el WhatsApp con el nombre de tu consultorio. Sin que toques nada.",
  },
  {
    title: "El recordatorio sale solo, cuando vos digas",
    body: "Vos elegís cuántas horas antes de la sesión se envía (24 hs antes, por ejemplo) y sale automático. Es lo que más baja las ausencias.",
  },
  {
    title: "Y en tu agenda ya está el turno",
    body: "Sin que hayas tocado nada. Así se ve tu día de mañana:",
  },
  {
    title: "Hasta en tu Google Calendar, solo",
    body: "La cita se sincronizó al instante con el calendario que ya usás. Cambiás algo allá, cambia acá. Ese es el truco: no tenés que cambiar de costumbres.",
  },
];

const NEXT_LABEL = [
  "¿Y ahora? Mirá el celular de Sofía",
  "¿Y antes de la sesión? El recordatorio",
  "¿Y vos qué ves? Tu agenda",
  "¿Y en tu calendario de siempre? Mirá",
];

const DemoRecorrido = () => {
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  // Paso 1: mini reserva
  const [slot, setSlot] = useState<string | null>(null);
  const [booked, setBooked] = useState(false);

  const chosenTime = slot ?? "16:00";
  const canAdvance = step !== 0 || booked;
  const last = STEPS.length - 1;

  return (
    <div className="h-dvh overflow-hidden flex flex-col" style={{ background: BG, color: INK, fontFamily: "'Instrument Sans', sans-serif" }}>
      {/* Top bar */}
      <div
        className="shrink-0 flex items-center justify-between gap-3 px-4 py-2.5"
        style={{ borderBottom: "1px solid rgba(22,33,28,0.08)", background: "rgba(251,250,247,0.88)", backdropFilter: "blur(12px)" }}
      >
        <Link to="/demo" className="inline-flex items-center gap-2 text-sm font-medium transition-opacity hover:opacity-70" style={{ color: MUTED }}>
          <ArrowLeft className="w-4 h-4" /> Volver a la demo
        </Link>
        <span className="inline-flex items-center gap-1.5 text-[11px] sm:text-xs font-semibold px-2.5 py-1 rounded-full" style={{ backgroundColor: "rgba(31,147,141,0.1)", color: TEAL_DEEP }}>
          <Sparkles className="w-3.5 h-3.5" /> Recorrido de 2 minutos
        </span>
      </div>

      <div className="flex-1 min-h-0 w-full max-w-5xl mx-auto px-4 sm:px-6 py-3 sm:py-5 flex flex-col">
        {/* Stepper: los pasos ya recorridos son clickeables para volver */}
        <div className="shrink-0 flex items-center justify-center gap-1.5 sm:gap-3 mb-3 sm:mb-5">
          {STEPS.map((s, i) => (
            <div key={s.label} className="flex items-center gap-1.5 sm:gap-3">
              <button
                type="button"
                onClick={() => i < step && setStep(i)}
                disabled={i >= step}
                className="flex flex-col items-center gap-1 disabled:cursor-default"
                title={i < step ? `Volver a "${s.label}"` : s.label}
              >
                <span
                  className="w-8 h-8 sm:w-9 sm:h-9 rounded-full flex items-center justify-center border transition-colors"
                  style={
                    i < step
                      ? { backgroundColor: BRAND, borderColor: BRAND, color: "#fff" }
                      : i === step
                        ? { borderColor: BRAND, color: TEAL_DEEP, backgroundColor: "rgba(31,147,141,0.08)" }
                        : { borderColor: "rgba(22,33,28,0.15)", color: DIM }
                  }
                >
                  {i < step ? <Check className="w-4 h-4" /> : <s.icon className="w-4 h-4" />}
                </span>
                <span className="hidden lg:block text-[11px]" style={{ color: i === step ? INK : DIM }}>{s.label}</span>
              </button>
              {i < STEPS.length - 1 && (
                <div className="w-4 sm:w-10 h-px lg:mb-4" style={{ backgroundColor: i < step ? BRAND : "rgba(22,33,28,0.12)" }} />
              )}
            </div>
          ))}
        </div>

        {/* Contenido: texto a la izquierda, visual a la derecha (desktop);
            apilado compacto en mobile. Todo cambia en el mismo lugar. */}
        <div className="flex-1 min-h-0 grid md:grid-cols-2 gap-4 md:gap-10 items-center">
          {/* Texto + navegación */}
          <div className="text-center md:text-left order-1">
            <h1 className="text-xl sm:text-2xl md:text-3xl font-bold mb-1.5 sm:mb-2" style={{ fontFamily: "'Space Grotesk', sans-serif", letterSpacing: "-0.02em" }}>{COPY[step].title}</h1>
            <p className="text-sm max-w-md mx-auto md:mx-0" style={{ color: MUTED }}>{COPY[step].body}</p>

            {/* Navegación (desktop: acá abajo; mobile: fila propia al final) */}
            <div className="hidden md:flex items-center gap-3 mt-7">
              {step > 0 && (
                <button
                  onClick={() => setStep(step - 1)}
                  className="inline-flex items-center gap-2 h-11 px-5 rounded-full text-sm font-semibold transition-colors hover:bg-black/[0.03]"
                  style={{ border: "1px solid rgba(22,33,28,0.16)", color: INK }}
                >
                  <ArrowLeft className="w-4 h-4" /> Atrás
                </button>
              )}
              {step < last ? (
                <button
                  onClick={() => canAdvance && setStep(step + 1)}
                  disabled={!canAdvance}
                  className="group inline-flex items-center gap-2 h-11 px-5 rounded-full text-sm font-semibold transition-opacity disabled:opacity-30 text-white"
                  style={{ backgroundColor: BRAND, boxShadow: "0 10px 24px -10px rgba(31,147,141,0.6)" }}
                >
                  {NEXT_LABEL[step]}
                  <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" />
                </button>
              ) : (
                <button
                  onClick={() => navigate("/demo")}
                  className="group inline-flex items-center gap-2 h-11 px-5 rounded-full text-sm font-semibold text-white"
                  style={{ backgroundColor: BRAND, boxShadow: "0 10px 24px -10px rgba(31,147,141,0.6)" }}
                >
                  Volver a la demo
                  <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" />
                </button>
              )}
            </div>
          </div>

          {/* Visual del paso */}
          <div className="order-2 min-h-0 flex items-center justify-center">
            {step === 0 && (
              <div className="w-full max-w-sm rounded-2xl bg-white p-4 sm:p-5 text-left" style={{ border: "1px solid rgba(22,33,28,0.09)", boxShadow: "0 24px 46px -28px rgba(22,33,28,0.2)" }}>
                {!booked ? (
                  <>
                    <p className="text-sm font-semibold mb-0.5">Sesión individual · 60 min</p>
                    <p className="text-xs capitalize mb-3" style={{ color: DIM }}>{tomorrowEs}</p>
                    {/* Guía: sin esto no se entiende que hay que tocar un horario */}
                    {!slot && (
                      <div className="flex items-center gap-1.5 mb-2 text-[13px] font-semibold" style={{ color: TEAL_DEEP }}>
                        <ArrowDown className="w-4 h-4 animate-bounce" />
                        Tocá un horario para empezar
                      </div>
                    )}
                    <div className="grid grid-cols-3 gap-2 mb-4">
                      {SLOTS.map((t) => (
                        <button
                          key={t}
                          onClick={() => setSlot(t)}
                          className="h-9 rounded-lg text-sm font-medium border transition-colors"
                          style={
                            slot === t
                              ? { backgroundColor: BRAND, borderColor: BRAND, color: "#fff" }
                              : { borderColor: "rgba(22,33,28,0.15)", color: INK }
                          }
                        >
                          {t}
                        </button>
                      ))}
                    </div>
                    <button
                      onClick={() => slot && setBooked(true)}
                      disabled={!slot}
                      className="w-full h-10 rounded-xl text-sm font-semibold transition-opacity disabled:opacity-40 text-white"
                      style={{ backgroundColor: BRAND }}
                    >
                      Confirmar reserva
                    </button>
                  </>
                ) : (
                  <div className="text-center py-2">
                    <div className="w-11 h-11 mx-auto rounded-full flex items-center justify-center mb-2.5" style={{ backgroundColor: "rgba(31,147,141,0.12)" }}>
                      <Check className="w-5 h-5" style={{ color: BRAND }} />
                    </div>
                    <p className="font-bold text-base mb-0.5">¡Reserva confirmada!</p>
                    <p className="text-sm capitalize" style={{ color: MUTED }}>{tomorrowEs} · {chosenTime} hs</p>
                  </div>
                )}
              </div>
            )}

            {step === 1 && (
              <WhatsAppPhone
                clinicName="Mente Clara"
                clinicInitials="MC"
                messages={[buildDemoWaConfirmation(chosenTime)]}
                animate
              />
            )}

            {step === 2 && (
              <WhatsAppPhone
                clinicName="Mente Clara"
                clinicInitials="MC"
                messages={[buildDemoWaConfirmation(chosenTime), buildDemoWaReminder(chosenTime)]}
                animate
                staticCount={1}
              />
            )}

            {step === 3 && (
              <div className="w-full max-w-sm rounded-2xl bg-white p-4 sm:p-5 text-left" style={{ border: "1px solid rgba(22,33,28,0.09)", boxShadow: "0 24px 46px -28px rgba(22,33,28,0.2)" }}>
                <p className="text-xs uppercase tracking-wider mb-2.5 capitalize" style={{ color: DIM }}>{tomorrowEs}</p>
                <div className="space-y-2">
                  {[
                    { time: "09:00", name: "María González", tag: null as string | null },
                    { time: "11:30", name: "Diego Martínez", tag: null },
                    { time: chosenTime, name: "Sofía Pereyra", tag: "Nueva · reservó online" },
                    { time: "18:00", name: "Valentina Méndez", tag: null },
                  ]
                    .sort((a, b) => a.time.localeCompare(b.time))
                    .map((apt) => (
                      <div
                        key={apt.time + apt.name}
                        className="flex items-center gap-3 rounded-xl px-3 py-2 border"
                        style={
                          apt.tag
                            ? { borderColor: BRAND, backgroundColor: "rgba(31,147,141,0.07)", boxShadow: "0 0 24px rgba(31,147,141,0.12)" }
                            : { borderColor: "rgba(22,33,28,0.09)" }
                        }
                      >
                        <span className="text-sm font-semibold tabular-nums w-12 shrink-0">{apt.time}</span>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium truncate m-0">{apt.name}</p>
                          {apt.tag && <p className="text-[11px] font-semibold m-0" style={{ color: TEAL_DEEP }}>{apt.tag}</p>}
                        </div>
                        <Video className="w-4 h-4 shrink-0" style={{ color: DIM }} />
                      </div>
                    ))}
                </div>
              </div>
            )}

            {step === 4 && (
              <div className="w-full max-w-sm rounded-2xl bg-white p-4 sm:p-5 text-left" style={{ border: "1px solid rgba(22,33,28,0.09)", boxShadow: "0 24px 46px -28px rgba(22,33,28,0.2)" }}>
                {/* Encabezado tipo Google Calendar, con el logo real */}
                <div className="flex items-center gap-2.5 pb-3 mb-3" style={{ borderBottom: "1px solid rgba(22,33,28,0.08)" }}>
                  <svg className="w-5 h-5" viewBox="0 0 48 48"><path fill="#EA4335" d="M24 9.5c3.5 0 6.7 1.2 9.2 3.6l6.9-6.9C35.9 2.4 30.5 0 24 0 14.6 0 6.5 5.4 2.6 13.2l8 6.2C12.4 13.7 17.7 9.5 24 9.5z" /><path fill="#4285F4" d="M47 24.6c0-1.6-.2-3.1-.4-4.6H24v9h12.9c-.6 3-2.3 5.5-4.8 7.2l7.7 6c4.5-4.2 7.2-10.3 7.2-17.6z" /><path fill="#FBBC05" d="M10.5 28.6a14.5 14.5 0 0 1 0-9.2l-8-6.2a24 24 0 0 0 0 21.6l8-6.2z" /><path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.7-6c-2.1 1.5-4.9 2.3-8.2 2.3-6.3 0-11.6-4.2-13.5-9.9l-8 6.2C6.5 42.6 14.6 48 24 48z" /></svg>
                  <span className="text-sm font-semibold">Tu Google Calendar</span>
                  <span className="ml-auto inline-flex items-center gap-1 text-[10.5px] font-semibold px-2 py-0.5 rounded-full" style={{ backgroundColor: "rgba(31,147,141,0.1)", color: TEAL_DEEP }}>
                    <RefreshCw className="w-3 h-3" /> Sincronizado
                  </span>
                </div>
                <p className="text-xs uppercase tracking-wider mb-2 capitalize" style={{ color: DIM }}>{tomorrowEs}</p>
                <div className="space-y-1.5">
                  <div className="rounded-lg px-3 py-2" style={{ backgroundColor: "rgba(22,33,28,0.05)", borderLeft: "3px solid #93a09a" }}>
                    <p className="text-[13px] font-medium m-0" style={{ color: MUTED }}>Almuerzo</p>
                    <p className="text-[11px] m-0" style={{ color: DIM }}>13:00 – 14:00 · tuyo, de siempre</p>
                  </div>
                  <div className="rounded-lg px-3 py-2" style={{ backgroundColor: "rgba(31,147,141,0.1)", borderLeft: `3px solid ${BRAND}`, boxShadow: "0 0 20px rgba(31,147,141,0.12)" }}>
                    <p className="text-[13px] font-semibold m-0">Sofía Pereyra — Sesión individual</p>
                    <p className="text-[11px] m-0" style={{ color: TEAL_DEEP }}>{chosenTime} hs · recién sincronizada desde tu agenda ⚡</p>
                  </div>
                  <div className="rounded-lg px-3 py-2" style={{ backgroundColor: "rgba(22,33,28,0.05)", borderLeft: "3px solid #93a09a" }}>
                    <p className="text-[13px] font-medium m-0" style={{ color: MUTED }}>Gimnasio</p>
                    <p className="text-[11px] m-0" style={{ color: DIM }}>19:30 – 20:30 · tuyo, de siempre</p>
                  </div>
                </div>
                <p className="text-[11.5px] mt-3 mb-0 leading-snug" style={{ color: DIM }}>
                  Funciona igual con el calendario del iPhone. Y si borrás la cita allá, se refleja acá.
                </p>
              </div>
            )}
          </div>

          {/* Navegación mobile: siempre visible abajo, sin scroll */}
          <div className="order-3 md:hidden flex items-center justify-center gap-2.5 pb-1">
            {step > 0 && (
              <button
                onClick={() => setStep(step - 1)}
                className="inline-flex items-center justify-center gap-1.5 h-11 px-4 rounded-full text-sm font-semibold"
                style={{ border: "1px solid rgba(22,33,28,0.16)", color: INK }}
              >
                <ArrowLeft className="w-4 h-4" /> Atrás
              </button>
            )}
            {step < last ? (
              <button
                onClick={() => canAdvance && setStep(step + 1)}
                disabled={!canAdvance}
                className="flex-1 max-w-xs inline-flex items-center justify-center gap-2 h-11 px-4 rounded-full text-sm font-semibold transition-opacity disabled:opacity-30 text-white"
                style={{ backgroundColor: BRAND }}
              >
                Siguiente <ArrowRight className="w-4 h-4" />
              </button>
            ) : (
              <button
                onClick={() => navigate("/demo")}
                className="flex-1 max-w-xs inline-flex items-center justify-center gap-2 h-11 px-4 rounded-full text-sm font-semibold text-white"
                style={{ backgroundColor: BRAND }}
              >
                Volver a la demo <ArrowRight className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default DemoRecorrido;
