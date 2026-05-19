import { IPhoneFrame, Finger } from "./iphone-frame";

/**
 * Paso 3: pantalla "Agregar a inicio" con el botón Agregar arriba derecha.
 */
export const IOSConfirmStep = () => (
  <div className="relative w-full max-w-[180px] mx-auto aspect-[200/360]">
    <style>{`
      @keyframes ios-tap-confirm {
        0%   { opacity: 0; transform: translate(80px, 200px); }
        15%  { opacity: 1; transform: translate(80px, 200px); }
        50%  { opacity: 1; transform: translate(155px, 60px); }
        60%  { opacity: 1; transform: translate(155px, 60px) scale(0.82); }
        70%  { opacity: 1; transform: translate(155px, 60px) scale(1); }
        90%  { opacity: 1; transform: translate(155px, 60px); }
        100% { opacity: 0; transform: translate(155px, 60px); }
      }
      .ios-confirm-finger { animation: ios-tap-confirm 3.4s ease-in-out infinite; }
      @media (prefers-reduced-motion: reduce) {
        .ios-confirm-finger { animation: none; transform: translate(155px, 60px); opacity: 1; }
      }
      @keyframes ios-confirm-pulse {
        0%, 100% { opacity: 0.0; }
        45%, 75% { opacity: 1; }
      }
      .ios-confirm-pulse { animation: ios-confirm-pulse 3.4s ease-in-out infinite; }
      @media (prefers-reduced-motion: reduce) { .ios-confirm-pulse { animation: none; opacity: 1; } }
    `}</style>
    <IPhoneFrame>
      {/* Top bar with Cancel + title + Add */}
      <rect x="28" y="48" width="144" height="28" fill="hsl(var(--muted) / 0.4)" />
      <text x="40" y="66" fontSize="9" fill="hsl(var(--muted-foreground))" fontFamily="system-ui">
        Cancelar
      </text>
      <text x="100" y="66" textAnchor="middle" fontSize="9" fontWeight="600" fill="hsl(var(--foreground))" fontFamily="system-ui">
        Agregar
      </text>
      {/* Add (target) — highlighted background */}
      <rect x="138" y="54" width="28" height="16" rx="4" fill="hsl(var(--primary))" className="ios-confirm-pulse" />
      <text x="152" y="66" textAnchor="middle" fontSize="9" fontWeight="700" fill="hsl(var(--primary-foreground))" fontFamily="system-ui">
        Agregar
      </text>

      {/* App preview card */}
      <rect x="44" y="100" width="112" height="60" rx="10" fill="hsl(var(--card))" stroke="hsl(var(--border))" />
      <rect x="56" y="112" width="28" height="36" rx="7" fill="hsl(var(--primary) / 0.15)" />
      <circle cx="70" cy="130" r="6" fill="hsl(var(--primary))" />
      <rect x="92" y="116" width="56" height="6" rx="2" fill="hsl(var(--foreground) / 0.8)" />
      <rect x="92" y="128" width="44" height="5" rx="2" fill="hsl(var(--muted-foreground))" />
      <rect x="92" y="140" width="36" height="4" rx="2" fill="hsl(var(--muted))" />

      {/* Name input */}
      <rect x="44" y="180" width="112" height="22" rx="6" fill="hsl(var(--muted))" />
      <rect x="52" y="188" width="50" height="6" rx="2" fill="hsl(var(--foreground) / 0.7)" />

      {/* URL input */}
      <rect x="44" y="212" width="112" height="22" rx="6" fill="hsl(var(--muted) / 0.6)" />
      <rect x="52" y="220" width="80" height="5" rx="2" fill="hsl(var(--muted-foreground))" />

      <text x="100" y="270" textAnchor="middle" fontSize="7" fill="hsl(var(--muted-foreground))" fontFamily="system-ui">
        Aparecerá en tu pantalla
      </text>
      <text x="100" y="282" textAnchor="middle" fontSize="7" fill="hsl(var(--muted-foreground))" fontFamily="system-ui">
        de inicio como una app.
      </text>

      <Finger className="ios-confirm-finger" />
    </IPhoneFrame>
  </div>
);