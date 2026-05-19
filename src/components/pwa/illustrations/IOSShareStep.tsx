import { IPhoneFrame, Finger } from "./iphone-frame";

/**
 * Paso 1: dedo tappea el botón Compartir en la barra inferior de Safari.
 * El share button se ubica aprox en x=100, y=315.
 */
export const IOSShareStep = () => (
  <div className="relative w-full max-w-[180px] mx-auto aspect-[200/360]">
    <style>{`
      @keyframes ios-tap-share {
        0%   { opacity: 0; transform: translate(140px, 250px) scale(1); }
        15%  { opacity: 1; transform: translate(140px, 250px) scale(1); }
        45%  { opacity: 1; transform: translate(100px, 315px) scale(1); }
        55%  { opacity: 1; transform: translate(100px, 315px) scale(0.82); }
        65%  { opacity: 1; transform: translate(100px, 315px) scale(1); }
        85%  { opacity: 1; transform: translate(100px, 315px) scale(1); }
        100% { opacity: 0; transform: translate(100px, 315px) scale(1); }
      }
      .ios-share-finger { animation: ios-tap-share 3.2s ease-in-out infinite; }
      @media (prefers-reduced-motion: reduce) {
        .ios-share-finger { animation: none; transform: translate(100px, 315px); opacity: 1; }
      }
      @keyframes ios-share-pulse {
        0%, 100% { opacity: 0.2; r: 14; }
        50%      { opacity: 0; r: 22; }
      }
      .ios-share-pulse { animation: ios-share-pulse 3.2s ease-out infinite; animation-delay: 1.3s; transform-origin: center; }
      @media (prefers-reduced-motion: reduce) { .ios-share-pulse { animation: none; opacity: 0; } }
    `}</style>
    <IPhoneFrame>
      {/* URL bar */}
      <rect x="40" y="46" width="120" height="20" rx="6" fill="hsl(var(--muted))" />
      <text x="100" y="60" textAnchor="middle" fontSize="9" fill="hsl(var(--muted-foreground))" fontFamily="system-ui">
        consultorio
      </text>

      {/* fake page content */}
      <rect x="40" y="80" width="120" height="60" rx="6" fill="hsl(var(--muted) / 0.6)" />
      <rect x="40" y="148" width="80" height="6" rx="3" fill="hsl(var(--muted))" />
      <rect x="40" y="160" width="100" height="6" rx="3" fill="hsl(var(--muted))" />
      <rect x="40" y="172" width="60" height="6" rx="3" fill="hsl(var(--muted))" />
      <rect x="40" y="195" width="120" height="40" rx="8" fill="hsl(var(--primary) / 0.12)" />

      {/* Bottom Safari toolbar */}
      <rect x="28" y="300" width="144" height="32" fill="hsl(var(--muted) / 0.4)" />

      {/* Toolbar icons */}
      <g stroke="hsl(var(--muted-foreground))" strokeWidth="1.4" fill="none">
        {/* back arrow */}
        <path d="M 50 316 L 44 316 M 44 316 L 47 313 M 44 316 L 47 319" />
        {/* forward arrow */}
        <path d="M 70 316 L 76 316 M 76 316 L 73 313 M 76 316 L 73 319" />
        {/* tabs icon */}
        <rect x="146" y="311" width="9" height="9" rx="1.5" />
        <rect x="143" y="314" width="9" height="9" rx="1.5" />
      </g>

      {/* SHARE button (target) — highlighted */}
      <g>
        <circle cx="100" cy="315" r="14" className="ios-share-pulse" fill="hsl(var(--primary))" />
        <rect x="93" y="310" width="14" height="14" rx="2" fill="none" stroke="hsl(var(--primary))" strokeWidth="1.6" />
        <path d="M 100 313 L 100 320 M 96 316 L 100 312 L 104 316" stroke="hsl(var(--primary))" strokeWidth="1.6" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      </g>

      <Finger className="ios-share-finger" />
    </IPhoneFrame>
  </div>
);