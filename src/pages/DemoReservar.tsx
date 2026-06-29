// Simulación de la reserva online (web pública). Todo es estado local: elegir
// día + hora y "confirmar" muestra un éxito simulado. Nada se guarda; al
// refrescar vuelve a empezar.
import { useState } from "react";
import { DemoBanner } from "@/components/demo/DemoBanner";
import { Check, Clock, Video, MapPin, CalendarCheck } from "lucide-react";

const GREEN = "#00c78a";

const DAYS = [
  { d: "Lun", n: "14" },
  { d: "Mar", n: "15" },
  { d: "Mié", n: "16" },
  { d: "Jue", n: "17" },
  { d: "Vie", n: "18" },
];
const TIMES = ["09:00", "10:30", "12:00", "15:00", "16:30", "18:00"];

const DemoReservar = () => {
  const [day, setDay] = useState<number | null>(2);
  const [time, setTime] = useState<string | null>(null);
  const [modality, setModality] = useState<"online" | "presencial">("online");
  const [confirmed, setConfirmed] = useState(false);

  const canConfirm = day !== null && time !== null;

  return (
    <div className="min-h-screen bg-black text-white">
      <DemoBanner />

      <div className="max-w-lg mx-auto px-4 py-8 sm:py-12">
        {/* Clinic header */}
        <div className="flex items-center gap-3 mb-8">
          <div className="w-12 h-12 rounded-xl flex items-center justify-center text-white font-bold text-lg flex-shrink-0" style={{ backgroundColor: GREEN }}>
            L
          </div>
          <div>
            <h1 className="text-lg font-bold text-white leading-tight">Lic. Laura López</h1>
            <p className="text-sm text-white/50">Psicología clínica · Montevideo</p>
          </div>
        </div>

        {!confirmed ? (
          <div className="rounded-2xl border border-white/10 p-5 sm:p-6" style={{ backgroundColor: "#111111" }}>
            <h2 className="text-base font-semibold text-white mb-1">Reservá tu sesión</h2>
            <p className="text-sm text-white/50 mb-5">Elegí día y horario disponible.</p>

            {/* Day */}
            <p className="text-xs text-white/50 mb-2">Día</p>
            <div className="flex gap-2 mb-5">
              {DAYS.map((dd, i) => (
                <button
                  key={dd.n}
                  onClick={() => setDay(i)}
                  className="flex-1 rounded-lg py-2 text-center border transition-colors"
                  style={
                    day === i
                      ? { backgroundColor: GREEN, borderColor: GREEN, color: "#111" }
                      : { backgroundColor: "#161616", borderColor: "rgba(255,255,255,0.08)", color: "#9ca3af" }
                  }
                >
                  <span className="block text-[10px]">{dd.d}</span>
                  <span className="block text-sm font-semibold">{dd.n}</span>
                </button>
              ))}
            </div>

            {/* Modality */}
            <p className="text-xs text-white/50 mb-2">Modalidad</p>
            <div className="flex gap-2 mb-5">
              {([["online", Video, "Online"], ["presencial", MapPin, "Presencial"]] as const).map(([key, Icon, label]) => (
                <button
                  key={key}
                  onClick={() => setModality(key)}
                  className="flex-1 inline-flex items-center justify-center gap-2 rounded-lg py-2.5 text-sm border transition-colors"
                  style={
                    modality === key
                      ? { backgroundColor: `${GREEN}1a`, borderColor: GREEN, color: GREEN }
                      : { backgroundColor: "#161616", borderColor: "rgba(255,255,255,0.08)", color: "#9ca3af" }
                  }
                >
                  <Icon className="w-4 h-4" /> {label}
                </button>
              ))}
            </div>

            {/* Time */}
            <p className="text-xs text-white/50 mb-2">Horario</p>
            <div className="grid grid-cols-3 gap-2 mb-6">
              {TIMES.map((t) => (
                <button
                  key={t}
                  onClick={() => setTime(t)}
                  className="rounded-md py-2 text-center text-sm font-medium border transition-colors"
                  style={
                    time === t
                      ? { backgroundColor: `${GREEN}1a`, borderColor: GREEN, color: GREEN }
                      : { backgroundColor: "#161616", borderColor: "rgba(255,255,255,0.08)", color: "#9ca3af" }
                  }
                >
                  {t}
                </button>
              ))}
            </div>

            <button
              disabled={!canConfirm}
              onClick={() => setConfirmed(true)}
              className="w-full h-12 rounded-xl text-sm font-semibold text-white transition-all disabled:opacity-40"
              style={{ backgroundColor: GREEN, boxShadow: canConfirm ? `0 4px 20px ${GREEN}40` : "none" }}
            >
              Confirmar reserva
            </button>
          </div>
        ) : (
          <div className="rounded-2xl border border-white/10 p-6 sm:p-8 text-center" style={{ backgroundColor: "#111111" }}>
            <div className="mx-auto w-16 h-16 rounded-full flex items-center justify-center mb-4" style={{ backgroundColor: `${GREEN}1a` }}>
              <Check className="w-8 h-8" style={{ color: GREEN }} />
            </div>
            <h2 className="text-xl font-bold text-white mb-2">¡Turno reservado!</h2>
            <p className="text-sm text-white/60 mb-5">Te enviaríamos la confirmación por email y un recordatorio antes de la sesión.</p>

            <div className="rounded-xl border border-white/10 p-4 text-left space-y-2 mb-6" style={{ backgroundColor: "#161616" }}>
              <div className="flex items-center gap-2 text-sm text-white/80">
                <CalendarCheck className="w-4 h-4" style={{ color: GREEN }} />
                {DAYS[day!].d} {DAYS[day!].n} · {time}
              </div>
              <div className="flex items-center gap-2 text-sm text-white/80">
                {modality === "online" ? <Video className="w-4 h-4" style={{ color: GREEN }} /> : <MapPin className="w-4 h-4" style={{ color: GREEN }} />}
                {modality === "online" ? "Sesión online" : "Sesión presencial"}
              </div>
              <div className="flex items-center gap-2 text-sm text-white/80">
                <Clock className="w-4 h-4" style={{ color: GREEN }} />
                Recordatorio automático 24 h antes
              </div>
            </div>

            <button
              onClick={() => { setConfirmed(false); setTime(null); }}
              className="text-sm text-white/50 hover:text-white transition-colors underline underline-offset-2"
            >
              Reservar otro turno
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default DemoReservar;
