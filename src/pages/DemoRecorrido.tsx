// El recorrido completo en 4 pasos, pensado para que se entienda SOLO:
// reserva → confirmación por WhatsApp → recordatorio automático → la agenda
// del profesional. Todo ficticio, nada se guarda.
//
// Diseño: UNA sola pantalla, sin scroll — el stepper arriba, el contenido
// cambia en el mismo lugar (texto a la izquierda, visual a la derecha en
// escritorio; compacto en mobile). Se puede volver atrás con el botón Atrás
// o tocando un paso ya recorrido.
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft, ArrowRight, ArrowDown, Check, CalendarDays, MessageCircle, BellRing, LayoutDashboard, Video, Sparkles } from "lucide-react";
import { WhatsAppPhone, buildDemoWaConfirmation, buildDemoWaReminder } from "@/components/demo/WhatsAppPhone";

const BRAND = "#00c78a";

const tomorrow = new Date();
tomorrow.setDate(tomorrow.getDate() + 1);
const tomorrowEs = tomorrow.toLocaleDateString("es-UY", { weekday: "long", day: "numeric", month: "long" });

const SLOTS = ["10:00", "11:30", "14:00", "16:00", "17:30"];

const STEPS = [
  { icon: CalendarDays, label: "El paciente reserva" },
  { icon: MessageCircle, label: "Le llega la confirmación" },
  { icon: BellRing, label: "El recordatorio automático" },
  { icon: LayoutDashboard, label: "Vos lo ves en tu agenda" },
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
];

const NEXT_LABEL = [
  "¿Y ahora? Mirá el celular de Sofía",
  "¿Y antes de la sesión? El recordatorio",
  "¿Y vos qué ves? Tu agenda",
];

