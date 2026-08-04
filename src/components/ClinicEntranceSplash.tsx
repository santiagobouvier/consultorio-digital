import { useEffect, useState } from "react";
import { getPanelBrand } from "@/lib/panel-brand-cache";

const FLAG_KEY = "clinic_entrance_pending";
const START_EVENT = "clinic-entrance-start";
const READY_EVENT = "clinic-entrance-ready";
const SHOW_MS = 2800; // mínimo que se luce la entrada
const MAX_MS = 15000; // tope duro: nunca más que esto
const FADE_MS = 600; // fundido de salida

/** Dispara la bienvenida (la llama Auth justo antes de navegar al panel). */
export function triggerClinicEntrance() {
  try { sessionStorage.setItem(FLAG_KEY, "1"); } catch {}
  window.dispatchEvent(new Event(START_EVENT));
}

/**
 * Avisa que el panel ya está montado (lo llama DashboardLayout). El splash
 * espera este aviso ADEMÁS del tiempo mínimo: así nunca se despide antes de
 * que el panel esté listo y no queda expuesto ningún preloader genérico.
 */
export function notifyClinicEntranceReady() {
  window.dispatchEvent(new Event(READY_EVENT));
}

/**
 * Bienvenida con marca al entrar al panel tras iniciar sesión: el logo del
 * consultorio con su color, "Preparando tu consultorio..." y una barra de
 * progreso elegante. Se muestra UNA vez por login (flag en sessionStorage
 * que setea Auth al redirigir al dashboard).
 *
 * Lee la marca de la caché local (panel_brand) para poder montarse ANTES de
 * que cargue cualquier dato: cubre también el preloader de arranque del
 * panel, así la entrada es UNA sola pantalla, no dos encadenadas.
 */
