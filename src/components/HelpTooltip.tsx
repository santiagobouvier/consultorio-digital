import { useState } from "react";
import { Info } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { HELP_CONTENT, type HelpId } from "@/data/help-content";

interface HelpTooltipProps {
  id: HelpId;
  className?: string;
  /** Tamaño del ícono. Por defecto h-4 w-4. */
  size?: "sm" | "md";
  /** Etiqueta accesible alternativa (sino se usa el title del contenido). */
  ariaLabel?: string;
}

/**
 * Ícono ⓘ discreto que abre un Popover con texto de ayuda contextual.
 *
 * El contenido se busca en `HELP_CONTENT` por id. Es totalmente accesible:
 * el trigger es un <button>, se abre con click y se cierra con Escape.
 * El popover se posiciona automáticamente y queda dentro del viewport
 * en mobile gracias a Radix Portal + collisionPadding.
 */
export const HelpTooltip = ({
  id,
  className,
  size = "sm",
  ariaLabel,
}: HelpTooltipProps) => {
  const [open, setOpen] = useState(false);
  const entry = HELP_CONTENT[id];

  if (!entry) {
    if (import.meta.env.DEV) {
      console.warn(`[HelpTooltip] No existe contenido de ayuda para id="${id}"`);
    }
    return null;
  }

  const iconClass = size === "md" ? "h-[18px] w-[18px]" : "h-4 w-4";

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={ariaLabel ?? `Ayuda: ${entry.title}`}
          className={cn(
            "inline-flex items-center justify-center rounded-full text-muted-foreground/70",
            "hover:text-foreground hover:bg-muted transition-colors",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
            "h-6 w-6 shrink-0 align-middle",
            className,
          )}
        >
          <Info className={iconClass} aria-hidden="true" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        side="top"
        align="center"
        sideOffset={6}
        collisionPadding={12}
        className="w-[min(20rem,calc(100vw-1.5rem))] p-4 text-sm"
      >
        <p className="font-semibold text-foreground mb-1">{entry.title}</p>
        <p className="text-muted-foreground leading-relaxed">{entry.body}</p>
      </PopoverContent>
    </Popover>
  );
};

export default HelpTooltip;