import { IPhoneFrame, Finger } from "./iphone-frame";

/**
 * Paso 2: menú compartir abierto. Dedo tappea "Agregar a pantalla de inicio".
 * Target row aprox y=235.
 */
export const IOSAddToHomeStep = () => (
  <div className="relative w-full max-w-[180px] mx-auto aspect-[200/360]">
    <style>{`
      @keyframes ios-tap-add {
        0%   { opacity: 0; transform: translate(150px, 150px); }
        15%  { opacity: 1; transform: translate(150px, 150px); }
        50%  { opacity: 1; transform: translate(150px, 235px); }
        60%  { opacity: 1; transform: translate(150px, 235px) scale(0.82); }
        70%  { opacity: 1; transform: translate(150px, 235px) scale(1); }
        90%  { opacity: 1; transform: translate(150px, 235px); }
        100% { opacity: 0; transform: translate(150px, 235px); }
      }
      .ios-add-finger { animation: ios-tap-add 3.4s ease-in-out infinite; }
      @media (prefers-reduced-motion: reduce) {
        .ios-add-finger { animation: none; transform: translate(150px, 235px); opacity: 1; }
      }
      @keyframes ios-add-highlight {
        0%, 100% { opacity: 0; }
        45%, 75% { opacity: 1; }
      }
      .ios-add-highlight { animation: ios-add-highlight 3.4s ease-in-out infinite; }
      @media (prefers-reduced-motion: reduce) { .ios-add-highlight { animation: none; opacity: 1; } }
    `}</style>
    <IPhoneFrame>
      {/* dimmed app behind */}
      <rect x="28" y="22" width="144" height="316" fill="hsl(var(--foreground) / 0.15)" />

      {/* Share sheet panel */}
      <rect x="36" y="80" width="128" height="240" rx="14" fill="hsl(var(--card))" stroke="hsl(var(--border))" strokeWidth="1" />

      {/* Top preview row (page being shared) */}
      <rect x="44" y="90" width="40" height="30" rx="5" fill="hsl(var(--muted))" />
      <rect x="90" y="95" width="50" height="6" rx="2" fill="hsl(var(--muted-foreground) / 0.6)" />
      <rect x="90" y="107" width="35" height="5" rx="2" fill="hsl(var(--muted))" />

      {/* App row icons */}
      <g>
        {[0, 1, 2, 3].map((i) => (
          <rect key={i} x={44 + i * 30} y="130" width="22" height="22" rx="5" fill="hsl(var(--muted))" />
        ))}
      </g>

      {/* Action list rows */}
      <line x1="44" y1="170" x2="156" y2="170" stroke="hsl(var(--border))" strokeWidth="0.5" />
      <rect x="44" y="180" width="80" height="6" rx="2" fill="hsl(var(--muted-foreground) / 0.4)" />
      <rect x="140" y="178" width="12" height="10" rx="2" fill="hsl(var(--muted))" />

      <line x1="44" y1="200" x2="156" y2="200" stroke="hsl(var(--border))" strokeWidth="0.5" />
      <rect x="44" y="210" width="70" height="6" rx="2" fill="hsl(var(--muted-foreground) / 0.4)" />
      <rect x="140" y="208" width="12" height="10" rx="2" fill="hsl(var(--muted))" />

      {/* TARGET: Agregar a pantalla de inicio */}
      <line x1="44" y1="225" x2="156" y2="225" stroke="hsl(var(--border))" strokeWidth="0.5" />
      <rect
        x="40"
        y="227"
        width="120"
        height="20"
        rx="4"
        fill="hsl(var(--primary) / 0.18)"
        className="ios-add-highlight"
      />
      <rect x="44" y="232" width="92" height="6" rx="2" fill="hsl(var(--primary))" />
      <rect x="44" y="242" width="40" height="4" rx="2" fill="hsl(var(--primary) / 0.6)" />
      {/* plus icon */}
      <g stroke="hsl(var(--primary))" strokeWidth="1.6" fill="none" strokeLinecap="round">
        <rect x="138" y="231" width="14" height="14" rx="3" />
        <path d="M 145 234 L 145 242 M 141 238 L 149 238" />
      </g>

      <line x1="44" y1="260" x2="156" y2="260" stroke="hsl(var(--border))" strokeWidth="0.5" />
      <rect x="44" y="270" width="65" height="6" rx="2" fill="hsl(var(--muted-foreground) / 0.4)" />

      <line x1="44" y1="290" x2="156" y2="290" stroke="hsl(var(--border))" strokeWidth="0.5" />
      <rect x="44" y="300" width="55" height="6" rx="2" fill="hsl(var(--muted-foreground) / 0.4)" />

      <Finger className="ios-add-finger" />
    </IPhoneFrame>
  </div>
);