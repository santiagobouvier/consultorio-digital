/**
 * Ilustración para desktop Safari: barra de menú con "Archivo" abierto
 * mostrando "Añadir al Dock".
 */
export const SafariMenuStep = () => (
  <div className="relative w-full max-w-[320px] mx-auto">
    <style>{`
      @keyframes safari-tap {
        0%   { opacity: 0; transform: translate(80px, 25px); }
        15%  { opacity: 1; transform: translate(80px, 25px); }
        50%  { opacity: 1; transform: translate(75px, 95px); }
        60%  { opacity: 1; transform: translate(75px, 95px) scale(0.85); }
        70%  { opacity: 1; transform: translate(75px, 95px) scale(1); }
        90%  { opacity: 1; transform: translate(75px, 95px); }
        100% { opacity: 0; transform: translate(75px, 95px); }
      }
      .safari-finger { animation: safari-tap 3.4s ease-in-out infinite; }
      @media (prefers-reduced-motion: reduce) {
        .safari-finger { animation: none; transform: translate(75px, 95px); opacity: 1; }
      }
      @keyframes safari-highlight {
        0%, 100% { opacity: 0; }
        45%, 75% { opacity: 1; }
      }
      .safari-highlight { animation: safari-highlight 3.4s ease-in-out infinite; }
      @media (prefers-reduced-motion: reduce) { .safari-highlight { animation: none; opacity: 1; } }
    `}</style>
    <svg viewBox="0 0 320 180" xmlns="http://www.w3.org/2000/svg" role="img" aria-hidden="true" className="w-full">
      {/* Mac menu bar */}
      <rect x="0" y="0" width="320" height="22" fill="hsl(var(--card))" stroke="hsl(var(--border))" strokeWidth="1" />
      {/* Apple logo */}
      <circle cx="14" cy="11" r="4" fill="hsl(var(--foreground))" />
      <text x="30" y="15" fontSize="9" fontWeight="700" fill="hsl(var(--foreground))" fontFamily="system-ui">Safari</text>
      <rect x="68" y="6" width="32" height="14" rx="3" fill="hsl(var(--primary) / 0.18)" />
      <text x="84" y="15" textAnchor="middle" fontSize="9" fontWeight="600" fill="hsl(var(--primary))" fontFamily="system-ui">Archivo</text>
      <text x="118" y="15" fontSize="9" fill="hsl(var(--foreground))" fontFamily="system-ui">Edición</text>
      <text x="160" y="15" fontSize="9" fill="hsl(var(--foreground))" fontFamily="system-ui">Visualización</text>
      <text x="220" y="15" fontSize="9" fill="hsl(var(--foreground))" fontFamily="system-ui">Historial</text>

      {/* Dropdown menu (Archivo abierto) */}
      <rect x="68" y="24" width="160" height="120" rx="6" fill="hsl(var(--card))" stroke="hsl(var(--border))" strokeWidth="1" />
      <rect x="72" y="30" width="100" height="6" rx="2" fill="hsl(var(--muted-foreground) / 0.5)" />
      <rect x="72" y="46" width="80" height="6" rx="2" fill="hsl(var(--muted-foreground) / 0.5)" />
      <line x1="72" y1="62" x2="224" y2="62" stroke="hsl(var(--border))" />
      <rect x="72" y="70" width="70" height="6" rx="2" fill="hsl(var(--muted-foreground) / 0.5)" />
      <rect x="72" y="86" width="90" height="6" rx="2" fill="hsl(var(--muted-foreground) / 0.5)" />

      {/* TARGET: Añadir al Dock */}
      <rect x="70" y="100" width="156" height="20" rx="3" className="safari-highlight" fill="hsl(var(--primary) / 0.18)" />
      <rect x="80" y="108" width="100" height="6" rx="2" fill="hsl(var(--primary))" />
      <g stroke="hsl(var(--primary))" strokeWidth="1.5" fill="none" strokeLinecap="round">
        <path d="M 200 110 L 200 116 M 196 113 L 204 113" />
      </g>

      <line x1="72" y1="128" x2="224" y2="128" stroke="hsl(var(--border))" />
      <rect x="72" y="134" width="60" height="6" rx="2" fill="hsl(var(--muted-foreground) / 0.5)" />

      {/* finger */}
      <g className="safari-finger">
        <circle r="12" fill="hsl(var(--primary))" fillOpacity="0.25" />
        <circle r="8" fill="hsl(var(--primary))" fillOpacity="0.85" />
      </g>
    </svg>
  </div>
);