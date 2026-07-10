// Animated mock-ups for the landing page, all built in code (no screenshots).
// Same visual language as AgendaPreview: an app-window frame with content that
// fades in staggered. One component per landing section.
import { ReactNode } from "react";

function PreviewFrame({
  title,
  accent,
  badge,
  children,
}: {
  title: string;
  accent: string;
  badge?: string;
  children: ReactNode;
}) {
  return (
    <div
      className="relative rounded-xl sm:rounded-2xl overflow-hidden border border-white/10"
      style={{
        backgroundColor: "#0f0f0f",
        boxShadow: `0 25px 70px -20px ${accent}30, 0 10px 30px -10px rgba(0,0,0,0.6)`,
      }}
    >
      <style>{`
        @keyframes previewCardIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes previewDotPulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }
        @keyframes previewBarGrow { from { transform: scaleY(0.12); } to { transform: scaleY(1); } }
        .preview-card { opacity: 0; animation: previewCardIn 0.6s ease-out forwards; }
        .preview-dot { animation: previewDotPulse 1.8s ease-in-out infinite; }
        .preview-bar { transform-origin: bottom; transform: scaleY(0.12); animation: previewBarGrow 0.7s ease-out forwards; }
      `}</style>

      <div className="flex items-center gap-2 px-4 py-3 border-b border-white/5">
        <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: "#ff5f57" }} />
        <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: "#febc2e" }} />
        <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: "#28c840" }} />
        <span className="ml-3 text-xs text-gray-400 font-medium truncate">{title}</span>
        {badge && (
          <span
            className="ml-auto text-[10px] font-semibold px-2 py-0.5 rounded-md flex-shrink-0"
            style={{ backgroundColor: `${accent}1a`, color: accent }}
          >
            {badge}
          </span>
        )}
      </div>

      <div className="p-4 sm:p-5">{children}</div>
    </div>
  );
}

/* ── Portal del paciente (marca blanca) ── */
export function PortalPreview() {
  const accent = "#a78bfa";
  return (
    <PreviewFrame title="Portal del paciente" accent={accent} badge="Tu marca">
      <div className="space-y-3">
        <div
          className="preview-card flex items-center gap-3 rounded-lg p-3"
          style={{ backgroundColor: `${accent}14`, animationDelay: "0s" }}
        >
          <div
            className="w-9 h-9 rounded-lg flex items-center justify-center text-white font-bold text-sm flex-shrink-0"
            style={{ backgroundColor: accent }}
          >
            L
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-white truncate">Dra. Laura López</p>
            <p className="text-[11px]" style={{ color: accent }}>Psicología clínica</p>
          </div>
        </div>

        <p className="preview-card text-sm text-gray-300" style={{ animationDelay: "0.15s" }}>
          Hola, <span className="text-white font-medium">María</span> 👋
        </p>

        <div
          className="preview-card rounded-lg border border-white/5 p-3"
          style={{ backgroundColor: "#161616", animationDelay: "0.3s" }}
        >
          <p className="text-[11px] text-gray-500 mb-1">Tu próxima sesión</p>
          <p className="text-sm font-medium text-white">Lunes 14 · 10:30</p>
          <p className="text-[11px] text-gray-400">Modalidad: Online</p>
        </div>

        <div
          className="preview-card rounded-lg py-2.5 text-center text-sm font-semibold"
          style={{ backgroundColor: accent, color: "#111", animationDelay: "0.45s" }}
        >
          Reservar nueva sesión
        </div>
      </div>
    </PreviewFrame>
  );
}

