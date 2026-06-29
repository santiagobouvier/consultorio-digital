// Simulación de la agenda en el panel del profesional. Datos fijos en memoria:
// se puede navegar y "hacer como que" se agenda, pero nada se guarda. Al
// refrescar vuelve a empezar.
import { useState } from "react";
import { DemoBanner } from "@/components/demo/DemoBanner";
import { Video, MapPin, Plus, X, Users, CalendarDays, DollarSign } from "lucide-react";

const GREEN = "#00c78a";
const BRAND = "#00a5a0";

interface Appt {
  time: string;
  name: string;
  modality: "online" | "presencial";
  status: "Confirmada" | "Pendiente";
  reason: string;
}

const APPTS: Appt[] = [
  { time: "09:00", name: "María González", modality: "presencial", status: "Confirmada", reason: "Terapia individual" },
  { time: "10:30", name: "Lucía Fernández", modality: "online", status: "Confirmada", reason: "Seguimiento" },
  { time: "12:00", name: "Diego Martínez", modality: "presencial", status: "Pendiente", reason: "Primera consulta" },
  { time: "15:00", name: "Sofía Pereyra", modality: "online", status: "Confirmada", reason: "Terapia de pareja" },
  { time: "16:30", name: "Andrés Silva", modality: "presencial", status: "Pendiente", reason: "Seguimiento" },
];

const STATS = [
  { icon: CalendarDays, label: "Citas hoy", value: "5", color: BRAND },
  { icon: Users, label: "Pacientes activos", value: "24", color: GREEN },
  { icon: DollarSign, label: "Cobros pendientes", value: "3", color: "#f59e0b" },
];

const DemoAgenda = () => {
  const [selected, setSelected] = useState<number | null>(1);
  const [showNew, setShowNew] = useState(false);

  return (
    <div className="min-h-screen bg-black text-white">
      <DemoBanner />

      <div className="max-w-3xl mx-auto px-4 py-6 sm:py-10">
        {/* Header */}
        <div className="flex items-center justify-between gap-3 mb-5">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-white leading-tight">Mi agenda</h1>
            <p className="text-sm text-white/50">Lunes 14 de julio</p>
          </div>
          <button
            onClick={() => setShowNew(true)}
            className="inline-flex items-center gap-2 h-10 px-4 rounded-xl text-sm font-semibold text-white"
            style={{ backgroundColor: BRAND, boxShadow: `0 4px 20px rgba(0,165,160,0.3)` }}
          >
            <Plus className="w-4 h-4" /> Nueva cita
          </button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-3 mb-6">
          {STATS.map((s) => (
            <div key={s.label} className="rounded-xl border border-white/5 p-3" style={{ backgroundColor: "#111111" }}>
              <s.icon className="w-4 h-4 mb-1.5" style={{ color: s.color }} />
              <p className="text-lg font-bold text-white leading-tight">{s.value}</p>
              <p className="text-[11px] text-white/50 leading-tight">{s.label}</p>
            </div>
          ))}
        </div>

        {/* Day list */}
        <div className="space-y-2.5">
          {APPTS.map((a, i) => {
            const isSel = selected === i;
            const statusColor = a.status === "Confirmada" ? GREEN : "#f59e0b";
            return (
              <div key={a.time}>
                <button
                  onClick={() => setSelected(isSel ? null : i)}
                  className="w-full flex items-center gap-3 rounded-xl border px-3.5 py-3 text-left transition-colors"
                  style={{
                    backgroundColor: isSel ? "#181818" : "#111111",
                    borderColor: isSel ? `${BRAND}66` : "rgba(255,255,255,0.06)",
                  }}
                >
                  <span className="text-sm font-mono text-white/50 w-12 flex-shrink-0">{a.time}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-medium text-white truncate">{a.name}</span>
                  </span>
                  {a.modality === "online" ? (
                    <Video className="w-4 h-4 text-white/40 flex-shrink-0" />
                  ) : (
                    <MapPin className="w-4 h-4 text-white/40 flex-shrink-0" />
                  )}
                  <span className="text-[10px] font-medium px-2 py-0.5 rounded-md flex-shrink-0" style={{ backgroundColor: `${statusColor}1a`, color: statusColor }}>
                    {a.status}
                  </span>
                </button>

                {isSel && (
                  <div className="mt-1 rounded-xl border border-white/5 p-4 text-sm" style={{ backgroundColor: "#0e0e0e" }}>
                    <p className="text-white/80 mb-1"><span className="text-white/50">Motivo:</span> {a.reason}</p>
                    <p className="text-white/80 mb-3"><span className="text-white/50">Modalidad:</span> {a.modality === "online" ? "Online" : "Presencial"}</p>
                    <div className="flex flex-wrap gap-2">
                      {["Confirmar", "Reprogramar", "Marcar cobro", "Ver ficha"].map((act) => (
                        <span key={act} className="text-xs px-2.5 py-1 rounded-md border border-white/10 text-white/60">{act}</span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Fake "nueva cita" modal */}
      {showNew && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setShowNew(false)} />
          <div className="relative z-10 w-full max-w-sm rounded-2xl border border-white/10 p-6" style={{ backgroundColor: "#111111" }}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-bold text-white">Nueva cita</h3>
              <button onClick={() => setShowNew(false)} className="text-white/50 hover:text-white"><X className="w-5 h-5" /></button>
            </div>
            <p className="text-sm text-white/50 mb-5">
              En la app real, acá elegís paciente, fecha y hora, y la cita aparece al instante en tu agenda.
              En esta demo no se guarda nada.
            </p>
            <button
              onClick={() => setShowNew(false)}
              className="w-full h-11 rounded-xl text-sm font-semibold text-white"
              style={{ backgroundColor: BRAND }}
            >
              Entendido
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default DemoAgenda;
