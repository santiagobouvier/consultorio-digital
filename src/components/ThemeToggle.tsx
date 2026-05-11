import { Moon, Sun } from "lucide-react";
import { useTheme } from "@/contexts/ThemeContext";
import { cn } from "@/lib/utils";

type Variant = "dark-surface" | "ghost";

interface ThemeToggleProps {
  className?: string;
  variant?: Variant;
}

/**
 * Elegant sun/moon toggle. Two visual variants:
 * - "dark-surface": for dark sidebars/headers (white-on-dark, glass surface).
 * - "ghost": adapts to current theme tokens (for light cards/sections).
 */
export function ThemeToggle({ className, variant = "dark-surface" }: ThemeToggleProps) {
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === "dark";

  const base =
    "relative h-9 w-9 rounded-xl flex items-center justify-center transition-all duration-300 active:scale-90 overflow-hidden";

  const variantClasses =
    variant === "dark-surface"
      ? "bg-white/[0.06] border border-white/[0.08] hover:bg-white/[0.1] text-white/85"
      : "bg-muted/50 border border-border hover:bg-muted text-foreground";

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={isDark ? "Activar modo claro" : "Activar modo oscuro"}
      title={isDark ? "Modo claro" : "Modo oscuro"}
      className={cn(base, variantClasses, className)}
    >
      <Sun
        className={cn(
          "h-[16px] w-[16px] absolute transition-all duration-300",
          isDark ? "opacity-0 rotate-90 scale-50" : "opacity-100 rotate-0 scale-100",
        )}
        strokeWidth={2.2}
      />
      <Moon
        className={cn(
          "h-[16px] w-[16px] absolute transition-all duration-300",
          isDark ? "opacity-100 rotate-0 scale-100" : "opacity-0 -rotate-90 scale-50",
        )}
        strokeWidth={2.2}
      />
    </button>
  );
}