/* ── Reserva online de turnos ── */
export function BookingPreview() {
  const accent = "#00c78a";
  const days = [
    { d: "Lun", n: "12" },
    { d: "Mar", n: "13" },
    { d: "Mié", n: "14" },
    { d: "Jue", n: "15" },
  ];
  const times = ["09:00", "10:30", "12:00", "15:00", "16:30", "18:00"];
  return (
    <PreviewFrame title="Reservar turno" accent={accent} badge="En vivo">
      <div className="space-y-3">
        <p className="preview-card text-[11px] text-gray-500" style={{ animationDelay: "0s" }}>Elegí un día</p>
        <div className="preview-card flex gap-2" style={{ animationDelay: "0.1s" }}>
          {days.map((day, i) => (
            <div
              key={day.n}
              className="flex-1 rounded-lg py-2 text-center border"
              style={
                i === 2
                  ? { backgroundColor: accent, borderColor: accent, color: "#111" }
                  : { backgroundColor: "#161616", borderColor: "rgba(255,255,255,0.06)", color: "#9ca3af" }
              }
            >
              <p className="text-[10px]">{day.d}</p>
              <p className="text-sm font-semibold">{day.n}</p>
            </div>
          ))}
        </div>

        <p className="preview-card text-[11px] text-gray-500" style={{ animationDelay: "0.2s" }}>Horarios disponibles</p>
        <div className="preview-card grid grid-cols-3 gap-2" style={{ animationDelay: "0.3s" }}>
          {times.map((t, i) => (
            <div
              key={t}
              className="rounded-md py-1.5 text-center text-xs font-medium border"
              style={
                i === 1
                  ? { backgroundColor: `${accent}1a`, borderColor: accent, color: accent }
                  : { backgroundColor: "#161616", borderColor: "rgba(255,255,255,0.06)", color: "#9ca3af" }
              }
            >
              {t}
            </div>
          ))}
        </div>

        <div
          className="preview-card flex items-center justify-center gap-2 rounded-lg py-2.5 text-sm font-semibold"
          style={{ backgroundColor: `${accent}1a`, color: accent, animationDelay: "0.45s" }}
        >
          <span className="preview-dot">●</span> Turno confirmado
        </div>
      </div>
    </PreviewFrame>
  );
}

/* ── Control de cobros ── */
export function PaymentsPreview() {
  const accent = "#f59e0b";
  const green = "#00c78a";
  const rows = [
    { name: "María González", amount: "$1.500", paid: true },
    { name: "Diego Martínez", amount: "$1.500", paid: true },
    { name: "Lucía Fernández", amount: "$1.500", paid: false },
  ];
  return (
    <PreviewFrame title="Cobros · Junio" accent={accent} badge="$48.500">
      <div className="space-y-2.5">
        {rows.map((r, i) => (
          <div
            key={r.name}
            className="preview-card flex items-center gap-3 rounded-lg border border-white/5 px-3 py-2.5"
            style={{ backgroundColor: "#161616", animationDelay: `${i * 0.15}s` }}
          >
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-white truncate">{r.name}</p>
            </div>
            <span className="text-sm font-mono text-gray-300">{r.amount}</span>
            <span
              className="text-[10px] font-medium px-2 py-0.5 rounded-md flex-shrink-0"
              style={
                r.paid
                  ? { backgroundColor: `${green}1a`, color: green }
                  : { backgroundColor: `${accent}1a`, color: accent }
              }
            >
              {r.paid ? "Pagado" : "Pendiente"}
            </span>
          </div>
        ))}
        <div
          className="preview-card flex items-center justify-between rounded-lg px-3 py-2.5 mt-1"
          style={{ backgroundColor: `${accent}14`, animationDelay: "0.45s" }}
        >
          <span className="text-xs text-gray-300">Cobrado este mes</span>
          <span className="text-sm font-bold" style={{ color: accent }}>$45.500</span>
        </div>
      </div>
    </PreviewFrame>
  );
}

/* ── Dashboard / estadísticas ── */
export function StatsPreview() {
  const accent = "#60a5fa";
  const metrics = [
    { label: "Pacientes", value: "42" },
    { label: "Citas / semana", value: "18" },
    { label: "Ingresos", value: "$72k" },
  ];
  const bars = [40, 65, 50, 80, 60, 95, 70];
  return (
    <PreviewFrame title="Panel · Resumen" accent={accent} badge="Hoy">
      <div className="space-y-4">
        <div className="grid grid-cols-3 gap-2">
          {metrics.map((m, i) => (
            <div
              key={m.label}
              className="preview-card rounded-lg border border-white/5 p-2.5"
              style={{ backgroundColor: "#161616", animationDelay: `${i * 0.12}s` }}
            >
              <p className="text-base sm:text-lg font-bold text-white leading-tight">{m.value}</p>
              <p className="text-[10px] text-gray-500 leading-tight">{m.label}</p>
            </div>
          ))}
        </div>

        <div
          className="preview-card rounded-lg border border-white/5 p-3"
          style={{ backgroundColor: "#161616", animationDelay: "0.4s" }}
        >
          <p className="text-[11px] text-gray-500 mb-2">Citas por día</p>
          <div className="flex items-end gap-1.5 h-20">
            {bars.map((h, i) => (
              <div key={i} className="flex-1 flex items-end" style={{ height: "100%" }}>
                <div
                  className="preview-bar w-full rounded-t"
                  style={{
                    height: `${h}%`,
                    backgroundColor: i === 5 ? accent : `${accent}55`,
                    animationDelay: `${0.4 + i * 0.07}s`,
                  }}
                />
              </div>
            ))}
          </div>
        </div>
      </div>
    </PreviewFrame>
  );
}
