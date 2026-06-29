// Animated mock-up of the daily agenda for the landing page.
// Built entirely in code (no screenshots): an app-window frame with appointment
// cards that fade in one after another and a gently pulsing "now" indicator.

const GREEN = "#00c78a";

interface Appt {
  time: string;
  name: string;
  modality: string;
  color: string;
}

const APPOINTMENTS: Appt[] = [
  { time: "09:00", name: "María González", modality: "Presencial", color: "#00c78a" },
  { time: "10:30", name: "Lucía Fernández", modality: "Online", color: "#60a5fa" },
  { time: "12:00", name: "Diego Martínez", modality: "Presencial", color: "#a78bfa" },
  { time: "16:00", name: "Sofía Pereyra", modality: "Online", color: "#f59e0b" },
];

export function AgendaPreview() {
  return (
    <div
      className="relative rounded-xl sm:rounded-2xl overflow-hidden border border-white/10"
      style={{
        backgroundColor: "#0f0f0f",
        boxShadow: `0 25px 70px -20px ${GREEN}30, 0 10px 30px -10px rgba(0,0,0,0.6)`,
      }}
    >
      {/* Scoped animations */}
      <style>{`
        @keyframes agendaCardIn {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes agendaNowPulse {
          0%, 100% { box-shadow: 0 0 0 0 ${GREEN}66; }
          50% { box-shadow: 0 0 0 6px ${GREEN}00; }
        }
        .agenda-card { opacity: 0; animation: agendaCardIn 0.6s ease-out forwards; }
        .agenda-now-dot { animation: agendaNowPulse 2.2s ease-in-out infinite; }
      `}</style>

      {/* Window top bar */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-white/5">
        <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: "#ff5f57" }} />
        <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: "#febc2e" }} />
        <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: "#28c840" }} />
        <span className="ml-3 text-xs text-gray-400 font-medium">Agenda · Hoy, lunes</span>
        <span
          className="ml-auto text-[10px] font-semibold px-2 py-0.5 rounded-md"
          style={{ backgroundColor: `${GREEN}1a`, color: GREEN }}
        >
          4 citas
        </span>
      </div>

      {/* Day grid */}
      <div className="p-4 sm:p-5 space-y-2.5">
        {APPOINTMENTS.map((a, i) => (
          <div key={a.time}>
            {/* "Now" indicator between 10:30 and 12:00 */}
            {i === 2 && (
              <div className="flex items-center gap-2 my-1.5">
                <span
                  className="agenda-now-dot w-2 h-2 rounded-full flex-shrink-0"
                  style={{ backgroundColor: GREEN }}
                />
                <span className="h-px flex-1" style={{ backgroundColor: `${GREEN}55` }} />
                <span className="text-[10px] font-medium" style={{ color: GREEN }}>
                  ahora
                </span>
              </div>
            )}

            <div
              className="agenda-card flex items-center gap-3 rounded-lg border border-white/5 px-3 py-2.5"
              style={{
                backgroundColor: "#161616",
                borderLeft: `3px solid ${a.color}`,
                animationDelay: `${i * 0.18}s`,
              }}
            >
              <span className="text-xs font-mono text-gray-400 w-11 flex-shrink-0">{a.time}</span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-white truncate">{a.name}</p>
              </div>
              <span
                className="text-[10px] font-medium px-2 py-0.5 rounded-md flex-shrink-0"
                style={{ backgroundColor: `${a.color}1a`, color: a.color }}
              >
                {a.modality}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
