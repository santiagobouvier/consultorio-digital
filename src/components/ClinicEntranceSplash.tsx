import { useEffect, useState } from "react";
import { useDashboardBranding } from "@/contexts/DashboardBrandingContext";

const FLAG_KEY = "clinic_entrance_pending";
const SHOW_MS = 2500; // cuánto se luce la entrada
const FADE_MS = 550; // fundido de salida

/**
 * Bienvenida con marca al entrar al panel tras iniciar sesión: el logo del
 * consultorio con su color, "Preparando tu consultorio..." y una barra de
 * progreso elegante. Se muestra UNA vez por login (flag en sessionStorage
 * que setea Auth al redirigir al dashboard).
 */
export function ClinicEntranceSplash() {
  const { logoUrl, displayName, primaryColor } = useDashboardBranding();
  const [phase, setPhase] = useState<"show" | "fade" | "done">(() => {
    try {
      return sessionStorage.getItem(FLAG_KEY) === "1" ? "show" : "done";
    } catch {
      return "done";
    }
  });

  useEffect(() => {
    if (phase !== "show") return;
    try { sessionStorage.removeItem(FLAG_KEY); } catch {}
    const t1 = window.setTimeout(() => setPhase("fade"), SHOW_MS);
    const t2 = window.setTimeout(() => setPhase("done"), SHOW_MS + FADE_MS);
    return () => {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  if (phase === "done") return null;

  const brand = primaryColor || "176 100% 32%";
  const name = displayName || "Tu consultorio";
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
      className="fixed inset-0 z-[150] flex items-center justify-center"
      style={{
        backgroundColor: "hsl(180 12% 16%)",
        opacity: phase === "fade" ? 0 : 1,
        transition: `opacity ${FADE_MS}ms ease`,
        pointerEvents: phase === "fade" ? "none" : "auto",
      }}
    >
      <style>{`
        @keyframes ce-logo-in {
          0% { opacity: 0; transform: scale(0.72) translateY(10px); }
          55% { opacity: 1; transform: scale(1.04) translateY(0); }
          100% { opacity: 1; transform: scale(1) translateY(0); }
        }
        @keyframes ce-breathe {
          0%, 100% { box-shadow: 0 0 0 2px hsla(${brand}, 0.55), 0 0 46px -6px hsla(${brand}, 0.55); }
          50% { box-shadow: 0 0 0 2px hsla(${brand}, 0.85), 0 0 70px -4px hsla(${brand}, 0.75); }
        }
        @keyframes ce-rise {
          0% { opacity: 0; transform: translateY(8px); }
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
          background: `radial-gradient(ellipse 55% 42% at 50% 42%, hsla(${brand}, 0.16), transparent 70%)`,
        }}
      />

      <div className="relative flex flex-col items-center px-6 text-center">
        {/* Logo del consultorio */}
        <div
          className="h-24 w-24 rounded-3xl overflow-hidden flex items-center justify-center"
          style={{
            backgroundColor: "hsl(180 12% 10%)",
            animation: `ce-logo-in 700ms cubic-bezier(0.22, 1, 0.36, 1) both, ce-breathe 2.2s ease-in-out 700ms infinite`,
          }}
        >
          {logoUrl ? (
            <img src={logoUrl} alt="" className="h-full w-full object-cover" />
          ) : (
            <span className="text-3xl font-bold" style={{ color: `hsl(${brand})` }}>
              {initials || "CD"}
            </span>
          )}
        </div>

        {/* Nombre del consultorio */}
        <p
          className="mt-6 text-2xl font-bold tracking-tight text-white"
          style={{ animation: "ce-rise 600ms ease 350ms both" }}
        >
          {name}
        </p>

        <p
          className="ce-dots mt-2 text-sm text-white/50"
          style={{ animation: "ce-rise 600ms ease 550ms both" }}
        >
          Preparando tu consultorio
        </p>

        {/* Barra de progreso de marca */}
        <div
          className="mt-7 h-1.5 w-56 rounded-full overflow-hidden"
          style={{
            backgroundColor: "hsla(0, 0%, 100%, 0.08)",
            animation: "ce-rise 600ms ease 700ms both",
          }}
        >
          <div
            className="h-full rounded-full"
            style={{
              background: `linear-gradient(90deg, hsla(${brand}, 0.65), hsl(${brand}))`,
              boxShadow: `0 0 14px hsla(${brand}, 0.7)`,
              animation: `ce-bar ${SHOW_MS + 300}ms cubic-bezier(0.35, 0.1, 0.25, 1) both`,
            }}
          />
        </div>
      </div>
    </div>
  );
}