const DemoRecorrido = () => {
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  // Paso 1: mini reserva
  const [slot, setSlot] = useState<string | null>(null);
  const [booked, setBooked] = useState(false);

  const chosenTime = slot ?? "16:00";
  const canAdvance = step !== 0 || booked;

  return (
    <div className="h-dvh overflow-hidden bg-black text-white flex flex-col">
      {/* Top bar */}
      <div className="shrink-0 flex items-center justify-between gap-3 px-4 py-2.5 border-b border-white/10 bg-black/85 backdrop-blur-md">
        <Link to="/demo" className="inline-flex items-center gap-2 text-sm text-white/70 hover:text-white transition-colors">
          <ArrowLeft className="w-4 h-4" /> Volver a la demo
        </Link>
        <span className="inline-flex items-center gap-1.5 text-[11px] sm:text-xs font-medium px-2.5 py-1 rounded-full" style={{ backgroundColor: "rgba(0,199,138,0.12)", color: BRAND }}>
          <Sparkles className="w-3.5 h-3.5" /> Recorrido de 2 minutos
        </span>
      </div>

      <div className="flex-1 min-h-0 w-full max-w-5xl mx-auto px-4 sm:px-6 py-3 sm:py-5 flex flex-col">
        {/* Stepper: los pasos ya recorridos son clickeables para volver */}
        <div className="shrink-0 flex items-center justify-center gap-2 sm:gap-3 mb-3 sm:mb-5">
          {STEPS.map((s, i) => (
            <div key={s.label} className="flex items-center gap-2 sm:gap-3">
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
                      ? { backgroundColor: BRAND, borderColor: BRAND, color: "#000" }
                      : i === step
                        ? { borderColor: BRAND, color: BRAND, backgroundColor: "rgba(0,199,138,0.1)" }
                        : { borderColor: "rgba(255,255,255,0.15)", color: "rgba(255,255,255,0.35)" }
                  }
                >
                  {i < step ? <Check className="w-4 h-4" /> : <s.icon className="w-4 h-4" />}
                </span>
                <span className={`hidden lg:block text-[11px] ${i === step ? "text-white" : "text-white/40"}`}>{s.label}</span>
              </button>
              {i < STEPS.length - 1 && (
                <div className="w-6 sm:w-12 h-px lg:mb-4" style={{ backgroundColor: i < step ? BRAND : "rgba(255,255,255,0.12)" }} />
              )}
            </div>
          ))}
        </div>

        {/* Contenido: texto a la izquierda, visual a la derecha (desktop);
            apilado compacto en mobile. Todo cambia en el mismo lugar. */}
        <div className="flex-1 min-h-0 grid md:grid-cols-2 gap-4 md:gap-10 items-center">
          {/* Texto + navegación */}
          <div className="text-center md:text-left order-1">
            <h1 className="text-xl sm:text-2xl md:text-3xl font-bold mb-1.5 sm:mb-2">{COPY[step].title}</h1>
            <p className="text-sm text-white/50 max-w-md mx-auto md:mx-0">{COPY[step].body}</p>

            {/* Navegación (desktop: acá abajo; mobile: fila propia al final) */}
            <div className="hidden md:flex items-center gap-3 mt-7">
              {step > 0 && (
                <button
                  onClick={() => setStep(step - 1)}
                  className="inline-flex items-center gap-2 h-11 px-5 rounded-xl text-sm font-semibold border border-white/15 text-white/80 hover:bg-white/5 transition-colors"
                >
                  <ArrowLeft className="w-4 h-4" /> Atrás
                </button>
              )}
              {step < 3 ? (
                <button
                  onClick={() => canAdvance && setStep(step + 1)}
                  disabled={!canAdvance}
                  className="group inline-flex items-center gap-2 h-11 px-5 rounded-xl text-sm font-semibold transition-opacity disabled:opacity-30"
                  style={{ backgroundColor: BRAND, color: "#000" }}
                >
                  {NEXT_LABEL[step]}
                  <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" />
                </button>
              ) : (
                <button
                  onClick={() => navigate("/demo")}
                  className="group inline-flex items-center gap-2 h-11 px-5 rounded-xl text-sm font-semibold"
                  style={{ backgroundColor: BRAND, color: "#000", boxShadow: "0 4px 24px rgba(0,199,138,0.35)" }}
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
              <div className="w-full max-w-sm rounded-2xl border border-white/10 p-4 sm:p-5 text-left" style={{ backgroundColor: "#111111" }}>
                {!booked ? (
                  <>
                    <p className="text-sm font-semibold mb-0.5">Sesión individual · 60 min</p>
                    <p className="text-xs text-white/50 capitalize mb-3">{tomorrowEs}</p>
                    {/* Guía: sin esto no se entiende que hay que tocar un horario */}
                    {!slot && (
                      <div className="flex items-center gap-1.5 mb-2 text-[13px] font-semibold" style={{ color: BRAND }}>
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
                              ? { backgroundColor: BRAND, borderColor: BRAND, color: "#000" }
                              : { borderColor: "rgba(255,255,255,0.15)", color: "rgba(255,255,255,0.8)" }
                          }
                        >
                          {t}
                        </button>
                      ))}
                    </div>
                    <button
                      onClick={() => slot && setBooked(true)}
                      disabled={!slot}
                      className="w-full h-10 rounded-xl text-sm font-semibold transition-opacity disabled:opacity-40"
                      style={{ backgroundColor: BRAND, color: "#000" }}
                    >
                      Confirmar reserva
                    </button>
                  </>
                ) : (
                  <div className="text-center py-2">
                    <div className="w-11 h-11 mx-auto rounded-full flex items-center justify-center mb-2.5" style={{ backgroundColor: "rgba(0,199,138,0.15)" }}>
                      <Check className="w-5 h-5" style={{ color: BRAND }} />
                    </div>
                    <p className="font-bold text-base mb-0.5">¡Reserva confirmada!</p>
                    <p className="text-sm text-white/50 capitalize">{tomorrowEs} · {chosenTime} hs</p>
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
              <div className="w-full max-w-sm rounded-2xl border border-white/10 p-4 sm:p-5 text-left" style={{ backgroundColor: "#111111" }}>
                <p className="text-xs text-white/40 uppercase tracking-wider mb-2.5 capitalize">{tomorrowEs}</p>
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
                            ? { borderColor: BRAND, backgroundColor: "rgba(0,199,138,0.08)", boxShadow: "0 0 24px rgba(0,199,138,0.15)" }
                            : { borderColor: "rgba(255,255,255,0.08)" }
                        }
                      >
                        <span className="text-sm font-semibold tabular-nums w-12 shrink-0">{apt.time}</span>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium truncate">{apt.name}</p>
                          {apt.tag && <p className="text-[11px] font-medium" style={{ color: BRAND }}>{apt.tag}</p>}
                        </div>
                        <Video className="w-4 h-4 text-white/30 shrink-0" />
                      </div>
                    ))}
                </div>
              </div>
            )}
          </div>

          {/* Navegación mobile: siempre visible abajo, sin scroll */}
          <div className="order-3 md:hidden flex items-center justify-center gap-2.5 pb-1">
            {step > 0 && (
              <button
                onClick={() => setStep(step - 1)}
                className="inline-flex items-center justify-center gap-1.5 h-11 px-4 rounded-xl text-sm font-semibold border border-white/15 text-white/80"
              >
                <ArrowLeft className="w-4 h-4" /> Atrás
              </button>
            )}
            {step < 3 ? (
              <button
                onClick={() => canAdvance && setStep(step + 1)}
                disabled={!canAdvance}
                className="flex-1 max-w-xs inline-flex items-center justify-center gap-2 h-11 px-4 rounded-xl text-sm font-semibold transition-opacity disabled:opacity-30"
                style={{ backgroundColor: BRAND, color: "#000" }}
              >
                Siguiente <ArrowRight className="w-4 h-4" />
              </button>
            ) : (
              <button
                onClick={() => navigate("/demo")}
                className="flex-1 max-w-xs inline-flex items-center justify-center gap-2 h-11 px-4 rounded-xl text-sm font-semibold"
                style={{ backgroundColor: BRAND, color: "#000" }}
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
