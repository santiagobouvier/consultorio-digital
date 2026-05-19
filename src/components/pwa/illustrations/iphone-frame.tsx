import type { ReactNode } from "react";

/**
 * Reusable iPhone frame for tutorial illustrations.
 * viewBox 0 0 200 360 (mantiene proporción cercana a iPhone moderno).
 */
export const IPhoneFrame = ({ children }: { children: ReactNode }) => (
  <svg
    viewBox="0 0 200 360"
    xmlns="http://www.w3.org/2000/svg"
    role="img"
    aria-hidden="true"
    className="w-full h-full"
  >
    {/* outer body */}
    <rect
      x="20"
      y="10"
      width="160"
      height="340"
      rx="26"
      ry="26"
      fill="hsl(var(--card))"
      stroke="hsl(var(--border))"
      strokeWidth="1.5"
    />
    {/* screen */}
    <rect
      x="28"
      y="22"
      width="144"
      height="316"
      rx="18"
      ry="18"
      fill="hsl(var(--background))"
    />
    {/* dynamic island */}
    <rect x="80" y="28" width="40" height="8" rx="4" fill="hsl(var(--foreground) / 0.35)" />
    {children}
  </svg>
);

/** Animated finger circle. Position is controlled by CSS keyframes via className. */
export const Finger = ({ className }: { className: string }) => (
  <g className={className}>
    <circle r="14" fill="hsl(var(--primary))" fillOpacity="0.25" />
    <circle r="9" fill="hsl(var(--primary))" fillOpacity="0.85" />
    <circle r="9" fill="none" stroke="hsl(var(--primary-foreground))" strokeWidth="1" strokeOpacity="0.4" />
  </g>
);