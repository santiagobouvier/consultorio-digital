// Celular con un chat estilo WhatsApp: muestra los avisos automáticos tal
// como le llegan al paciente. Solo vidriera (nada clickeable): es la pieza
// más vendedora de la demo — el diferencial se entiende en 3 segundos.
import { useEffect, useState } from "react";
import { CheckCheck } from "lucide-react";

export interface WaMessage {
  text: string;
  time: string;
}

interface Props {
  clinicName: string;
  clinicInitials: string;
  messages: WaMessage[];
  /** Si es true, los mensajes "van llegando" uno a uno (para el recorrido). */
  animate?: boolean;
}

export function WhatsAppPhone({ clinicName, clinicInitials, messages, animate = false }: Props) {
  const [visibleCount, setVisibleCount] = useState(animate ? 0 : messages.length);

  useEffect(() => {
    if (!animate) {
      setVisibleCount(messages.length);
      return;
    }
    setVisibleCount(0);
    const timers = messages.map((_, i) =>
      window.setTimeout(() => setVisibleCount(i + 1), 700 + i * 1400),
    );
    return () => timers.forEach(clearTimeout);
  }, [animate, messages]);

  return (
    <div className="mx-auto w-full max-w-[340px] aspect-[390/760] rounded-[36px] bg-black p-2 shadow-2xl ring-1 ring-white/20 select-none">
      <div className="w-full h-full rounded-[28px] overflow-hidden flex flex-col" style={{ backgroundColor: "#0b141a" }}>
        {/* Header del chat */}
        <div className="shrink-0 flex items-center gap-3 px-3 pt-6 pb-2.5" style={{ backgroundColor: "#202c33" }}>
          <div
            className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0"
            style={{ backgroundColor: "#00a884" }}
          >
            {clinicInitials}
          </div>
          <div className="min-w-0">
            <p className="text-[14px] font-semibold text-white leading-tight truncate">{clinicName}</p>
            <p className="text-[11px]" style={{ color: "#8696a0" }}>en línea</p>
          </div>
        </div>

        {/* Mensajes (fondo con patrón sutil de WhatsApp oscuro) */}
        <div
          className="flex-1 overflow-hidden px-3 py-3 space-y-2"
          style={{
            backgroundColor: "#0b141a",
            backgroundImage:
              "radial-gradient(circle at 20% 30%, rgba(255,255,255,0.015) 0 2px, transparent 2px), radial-gradient(circle at 70% 60%, rgba(255,255,255,0.015) 0 2px, transparent 2px)",
            backgroundSize: "90px 90px",
          }}
        >
          <div className="flex justify-center pb-1">
            <span className="text-[10px] px-2 py-0.5 rounded" style={{ backgroundColor: "#182229", color: "#8696a0" }}>
              HOY
            </span>
          </div>
          {messages.slice(0, visibleCount).map((m, i) => (
            <div key={i} className="flex justify-start animate-in fade-in slide-in-from-bottom-2 duration-300">
              <div
                className="max-w-[88%] rounded-lg rounded-tl-none px-2.5 py-1.5 shadow"
                style={{ backgroundColor: "#202c33" }}
              >
                <p className="text-[12.5px] leading-snug text-white whitespace-pre-line">{m.text}</p>
                <div className="flex items-center justify-end gap-1 mt-0.5">
                  <span className="text-[10px]" style={{ color: "#8696a0" }}>{m.time}</span>
                </div>
              </div>
            </div>
          ))}
          {animate && visibleCount < messages.length && (
            <div className="flex justify-start">
              <div className="rounded-lg rounded-tl-none px-3 py-2" style={{ backgroundColor: "#202c33" }}>
                <span className="inline-flex gap-1">
                  {[0, 1, 2].map((d) => (
                    <span
                      key={d}
                      className="w-1.5 h-1.5 rounded-full animate-bounce"
                      style={{ backgroundColor: "#8696a0", animationDelay: `${d * 150}ms` }}
                    />
                  ))}
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Barra de escribir (decorativa) */}
        <div className="shrink-0 flex items-center gap-2 px-3 py-2.5" style={{ backgroundColor: "#202c33" }}>
          <div className="flex-1 h-9 rounded-full px-4 flex items-center" style={{ backgroundColor: "#2a3942" }}>
            <span className="text-[12px]" style={{ color: "#8696a0" }}>Mensaje</span>
          </div>
          <div className="w-9 h-9 rounded-full flex items-center justify-center shrink-0" style={{ backgroundColor: "#00a884" }}>
            <CheckCheck className="w-4 h-4 text-white" />
          </div>
        </div>
      </div>
    </div>
  );
}

// Los textos REALES de las plantillas del producto, con datos ficticios.
export const buildDemoWaMessages = (): WaMessage[] => {
  const fecha = new Date();
  fecha.setDate(fecha.getDate() + 1);
  const fechaEs = fecha.toLocaleDateString("es-UY", { weekday: "long", day: "numeric", month: "long" });
  return [
    {
      text: `Hola Sofía 👋 ¡Tu sesión con Mente Clara quedó agendada! 📅 ${fechaEs} 🕐 16:00 hs. Si necesitás reprogramar o cancelar, escribile a tu profesional: +598 98 123 456 ¡Nos vemos!`,
      time: "10:24",
    },
    {
      text: `Hola Sofía 👋 Te recordamos tu próxima sesión con Mente Clara: 📅 ${fechaEs} 🕐 16:00 hs. Si necesitás reprogramar o cancelar, escribile a tu profesional: +598 98 123 456 ¡Te esperamos!`,
      time: "10:25",
    },
  ];
};