export function ClinicEntranceSplash() {
  const [phase, setPhase] = useState<"show" | "fade" | "done">(() => {
    try {
      return sessionStorage.getItem(FLAG_KEY) === "1" ? "show" : "done";
    } catch {
      return "done";
    }
  });

  // Marca del consultorio ACTIVO, cacheada por DashboardBrandingContext.
  const readBrand = () => {
    const parsed = getPanelBrand();
    return {
      logoUrl: parsed?.logoUrl || null,
      color: parsed?.color || "176 100% 32%",
      name: parsed?.name || null,
    };
  };
  const [brandInfo, setBrandInfo] = useState(readBrand);

  // El splash vive montado a nivel App (por encima del Suspense de rutas):
  // arranca cuando Auth dispara el evento, tapando también el preloader
  // global desde el primer frame.
  useEffect(() => {
    const onStart = () => {
      setBrandInfo(readBrand());
      setPhase("show");
    };
    window.addEventListener(START_EVENT, onStart);
    return () => window.removeEventListener(START_EVENT, onStart);
  }, []);

  // Salida en dos condiciones: pasó el tiempo mínimo Y el panel avisó que
  // está listo (o se alcanzó el tope duro). Así el splash nunca se despide
  // dejando un preloader genérico a la vista.
  useEffect(() => {
    if (phase !== "show") return;
    try { sessionStorage.removeItem(FLAG_KEY); } catch {}

    let ready = false;
    let minDone = false;
    let leaving = false;
    let tFade = 0;

    const leave = () => {
      if (leaving || !(ready && minDone)) return;
      leaving = true;
      setPhase("fade");
      tFade = window.setTimeout(() => setPhase("done"), FADE_MS);
    };
    const onReady = () => { ready = true; leave(); };

    window.addEventListener(READY_EVENT, onReady);
    const tMin = window.setTimeout(() => { minDone = true; leave(); }, SHOW_MS);
    const tMax = window.setTimeout(() => { ready = true; minDone = true; leave(); }, MAX_MS);

    return () => {
      window.removeEventListener(READY_EVENT, onReady);
      window.clearTimeout(tMin);
      window.clearTimeout(tMax);
      if (tFade) window.clearTimeout(tFade);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  if (phase === "done") return null;

  const brand = brandInfo.color;
  const name = brandInfo.name || "Tu consultorio";
  const initials = name
    .trim()
    .split(/\s+/)
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <div
      aria-hidden
      className="fixed inset-0 z-[200] flex items-center justify-center"
      style={{
        backgroundColor: "hsl(180 12% 14%)",
        opacity: phase === "fade" ? 0 : 1,
        transition: `opacity ${FADE_MS}ms ease`,
        pointerEvents: phase === "fade" ? "none" : "auto",
      }}
    >
      <style>{`
        @keyframes ce-logo-in {
          0% { opacity: 0; transform: scale(0.6) translateY(14px); }
          55% { opacity: 1; transform: scale(1.06) translateY(0); }
          100% { opacity: 1; transform: scale(1) translateY(0); }
        }
        @keyframes ce-breathe {
          0%, 100% { box-shadow: 0 0 0 3px hsla(${brand}, 0.55), 0 0 60px -4px hsla(${brand}, 0.6); }
          50% { box-shadow: 0 0 0 3px hsla(${brand}, 0.95), 0 0 100px 0px hsla(${brand}, 0.8); }
        }
        @keyframes ce-halo-spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        @keyframes ce-rise {
          0% { opacity: 0; transform: translateY(10px); }
          100% { opacity: 1; transform: translateY(0); }
        }
        @keyframes ce-bar {
          0% { width: 0%; }
          18% { width: 31%; }
          46% { width: 58%; }
          74% { width: 82%; }
          100% { width: 100%; }
        }
        @keyframes ce-dots {
          0% { content: ""; }
          25% { content: "."; }
          50% { content: ".."; }
          75%, 100% { content: "..."; }
        }
        .ce-dots::after {
          display: inline-block;
          width: 1.2em;
          text-align: left;
          content: "...";
          animation: ce-dots 1.4s steps(1, end) infinite;
        }
      `}</style>

      {/* Glow de marca de fondo */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: `radial-gradient(ellipse 60% 46% at 50% 40%, hsla(${brand}, 0.22), transparent 70%)`,
        }}
      />

      <div className="relative flex flex-col items-center px-6 text-center">
        {/* Halo giratorio alrededor del logo */}
        <div className="relative">
          <div
            className="absolute -inset-4 rounded-full pointer-events-none"
            style={{
              background: `conic-gradient(from 0deg, transparent 0deg, transparent 260deg, hsla(${brand}, 0.9) 320deg, transparent 360deg)`,
              WebkitMask: "radial-gradient(farthest-side, transparent calc(100% - 3px), black calc(100% - 2px))",
              mask: "radial-gradient(farthest-side, transparent calc(100% - 3px), black calc(100% - 2px))",
              animation: "ce-halo-spin 1.6s linear infinite",
            }}
          />
          {/* Logo del consultorio */}
          <div
            className="h-28 w-28 rounded-[28px] overflow-hidden flex items-center justify-center"
            style={{
              backgroundColor: "hsl(180 12% 9%)",
              animation: `ce-logo-in 750ms cubic-bezier(0.22, 1, 0.36, 1) both, ce-breathe 2.2s ease-in-out 750ms infinite`,
            }}
          >
            {brandInfo.logoUrl ? (
              <img src={brandInfo.logoUrl} alt="" className="h-full w-full object-cover" />
            ) : (
              <span className="text-4xl font-bold" style={{ color: `hsl(${brand})` }}>
                {initials || "CD"}
              </span>
            )}
          </div>
        </div>

        {/* Nombre del consultorio */}
        <p
          className="mt-8 text-3xl font-bold tracking-tight text-white"
          style={{ animation: "ce-rise 650ms ease 400ms both" }}
        >
          {name}
        </p>

        <p
          className="ce-dots mt-2.5 text-[15px] text-white/55"
          style={{ animation: "ce-rise 650ms ease 600ms both" }}
        >
          Preparando tu consultorio
        </p>

        {/* Barra de progreso de marca */}
        <div
          className="mt-8 h-2 w-64 rounded-full overflow-hidden"
          style={{
            backgroundColor: "hsla(0, 0%, 100%, 0.08)",
            animation: "ce-rise 650ms ease 750ms both",
          }}
        >
          <div
            className="h-full rounded-full"
            style={{
              background: `linear-gradient(90deg, hsla(${brand}, 0.6), hsl(${brand}))`,
              boxShadow: `0 0 18px hsla(${brand}, 0.8)`,
              animation: `ce-bar ${SHOW_MS + 300}ms cubic-bezier(0.35, 0.1, 0.25, 1) both`,
            }}
          />
        </div>
      </div>
    </div>
  );
}
