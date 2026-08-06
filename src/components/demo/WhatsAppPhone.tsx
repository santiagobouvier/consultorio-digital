// Celular con un chat estilo WhatsApp: muestra los avisos automáticos tal
// como le llegan al paciente. Solo vidriera (nada clickeable): es la pieza
// más vendedora de la demo — el diferencial se entiende en 3 segundos.
import { useEffect, useRef, useState } from "react";
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
  /** Cuántos mensajes ya están en el chat desde el arranque (no se animan). */
  staticCount?: number;
}

export function WhatsAppPhone({ clinicName, clinicInitials, messages, animate = false, staticCount = 0 }: Props) {
  const [visibleCount, setVisibleCount] = useState(animate ? staticCount : messages.length);

  useEffect(() => {
    if (!animate) {
      setVisibleCount(messages.length);
      return;
    }
    setVisibleCount(staticCount);
    const timers = messages.slice(staticCount).map((_, i) =>
      window.setTimeout(() => setVisibleCount(staticCount + i + 1), 700 + i * 1400),
    );
    return () => timers.forEach(clearTimeout);
  }, [animate, messages, staticCount]);

  // Como en WhatsApp: el chat siempre muestra lo último que llegó
  const chatRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    chatRef.current?.scrollTo({ top: chatRef.current.scrollHeight, behavior: "smooth" });
  }, [visibleCount]);

  // El celular se dibuja SIEMPRE a tamaño real (390x760, texto de WhatsApp
  // de verdad) y se escala ENTERO al espacio disponible: tipografía, avatar
  // y burbujas siempre proporcionales, en cualquier pantalla.
  const DESIGN_W = 390;
  const DESIGN_H = 760;
  const boxRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0.6);
  useEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      const next = Math.min(el.clientHeight / DESIGN_H, el.clientWidth / DESIGN_W);
      if (next > 0) setScale(next);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return (
    <div
      ref={boxRef}
      className="mx-auto w-full max-w-[390px] h-[min(62dvh,560px)] md:h-[min(74dvh,700px)] flex items-center justify-center select-none text-left"
    >
      <div style={{ width: DESIGN_W * scale, height: DESIGN_H * scale, position: "relative" }}>
        <div
          className="rounded-[36px] bg-black p-2 shadow-2xl ring-1 ring-white/20"
          style={{
            width: DESIGN_W,
            height: DESIGN_H,
            transform: `scale(${scale})`,
            transformOrigin: "top left",
            position: "absolute",
            top: 0,
            left: 0,
          }}
        >
      <div className="w-full h-full rounded-[28px] overflow-hidden flex flex-col" style={{ backgroundColor: "#0b141a" }}>
        {/* Header del chat */}
        <div className="shrink-0 flex items-center gap-3 px-4 pt-7 pb-3" style={{ backgroundColor: "#202c33" }}>
          <div
            className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold text-white shrink-0"
            style={{ backgroundColor: "#00a884" }}
          >
            {clinicInitials}
          </div>
          <div className="min-w-0">
            <p className="text-[16px] font-semibold text-white leading-tight truncate">{clinicName}</p>
            <p className="text-[12px]" style={{ color: "#8696a0" }}>en línea</p>
          </div>
        </div>

        {/* Mensajes (fondo con patrón sutil de WhatsApp oscuro) */}
        <div
          ref={chatRef}
          className="flex-1 overflow-y-auto px-3 py-3 space-y-2 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]"
          style={{
            backgroundColor: "#0b141a",
            backgroundImage:
              "radial-gradient(circle at 20% 30%, rgba(255,255,255,0.015) 0 2px, transparent 2px), radial-gradient(circle at 70% 60%, rgba(255,255,255,0.015) 0 2px, transparent 2px)",
            backgroundSize: "90px 90px",
          }}
        >
          <div className="flex justify-center pb-1">
            <span className="text-[11px] px-2 py-0.5 rounded" style={{ backgroundColor: "#182229", color: "#8696a0" }}>
              HOY
            </span>
          </div>
          {messages.slice(0, visibleCount).map((m, i) => (
            <div key={i} className="flex justify-start animate-in fade-in slide-in-from-bottom-2 duration-300">
              <div
                className="max-w-[85%] rounded-lg rounded-tl-none px-3 py-2 shadow"
                style={{ backgroundColor: "#202c33" }}
              >
                <p className="text-[14.5px] leading-[1.45] text-white whitespace-pre-line">{m.text}</p>
                <div className="flex items-center justify-end gap-1 mt-0.5">
                  <span className="text-[11px]" style={{ color: "#8696a0" }}>{m.time}</span>
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
        <div className="shrink-0 flex items-center gap-2 px-3 py-3" style={{ backgroundColor: "#202c33" }}>
          <div className="flex-1 h-11 rounded-full px-4 flex items-center" style={{ backgroundColor: "#2a3942" }}>
            <span className="text-[14px]" style={{ color: "#8696a0" }}>Mensaje</span>
          </div>
          <div className="w-11 h-11 rounded-full flex items-center justify-center shrink-0" style={{ backgroundColor: "#00a884" }}>
            <CheckCheck className="w-5 h-5 text-white" />
          </div>
        </div>
      </div>
        </div>
      </div>
    </div>
  );
}

// Los textos de las plantillas del producto, con datos ficticios y párrafos
// aireados para que en la demo se lean lindos.
const demoDateEs = () => {
  const fecha = new Date();
  fecha.setDate(fecha.getDate() + 1);
  return fecha.toLocaleDateString("es-UY", { weekday: "long", day: "numeric", month: "long" });
};

export const buildDemoWaConfirmation = (time = "16:00"): WaMessage => ({
  text: `Hola Sofía 👋\n\n¡Tu sesión con Mente Clara quedó agendada!\n\n📅 ${demoDateEs()}\n🕐 ${time} hs\n\nSi necesitás reprogramar o cancelar, escribile a tu profesional: +598 98 123 456\n\n¡Nos vemos!`,
  time: "10:24",
});

export const buildDemoWaReminder = (time = "16:00"): WaMessage => ({
  text: `Hola Sofía 👋\n\nTe recordamos tu próxima sesión con Mente Clara:\n\n📅 mañana, ${demoDateEs()}\n🕐 ${time} hs\n\nSi necesitás reprogramar o cancelar, escribile a tu profesional: +598 98 123 456\n\n¡Te esperamos!`,
  time: "19:00",
});

export const buildDemoWaMessages = (time = "16:00"): WaMessage[] => [
  buildDemoWaConfirmation(time),
  buildDemoWaReminder(time),
];
