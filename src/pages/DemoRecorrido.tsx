// El recorrido completo en 3 pasos, pensado para que se entienda SOLO:
// 1) el paciente reserva desde la web → 2) le llega el WhatsApp automático →
// 3) el turno aparece en la agenda del profesional. Todo ficticio, nada se
// guarda. Es la pieza central de la demo pública.
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft, ArrowRight, Check, CalendarDays, MessageCircle, LayoutDashboard, Video, Sparkles } from "lucide-react";
import { WhatsAppPhone, buildDemoWaMessages } from "@/components/demo/WhatsAppPhone";

const BRAND = "#00c78a";

const tomorrow = new Date();
tomorrow.setDate(tomorrow.getDate() + 1);
const tomorrowEs = tomorrow.toLocaleDateString("es-UY", { weekday: "long", day: "numeric", month: "long" });

const SLOTS = ["10:00", "11:30", "14:00", "16:00", "17:30"];

const STEPS = [
  { icon: CalendarDays, label: "El paciente reserva" },
  { icon: MessageCircle, label: "Le llega el WhatsApp" },
  { icon: LayoutDashboard, label: "Vos lo ves en tu agenda" },
];

const DemoRecorrido = () => {
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  // Paso 1: mini reserva
  const [slot, setSlot] = useState<string | null>(null);
  const [booked, setBooked] = useState(false);

  const chosenTime = slot ?? "16:00";

  return (
    <div className="min-h-screen bg-black text-white">
      {/* Top bar */}
      <div className="sticky top-0 z-50 flex items-center justify-between gap-3 px-4 py-2.5 border-b border-white/10 bg-black/85 backdrop-blur-md">
        <Link to="/demo" className="inline-flex items-center gap-2 text-sm text-white/70 hover:text-white transition-colors">
          <ArrowLeft className="w-4 h-4" /> Volver a la demo
        </Link>
        <span className="inline-flex items-center gap-1.5 text-[11px] sm:text-xs font-medium px-2.5 py-1 rounded-full" style={{ backgroundColor: "rgba(0,199,138,0.12)", color: BRAND }}>
          <Sparkles className="w-3.5 h-3.5" /> Recorrido de 2 minutos
        </span>
      </div>

      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
        {/* Stepper */}
        <div className="flex items-center justify-center gap-2 sm:gap-3 mb-8">
          {STEPS.map((s, i) => (
            <div key={s.label} className="flex items-center gap-2 sm:gap-3">
              <div className="flex flex-col items-center gap-1.5">
                <div
                  className="w-9 h-9 rounded-full flex items-center justify-center border transition-colors"
                  style={
                    i < step
                      ? { backgroundColor: BRAND, borderColor: BRAND, color: "#000" }
                      : i === step
                        ? { borderColor: BRAND, color: BRAND, backgroundColor: "rgba(0,199,138,0.1)" }
                        : { borderColor: "rgba(255,255,255,0.15)", color: "rgba(255,255,255,0.35)" }
                  }
                >
                  {i < step ? <Check className="w-4 h-4" /> : <s.icon className="w-4 h-4" />}
                </div>
                <span className={`hidden sm:block text-[11px] ${i === step ? "text-white" : "text-white/40"}`}>{s.label}</span>
              </div>
              {i < STEPS.length - 1 && (
                <div className="w-8 sm:w-16 h-px mb-0 sm:mb-5" style={{ backgroundColor: i < step ? BRAND : "rgba(255,255,255,0.12)" }} />
              )}
            </div>
          ))}
        </div>

        {/* ── Paso 1: mini reserva ── */}
        {step === 0 && (
          <div className="text-center">
            <h1 className="text-2xl sm:text-3xl font-bold mb-2">Sofía encontró tu web y reserva sola</h1>
            <p className="text-white/50 mb-8 max-w-md mx-auto">
              Sin llamadas ni idas y vueltas por WhatsApp: elige un horario libre y confirma. Probalo vos:
            </p>

            <div className="max-w-md mx-auto rounded-2xl border border-white/10 p-5 text-left" style={{ backgroundColor: "#111111" }}>
              {!booked ? (
                <>
                  <p className="text-sm font-semibold mb-1">Sesión individual · 60 min</p>
                  <p className="text-xs text-white/50 capitalize mb-4">{tomorrowEs}</p>
                  <div className="grid grid-cols-3 gap-2 mb-5">
                    {SLOTS.map((t) => (
                      <button
                        key={t}
                        onClick={() => setSlot(t)}
                        className="h-10 rounded-lg text-sm font-medium border transition-colors"
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
                    className="w-full h-11 rounded-xl text-sm font-semibold transition-opacity disabled:opacity-40"
                    style={{ backgroundColor: BRAND, color: "#000" }}
                  >
                    Confirmar reserva
                  </button>
                </>
              ) : (
                <div className="text-center py-3">
                  <div className="w-12 h-12 mx-auto rounded-full flex items-center justify-center mb-3" style={{ backgroundColor: "rgba(0,199,138,0.15)" }}>
                    <Check className="w-6 h-6" style={{ color: BRAND }} />
                  </div>
                  <p className="font-bold text-lg mb-1">¡Reserva confirmada!</p>
                  <p className="text-sm text-white/50 capitalize">{tomorrowEs} · {chosenTime} hs</p>
                </div>
              )}
            </div>

            <button
              onClick={() => setStep(1)}
              disabled={!booked}
              className="group mt-8 inline-flex items-center gap-2 h-12 px-6 rounded-xl text-sm font-semibold transition-opacity disabled:opacity-30"
              style={{ backgroundColor: BRAND, color: "#000" }}
            >
              ¿Y ahora? Mirá el celular de Sofía
              <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" />
            </button>
          </div>
        )}

        {/* ── Paso 2: WhatsApp ── */}
        {step === 1 && (
          <div className="text-center">
            <h1 className="text-2xl sm:text-3xl font-bold mb-2">El WhatsApp le llega solo, al instante</h1>
            <p className="text-white/50 mb-8 max-w-md mx-auto">
              Confirmación al reservar y recordatorio antes de la sesión — automáticos, con tu nombre. Menos ausencias, cero trabajo.
            </p>

            <WhatsAppPhone
              clinicName="Mente Clara"
              clinicInitials="MC"
              messages={buildDemoWaMessages()}
              animate
            />

            <button
              onClick={() => setStep(2)}
              className="group mt-8 inline-flex items-center gap-2 h-12 px-6 rounded-xl text-sm font-semibold"
              style={{ backgroundColor: BRAND, color: "#000" }}
            >
              ¿Y vos qué ves? Tu agenda
              <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" />
            </button>
          </div>
        )}

        {/* ── Paso 3: la agenda del profesional ── */}
        {step === 2 && (
          <div className="text-center">
            <h1 className="text-2xl sm:text-3xl font-bold mb-2">Y en tu agenda ya está el turno</h1>
            <p className="text-white/50 mb-8 max-w-md mx-auto">
              Sin que hayas tocado nada. Así se ve tu día de mañana:
            </p>

            <div className="max-w-md mx-auto rounded-2xl border border-white/10 p-5 text-left" style={{ backgroundColor: "#111111" }}>
              <p className="text-xs text-white/40 uppercase tracking-wider mb-3 capitalize">{tomorrowEs}</p>
              <div className="space-y-2">
                {[
                  { time: "09:00", name: "María González", tag: null },
                  { time: "11:30", name: "Diego Martínez", tag: null },
                  { time: chosenTime, name: "Sofía Pereyra", tag: "Nueva · reservó online" },
                  { time: "18:00", name: "Valentina Méndez", tag: null },
                ]
                  .sort((a, b) => a.time.localeCompare(b.time))
                  .map((apt) => (
                    <div
                      key={apt.time + apt.name}
                      className="flex items-center gap-3 rounded-xl px-3 py-2.5 border"
                      style={
                        apt.tag
                          ? { borderColor: BRAND, backgroundColor: "rgba(0,199,138,0.08)", boxShadow: `0 0 24px rgba(0,199,138,0.15)` }
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

            <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
              <button
                onClick={() => navigate("/demo/agenda")}
                className="inline-flex items-center gap-2 h-12 px-6 rounded-xl text-sm font-semibold border border-white/15 text-white hover:bg-white/5 transition-colors"
              >
                Explorar la agenda completa
              </button>
              <button
                onClick={() => navigate("/")}
                className="group inline-flex items-center gap-2 h-12 px-6 rounded-xl text-sm font-semibold"
                style={{ backgroundColor: BRAND, color: "#000", boxShadow: `0 4px 24px rgba(0,199,138,0.35)` }}
              >
                Quiero esto en mi consultorio
                <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default DemoRecorrido;
