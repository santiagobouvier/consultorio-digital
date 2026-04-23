import { useState } from "react";
import { Info, ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { HELP_CONTENT, type HelpId } from "@/data/help-content";

interface HelpTooltipProps {
  id: HelpId;
  className?: string;
  /** Tamaño del ícono. Por defecto sm (h-3.5). */
  size?: "sm" | "md";
  /** Etiqueta accesible alternativa (sino se usa el title del contenido). */
  ariaLabel?: string;
  /** Lado preferido del popover (default: top). */
  side?: "top" | "right" | "bottom" | "left";
}

/**
 * Ícono ⓘ discreto que abre un Popover con ayuda contextual.
 *
 * - El ícono está en `text-muted-foreground/60` y pasa a `text-primary` al hover.
 * - El popover muestra título en bold + descripción en muted, máx ~3 líneas.
 * - Si el HelpEntry trae `learnMoreUrl`, se renderiza un link "Ver más".
 * - Accesible: trigger es <button>, se cierra con Escape, posicionado con
 *   Radix Portal + collisionPadding para que quede dentro del viewport en mobile.
 */
export const HelpTooltip = ({
  id,
  className,
  size = "sm",
  ariaLabel,
  side = "top",
}: HelpTooltipProps) => {
  const [open, setOpen] = useState(false);
  const entry = HELP_CONTENT[id];

  if (!entry) {
    if (import.meta.env.DEV) {
      console.warn(`[HelpTooltip] No existe contenido de ayuda para id="${id}"`);
    }
    return null;
  }

  const iconClass = size === "md" ? "h-[18px] w-[18px]" : "h-3.5 w-3.5";
  const buttonSize = size === "md" ? "h-6 w-6" : "h-5 w-5";

  const isExternal = entry.learnMoreUrl?.startsWith("http");

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={ariaLabel ?? `Ayuda: ${entry.title}`}
          onClick={(e) => e.stopPropagation()}
          className={cn(
            "group inline-flex items-center justify-center rounded-full",
            "text-muted-foreground/60 hover:text-primary hover:bg-primary/10",
            "transition-colors duration-150",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:text-primary",
            buttonSize,
            "shrink-0 align-middle",
            open && "text-primary bg-primary/10",
            className,
          )}
        >
          <Info className={iconClass} aria-hidden="true" strokeWidth={2.25} />
        </button>
      </PopoverTrigger>
      <PopoverContent
        side={side}
        align="center"
        sideOffset={8}
        collisionPadding={12}
        onClick={(e) => e.stopPropagation()}
        className={cn(
          "w-[min(20rem,calc(100vw-1.5rem))] p-0 overflow-hidden",
          "border-border/60 shadow-lg rounded-xl",
        )}
      >
        <div className="p-3.5 space-y-1.5">
          <p className="font-semibold text-foreground text-sm leading-snug">
            {entry.title}
          </p>
          <p className="text-muted-foreground text-[13px] leading-relaxed">
            {entry.body}
          </p>
        </div>
        {entry.learnMoreUrl && (
          <div className="border-t border-border/50 px-3.5 py-2 bg-muted/30">
            {isExternal ? (
              <a
                href={entry.learnMoreUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
              >
                {entry.learnMoreLabel ?? "Ver más"}
                <ArrowRight className="h-3 w-3" />
              </a>
            ) : (
              <Link
                to={entry.learnMoreUrl}
                onClick={() => setOpen(false)}
                className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
              >
                {entry.learnMoreLabel ?? "Ver más"}
                <ArrowRight className="h-3 w-3" />
              </Link>
            )}
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
};

export default HelpTooltip;